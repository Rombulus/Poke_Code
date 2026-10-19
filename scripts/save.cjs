#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { createRuntime } = require('../sync/runtime.cjs');
const { runGh } = require('../sync/github.cjs');
const projectRoot = path.resolve(__dirname, '..');
let runtime;
function getRuntime() { return runtime || (runtime = createRuntime(projectRoot)); }
function question(prompt) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => input.question(prompt, (answer) => { input.close(); resolve(answer.trim()); }));
}
async function login() {
  await new Promise((resolve, reject) => {
    const child = spawn('gh', ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'], {
      stdio: 'inherit', windowsHide: true, env: { ...process.env, GH_HOST: 'github.com' }
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('Connexion GitHub interrompue.')));
  });
}
function display(result) {
  console.log('\n' + result.message);
  console.log('Dépôt : ' + (result.repository || 'non configuré'));
  if (result.branch) console.log('Branche : ' + result.branch);
  console.log('Sauvegarde locale : ' + result.localFile);
  if (result.state === 'conflict') console.log('Copies conservées : ' + result.conflictsDirectory);
  if (result.state === 'conflict' || result.state === 'error') process.exitCode = 1;
}
async function execute(action, args = []) {
  if (action === 'login') return login();
  if (action === 'setup') {
    const account = await runGh(['api', '--hostname', 'github.com', 'user']);
    const repository = args[0] && !args[0].startsWith('--') ? args[0] : `${account.login}/pokeidle-save`;
    const branch = args.includes('--branch') ? args[args.indexOf('--branch') + 1] : undefined;
    display(await getRuntime().configure(repository, args.includes('--create'), branch, args.includes('--allow-public')));
    display(await getRuntime().synchronize());
    return;
  }
  if (action === 'status') { const current = getRuntime().status(); display({ message: 'État de la sauvegarde : ' + (current.state || 'locale'), ...current }); return; }
  if (action === 'export') {
    const state = getRuntime().store.state();
    if (!state) throw new Error('Aucune partie enregistrée.');
    const destination = path.resolve(args[0] || `poke-idle-save-${Date.now()}.json`);
    fs.writeFileSync(destination, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
    console.log('Fichier exporté : ' + destination);
    return;
  }
  if (action === 'keep-local' || action === 'keep-github') {
    console.log(action === 'keep-local' ? 'La partie de ce PC remplacera celle de GitHub.' : 'La partie GitHub remplacera celle de ce PC.');
    if ((await question('Les deux versions seront archivées si elles diffèrent. Taper OUI pour continuer : ')) !== 'OUI') return;
  }
  if (!['sync', 'push', 'pull', 'keep-local', 'keep-github'].includes(action)) throw new Error('Commande inconnue. Utilise npm run save -- help.');
  display(await getRuntime().synchronize(action));
}
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'help') {
    console.log('PokeIdle — sauvegarde GitHub\n\n  npm run save -- login\n  npm run save -- setup compte/depot --branch pokeidle-save [--allow-public]\n  npm run save -- setup compte/pokeidle-save --create\n  npm run save -- sync\n  npm run save -- push\n  npm run save -- pull\n  npm run save -- status\n  npm run save -- export [fichier.json]\n  npm run save -- keep-local\n  npm run save -- keep-github\n\nFerme les panneaux de jeu avant une commande Pull ou une résolution de conflit.');
    return;
  }
  if (args.length) { await execute(args[0], args.slice(1)); return; }
  console.log('PokeIdle — sauvegarde personnelle\n\n1. Première configuration GitHub\n2. Synchroniser maintenant\n3. Push : envoyer ma partie\n4. Pull : récupérer ma partie\n5. État de la synchronisation\n6. Exporter un fichier JSON\n7. Conflit : garder la partie de ce PC\n8. Conflit : garder la partie GitHub\n0. Quitter\n');
  const choice = await question('Choix : ');
  if (choice === '0') return;
  if (choice === '1') {
    try { await runGh(['api', '--hostname', 'github.com', 'user']); } catch { await login(); }
    const account = await runGh(['api', '--hostname', 'github.com', 'user']);
    const repository = await question(`Dépôt GitHub [${account.login}/Poke_Code] : `) || `${account.login}/Poke_Code`;
    const branch = await question('Branche de sauvegarde [pokeidle-save] : ') || 'pokeidle-save';
    const metadata = await runGh(['api', '--hostname', 'github.com', `repos/${repository}`]);
    const setup = [repository, '--branch', branch];
    if (!metadata.private) {
      console.log('Ce dépôt est PUBLIC. Le fichier de sauvegarde sera visible par tout le monde.');
      if ((await question('Taper OUI pour utiliser cette branche publique : ')) !== 'OUI') return;
      setup.push('--allow-public');
    }
    await execute('setup', setup);
  } else {
    const actions = { 2: 'sync', 3: 'push', 4: 'pull', 5: 'status', 6: 'export', 7: 'keep-local', 8: 'keep-github' };
    if (!actions[choice]) throw new Error('Choix inconnu.');
    await execute(actions[choice]);
  }
}
main().catch((error) => { console.error('\n' + error.message); process.exitCode = 1; });
