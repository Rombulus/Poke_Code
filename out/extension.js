"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const https = __importStar(require("https"));
function activate(context) {
    // Permet la synchronisation des données entre différents ordinateurs via VS Code Settings Sync
    context.globalState.setKeysForSync(['pokeState']);
    const provider = new PokeIdleProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(PokeIdleProvider.viewType, provider), vscode.commands.registerCommand('pokeidle.giveCoins', () => provider.cheat('coins')), vscode.commands.registerCommand('pokeidle.giveStones', () => provider.cheat('stones')), vscode.commands.registerCommand('pokeidle.giveBalls', () => provider.cheat('balls')), vscode.commands.registerCommand('pokeidle.giveItem', () => provider.giveItem()));
}
exports.activate = activate;
class PokeIdleProvider {
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._statusBarItem.text = "$(symbol-event) PokeIdle: Recherche...";
        this._statusBarItem.show();
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'saveState':
                    try {
                        const currentState = this._context.globalState.get('pokeState');
                        const mergedState = this._mergeStates(currentState, data.value);
                        const savePath = this._getSavePath();
                        fs.writeFileSync(savePath, JSON.stringify(mergedState, null, 2));
                        this._context.globalState.update('pokeState', mergedState);
                    }
                    catch (e) {
                        console.error("Save error:", e);
                    }
                    break;
                case 'getState':
                    this._view?.webview.postMessage({ type: 'loadState', value: this._getCurrentState() });
                    break;
                case 'showInfo':
                    vscode.window.showInformationMessage(data.value);
                    break;
                case 'updateStatus':
                    if (data.active) {
                        this._statusBarItem.text = "$(zap) PokeIdle: Un Pokémon est là !";
                        this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                    }
                    else {
                        this._statusBarItem.text = "$(symbol-event) PokeIdle: Recherche...";
                        this._statusBarItem.backgroundColor = undefined;
                    }
                    break;
                case 'evoNotify':
                    const originalText = this._statusBarItem.text;
                    this._statusBarItem.text = `$(star-full) PokeIdle: ${data.value} vient d'évoluer !`;
                    this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                    setTimeout(() => {
                        this._statusBarItem.text = originalText;
                        this._statusBarItem.backgroundColor = undefined;
                    }, 5000);
                    break;
                case 'githubSync':
                    await this._handleGitHubSync();
                    break;
                case 'exportState':
                    const stateToExport = this._getCurrentState();
                    this._view?.webview.postMessage({ type: 'copyToClipboard', value: JSON.stringify(stateToExport) });
                    vscode.window.showInformationMessage("Sauvegarde copiée dans le presse-papier !");
                    break;
                case 'importState':
                    await this._handleImport();
                    break;
            }
        });
    }
    _getCurrentState() {
        let state = this._context.globalState.get('pokeState');
        const savePath = this._getSavePath();
        if (!state && fs.existsSync(savePath)) {
            try {
                const fileContent = fs.readFileSync(savePath, 'utf8');
                state = JSON.parse(fileContent);
                this._context.globalState.update('pokeState', state);
            }
            catch (e) {
                console.error("Load file error:", e);
            }
        }
        if (!state) {
            return {
                pokedex: [],
                inventory: { balls: { pokeball: 20 }, stones: {} },
                coins: 200,
                xp: 0,
                level: 1,
                missions: { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] },
                spawnTimer: 180,
                discovery: {}
            };
        }
        return state;
    }
    async _handleImport() {
        const input = await vscode.window.showInputBox({
            prompt: "Collez votre JSON de sauvegarde ici",
            placeHolder: '{"pokedex": [...], ...}'
        });
        if (input) {
            try {
                const newState = JSON.parse(input);
                const currentState = this._context.globalState.get('pokeState');
                const merged = this._mergeStates(currentState, newState);
                this._context.globalState.update('pokeState', merged);
                this._view?.webview.postMessage({ type: 'loadState', value: merged });
                vscode.window.showInformationMessage("Sauvegarde importée et fusionnée avec succès !");
            }
            catch (e) {
                vscode.window.showErrorMessage("Format de sauvegarde invalide.");
            }
        }
    }
    async _handleGitHubSync() {
        try {
            const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
            if (!session)
                return;
            this._view?.webview.postMessage({ type: 'syncStatus', value: 'inprogress' });
            const sync = new GitHubSync(session.accessToken);
            const localState = this._getCurrentState();
            // 1. Chercher un Gist existant
            let remoteState = await sync.fetchGist();
            if (remoteState) {
                // 2. Fusionner
                const merged = this._mergeStates(localState, remoteState);
                this._context.globalState.update('pokeState', merged);
                // 3. Pousser vers GitHub
                await sync.updateGist(merged);
                this._view?.webview.postMessage({ type: 'loadState', value: merged });
                this._view?.webview.postMessage({ type: 'syncStatus', value: 'success', date: new Date().toLocaleString() });
                vscode.window.showInformationMessage("PokéCode : Synchronisation GitHub réussie !");
            }
            else {
                // Créer un nouveau Gist avec l'état local
                await sync.createGist(localState);
                this._view?.webview.postMessage({ type: 'syncStatus', value: 'success', date: new Date().toLocaleString() });
                vscode.window.showInformationMessage("PokéCode : Premier Gist de sauvegarde créé sur GitHub !");
            }
        }
        catch (e) {
            console.error("GitHub Sync Error:", e);
            this._view?.webview.postMessage({ type: 'syncStatus', value: 'error' });
            vscode.window.showErrorMessage("Erreur lors de la synchronisation GitHub.");
        }
    }
    cheat(type) {
        let state = this._context.globalState.get('pokeState');
        if (!state)
            return;
        if (type === 'coins') {
            state.coins += 100000;
            vscode.window.showInformationMessage('Cheat : 100 000 Pièces ajoutées !');
        }
        else if (type === 'stones') {
            if (!state.inventory)
                state.inventory = { stones: {}, balls: {} };
            if (!state.inventory.stones)
                state.inventory.stones = {};
            const allStones = [
                'fire-stone', 'water-stone', 'leaf-stone', 'thunder-stone', 'ice-stone', 'moon-stone', 'sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone',
                'kings-rock', 'metal-coat', 'protector', 'electirizer', 'magmarizer', 'reaper-cloth', 'dragon-scale', 'prism-scale', 'upgrade', 'dubious-disc',
                'linking-cord', 'soothe-bell', 'razor-fang', 'razor-claw', 'black-augurite', 'peat-block', 'galarica-cuff', 'galarica-wreath',
                'sweet-apple', 'tart-apple', 'chipped-pot', 'cracked-pot', 'auspicious-armor', 'malicious-armor', 'scroll-of-darkness', 'scroll-of-waters', 'gimmighoul-coin'
            ];
            allStones.forEach(s => {
                state.inventory.stones[s] = (state.inventory.stones[s] || 0) + 10;
            });
            vscode.window.showInformationMessage('Cheat : Toutes les pierres ajoutées !');
        }
        else if (type === 'balls') {
            if (!state.inventory)
                state.inventory = { stones: {}, balls: {} };
            if (!state.inventory.balls)
                state.inventory.balls = {};
            const allBalls = ['pokeball', 'superball', 'hyperball', 'masterball', 'sombreball', 'quickball', 'luxeball', 'soinball', 'filetball', 'faibleball', 'scaphandreball', 'amourball'];
            allBalls.forEach(b => {
                state.inventory.balls[b] = (state.inventory.balls[b] || 0) + 100;
            });
            vscode.window.showInformationMessage('Cheat : 100 de chaque Pokéball ajoutées !');
        }
        state.lastUpdate = Date.now();
        this._context.globalState.update('pokeState', state);
        this._view?.webview.postMessage({ type: 'loadState', value: state });
    }
    async giveItem() {
        const allStones = [
            'fire-stone', 'water-stone', 'leaf-stone', 'thunder-stone', 'ice-stone', 'moon-stone', 'sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone',
            'kings-rock', 'metal-coat', 'protector', 'electirizer', 'magmarizer', 'reaper-cloth', 'dragon-scale', 'prism-scale', 'upgrade', 'dubious-disc',
            'linking-cord', 'soothe-bell', 'razor-fang', 'razor-claw', 'black-augurite', 'peat-block', 'galarica-cuff', 'galarica-wreath',
            'sweet-apple', 'tart-apple', 'chipped-pot', 'cracked-pot', 'auspicious-armor', 'malicious-armor', 'scroll-of-darkness', 'scroll-of-waters', 'gimmighoul-coin'
        ];
        const allBalls = ['pokeball', 'superball', 'hyperball', 'masterball', 'sombreball', 'quickball', 'luxeball', 'soinball', 'filetball', 'faibleball', 'scaphandreball', 'amourball'];
        const items = [
            ...allBalls.map(b => ({ label: `Ball: ${b}`, id: b, type: 'ball' })),
            ...allStones.map(s => ({ label: `Pierre: ${s}`, id: s, type: 'stone' }))
        ];
        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Sélectionnez un objet à obtenir' });
        if (!selected)
            return;
        const quantityStr = await vscode.window.showInputBox({
            prompt: `Quantité pour ${selected.label}`,
            placeHolder: 'Ex: 50',
            validateInput: (value) => isNaN(Number(value)) ? 'Entrez un nombre valide' : null
        });
        if (!quantityStr)
            return;
        const quantity = Math.floor(Number(quantityStr));
        let state = this._context.globalState.get('pokeState');
        if (!state)
            return;
        if (!state.inventory)
            state.inventory = { stones: {}, balls: {} };
        if (selected.type === 'ball') {
            if (!state.inventory.balls)
                state.inventory.balls = {};
            state.inventory.balls[selected.id] = (state.inventory.balls[selected.id] || 0) + quantity;
        }
        else {
            if (!state.inventory.stones)
                state.inventory.stones = {};
            state.inventory.stones[selected.id] = (state.inventory.stones[selected.id] || 0) + quantity;
        }
        state.lastUpdate = Date.now();
        this._context.globalState.update('pokeState', state);
        this._view?.webview.postMessage({ type: 'loadState', value: state });
        vscode.window.showInformationMessage(`Cheat : ${quantity}x ${selected.label} ajouté(s) !`);
    }
    _mergeStates(s1, s2) {
        if (!s1)
            return s2;
        if (!s2)
            return s1;
        const s1Time = s1.lastUpdate || 0;
        const s2Time = s2.lastUpdate || 0;
        const newer = s2Time >= s1Time ? s2 : s1;
        const merged = { ...newer };
        // Toujours prendre le max pour les ressources
        merged.coins = Math.max(s1.coins || 0, s2.coins || 0);
        merged.xp = Math.max(s1.xp || 0, s2.xp || 0);
        merged.level = Math.max(s1.level || 0, s2.level || 0);
        // Inventaire (Union et Max)
        merged.inventory = { balls: { ...(s1.inventory?.balls || {}) }, stones: { ...(s1.inventory?.stones || {}) } };
        if (s2.inventory?.balls) {
            Object.entries(s2.inventory.balls).forEach(([k, v]) => {
                merged.inventory.balls[k] = Math.max(merged.inventory.balls[k] || 0, v);
            });
        }
        if (s2.inventory?.stones) {
            Object.entries(s2.inventory.stones).forEach(([k, v]) => {
                merged.inventory.stones[k] = Math.max(merged.inventory.stones[k] || 0, v);
            });
        }
        // Pokédex (Union et Max niveau)
        merged.released = Array.from(new Set([...(s1.released || []), ...(s2.released || [])]));
        const pokedexMap = new Map();
        [...(s1.pokedex || []), ...(s2.pokedex || [])].forEach(p => {
            if (!p || merged.released.includes(p.instanceId))
                return;
            const existing = pokedexMap.get(p.instanceId);
            if (!existing || (p.level || 0) > (existing.level || 0)) {
                pokedexMap.set(p.instanceId, p);
            }
        });
        merged.pokedex = Array.from(pokedexMap.values());
        // Missions
        merged.missions = {
            ...newer.missions,
            claimed: Array.from(new Set([...(s1.missions?.claimed || []), ...(s2.missions?.claimed || [])]))
        };
        merged.missions.typeProgress = { ...(s1.missions?.typeProgress || {}) };
        if (s2.missions?.typeProgress) {
            Object.keys(s2.missions.typeProgress).forEach(k => {
                merged.missions.typeProgress[k] = Math.max(merged.missions.typeProgress[k] || 0, s2.missions.typeProgress[k]);
            });
        }
        // Stats
        merged.stats = { ...(s1.stats || {}) };
        if (s2.stats) {
            Object.keys(s2.stats).forEach(k => {
                merged.stats[k] = Math.max(merged.stats[k] || 0, s2.stats[k]);
            });
        }
        // Quest trackers
        merged.middayCaptures = Math.max(s1.middayCaptures || 0, s2.middayCaptures || 0);
        merged.dawnCaptureAchieved = s1.dawnCaptureAchieved || s2.dawnCaptureAchieved || false;
        merged.soldLevel50 = s1.soldLevel50 || s2.soldLevel50 || false;
        merged.ningaleEvolvedWithBalls = s1.ningaleEvolvedWithBalls || s2.ningaleEvolvedWithBalls || false;
        merged.boughtAbove10000 = s1.boughtAbove10000 || s2.boughtAbove10000 || false;
        // Timestamps (pick most recent)
        merged.lastCaptureTimestamp = Math.max(s1.lastCaptureTimestamp || 0, s2.lastCaptureTimestamp || 0);
        merged.lastEvoTimestamp = Math.max(s1.lastEvoTimestamp || 0, s2.lastEvoTimestamp || 0);
        merged.lastPurchaseTimestamp = Math.max(s1.lastPurchaseTimestamp || 0, s2.lastPurchaseTimestamp || 0);
        merged.lastUpdate = Date.now();
        return merged;
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        return `<!DOCTYPE html>
			<html lang="fr">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>PokeIdle</title>
			</head>
			<body>
				<div id="app">
                    <header>
                        <div class="user-profile">
                            <div class="lvl-badge">Nv.<span id="player-level">1</span> <span class="v-tag">v0.7.0</span></div>
                            <div class="xp-bar-container">
                                <div id="xp-progress" class="xp-progress" style="width: 0%"></div>
                            </div>
                        </div>
                        <div class="stats">
                            <span><span id="coin-count">0</span> <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/nugget.png" class="mini-icon"></span>
                            <span><span id="pokedex-count">0</span> 🐾</span>
                        </div>
                    </header>

                    <nav class="tabs">
                        <button class="tab-btn active" data-tab="safari-tab">Safari <div class="notification-badge" id="badge-safari"></div></button>
                        <button class="tab-btn" data-tab="pokedex-tab">Pokédex</button>
                        <button class="tab-btn" data-tab="shop-tab">Boutique</button>
                        <button class="tab-btn" data-tab="missions-tab">Missions <div class="notification-badge" id="badge-missions"></div></button>
                        <button class="tab-btn" data-tab="settings-tab">⚙️</button>
                    </nav>

                    <div class="tab-content" id="safari-tab">
                        <div class="walker-container">
                            <div class="tall-grass"></div>
                            <div class="trainer-walker"></div>
                        </div>
                        <div class="game-container">
                            <div id="spawn-area">
                                <div class="loader">Zone de Safari calme...</div>
                            </div>
                        </div>
                        <div class="inventory-bar" id="ball-inventory">
                            <!-- Balls generees dynamiquement -->
                        </div>
                        <div class="inventory-bar" id="stone-inventory" style="margin-top: 10px;">
                            <!-- Pierres generees dynamiquement -->
                        </div>
                    </div>

                    <div class="tab-content hidden" id="pokedex-tab">
                        <div class="pokedex-controls">
                            <input type="text" id="poke-search" placeholder="Rechercher un Pokémon...">
                            <select id="pokedex-sort">
                                <option value="id">Ordre Pokéball</option>
                                <option value="name-asc">Nom (A -> Z)</option>
                                <option value="name-desc">Nom (Z -> A)</option>
                                <option value="level-desc">Niveau (+ -> -)</option>
                                <option value="level-asc">Niveau (- -> +)</option>
                                <option value="can-evolve">Peut Evoluer</option>
                                <option value="final-stage">Stade Final</option>
                            </select>
                        </div>
                        <div id="pokedex-list" class="pokedex-list">
                            <!-- Pokedex items here -->
                        </div>
                    </div>

                    <div class="tab-content hidden" id="shop-tab">
                        <div id="shop-list" class="shop-list">
                            <!-- Shop items here -->
                        </div>
                    </div>

                    <div class="tab-content hidden" id="missions-tab">
                        <div id="missions-list" class="missions-list">
                            <!-- Missions here -->
                        </div>
                    </div>

                    <div class="tab-content hidden" id="settings-tab">
                        <div class="settings-view">
                            <h3>Synchronisation Cloud</h3>
                            <button id="btn-github-sync" class="main-btn">
                                <span class="icon">☁️</span> Synchroniser avec GitHub
                            </button>
                            <div id="sync-status" class="sync-status">Non connecté</div>

                            <hr>

                            <h3>Transfert Manuel</h3>
                            <div class="btn-row">
                                <button id="btn-export" class="mini-btn">Exporter JSON</button>
                                <button id="btn-import" class="mini-btn">Importer JSON</button>
                            </div>
                            <p class="hint">Utilisez l'export/import pour transférer manuellement votre sauvegarde entre deux instances Antigravity.</p>
                        </div>
                    </div>
				</div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
    _getSavePath() {
        return path.join(os.homedir(), '.poke-idle-save.json');
    }
}
PokeIdleProvider.viewType = 'poke-idle-view';
class GitHubSync {
    constructor(token) {
        this.token = token;
        this.GIST_DESCRIPTION = "PokeIdle Save Game (Antigravity)";
        this.FILE_NAME = "poke-idle-save.json";
    }
    async fetchGist() {
        const gists = await this._apiCall('GET', '/gists');
        const pokeGist = gists.find((g) => g.description === this.GIST_DESCRIPTION);
        if (!pokeGist)
            return null;
        const fullGist = await this._apiCall('GET', `/gists/${pokeGist.id}`);
        const content = fullGist.files[this.FILE_NAME]?.content;
        return content ? JSON.parse(content) : null;
    }
    async createGist(state) {
        await this._apiCall('POST', '/gists', {
            description: this.GIST_DESCRIPTION,
            public: false,
            files: {
                [this.FILE_NAME]: {
                    content: JSON.stringify(state)
                }
            }
        });
    }
    async updateGist(state) {
        const gists = await this._apiCall('GET', '/gists');
        const pokeGist = gists.find((g) => g.description === this.GIST_DESCRIPTION);
        if (!pokeGist)
            return this.createGist(state);
        await this._apiCall('PATCH', `/gists/${pokeGist.id}`, {
            files: {
                [this.FILE_NAME]: {
                    content: JSON.stringify(state)
                }
            }
        });
    }
    _apiCall(method, endpoint, body) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: endpoint,
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'PokeIdle-VSCode-Extension',
                    'Content-Type': 'application/json'
                }
            };
            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data ? JSON.parse(data) : null);
                    }
                    else {
                        reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
                    }
                });
            });
            req.on('error', reject);
            if (body)
                req.write(JSON.stringify(body));
            req.end();
        });
    }
}
//# sourceMappingURL=extension.js.map