@echo off
setlocal
echo   MISE A JOUR POKEIDLE (VS CODE + CURSOR + ANTIGRAVITY)
echo ===========================================
echo.

cd /d "%~dp0"

echo [1/4] Compilation...
call npm run compile

echo [2/4] Recuperation de la version...
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content package.json | ConvertFrom-Json).version"`) do set VERSION=%%v

echo [3/4] Nettoyage des anciennes extensions...

:: 1. VS Code
if not exist "%USERPROFILE%\.vscode\extensions" mkdir "%USERPROFILE%\.vscode\extensions"
if exist "%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-*" for /d %%d in ("%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-*") do rd /s /q "%%d"
set VSCODE_DIR=%USERPROFILE%\.vscode\extensions\hugo.poke-idle-game-%VERSION%

:: 2. Cursor
if not exist "%USERPROFILE%\.cursor\extensions" mkdir "%USERPROFILE%\.cursor\extensions"
if exist "%USERPROFILE%\.cursor\extensions\hugo.poke-idle-game-*" for /d %%d in ("%USERPROFILE%\.cursor\extensions\hugo.poke-idle-game-*") do rd /s /q "%%d"
set CURSOR_DIR=%USERPROFILE%\.cursor\extensions\hugo.poke-idle-game-%VERSION%

:: 3. Antigravity
if not exist "%USERPROFILE%\.antigravity\extensions" mkdir "%USERPROFILE%\.antigravity\extensions"
if exist "%USERPROFILE%\.antigravity\extensions\hugo.poke-idle-game-*" for /d %%d in ("%USERPROFILE%\.antigravity\extensions\hugo.poke-idle-game-*") do rd /s /q "%%d"
set ANTIGRAVITY_DIR=%USERPROFILE%\.antigravity\extensions\hugo.poke-idle-game-%VERSION%

mkdir "%VSCODE_DIR%"
mkdir "%CURSOR_DIR%"
mkdir "%ANTIGRAVITY_DIR%"

echo [4/4] Déploiement des fichiers...

:: Copie vers VS Code
xcopy /s /e /y "out" "%VSCODE_DIR%\out\"
xcopy /s /e /y "media" "%VSCODE_DIR%\media\"
copy "package.json" "%VSCODE_DIR%\"

:: Copie vers Cursor
xcopy /s /e /y "out" "%CURSOR_DIR%\out\"
xcopy /s /e /y "media" "%CURSOR_DIR%\media\"
copy "package.json" "%CURSOR_DIR%\"

:: Copie vers Antigravity
xcopy /s /e /y "out" "%ANTIGRAVITY_DIR%\out\"
xcopy /s /e /y "media" "%ANTIGRAVITY_DIR%\media\"
copy "package.json" "%ANTIGRAVITY_DIR%\"

echo.
echo ===========================================
echo   TERMINE ! 
echo   Relancez VS Code, Cursor ou Antigravity.
echo ===========================================
echo.
pause
