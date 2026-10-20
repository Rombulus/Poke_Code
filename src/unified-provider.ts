import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class UnifiedPokeIdleProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'poke-idle-view';
    private _view?: vscode.WebviewView;
    private _github: any;
    private _revision = 0;
    private _generation = 0;
    private _syncing = false;
    private _blocked = false;
    private _startup: Promise<void> = Promise.resolve();
    private _statusBarItem: vscode.StatusBarItem;
    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {
        this._github = require(path.join(_extensionUri.fsPath, 'sync/runtime.cjs')).createRuntime(_extensionUri.fsPath);
        if (!this._github.store.state() && _context.globalState.get('pokeState')) {
            const current = this._github.store.read();
            this._github.store.replace(_context.globalState.get('pokeState'), current.revision);
        }
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._statusBarItem.text = '$(symbol-event) PokeIdle';
        this._statusBarItem.command = 'pokeidle.sync';
        this._statusBarItem.show();
        _context.subscriptions.push(this._statusBarItem);
    }
    public resolveWebviewView(view: vscode.WebviewView) {
        this._view = view;
        this._blocked = false;
        view.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        this._startup = this._github.synchronize().catch(() => {});
        view.webview.onDidReceiveMessage(async (data: any) => {
            try {
                switch (data.type) {
                    case 'getState': await this._startup; this._sendState(); this._showSync(this._github.status()); break;
                    case 'saveState':
                        if (this._blocked) return;
                        if (data.generation !== this._generation) {
                            this._github.store.archive(data.value, 'ancienne-fenetre');
                            throw new Error('Une ancienne fenêtre tente de sauvegarder. Sa partie est conservée. Rouvre le panneau PokeIdle.');
                        }
                        this._saveCurrentState(data.value); break;
                    case 'githubSync': await this.synchronize(); break;
                    case 'githubAction': await this.synchronize(data.action, data.repository, false, data.branch, data.allowPublic === true); break;
                    case 'exportState':
                        await vscode.env.clipboard.writeText(JSON.stringify(this._getCurrentState(), null, 2));
                        vscode.window.showInformationMessage('Sauvegarde copiée dans le presse-papier.'); break;
                    case 'importState': await this._import(); break;
                    case 'showInfo': vscode.window.showInformationMessage(String(data.value)); break;
                    case 'evoNotify': vscode.window.showInformationMessage(String(data.value) + ' vient d’évoluer !'); break;
                    case 'updateStatus': this._statusBarItem.text = data.active ? '$(zap) PokeIdle : un Pokémon !' : '$(symbol-event) PokeIdle'; break;
                    case 'newGame':
                        if (await vscode.window.showWarningMessage('Recommencer PokeIdle à zéro ? Une copie de la partie actuelle sera conservée.', { modal: true }, 'Recommencer') === 'Recommencer') {
                            this._github.store.archive(this._getCurrentState(), 'avant-nouvelle-partie');
                            this._saveCurrentState(this._freshState()); this._sendState();
                        } break;
                    case 'restoreGame': vscode.window.showInformationMessage('Les copies sont conservées dans ' + this._github.status().conflictsDirectory); break;
                }
            } catch (error: any) {
                if (data.type === 'saveState') { this._blocked = true; view.webview.postMessage({ type: 'syncPause', value: true }); }
                this._showSync({ state: 'error', message: error.message });
                vscode.window.showErrorMessage(error.message);
            }
        }, undefined, this._context.subscriptions);
        const timer = setInterval(() => {
            if (view.visible && this._github.status().configured && this._github.status().state !== 'conflict' && !this._blocked) this.synchronize('sync', undefined, true);
        }, 60000);
        view.onDidDispose(() => clearInterval(timer));
        view.webview.html = this._html(view.webview);
    }
    private _freshState(): any {
        return { pokedex: [], inventory: { balls: { pokeball: 20 }, stones: {} }, coins: 200, xp: 0, level: 1,
            missions: { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] }, spawnTimer: 180, discovery: {} };
    }
    private _getCurrentState(): any {
        const document = this._github.store.read(); this._revision = document.revision;
        return this._github.store.state(document) || this._freshState();
    }
    private _saveCurrentState(state: any) {
        const document = this._github.store.replace(state, this._revision);
        this._revision = document.revision;
        this._context.globalState.update('pokeState', state);
        this._view?.webview.postMessage({ type: 'syncStatus', value: 'local' });
        this._showSync(this._github.status());
    }
    private _sendState() {
        const state = this._getCurrentState();
        this._view?.webview.postMessage({ type: 'loadState', value: state, generation: ++this._generation });
    }
    private _showSync(value: any) { this._view?.webview.postMessage({ type: 'githubStatus', value }); }
    public async synchronize(action = 'sync', repository?: string, quiet = false, branch?: string, allowPublic = false): Promise<void> {
        if (this._syncing || this._blocked) return;
        if (action === 'keep-local' || action === 'keep-github') {
            const text = action === 'keep-local' ? 'Remplacer la partie GitHub par celle de ce PC ?' : 'Remplacer la partie de ce PC par celle de GitHub ?';
            if (await vscode.window.showWarningMessage(text + ' Une copie sera conservée.', { modal: true }, 'Continuer') !== 'Continuer') return;
        }
        this._syncing = true;
        this._view?.webview.postMessage({ type: 'syncPause', value: true });
        try {
            await this._startup;
            const result = action === 'configure' ? await this._github.configure(repository, true, branch, allowPublic) : await this._github.synchronize(action);
            const document = this._github.store.read();
            if (document.revision !== this._revision) this._sendState();
            this._showSync(result);
        } catch (error: any) {
            this._showSync({ ...this._github.status(), state: 'error', message: error.message });
            if (!quiet) vscode.window.showErrorMessage(error.message);
        } finally {
            this._syncing = false;
            if (!this._blocked) this._view?.webview.postMessage({ type: 'syncPause', value: false });
        }
    }
    private async _import() {
        const raw = await vscode.window.showInputBox({ prompt: 'Colle le JSON de ta partie PokeIdle.' });
        if (!raw) return;
        const state = JSON.parse(raw);
        require(path.join(this._extensionUri.fsPath, 'sync/store.cjs')).validateState(state);
        if (await vscode.window.showWarningMessage('Remplacer la partie actuelle par ce fichier ? Une copie sera conservée.', { modal: true }, 'Importer') !== 'Importer') return;
        this._github.store.archive(this._getCurrentState(), 'avant-import');
        this._saveCurrentState(state); this._sendState();
    }
    private _html(webview: vscode.Webview): string {
        let html = fs.readFileSync(path.join(this._extensionUri.fsPath, 'codex.html'), 'utf8');
        html = html.replace('<script>window.POKEIDLE_HTTP_HOST = true;</script>', '')
            .replace('<script src="/media/github-host.js"></script>', '').replace('<script src="/media/codex-bridge.js"></script>', '');
        for (const name of ['style.css', 'item-icons.js', 'evolution-data.js', 'evolutions.js', 'challenges.js', 'main.js', 'pokedollar.png']) {
            const uri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', name)).toString();
            html = html.split('/media/' + name).join(uri);
        }
        return html.replace('Codex Desktop', 'PokeIdle').replace('<span class="v-tag">Codex</span>', '<span class="v-tag">v1.5.0</span>');
    }
	public cheat(type: string) {
		let state = this._getCurrentState();
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
		this._saveCurrentState(state);
		this._sendState();
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

		let state = this._getCurrentState();
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
		this._saveCurrentState(state);
		this._sendState();
		vscode.window.showInformationMessage(`Cheat : ${quantity}x ${selected.label} ajouté(s) !`);
	}


}
