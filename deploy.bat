@echo off
setlocal
echo ===========================================
echo   RESET ET MISE A JOUR POKEIDLE
echo ===========================================
echo.

cd /d "%~dp0"

echo [1/3] Compilation...
call npm run compile

echo [2/3] Nettoyage des anciens dossiers...
:: On supprime toutes les versions possibles pour repartir de zero
if exist "%USERPROFILE%\.vscode\extensions\.obsolete" del /q "%USERPROFILE%\.vscode\extensions\.obsolete"
if exist "%USERPROFILE%\.vscode\extensions\extensions.json" del /q "%USERPROFILE%\.vscode\extensions\extensions.json"
if exist "%USERPROFILE%\.vscode\extensions\hugo.poke-idle-vscode-0.1.0" rd /s /q "%USERPROFILE%\.vscode\extensions\hugo.poke-idle-vscode-0.1.0"
if exist "%USERPROFILE%\.vscode\extensions\poke-idle-local" rd /s /q "%USERPROFILE%\.vscode\extensions\poke-idle-local"
if exist "%USERPROFILE%\.vscode\extensions\Poke_Code" rd /s /q "%USERPROFILE%\.vscode\extensions\Poke_Code"

set TARGET_DIR=%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-0.1.0
if exist "%TARGET_DIR%" rd /s /q "%TARGET_DIR%"
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
