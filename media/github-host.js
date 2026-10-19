(function () {
  const http = Boolean(window.POKEIDLE_HTTP_HOST);
  const statusBar = document.getElementById('pokeidle-host-status');
  const statusText = document.getElementById('pokeidle-host-message');
  const retry = document.getElementById('pokeidle-host-retry');
  const cloudStatus = document.getElementById('github-sync-status');
  let entries = { ...(window.POKEIDLE_BOOTSTRAP?.entries || {}) };
  let revision = window.POKEIDLE_BOOTSTRAP?.revision || 0;
  let dirty = false;
  let saving;
  let busy;
  let timer;
  let conflicted = false;
  let counter = 0;
  const pending = new Map();
  let cloud;
  function errorMessage(error) {
    if (statusBar) { statusText.textContent = error.message; statusBar.hidden = false; retry.hidden = false; }
    if (cloudStatus) cloudStatus.textContent = error.message;
  }
  function rpc(method, params) {
    if (http) {
      const tool = params?.name;
      const url = tool === 'get_pokeidle_storage' || tool === 'save_pokeidle_storage' ? '/api/storage'
        : tool === 'read_pokeidle_vscode_save' ? '/api/legacy-save' : '/api/github';
      const readonly = tool === 'get_pokeidle_storage' || tool === 'read_pokeidle_vscode_save';
      return fetch(url, readonly ? { cache: 'no-store' } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params.arguments)
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Sauvegarde indisponible.');
        return { structuredContent: result };
      });
    }
    return new Promise((resolve, reject) => {
      const id = `pokeidle-${++counter}`;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Codex ne répond pas. Réessaie.')); }, 90000);
      pending.set(id, { resolve, reject, timeout });
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    });
  }
  window.addEventListener('message', (event) => {
    if (http || event.source !== window.parent || event.data?.jsonrpc !== '2.0' || event.data.method) return;
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    clearTimeout(request.timeout);
    if (event.data.error) request.reject(new Error(event.data.error.message));
    else request.resolve(event.data.result);
  });
  const connected = http ? Promise.resolve() : rpc('ui/initialize', {
    appInfo: { name: 'pokeidle', version: '1.4.0' }, appCapabilities: {}, protocolVersion: '2026-01-26'
  }).then(() => window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*'));
  async function tool(name, args = {}) {
    await connected;
    const result = await rpc('tools/call', { name, arguments: args });
    if (result.isError) throw new Error(result.content?.[0]?.text || 'Opération impossible.');
    return result.structuredContent;
  }
  function showCloud(value) {
    cloud = value;
    if (cloudStatus) cloudStatus.textContent = value.message || (value.configured ? 'Synchronisation GitHub prête' : 'GitHub non configuré');
    const repository = document.getElementById('github-repository');
    if (repository && value.repository && document.activeElement !== repository) repository.value = value.repository;
    const branch = document.getElementById('github-branch'); if (branch && value.branch && document.activeElement !== branch) branch.value = value.branch;
    const publicSave = document.getElementById('github-allow-public'); if (publicSave) publicSave.checked = value.publicSaveApproved === true;
    const choices = document.getElementById('github-conflict');
    if (choices) choices.hidden = value.state !== 'conflict';
    if (value.state === 'conflict') errorMessage(new Error(value.message));
  }
  function apply(document) {
    entries = { ...document.entries };
    revision = document.revision;
    if (document.sync) showCloud(document.sync);
  }
  async function flush() {
    clearTimeout(timer);
    if (saving) { await saving; if (dirty && !conflicted) return flush(); return; }
    if (!dirty || conflicted) return;
    dirty = false;
    const snapshot = { ...entries };
    saving = tool('save_pokeidle_storage', { entries: snapshot, revision }).then((result) => {
      revision = result.revision;
      const label = document.getElementById('sync-status');
      if (label) label.textContent = 'Partie enregistrée sur ce PC';
    }).catch((error) => {
      dirty = true;
      conflicted = /autre fenêtre/.test(error.message);
      if (conflicted) {
        window.POKEIDLE_SYNC_BUSY = true;
        const app = document.getElementById('app'); if (app) app.inert = true;
      }
      errorMessage(error);
      throw error;
    });
    try { await saving; }
    finally { saving = null; if (dirty && !conflicted) timer = setTimeout(() => flush().catch(() => {}), 3000); }
  }
  window.POKEIDLE_STORAGE = {
    get length() { return Object.keys(entries).length; },
    key(index) { return Object.keys(entries)[index] ?? null; },
    getItem(key) { return entries[key] ?? null; },
    setItem(key, value) {
      entries[key] = String(value); dirty = true; schedule();
      if (key === 'pokeidle.codex.save.v1' && cloud?.configured && cloud.state !== 'conflict') {
        cloud.state = 'pending'; if (cloudStatus) cloudStatus.textContent = 'Modifications locales à envoyer sur GitHub';
      }
    },
    removeItem(key) { delete entries[key]; dirty = true; schedule(); }
  };
  function schedule() { clearTimeout(timer); timer = setTimeout(() => flush().catch(() => {}), 150); }
  const ready = connected.then(async () => {
    apply(await tool('get_pokeidle_storage'));
    try { apply(await tool('sync_pokeidle_github', { action: 'sync' })); }
    catch (error) { errorMessage(error); }
  });
  ready.catch(errorMessage);
  async function confirmAction(text) {
    const dialog = document.createElement('dialog');
    dialog.className = 'pokeidle-confirm';
    const message = document.createElement('p');
    message.textContent = text;
    const cancel = document.createElement('button'); cancel.textContent = 'Annuler';
    const accept = document.createElement('button'); accept.textContent = 'Continuer';
    cancel.addEventListener('click', () => dialog.close('cancel'));
    accept.addEventListener('click', () => dialog.close('accept'));
    dialog.append(message, cancel, accept); document.body.appendChild(dialog);
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => { const answer = dialog.returnValue === 'accept'; dialog.remove(); resolve(answer); }, { once: true });
      dialog.showModal();
    });
  }
  async function synchronize(action = 'sync') {
    if (busy) return busy;
    if (action === 'keep-local' || action === 'keep-github') {
      if (!(await confirmAction(action === 'keep-local' ? 'Remplacer la partie GitHub par celle de ce PC ? Une copie sera conservée.' : 'Reprendre la partie GitHub ? Une copie de la partie de ce PC sera conservée.'))) return;
    }
    busy = (async () => {
      await ready;
      window.POKEIDLE_SYNC_BUSY = true;
      const app = document.getElementById('app'); if (app) app.inert = true;
      try {
        await flush();
        if (conflicted) throw new Error('Une autre fenêtre a modifié la partie. Recharge avant de synchroniser.');
        const previousRevision = revision;
        const args = { action };
        if (action === 'configure') {
          args.repository = document.getElementById('github-repository').value.trim();
          args.create = true;
          args.branch = document.getElementById('github-branch').value.trim();
          args.allowPublic = document.getElementById('github-allow-public').checked;
        }
        const result = await tool('sync_pokeidle_github', args);
        if (dirty) throw new Error('La partie a changé pendant la synchronisation. Réessaie avant de changer de PC.');
        apply(result);
        if (statusBar && result.sync.state !== 'conflict') statusBar.hidden = true;
        if (revision !== previousRevision) window.acquireVsCodeApi().postMessage({ type: 'getState' });
      } catch (error) { errorMessage(error); }
      finally { window.POKEIDLE_SYNC_BUSY = conflicted; if (app) app.inert = conflicted; }
    })();
    try { await busy; } finally { busy = null; }
  }
  window.POKEIDLE_MCP_HOST = {
    ready, confirm: confirmAction, sync: synchronize,
    async readVsCodeSave() { return (await tool('read_pokeidle_vscode_save')).state; }
  };
  for (const [id, action] of Object.entries({
    'github-configure': 'configure', 'github-push': 'push', 'github-pull': 'pull',
    'github-keep-local': 'keep-local', 'github-keep-remote': 'keep-github'
  })) document.getElementById(id)?.addEventListener('click', () => synchronize(action));
  setInterval(() => { if (cloud?.configured && cloud.state !== 'conflict' && !document.hidden) synchronize(); }, 60000);
  window.addEventListener('pokeidle-game-ready', () => { if (statusBar && cloud?.state !== 'conflict') statusBar.hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush().catch(() => {}); });
  retry?.addEventListener('click', async () => {
    try {
      if (conflicted && await confirmAction('Recharger la partie de l’autre fenêtre ? Ta version a été conservée dans le dossier conflicts.')) {
        apply(await tool('get_pokeidle_storage')); dirty = false; conflicted = false;
        window.POKEIDLE_SYNC_BUSY = false;
        const app = document.getElementById('app'); if (app) app.inert = false;
        window.acquireVsCodeApi().postMessage({ type: 'getState' });
      } else if (!conflicted) await synchronize();
    } catch (error) { errorMessage(error); }
  });
})();
