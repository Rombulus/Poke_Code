const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { createStorageService, defaultDirectory, validateState, fingerprint, atomicJson, lock, parse } = require('./store.cjs');

function runGh(args, body) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')
      ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh';
    const child = execFile(executable, args, {
      windowsHide: true, timeout: 20000, maxBuffer: 12 * 1024 * 1024,
      env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_HOST: 'github.com' }
    }, (error, stdout, stderr) => {
      if (!error) { try { resolve(stdout.trim() ? JSON.parse(stdout) : null); } catch { resolve(stdout.trim()); } return; }
      const status = Number((stderr.match(/HTTP (\d{3})/) || [])[1]);
      const message = status === 404 ? 'Dépôt ou fichier GitHub introuvable.'
        : status === 409 || status === 422 ? 'La version GitHub a changé. Synchronise de nouveau.'
        : status === 401 || status === 403 ? 'Accès GitHub refusé. Vérifie la connexion et les droits du dépôt.'
        : error.code === 'ENOENT' || /auth login|GH_TOKEN/.test(stderr) ? 'Connecte GitHub CLI avec gh auth login.'
        : 'GitHub est indisponible. Ta partie reste enregistrée sur ce PC.';
      reject(Object.assign(new Error(message), { status, code: error.code }));
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
function createGitHubSync(options = {}) {
  const store = options.store || createStorageService(options.dataDir || defaultDirectory());
  const configFile = path.join(store.dataDir, 'github.json');
  const checkpointFile = path.join(store.dataDir, 'github-checkpoint.json');
  const reportFile = path.join(store.dataDir, 'github-status.json');
  const command = options.runGh || runGh;
  const report = (value) => { atomicJson(reportFile, value); return value; };
  function status() {
    const config = fs.existsSync(configFile) ? parse(configFile) : null;
    const last = fs.existsSync(reportFile) ? parse(reportFile) : {};
    if (config && ['success', 'ready', 'pending'].includes(last.state)) {
      const checkpoint = fs.existsSync(checkpointFile) ? parse(checkpointFile) : {};
      if (fingerprint(store.state()) !== (checkpoint.hash || null)) {
        last.state = 'pending'; last.message = 'Modifications locales à envoyer sur GitHub';
      }
    }
    return { ...last, configured: Boolean(config), repository: config?.repository || null,
      branch: config?.branch || null, publicSaveApproved: config?.publicSaveApproved === true,
      localFile: store.filePath, conflictsDirectory: path.join(store.dataDir, 'conflicts') };
  }
  async function configure(repository, create = false, branch, allowPublic = false) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository) || repository.split('/')[1] === '..') {
      throw new Error('Indique le dépôt sous la forme compte/depot.');
    }
    const release = lock(store.dataDir, 'github');
    try {
      let metadata;
      try { metadata = await command(['api', '--hostname', 'github.com', `repos/${repository}`]); }
      catch (error) {
        if (!create || error.status !== 404) throw error;
        await command(['repo', 'create', repository, '--private', '--description', 'Sauvegarde personnelle PokeIdle']);
        metadata = await command(['api', '--hostname', 'github.com', `repos/${repository}`]);
      }
      if (!metadata.private && !allowPublic) throw new Error('Ce dépôt est public. Confirme explicitement que ta sauvegarde peut être publique.');
      branch = branch || metadata.default_branch;
      if (!/^[A-Za-z0-9][A-Za-z0-9_/-]{0,99}$/.test(branch) || branch.includes('//') || branch.endsWith('/')) throw new Error('Nom de branche invalide.');
      if (!(metadata.size === 0 && branch === metadata.default_branch)) {
        try { await command(['api', '--hostname', 'github.com', `repos/${metadata.full_name}/git/ref/heads/${branch}`]); }
        catch (error) {
          if (error.status !== 404) throw error;
          const base = await command(['api', '--hostname', 'github.com', `repos/${metadata.full_name}/git/ref/heads/${metadata.default_branch}`]);
          await command(['api', '--hostname', 'github.com', '--method', 'POST', `repos/${metadata.full_name}/git/refs`, '--input', '-'], { ref: `refs/heads/${branch}`, sha: base.object.sha });
        }
      }
      const config = { repository: metadata.full_name, branch, file: 'poke-idle-save.json', publicSaveApproved: !metadata.private && allowPublic };
      const previous = fs.existsSync(configFile) ? parse(configFile) : null;
      atomicJson(configFile, config);
      if (previous?.repository !== config.repository || previous?.branch !== config.branch) atomicJson(checkpointFile, { repository: config.repository, branch, sha: null, hash: null });
      report({ state: 'ready', message: 'Dépôt configuré. Synchronise pour charger ou envoyer ta partie.' });
      return status();
    } finally { release(); }
  }
  async function synchronize(action = 'sync') {
    if (!['sync', 'push', 'pull', 'keep-local', 'keep-github'].includes(action)) throw new Error('Action de sauvegarde inconnue.');
    if (!fs.existsSync(configFile)) return { ...status(), state: 'unconfigured', message: 'Configure ton dépôt GitHub pour activer la synchronisation.' };
    const release = lock(store.dataDir, 'github');
    try {
      const config = parse(configFile);
      const metadata = await command(['api', '--hostname', 'github.com', `repos/${config.repository}`]);
      if (!metadata.private && !config.publicSaveApproved) throw new Error('Le dépôt est devenu public. Confirme cette visibilité dans les paramètres avant de synchroniser.');
      const endpoint = `repos/${config.repository}/contents/${config.file}`;
      const checkpoint = fs.existsSync(checkpointFile) ? parse(checkpointFile) : {};
      const base = checkpoint.repository === config.repository && checkpoint.branch === config.branch ? checkpoint : {};
      const localDocument = store.read();
      const local = store.state(localDocument);
      const localHash = fingerprint(local);
      let remote = null;
      let sha = null;
      try {
        const file = await command(['api', '--hostname', 'github.com', `${endpoint}?ref=${encodeURIComponent(config.branch)}`]);
        if (file.type !== 'file' || typeof file.sha !== 'string' || file.size > 5 * 1024 * 1024) throw new Error('Le fichier GitHub ne contient pas une sauvegarde lisible.');
        remote = file.encoding === 'base64' && file.content
          ? validateState(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8').replace(/^\uFEFF/, '')))
          : validateState(await command(['api', '--hostname', 'github.com', `${endpoint}?ref=${encodeURIComponent(config.branch)}`, '-H', 'Accept: application/vnd.github.raw+json']));
        sha = file.sha;
      } catch (error) { if (error.status !== 404) throw error; }
      const remoteHash = fingerprint(remote);
      let syncedHash = localHash;
      if (!local && !remote) throw new Error('Aucune partie à synchroniser. Lance PokeIdle une première fois.');
      function preserveConflict() {
        const previous = fs.existsSync(reportFile) ? parse(reportFile) : {};
        if (previous.state === 'conflict' && previous.localHash === localHash && previous.remoteHash === remoteHash) return previous;
        const localBackup = local ? store.archive(local, 'local') : null;
        const remoteBackup = remote ? store.archive(remote, 'github') : null;
        const conflict = { state: 'conflict', message: 'Deux versions différentes existent. Les deux sont conservées. Choisis la partie à reprendre.', localBackup, remoteBackup };
        return report({ ...conflict, localHash, remoteHash });
      }
      // Never infer the winning save from PC clocks or merge inventory/coins.
      if (localHash !== remoteHash) {
        const localChanged = localHash !== (base.hash || null);
        const remoteChanged = remoteHash !== (base.hash || null);
        const forceLocal = action === 'keep-local';
        const forceRemote = action === 'keep-github';
        if (!forceLocal && !forceRemote && localChanged && remoteChanged) { preserveConflict(); return status(); }
        if (!remote && base.sha && !forceLocal) { preserveConflict(); return status(); }
        const takeRemote = forceRemote || (!forceLocal && remoteChanged);
        if (takeRemote) {
          if (!remote) throw new Error('Aucune sauvegarde sur GitHub.');
          if (action === 'push') { report({ state: 'remote-newer', message: 'Une nouvelle partie est disponible sur GitHub. Utilise Pull ou Synchroniser.' }); return status(); }
          if (local) store.archive(local, 'avant-pull');
          store.replace(remote, localDocument.revision);
          syncedHash = remoteHash;
        } else {
          if (!local) throw new Error('Aucune partie locale à envoyer.');
          if (action === 'pull') { report({ state: 'pending', message: 'Ta partie locale attend un Push vers GitHub.' }); return status(); }
          if (remote && forceLocal) store.archive(remote, 'avant-push');
          const body = { message: `PokeIdle: sauvegarde ${new Date().toISOString()}`, content: Buffer.from(JSON.stringify(local, null, 2) + '\n').toString('base64'), branch: config.branch };
          if (sha) body.sha = sha;
          if (!sha && metadata.size === 0) delete body.branch;
          const result = await command(['api', '--hostname', 'github.com', '--method', 'PUT', endpoint, '--input', '-'], body);
          sha = result.content.sha;
        }
      }
      atomicJson(checkpointFile, { repository: config.repository, branch: config.branch, sha, hash: syncedHash });
      const pending = fingerprint(store.state()) !== syncedHash;
      report({ state: pending ? 'pending' : 'success', lastSync: new Date().toISOString(),
        message: pending ? 'Partie sauvegardée ; de nouveaux changements attendent le prochain envoi.' : 'Synchronisé avec GitHub' });
      return status();
    } catch (error) {
      report({ state: 'error', message: error.message });
      throw error;
    } finally { release(); }
  }
  return { store, status, configure, synchronize };
}
module.exports = { createGitHubSync, runGh };
