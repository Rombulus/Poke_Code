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
const unified_provider_1 = require("./unified-provider");
function activate(context) {
    // La partie est gérée par le module commun, pas par Settings Sync.
    context.globalState.setKeysForSync([]);
    const provider = new unified_provider_1.UnifiedPokeIdleProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(unified_provider_1.UnifiedPokeIdleProvider.viewType, provider, { webviewOptions: { retainContextWhenHidden: true } }), vscode.commands.registerCommand('pokeidle.sync', () => provider.synchronize()), vscode.commands.registerCommand('pokeidle.push', () => provider.synchronize('push')), vscode.commands.registerCommand('pokeidle.pull', () => provider.synchronize('pull')), vscode.commands.registerCommand('pokeidle.giveCoins', () => provider.cheat('coins')), vscode.commands.registerCommand('pokeidle.giveStones', () => provider.cheat('stones')), vscode.commands.registerCommand('pokeidle.giveBalls', () => provider.cheat('balls')), vscode.commands.registerCommand('pokeidle.giveItem', () => provider.giveItem()));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map