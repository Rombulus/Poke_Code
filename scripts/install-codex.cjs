const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
fs.writeFileSync(path.join(root, '.codex/plugins/pokeidle-codex/project.json'), JSON.stringify({ projectRoot: root }, null, 2) + '\n');
const launcher = path.join(root, '.codex/plugins/pokeidle-codex/mcp-direct.js');
const commands = [
  ['plugin', 'marketplace', 'add', '.'],
  ['plugin', 'add', 'pokeidle-codex@pokeidle-local'],
  ['mcp', 'add', 'pokeidle_game', '--env', `POKEIDLE_PROJECT_ROOT=${root}`, '--', process.execPath, launcher]
];
for (const args of commands) {
  const result = spawnSync(process.platform === 'win32' ? 'codex.exe' : 'codex', args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) { console.error('Installation Codex interrompue. Vérifie que la commande codex est disponible.'); process.exit(1); }
}
console.log('PokeIdle installé avec un lanceur stable. Quitte Codex depuis Fichier > Quitter, puis relance-le pour renouveler sa session de lancement.');
