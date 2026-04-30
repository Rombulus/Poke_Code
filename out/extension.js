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
        webviewView.webview.onDidReceiveMessage(data => {
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
                    let stateToLoad = this._context.globalState.get('pokeState');
                    const savePath = this._getSavePath();
                    // Si le globalState est vide, on tente de migrer depuis l'ancien fichier local
                    if (!stateToLoad && fs.existsSync(savePath)) {
                        try {
                            const fileContent = fs.readFileSync(savePath, 'utf8');
                            stateToLoad = JSON.parse(fileContent);
                            this._context.globalState.update('pokeState', stateToLoad);
                        }
                        catch (e) {
                            console.error("Load file error:", e);
                        }
                    }
                    if (stateToLoad) {
                        this._view?.webview.postMessage({ type: 'loadState', value: stateToLoad });
                    }
                    else {
                        // État initial
                        this._view?.webview.postMessage({
                            type: 'loadState', value: {
                                pokedex: [],
                                inventory: { balls: { pokeball: 20 }, stones: {} },
                                coins: 200,
                                xp: 0,
                                level: 1,
                                missions: { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] },
                                spawnTimer: 180,
                                discovery: {}
                            }
                        });
                    }
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
            }
        });
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
        // Stratégie de fusion :
        // 1. Pokédex et Missions : Union (on ne veut jamais perdre un Pokémon ou une quête faite)
        // 2. Monnaie, Inventaire, XP : Le plus récent gagne (pour permettre de dépenser/consommer)
        const s1Time = s1.lastUpdate || 0;
        const s2Time = s2.lastUpdate || 0;
        const newer = s2Time >= s1Time ? s2 : s1;
        const older = s2Time >= s1Time ? s1 : s2;
        const merged = { ...newer };
        // Fusion des Relâchés (Tombstone pour les ventes)
        merged.released = Array.from(new Set([...(s1.released || []), ...(s2.released || [])]));
        // Fusion du Pokédex (Union)
        const pokedexMap = new Map();
        [...(s1.pokedex || []), ...(s2.pokedex || [])].forEach(p => {
            if (!p || merged.released.includes(p.instanceId))
                return;
            const existing = pokedexMap.get(p.instanceId);
            if (!existing || (p.level || 0) > (existing.level || 0) || (p.xp || 0) > (existing.xp || 0)) {
                pokedexMap.set(p.instanceId, p);
            }
        });
        merged.pokedex = Array.from(pokedexMap.values());
        // Fusion des Missions (Union des terminées + Max progrès)
        merged.missions = {
            ...newer.missions,
            claimed: Array.from(new Set([...(s1.missions?.claimed || []), ...(s2.missions?.claimed || [])]))
        };
        // Pour le progrès des types, on garde le max pour ne pas reculer
        merged.missions.typeProgress = { ...(s1.missions?.typeProgress || {}) };
        if (s2.missions?.typeProgress) {
            Object.keys(s2.missions.typeProgress).forEach(k => {
                merged.missions.typeProgress[k] = Math.max(merged.missions.typeProgress[k] || 0, s2.missions.typeProgress[k]);
            });
        }
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
                            <div class="lvl-badge">Nv.<span id="player-level">1</span> <span class="v-tag">v0.6.2</span></div>
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
                        <button class="tab-btn active" data-tab="safari-tab">Safari</button>
                        <button class="tab-btn" data-tab="pokedex-tab">Pokédex</button>
                        <button class="tab-btn" data-tab="shop-tab">Boutique</button>
                        <button class="tab-btn" data-tab="missions-tab">Missions</button>
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
//# sourceMappingURL=extension.js.map