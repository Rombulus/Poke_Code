(function () {
    const STORAGE_KEY = 'pokeidle.codex.save.v1';
    const FRESH_START_KEY = 'pokeidle.codex.fresh-start.v1';
    const BACKUP_PREFIX = 'pokeidle.codex.backup.v1.';
    const fileInput = document.getElementById('codex-import-file');
    const toast = document.getElementById('codex-toast');
    const newGameButton = document.getElementById('btn-new-game');
    const restoreButton = document.getElementById('btn-restore-game');
    let toastTimer;
    let memoryState = null;

    function getStorage() {
        return window.POKEIDLE_STORAGE || window.localStorage;
    }

    function confirmAction(text) {
        return window.POKEIDLE_MCP_HOST
            ? window.POKEIDLE_MCP_HOST.confirm(text)
            : Promise.resolve(window.confirm(text));
    }

    function notify(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
    }

    function postToGame(message) {
        // A fresh-start save skips the fetch; deliver it after main.js registers its listener.
        queueMicrotask(() => {
            window.dispatchEvent(new MessageEvent('message', { data: message }));
            if (message.type === 'loadState') {
                window.dispatchEvent(new Event('pokeidle-game-ready'));
                window.parent.postMessage({ type: 'pokeidle-ready' }, '*');
            }
        });
    }

    function readStoredState() {
        try {
            const raw = getStorage().getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : memoryState;
        } catch (error) {
            console.warn('PokeIdle: sauvegarde locale illisible.', error);
            return memoryState;
        }
    }

    function storeState(value) {
        memoryState = value;
        try {
            getStorage().setItem(STORAGE_KEY, JSON.stringify(value));
        } catch (error) {
            console.warn('PokeIdle: stockage navigateur indisponible.', error);
            notify('Le stockage navigateur est indisponible ; la progression ne sera gardée que pendant cette session.');
        }
    }

    function clearFreshStartFlag() {
        try { getStorage().removeItem(FRESH_START_KEY); } catch { }
    }

    function getLatestBackup() {
        try {
            const keys = [];
            for (let index = 0; index < getStorage().length; index++) {
                const key = getStorage().key(index);
                if (key && key.startsWith(BACKUP_PREFIX)) keys.push(key);
            }
            keys.sort().reverse();
            return keys.length ? JSON.parse(getStorage().getItem(keys[0])) : null;
        } catch (error) {
            console.warn('PokeIdle: sauvegarde précédente illisible.', error);
            return null;
        }
    }

    function updateRestoreButton() {
        if (restoreButton) restoreButton.disabled = !getLatestBackup();
    }

    function hasProgress(value) {
        return Boolean(value && ((value.pokedex && value.pokedex.length) || (value.level || 1) > 1 || (value.missions && value.missions.claimed && value.missions.claimed.length)));
    }

    async function fetchVsCodeSave() {
        if (window.POKEIDLE_MCP_HOST) return window.POKEIDLE_MCP_HOST.readVsCodeSave();
        const response = await fetch('/api/initial-save', { cache: 'no-store' });
        if (response.status === 200) return await response.json();
        if (response.status === 204) return null;
        throw new Error(`Le serveur a répondu ${response.status}.`);
    }

    async function importVsCodeSave(force) {
        try {
            const importedState = await fetchVsCodeSave();
            if (!importedState) {
                notify('Aucune sauvegarde VS Code trouvée.');
                return null;
            }
            const currentState = readStoredState();
            if (!force && hasProgress(currentState) && !(await confirmAction('Remplacer la progression Codex par la sauvegarde VS Code ?'))) return currentState;
            importedState.lastUpdate = Date.now();
            clearFreshStartFlag();
            storeState(importedState);
            postToGame({ type: 'loadState', value: importedState });
            updateRestoreButton();
            notify('Sauvegarde VS Code chargée dans Codex.');
            return importedState;
        } catch (error) {
            console.warn('PokeIdle: chargement de la sauvegarde VS Code impossible.', error);
            notify('Impossible de charger la sauvegarde VS Code. Vérifie que le serveur PokeIdle est lancé.');
            return null;
        }
    }

    async function loadState() {
        if (window.POKEIDLE_MCP_HOST) {
            try { await window.POKEIDLE_MCP_HOST.ready; }
            catch { notify('La sauvegarde ne peut pas être chargée. Utilise Réessayer dans le panneau.'); return; }
        }
        let savedState = readStoredState();
        let freshStart = false;
        try { freshStart = getStorage().getItem(FRESH_START_KEY) === 'true'; } catch { }
        if (!freshStart && !window.POKEIDLE_MCP_HOST) {
            try {
                const sourceState = await fetchVsCodeSave();
                if (sourceState && !hasProgress(savedState)) {
                    sourceState.lastUpdate = Date.now();
                    storeState(sourceState);
                    savedState = sourceState;
                    notify('Sauvegarde VS Code chargée dans Codex.');
                }
            } catch (error) {
                console.info('PokeIdle: sauvegarde VS Code non disponible.', error);
            }
        }
        updateRestoreButton();
        postToGame({ type: 'loadState', value: savedState || {
            pokedex: [], inventory: { balls: { pokeball: 20 }, stones: {} }, coins: 200,
            xp: 0, level: 1, missions: { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] },
            spawnTimer: 180, discovery: {}, lastUpdate: Date.now()
        } });
    }

    function downloadState() {
        const savedState = readStoredState();
        if (!savedState) {
            notify('La sauvegarde est en cours de création. Réessaie dans un instant.');
            return;
        }
        const blob = new Blob([JSON.stringify(savedState, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'poke-idle-save.json';
        link.click();
        URL.revokeObjectURL(url);
        notify('Sauvegarde exportée.');
    }

    function importState(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const importedState = JSON.parse(String(reader.result));
                if (!importedState || !Array.isArray(importedState.pokedex) || !importedState.inventory) {
                    throw new Error('Format de sauvegarde non reconnu.');
                }
                const currentState = readStoredState();
                if (currentState && !(await confirmAction('Remplacer la progression Codex par cette sauvegarde ?'))) return;
                importedState.lastUpdate = Date.now();
                clearFreshStartFlag();
                storeState(importedState);
                postToGame({ type: 'loadState', value: importedState });
                updateRestoreButton();
                notify('Sauvegarde importée dans Codex.');
            } catch (error) {
                notify(error instanceof SyntaxError ? 'Ce fichier JSON est invalide.' : error.message);
            } finally {
                fileInput.value = '';
            }
        };
        reader.readAsText(file);
    }

    async function startNewGame() {
        const currentState = readStoredState();
        if (currentState && hasProgress(currentState)) {
            if (!(await confirmAction('Commencer une nouvelle partie ? Ta partie actuelle sera gardée et pourra être restaurée.'))) return;
            try {
                const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
                getStorage().setItem(backupKey, JSON.stringify(currentState));
            } catch (error) {
                notify('Impossible de créer une sauvegarde de secours ; la partie n’a pas été réinitialisée.');
                return;
            }
        }
        try { getStorage().setItem(FRESH_START_KEY, 'true'); } catch { }
        storeState({
            pokedex: [], inventory: { balls: { pokeball: 20 }, stones: {} }, coins: 200,
            xp: 0, level: 1, missions: { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] },
            spawnTimer: 180, discovery: {}, lastUpdate: Date.now()
        });
        postToGame({ type: 'loadState', value: readStoredState() });
        updateRestoreButton();
        notify('Nouvelle partie commencée. Ta partie précédente est conservée.');
    }

    async function restorePreviousGame() {
        const backup = getLatestBackup();
        if (!backup) {
            updateRestoreButton();
            notify('Aucune ancienne partie à restaurer.');
            return;
        }
        const currentState = readStoredState();
        if (currentState && hasProgress(currentState) && !(await confirmAction('Restaurer l’ancienne partie ? La partie actuelle sera remplacée.'))) return;
        clearFreshStartFlag();
        storeState(backup);
        postToGame({ type: 'loadState', value: backup });
        updateRestoreButton();
        notify('Ancienne partie restaurée.');
    }

    window.acquireVsCodeApi = function () {
        return {
            postMessage(message) {
                if (message.type === 'getState') {
                    loadState();
                } else if (message.type === 'saveState') {
                    storeState(message.value);
                } else if (message.type === 'showInfo') {
                    notify(message.value);
                } else if (message.type === 'updateStatus') {
                    document.body.dataset.pokemonActive = String(Boolean(message.active));
                } else if (message.type === 'githubSync') {
                    window.POKEIDLE_MCP_HOST?.sync();
                } else if (message.type === 'exportState') {
                    downloadState();
                } else if (message.type === 'importState') {
                    if (fileInput) fileInput.click();
                }
            }
        };
    };

    if (fileInput) fileInput.addEventListener('change', () => importState(fileInput.files && fileInput.files[0]));
    if (newGameButton) newGameButton.addEventListener('click', startNewGame);
    if (restoreButton) restoreButton.addEventListener('click', restorePreviousGame);
})();
