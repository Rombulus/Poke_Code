import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(symbol-event) PokeIdle: En attente...";
	statusBarItem.tooltip = "Cliquez pour ouvrir le Safari Pokémon";
	statusBarItem.command = 'poke-idle-view.focus';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	const provider = new PokeIdleProvider(context.extensionUri, context.globalState, statusBarItem);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PokeIdleProvider.viewType, provider)
	);
}

class PokeIdleProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'poke-idle-view';
	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _state: vscode.Memento,
		private readonly _statusBarItem: vscode.StatusBarItem
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'saveState':
					this._state.update('pokeData', data.value);
					break;
				case 'getState':
					const savedData = this._state.get('pokeData') || {
						pokedex: [],
						inventory: {
							pokeballs: 10,
							superballs: 0,
							hyperballs: 0,
							stones: {}
						},
						coins: 50,
						xp: 0,
						level: 1,
						missions: {
							captures: 0,
							evolutions: 0
						}
					};
					this._view?.webview.postMessage({ type: 'loadState', value: savedData });
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
                            <div class="lvl-badge">Nv.<span id="player-level">1</span></div>
                            <div class="xp-bar-container">
                                <div id="xp-progress" class="xp-progress" style="width: 0%"></div>
                            </div>
                        </div>
                        <div class="stats">
                            <span id="coin-count">0</span> <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" class="mini-icon">
                        </div>
                    </header>

                    <nav class="tabs">
                        <button class="tab-btn active" data-tab="safari">Safari</button>
                        <button class="tab-btn" data-tab="pokedex">Pokédex</button>
                        <button class="tab-btn" data-tab="shop">Boutique</button>
                        <button class="tab-btn" data-tab="missions">Missions</button>
                    </nav>

                    <div class="tab-content" id="safari-tab">
                        <div class="game-container">
                            <div id="spawn-area">
                                <div class="loader">Recherche de Pokémon...</div>
                            </div>
                        </div>
                        <div class="inventory-bar">
                            <div class="item-slot active" data-ball="pokeballs">
                                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png">
                                <span id="count-pokeballs">0</span>
                            </div>
                            <div class="item-slot" data-ball="superballs">
                                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png">
                                <span id="count-superballs">0</span>
                            </div>
                            <div class="item-slot" data-ball="hyperballs">
                                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png">
                                <span id="count-hyperballs">0</span>
                            </div>
                        </div>
                    </div>

                    <div class="tab-content hidden" id="pokedex-tab">
                        <div class="filter-bar">
                             <input type="text" id="poke-search" placeholder="Rechercher...">
                             <div id="pokedex-stats">Collection: <span id="pokedex-count">0</span></div>
                        </div>
                        <div id="pokedex-list" class="grid"></div>
                    </div>

                    <div class="tab-content hidden" id="shop-tab">
                        <h2>Boutique Pokémon</h2>
                        <div id="shop-list" class="shop-grid"></div>
                    </div>

                    <div class="tab-content hidden" id="missions-tab">
                        <h2>Objectifs & Évolutions</h2>
                        <div id="missions-list" class="mission-container">
                            <div class="mission-card">
                                <h3>Expert en Capture</h3>
                                <p>Capturez <span id="mission-capture-target">10</span> Pokémon.</p>
                                <div class="progress-bar"><div id="mission-capture-progress" style="width: 0%"></div></div>
                                <div class="reward">Récompense: 1x Pierre Feu</div>
                                <button id="claim-mission-1" class="claim-btn" disabled>Récupérer</button>
                            </div>
                        </div>
                    </div>
                </div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
