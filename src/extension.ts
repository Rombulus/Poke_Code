import * as vscode from 'vscode';
import { UnifiedPokeIdleProvider } from './unified-provider';

export function activate(context: vscode.ExtensionContext) {
	// La partie est gérée par le module commun, pas par Settings Sync.
	context.globalState.setKeysForSync([]);

	const provider = new UnifiedPokeIdleProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(UnifiedPokeIdleProvider.viewType, provider, { webviewOptions: { retainContextWhenHidden: true } }),
		vscode.commands.registerCommand('pokeidle.sync', () => provider.synchronize()),
		vscode.commands.registerCommand('pokeidle.push', () => provider.synchronize('push')),
		vscode.commands.registerCommand('pokeidle.pull', () => provider.synchronize('pull')),
		vscode.commands.registerCommand('pokeidle.giveCoins', () => provider.cheat('coins')),
		vscode.commands.registerCommand('pokeidle.giveStones', () => provider.cheat('stones')),
		vscode.commands.registerCommand('pokeidle.giveBalls', () => provider.cheat('balls')),
		vscode.commands.registerCommand('pokeidle.giveItem', () => provider.giveItem())
	);
}
