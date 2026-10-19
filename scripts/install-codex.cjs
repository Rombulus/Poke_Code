const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
fs.writeFileSync(path.join(root, '.codex/plugins/pokeidle-codex/project.json'), JSON.stringify({ projectRoot: root }, null, 2) + '\n');
for (const args of [['plugin', 'marketplace', 'add', '.'], ['plugin', 'add', 'pokeidle-codex@pokeidle-local']]) {
  const result = spawnSync('codex', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
  if (result.error || result.status !== 0) { console.error('Installation Codex interrompue. Vérifie que la commande codex est disponible.'); process.exit(1); }
}
console.log('PokeIdle installé. Ferme puis rouvre son panneau dans Codex.');
