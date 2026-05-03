$ErrorActionPreference = "Stop"

echo "==========================================="
echo "   INSTALLATION POKEIDLE POUR ANTIGRAVITY"
echo "==========================================="
echo ""

$extDir = "$env:USERPROFILE\.antigravity\extensions"
$version = "0.7.0"
$targetDir = "$extDir\hugo.poke-idle-game-$version"

echo "[1/3] Compilation..."
npm run compile

echo "[2/3] Nettoyage..."
if (Test-Path $targetDir) {
    Remove-Item -Recurse -Force $targetDir
}
New-Item -ItemType Directory -Path $targetDir -Force

echo "[3/3] Copie des fichiers..."
Copy-Item -Recurse "out" "$targetDir\"
Copy-Item -Recurse "media" "$targetDir\"
Copy-Item "package.json" "$targetDir\"

echo ""
echo "==========================================="
echo "   TERMINE ! "
echo "   Relancez Antigravity pour voir l'icone."
echo "==========================================="
