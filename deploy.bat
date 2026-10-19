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

if "%VERSION%"=="" (
    echo ERREUR : Impossible de lire la version dans package.json
    pause
    exit /b
)

echo Version detectee : %VERSION%

echo [3/4] Recuperation des chemins WSL (si dispo)...
set WSL_HOME_PATH=
for /f "usebackq delims=" %%p in (`wsl wslpath -w ~ 2^>nul`) do set WSL_HOME_PATH=%%p

echo [4/4] Nettoyage et Preparation des dossiers...

:: 1. VS Code
set "VSCODE_BASE=%USERPROFILE%\.vscode\extensions"
if not exist "%VSCODE_BASE%" mkdir "%VSCODE_BASE%"
if exist "%VSCODE_BASE%\hugo.poke-idle-game-*" for /d %%d in ("%VSCODE_BASE%\hugo.poke-idle-game-*") do rd /s /q "%%d"
set "VSCODE_DIR=%VSCODE_BASE%\hugo.poke-idle-game-%VERSION%"

:: 2. Cursor
set "CURSOR_BASE=%USERPROFILE%\.cursor\extensions"
if not exist "%CURSOR_BASE%" mkdir "%CURSOR_BASE%"
if exist "%CURSOR_BASE%\hugo.poke-idle-game-*" for /d %%d in ("%CURSOR_BASE%\hugo.poke-idle-game-*") do rd /s /q "%%d"
set "CURSOR_DIR=%CURSOR_BASE%\hugo.poke-idle-game-%VERSION%"

:: 3. Antigravity
set "ANTIGRAVITY_BASE=%USERPROFILE%\.antigravity\extensions"
if not exist "%ANTIGRAVITY_BASE%" mkdir "%ANTIGRAVITY_BASE%"
if exist "%ANTIGRAVITY_BASE%\hugo.poke-idle-game-*" for /d %%d in ("%ANTIGRAVITY_BASE%\hugo.poke-idle-game-*") do rd /s /q "%%d"
set "ANTIGRAVITY_DIR=%ANTIGRAVITY_BASE%\hugo.poke-idle-game-%VERSION%"

:: 4. WSL
set "WSL_CURSOR_DIR="
set "WSL_ANTIGRAVITY_DIR="
if defined WSL_HOME_PATH (
    :: Cursor WSL
    wsl mkdir -p ~/.cursor-server/extensions 2>nul
    wsl rm -rf ~/.cursor-server/extensions/hugo.poke-idle-game-*
    set "WSL_CURSOR_DIR=%WSL_HOME_PATH%\.cursor-server\extensions\hugo.poke-idle-game-%VERSION%"

    :: Antigravity WSL
    wsl mkdir -p ~/.antigravity-server/extensions 2>nul
    wsl rm -rf ~/.antigravity-server/extensions/hugo.poke-idle-game-*
    set "WSL_ANTIGRAVITY_DIR=%WSL_HOME_PATH%\.antigravity-server\extensions\hugo.poke-idle-game-%VERSION%"
)

:: Creation des dossiers de version
if not exist "%VSCODE_DIR%" mkdir "%VSCODE_DIR%" 2>nul
if not exist "%CURSOR_DIR%" mkdir "%CURSOR_DIR%" 2>nul
if not exist "%ANTIGRAVITY_DIR%" mkdir "%ANTIGRAVITY_DIR%" 2>nul
if defined WSL_CURSOR_DIR if not exist "%WSL_CURSOR_DIR%" mkdir "%WSL_CURSOR_DIR%" 2>nul
if defined WSL_ANTIGRAVITY_DIR if not exist "%WSL_ANTIGRAVITY_DIR%" mkdir "%WSL_ANTIGRAVITY_DIR%" 2>nul

echo [4/4] D?ploiement des fichiers...

:: Windows
xcopy /s /e /y "out" "%VSCODE_DIR%\out\" >nul
xcopy /s /e /y "media" "%VSCODE_DIR%\media\" >nul
copy "package.json" "%VSCODE_DIR%\" >nul
xcopy /s /e /y "sync" "%VSCODE_DIR%\sync\" >nul
copy "codex.html" "%VSCODE_DIR%\" >nul

xcopy /s /e /y "out" "%CURSOR_DIR%\out\" >nul
xcopy /s /e /y "media" "%CURSOR_DIR%\media\" >nul
copy "package.json" "%CURSOR_DIR%\" >nul
xcopy /s /e /y "sync" "%CURSOR_DIR%\sync\" >nul
copy "codex.html" "%CURSOR_DIR%\" >nul

xcopy /s /e /y "out" "%ANTIGRAVITY_DIR%\out\" >nul
xcopy /s /e /y "media" "%ANTIGRAVITY_DIR%\media\" >nul
copy "package.json" "%ANTIGRAVITY_DIR%\" >nul
xcopy /s /e /y "sync" "%ANTIGRAVITY_DIR%\sync\" >nul
copy "codex.html" "%ANTIGRAVITY_DIR%\" >nul

:: WSL
if defined WSL_CURSOR_DIR (
    xcopy /s /e /y "out" "%WSL_CURSOR_DIR%\out\" >nul
    xcopy /s /e /y "media" "%WSL_CURSOR_DIR%\media\" >nul
    copy "package.json" "%WSL_CURSOR_DIR%\" >nul
    xcopy /s /e /y "sync" "%WSL_CURSOR_DIR%\sync\" >nul
    copy "codex.html" "%WSL_CURSOR_DIR%\" >nul
)
if defined WSL_ANTIGRAVITY_DIR (
    xcopy /s /e /y "out" "%WSL_ANTIGRAVITY_DIR%\out\" >nul
    xcopy /s /e /y "media" "%WSL_ANTIGRAVITY_DIR%\media\" >nul
    copy "package.json" "%WSL_ANTIGRAVITY_DIR%\" >nul
    xcopy /s /e /y "sync" "%WSL_ANTIGRAVITY_DIR%\sync\" >nul
    copy "codex.html" "%WSL_ANTIGRAVITY_DIR%\" >nul
)

echo [4/4] Mise a jour du registre VS Code...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-vscode-extension-registry.ps1" "%VERSION%"

echo.
echo ===========================================
echo   TERMINE !
echo   IMPORTANT : Redemarrez vos editeurs.
echo ===========================================
echo.
pause
