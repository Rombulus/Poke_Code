@echo off
setlocal
echo ===========================================
echo   RESET ET MISE A JOUR POKEIDLE
echo ===========================================
echo.

cd /d "%~dp0"

echo [1/3] Compilation...
call npm run compile

echo [2/3] Nettoyage et recuperation de la version...
:: Recuperation de la version depuis package.json
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content package.json | ConvertFrom-Json).version"`) do set VERSION=%%v

:: On supprime les vieux dossiers pour eviter les conflits
if exist "%USERPROFILE%\.vscode\extensions\.obsolete" del /q "%USERPROFILE%\.vscode\extensions\.obsolete"
if exist "%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-*" for /d %%d in ("%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-*") do rd /s /q "%%d"

set TARGET_DIR=%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-%VERSION%
mkdir "%TARGET_DIR%"

echo [3/3] Installation de la nouvelle version...
xcopy /s /e /y "out" "%TARGET_DIR%\out\"
xcopy /s /e /y "media" "%TARGET_DIR%\media\"
copy "package.json" "%TARGET_DIR%\"

echo.
echo ===========================================
echo   TERMINE ! 
echo   1. FERME et RELANCE VS Code completement.
echo   2. Verifie si l'icone Pokeball apparait.
echo ===========================================
echo.
pause
