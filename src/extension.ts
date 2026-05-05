import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';

export function activate(context: vscode.ExtensionContext) {
	// Permet la synchronisation des données entre différents ordinateurs via VS Code Settings Sync
	context.globalState.setKeysForSync(['pokeState']);

	const provider = new PokeIdleProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PokeIdleProvider.viewType, provider),
		vscode.commands.registerCommand('pokeidle.giveCoins', () => provider.cheat('coins')),
		vscode.commands.registerCommand('pokeidle.giveStones', () => provider.cheat('stones')),
		vscode.commands.registerCommand('pokeidle.giveBalls', () => provider.cheat('balls')),
		vscode.commands.registerCommand('pokeidle.giveItem', () => provider.giveItem())
	);
}

class PokeIdleProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'poke-idle-view';
	private _view?: vscode.WebviewView;
	private _statusBarItem: vscode.StatusBarItem;
	private _githubPushTimer: NodeJS.Timeout | undefined;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext
	) {
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this._statusBarItem.text = "$(symbol-event) PokeIdle: Recherche...";
		this._statusBarItem.show();
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async data => {
			switch (data.type) {
				case 'saveState':
					try {
						const currentState = this._context.globalState.get('pokeState') as any;
						const mergedState = this._mergeStates(currentState, data.value);

						const savePath = this._getSavePath();
						fs.writeFileSync(savePath, JSON.stringify(mergedState, null, 2));

						this._context.globalState.update('pokeState', mergedState);

						// Push vers GitHub en arrière-plan (débounce 5 min)
						this._scheduledGitHubPush();
					} catch (e) {
						console.error("Save error:", e);
					}
					break;
				case 'getState':
					this._view?.webview.postMessage({ type: 'loadState', value: this._getCurrentState() });
					// Auto-sync GitHub silencieux 3s après le chargement
					setTimeout(() => this._autoGitHubSync(), 3000);
					break;
				case 'showInfo':
					vscode.window.showInformationMessage(data.value);
					break;
				case 'updateStatus':
					if (data.active) {
						this._statusBarItem.text = "$(zap) PokeIdle: Un Pokémon est là !";
						this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
					} else {
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

	private _getCurrentState(): any {
		const globalState = this._context.globalState.get('pokeState') as any;
		const savePath = this._getSavePath();
		let fileState: any = null;

		// Toujours lire le fichier JSON, même si globalState existe
		if (fs.existsSync(savePath)) {
			try {
				fileState = JSON.parse(fs.readFileSync(savePath, 'utf8'));
			} catch (e) {
				console.error("Load file error:", e);
			}
		}

		// Fusionner les deux sources pour récupérer le meilleur des deux mondes
		const merged = this._mergeStates(globalState, fileState);

		if (!merged) {
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

		// Resynchroniser les deux storages avec l'état fusionné
		this._context.globalState.update('pokeState', merged);
		try {
			fs.writeFileSync(savePath, JSON.stringify(merged, null, 2));
		} catch (e) {
			console.error("Sync file error:", e);
		}

		return merged;
	}

	private async _handleImport() {
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
			} catch (e) {
				vscode.window.showErrorMessage("Format de sauvegarde invalide.");
			}
		}
	}

	private async _handleGitHubSync() {
		try {
			const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
			if (!session) return;

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
			} else {
				// Créer un nouveau Gist avec l'état local
				await sync.createGist(localState);
				this._view?.webview.postMessage({ type: 'syncStatus', value: 'success', date: new Date().toLocaleString() });
				vscode.window.showInformationMessage("PokéCode : Premier Gist de sauvegarde créé sur GitHub !");
			}
		} catch (e) {
			console.error("GitHub Sync Error:", e);
			this._view?.webview.postMessage({ type: 'syncStatus', value: 'error' });
			vscode.window.showErrorMessage("Erreur lors de la synchronisation GitHub.");
		}
	}

	/**
	 * Sync silencieuse au démarrage : si une session GitHub existe déjà (sans en créer),
	 * on fusionne le Gist avec l'état local. Aucune notification, aucun blocage.
	 */
	private async _autoGitHubSync(): Promise<void> {
		try {
			const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: false });
			if (!session) return; // Pas de session → on ne fait rien

			const sync = new GitHubSync(session.accessToken);
			const remoteState = await sync.fetchGist();
			if (!remoteState) return; // Pas encore de Gist → on ne fait rien

			const localState = this._context.globalState.get('pokeState') as any;
			const merged = this._mergeStates(localState, remoteState);

			// Sauvegarder la fusion localement
			this._context.globalState.update('pokeState', merged);
			try { fs.writeFileSync(this._getSavePath(), JSON.stringify(merged, null, 2)); } catch { }

			// Mettre à jour le Gist avec l'état fusionné
			await sync.updateGist(merged);

			// Mettre à jour le webview
			this._view?.webview.postMessage({ type: 'loadState', value: merged });
			this._view?.webview.postMessage({
				type: 'syncStatus', value: 'success', date: new Date().toLocaleString()
			});
			console.log('[PokeCode] Auto-sync GitHub au démarrage réussie.');
		} catch (e) {
			// Silencieux : on log juste en console, pas de notification utilisateur
			console.warn('[PokeCode] Auto-sync GitHub échouée (normal si hors-ligne):', e);
		}
	}

	/**
	 * Planifie un push vers GitHub dans 5 minutes.
	 * Chaque nouvel appel réinitialise le timer (débounce).
	 * Silencieux : aucune notification utilisateur.
	 */
	private _scheduledGitHubPush(): void {
		if (this._githubPushTimer) {
			clearTimeout(this._githubPushTimer);
		}
		this._githubPushTimer = setTimeout(async () => {
			try {
				const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: false });
				if (!session) return;

				const sync = new GitHubSync(session.accessToken);
				const currentState = this._getCurrentState();
				await sync.updateGist(currentState);

				this._view?.webview.postMessage({
					type: 'syncStatus', value: 'success', date: new Date().toLocaleString()
				});
				console.log('[PokeCode] Push GitHub automatique réussi.');
			} catch (e) {
				console.warn('[PokeCode] Push GitHub automatique échoué (normal si hors-ligne):', e);
			}
		}, 5 * 60 * 1000); // 5 minutes
	}

	public cheat(type: string) {
		let state = this._context.globalState.get('pokeState') as any;
		if (!state) return;

		if (type === 'coins') {
			state.coins += 100000;
			vscode.window.showInformationMessage('Cheat : 100 000 Pièces ajoutées !');
		} else if (type === 'stones') {
			if (!state.inventory) state.inventory = { stones: {}, balls: {} };
			if (!state.inventory.stones) state.inventory.stones = {};
			const allStones = [
				'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone',
				'moon-stone', 'sun-stone', 'ice-stone', 'shiny-stone',
				'dusk-stone', 'dawn-stone', 'linking-cord', 'metal-coat',
				'kings-rock', 'dragon-scale', 'upgrade', 'dubious-disc',
				'protector', 'reaper-cloth', 'electirizer', 'magmarizer',
				'prism-scale', 'razor-claw', 'razor-fang',
				'sweet-apple', 'tart-apple', 'syrupy-apple',
				'cracked-pot', 'chipped-pot', 'malicious-armor', 'auspicious-armor',
				'black-augurite', 'peat-block', 'galarica-cuff', 'galarica-wreath',
				'unremarkable-teacup', 'masterpiece-teacup', 'metal-alloy',
				'sachet', 'whipped-dream', 'deep-sea-tooth', 'deep-sea-scale',
				'leaders-crest', 'strawberry-sweet', 'gimmighoul-coin',
				'alora-sand', 'rock-peak', 'galar-vapor', 'ancient-manuscript',
				'boussole-magnetique', 'cable-croise', 'masque-maudit', 'carte-de-voyage',
				'pokego-candy'
			];
			allStones.forEach(s => {
				state.inventory.stones[s] = (state.inventory.stones[s] || 0) + 10;
			});
			vscode.window.showInformationMessage('Cheat : Toutes les pierres ajoutées !');
		} else if (type === 'balls') {
			if (!state.inventory) state.inventory = { stones: {}, balls: {} };
			if (!state.inventory.balls) state.inventory.balls = {};
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

	public async giveItem() {
		const allStones = [
			'fire-stone', 'water-stone', 'leaf-stone', 'thunder-stone', 'ice-stone', 'moon-stone', 'sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone',
			'kings-rock', 'metal-coat', 'protector', 'electirizer', 'magmarizer', 'reaper-cloth', 'dragon-scale', 'prism-scale', 'upgrade', 'dubious-disc',
			'linking-cord', 'soothe-bell', 'razor-fang', 'razor-claw', 'black-augurite', 'peat-block', 'galarica-cuff', 'galarica-wreath',
			'sweet-apple', 'tart-apple', 'syrupy-apple', 'chipped-pot', 'cracked-pot', 'auspicious-armor', 'malicious-armor', 'scroll-of-darkness', 'scroll-of-waters',
			'gimmighoul-coin', 'unremarkable-teacup', 'masterpiece-teacup', 'leaders-crest', 'sachet', 'whipped-dream', 'deep-sea-tooth', 'deep-sea-scale', 'alora-sand'
		];
		const allBalls = ['pokeball', 'superball', 'hyperball', 'masterball', 'sombreball', 'quickball', 'luxeball', 'soinball', 'filetball', 'faibleball', 'scaphandreball', 'amourball'];

		const items = [
			...allBalls.map(b => ({ label: `Ball: ${b}`, id: b, type: 'ball' })),
			...allStones.map(s => ({ label: `Pierre: ${s}`, id: s, type: 'stone' }))
		];

		const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Sélectionnez un objet à obtenir' });
		if (!selected) return;

		const quantityStr = await vscode.window.showInputBox({
			prompt: `Quantité pour ${selected.label}`,
			placeHolder: 'Ex: 50',
			validateInput: (value) => isNaN(Number(value)) ? 'Entrez un nombre valide' : null
		});

		if (!quantityStr) return;
		const quantity = Math.floor(Number(quantityStr));

		let state = this._context.globalState.get('pokeState') as any;
		if (!state) return;

		if (!state.inventory) state.inventory = { stones: {}, balls: {} };
		if (selected.type === 'ball') {
			if (!state.inventory.balls) state.inventory.balls = {};
			state.inventory.balls[selected.id] = (state.inventory.balls[selected.id] || 0) + quantity;
		} else {
			if (!state.inventory.stones) state.inventory.stones = {};
			state.inventory.stones[selected.id] = (state.inventory.stones[selected.id] || 0) + quantity;
		}

		state.lastUpdate = Date.now();
		this._context.globalState.update('pokeState', state);
		this._view?.webview.postMessage({ type: 'loadState', value: state });
		vscode.window.showInformationMessage(`Cheat : ${quantity}x ${selected.label} ajouté(s) !`);
	}

	private _mergeStates(s1: any, s2: any): any {
		if (!s1) return s2;
		if (!s2) return s1;

		const s1Time = s1.lastUpdate || 0;
		const s2Time = s2.lastUpdate || 0;
		// On identifie qui est le plus récent (Last-Write-Wins de base)
		const newer = s2Time >= s1Time ? s2 : s1;
		const older = newer === s2 ? s1 : s2;

		const merged = { ...newer };

		// --- Ressources Snapshot (Last-Write-Wins) ---
		// On fait confiance au plus récent pour ce qui peut diminuer (dépenses, utilisation d'objets)
		merged.coins = newer.coins || 0;
		merged.inventory = {
			balls: { ...(newer.inventory?.balls || {}) },
			stones: { ...(newer.inventory?.stones || {}) }
		};

		// --- Progression de Niveau (Max robuste) ---
		// L'XP descend quand on monte de niveau, donc on fusionne par Niveau d'abord
		if ((older.level || 1) > (newer.level || 1)) {
			merged.level = older.level;
			merged.xp = older.xp;
		} else if ((older.level || 1) === (newer.level || 1)) {
			merged.xp = Math.max(newer.xp || 0, older.xp || 0);
		}
		// Si newer.level > older.level, on garde les valeurs de newer déjà présentes dans merged

		// --- Pokédex & Découvertes (Union cumulative) ---
		merged.released = Array.from(new Set([...(s1.released || []), ...(s2.released || [])]));
		const pokedexMap = new Map();
		[...(s1.pokedex || []), ...(s2.pokedex || [])].forEach(p => {
			if (!p || merged.released.includes(p.instanceId)) return;
			const existing = pokedexMap.get(p.instanceId);
			// On garde le Pokémon s'il est unique, ou on garde la version la plus haut niveau
			if (!existing || (p.level || 0) > (existing.level || 0)) {
				pokedexMap.set(p.instanceId, p);
			}
		});
		merged.pokedex = Array.from(pokedexMap.values());
		merged.discovery = { ...(s1.discovery || {}), ...(s2.discovery || {}) };

		// --- Missions (Union des succès) ---
		merged.missions = {
			...newer.missions,
			claimed: Array.from(new Set([...(s1.missions?.claimed || []), ...(s2.missions?.claimed || [])]))
		};
		merged.missions.typeProgress = { ...(s1.missions?.typeProgress || {}) };
		if (older.missions?.typeProgress) {
			Object.keys(older.missions.typeProgress).forEach(k => {
				merged.missions.typeProgress[k] = Math.max(merged.missions.typeProgress[k] || 0, older.missions.typeProgress[k]);
			});
		}

		// --- Statistiques & Flags (Max/OR) ---
		merged.stats = { ...(newer.stats || {}) };
		if (older.stats) {
			Object.keys(older.stats).forEach(k => {
				merged.stats[k] = Math.max(merged.stats[k] || 0, older.stats[k]);
			});
		}

		// Flags de quêtes (Union des complétions)
		merged.middayCaptures = Math.max(s1.middayCaptures || 0, s2.middayCaptures || 0);
		merged.dawnCaptureAchieved = s1.dawnCaptureAchieved || s2.dawnCaptureAchieved || false;
		merged.soldLevel50 = s1.soldLevel50 || s2.soldLevel50 || false;
		merged.ningaleEvolvedWithBalls = s1.ningaleEvolvedWithBalls || s2.ningaleEvolvedWithBalls || false;
		merged.boughtAbove10000 = s1.boughtAbove10000 || s2.boughtAbove10000 || false;

		// Timestamps (Prendre le plus récent pour chaque action)
		merged.lastCaptureTimestamp = Math.max(s1.lastCaptureTimestamp || 0, s2.lastCaptureTimestamp || 0);
		merged.lastEvoTimestamp = Math.max(s1.lastEvoTimestamp || 0, s2.lastEvoTimestamp || 0);
		merged.lastPurchaseTimestamp = Math.max(s1.lastPurchaseTimestamp || 0, s2.lastPurchaseTimestamp || 0);

		// /!\ IMPORTANT : On ne génère pas de nouveau Date.now() ici
		// On garde le timestamp de la version la plus récente pour éviter de dériver du webview
		merged.lastUpdate = Math.max(s1Time, s2Time);
		return merged;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
		const pokedollarUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'pokedollar.png'));

		return `<!DOCTYPE html>
			<html lang="fr">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>PokeIdle</title>
                <script>
                    window.POKEDOLLAR_URI = "${pokedollarUri}";
                </script>
			</head>
			<body>
				<div id="app">
                    <header>
                        <div class="user-profile">
                            <div class="lvl-badge">Nv.<span id="player-level">1</span> <span class="v-tag">v0.9.0</span></div>
                            <div class="xp-bar-container">
                                <div id="xp-progress" class="xp-progress" style="width: 0%"></div>
                            </div>
                        </div>
                        <div class="stats">
                            <span><span id="coin-count">0</span> <img src="${pokedollarUri}" class="pokedollar-icon" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;"></span>
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
                                <option value="duplicates">Doublons</option>
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

	private _getSavePath(): string {
		return path.join(os.homedir(), '.poke-idle-save.json');
	}
}

class GitHubSync {
	private readonly GIST_DESCRIPTION = "PokeIdle Save Game (Antigravity)";
	private readonly FILE_NAME = "poke-idle-save.json";

	constructor(private token: string) { }

	async fetchGist(): Promise<any | null> {
		const gists = await this._apiCall('GET', '/gists');
		const pokeGist = gists.find((g: any) => g.description === this.GIST_DESCRIPTION);

		if (!pokeGist) return null;

		const fullGist = await this._apiCall('GET', `/gists/${pokeGist.id}`);
		const content = fullGist.files[this.FILE_NAME]?.content;
		return content ? JSON.parse(content) : null;
	}

	async createGist(state: any): Promise<void> {
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

	async updateGist(state: any): Promise<void> {
		const gists = await this._apiCall('GET', '/gists');
		const pokeGist = gists.find((g: any) => g.description === this.GIST_DESCRIPTION);
		if (!pokeGist) return this.createGist(state);

		await this._apiCall('PATCH', `/gists/${pokeGist.id}`, {
			files: {
				[this.FILE_NAME]: {
					content: JSON.stringify(state)
				}
			}
		});
	}

	private _apiCall(method: string, endpoint: string, body?: any): Promise<any> {
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
					} else {
						reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
					}
				});
			});

			req.on('error', reject);
			if (body) req.write(JSON.stringify(body));
			req.end();
		});
	}
}
