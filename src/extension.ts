import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	const provider = new PokeIdleProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PokeIdleProvider.viewType, provider)
	);
}

class PokeIdleProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'poke-idle-view';
	private _view?: vscode.WebviewView;
	private _statusBarItem: vscode.StatusBarItem;

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

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'saveState':
					this._context.globalState.update('pokeState', data.value);
					break;
				case 'getState':
					const savedState = this._context.globalState.get('pokeState');
					if (savedState) {
						this._view?.webview.postMessage({ type: 'loadState', value: savedState });
					} else {
						// État initial si aucune sauvegarde
						this._view?.webview.postMessage({ type: 'loadState', value: { 
							pokedex: [], 
							inventory: { balls: { pokeball: 20 }, stones: {} }, 
							coins: 200, 
							xp: 0, 
							level: 1, 
							missions: { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] },
							spawnTimer: 180 
						}});
					}
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
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
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
                            <span><span id="coin-count">0</span> <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-dollar.png" class="mini-icon"></span>
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
                                <div class="loader">Recherche de Pokémon...</div>
                            </div>
                        </div>
                        <div class="inventory-bar" id="ball-inventory">
                            <!-- Les balls seront générées dynamiquement ici -->
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
}
