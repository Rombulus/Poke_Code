@echo off
setlocal
echo ===========================================
echo   MISE A JOUR POKEIDLE (VS CODE + CURSOR + ANTIGRAVITY + WSL)
echo ===========================================
echo.

cd /d "%~dp0"

echo [1/4] Compilation...
call npm run compile

echo [2/4] Recuperation de la version...
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content package.json | ConvertFrom-Json).version"`) do set VERSION=%%v

echo [3/4] Recuperation des chemins WSL (si dispo)...
set WSL_HOME_PATH=
for /f "usebackq delims=" %%p in (`wsl wslpath -w ~ 2^>nul`) do set WSL_HOME_PATH=%%p

echo [4/4] Nettoyage des anciennes extensions...

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

:: 4. WSL Cursor (si dispo)
set WSL_CURSOR_DIR=
if defined WSL_HOME_PATH (
    set WSL_CURSOR_DIR=%WSL_HOME_PATH%\.cursor-server\extensions\hugo.poke-idle-game-%VERSION%
    if not exist "%WSL_HOME_PATH%\.cursor-server\extensions" wsl mkdir -p ~/.cursor-server/extensions
    wsl rm -rf ~/.cursor-server/extensions/hugo.poke-idle-game-*
)

:: 5. WSL Antigravity (si dispo)
set WSL_ANTIGRAVITY_DIR=
if defined WSL_HOME_PATH (
    set WSL_ANTIGRAVITY_DIR=%WSL_HOME_PATH%\.antigravity-server\extensions\hugo.poke-idle-game-%VERSION%
    if not exist "%WSL_HOME_PATH%\.antigravity-server\extensions" wsl mkdir -p ~/.antigravity-server/extensions
    wsl rm -rf ~/.antigravity-server/extensions/hugo.poke-idle-game-*
)

mkdir "%VSCODE_DIR%"
mkdir "%CURSOR_DIR%"
mkdir "%ANTIGRAVITY_DIR%"
if defined WSL_CURSOR_DIR mkdir "%WSL_CURSOR_DIR%"
if defined WSL_ANTIGRAVITY_DIR mkdir "%WSL_ANTIGRAVITY_DIR%"

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

:: Copie vers WSL Cursor
if defined WSL_CURSOR_DIR (
    xcopy /s /e /y "out" "%WSL_CURSOR_DIR%\out\"
    xcopy /s /e /y "media" "%WSL_CURSOR_DIR%\media\"
    copy "package.json" "%WSL_CURSOR_DIR%\"
)

:: Copie vers WSL Antigravity
if defined WSL_ANTIGRAVITY_DIR (
    xcopy /s /e /y "out" "%WSL_ANTIGRAVITY_DIR%\out\"
    xcopy /s /e /y "media" "%WSL_ANTIGRAVITY_DIR%\media\"
    copy "package.json" "%WSL_ANTIGRAVITY_DIR%\"
)

echo.
echo ===========================================
echo   TERMINE ! 
echo   Relancez vos éditeurs (Windows et WSL).
echo ===========================================
echo.
pause
