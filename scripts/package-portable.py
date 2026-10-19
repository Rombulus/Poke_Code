"""Build a personal PokeIdle bundle from an explicit list; never include saves or credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
target = root / 'artifacts' / 'PokeIdle-portable.zip'
plugin = root / '.codex' / 'plugins' / 'pokeidle-codex'
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
files = [root / name for name in [
    'package.json', 'package-lock.json', 'tsconfig.json', 'codex.html', 'codex-server.js',
    'SAUVEGARDE.md', 'EVOLUTIONS.md', 'DEFIS.md', 'Sauvegarde-PokeIdle.cmd', 'Installer-PokeIdle-Codex.cmd',
    'scripts/save.cjs', 'scripts/install-codex.cjs', f'artifacts/pokeidle-{version}.vsix',
    '.agents/plugins/marketplace.json',
]]
for directory, pattern in [('sync', '*.cjs'), ('src', '*.ts'), ('out', '*.js'), ('out', '*.map')]:
    files.extend(sorted((root / directory).glob(pattern)))
files.extend(root / 'media' / name for name in [
    'main.js', 'style.css', 'github-host.js', 'codex-bridge.js', 'item-icons.js', 'evolution-data.js', 'evolutions.js', 'challenges.js', 'icon.svg', 'pokedollar.png',
])
files.extend(plugin / name for name in [
    'plugin.json', 'mcp.json', 'mcp-direct.js', 'game-resource.js', 'assets/pokeidle.svg', 'hooks/hooks.json',
])
missing = [str(file.relative_to(root)) for file in files if not file.is_file()]
if missing:
    raise SystemExit('Fichiers manquants : ' + ', '.join(missing))
target.parent.mkdir(exist_ok=True)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, 'PokeIdle/' + file.relative_to(root).as_posix())
    archive.writestr('PokeIdle/.codex/plugins/pokeidle-codex/project.json', json.dumps({'projectRoot': '.'}))
    archive.writestr('PokeIdle/LIRE-MOI.txt', f'''PokeIdle — retrouver ma partie sur un autre PC

1. Extraire tout le dossier PokeIdle (ne pas lancer les fichiers dans le ZIP).
2. Installer Node.js et GitHub CLI si necessaire.
3. Ouvrir Sauvegarde-PokeIdle.cmd et choisir 1 pour connecter GitHub.
   Depot : Rombulus/Poke_Code ; branche : pokeidle-save.
   La sauvegarde sur cette branche est publique.
4. Codex : ouvrir Installer-PokeIdle-Codex.cmd.
   VS Code / Cursor / Antigravity : Extensions > Installer a partir d'un VSIX,
   puis choisir artifacts/pokeidle-{version}.vsix et recharger l'editeur.
5. Avant de changer de PC, cliquer Synchroniser et attendre la confirmation.

Details : SAUVEGARDE.md.
Ce paquet ne contient aucune sauvegarde personnelle ni aucun jeton GitHub.
''')
print(target)
