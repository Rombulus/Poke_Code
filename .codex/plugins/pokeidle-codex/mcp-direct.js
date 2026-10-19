const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { buildGameHtml } = require('./game-resource');

const VERSION = '1.7.0';
const icons = [{
  src: `data:image/svg+xml;base64,${fs.readFileSync(path.join(__dirname, 'assets/pokeidle.svg')).toString('base64')}`,
  mimeType: 'image/svg+xml', sizes: ['any']
}];
const PROJECT_ROOT = process.env.POKEIDLE_PROJECT_ROOT || require('./project.json').projectRoot;
const UI_URI = `ui://pokeidle/direct-v${VERSION}.html`;
const { createRuntime } = require(path.join(PROJECT_ROOT, 'sync/runtime.cjs'));
const github = createRuntime(PROJECT_ROOT);
const storage = github.store;
const uiMeta = {
  ui: { csp: { connectDomains: ['https://pokeapi.co'], resourceDomains: ['https://raw.githubusercontent.com'] } },
  'openai/widgetCSP': { connect_domains: ['https://pokeapi.co'], resource_domains: ['https://raw.githubusercontent.com'] },
  'openai/ui': { availableDisplayModes: ['fullscreen', 'inline'] }
};

const emptySchema = { type: 'object', properties: {}, additionalProperties: false };
const appToolMeta = { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true };
const tools = [
  {
    name: 'play_pokeidle', title: 'PokeIdle', icons,
    description: 'Ouvre le jeu PokeIdle directement dans le panneau Codex.',
    inputSchema: emptySchema,
    _meta: {
      ui: { resourceUri: UI_URI }, 'openai/outputTemplate': UI_URI,
      'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] }
    }
  },
  {
    name: 'get_pokeidle_storage', title: 'Charger la partie PokeIdle',
    description: 'Lit la progression locale PokeIdle pour le panneau du jeu.',
    inputSchema: emptySchema, annotations: { readOnlyHint: true }, _meta: appToolMeta
  },
  {
    name: 'save_pokeidle_storage', title: 'Sauvegarder la partie PokeIdle',
    description: 'Enregistre uniquement la progression locale PokeIdle dans son fichier dédié.',
    inputSchema: { type: 'object', properties: {
      entries: { type: 'object', additionalProperties: { type: 'string' } },
      revision: { type: 'integer', minimum: 0 }
    }, required: ['entries', 'revision'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }, _meta: appToolMeta
  },
  {
    name: 'sync_pokeidle_github', title: 'Synchroniser la partie avec GitHub',
    description: 'Gère uniquement le fichier et la branche de sauvegarde PokeIdle et conserve les conflits.',
    inputSchema: { type: 'object', properties: {
      action: { type: 'string', enum: ['status', 'sync', 'push', 'pull', 'configure', 'keep-local', 'keep-github'] },
      repository: { type: 'string' }, create: { type: 'boolean' }, branch: { type: 'string' }, allowPublic: { type: 'boolean' }
    }, required: ['action'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false }, _meta: appToolMeta
  },
  {
    name: 'read_pokeidle_vscode_save', title: 'Lire la sauvegarde VS Code',
    description: 'Lit le fichier historique .poke-idle-save.json sans le modifier.',
    inputSchema: emptySchema, annotations: { readOnlyHint: true }, _meta: appToolMeta
  }
];

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }

async function handle(message) {
  if (!message || typeof message !== 'object' || message.method?.startsWith('notifications/')) return;
  const result = (value) => send({ jsonrpc: '2.0', id: message.id, result: value });
  const error = (code, text) => send({ jsonrpc: '2.0', id: message.id, error: { code, message: text } });
  switch (message.method) {
    case 'initialize':
      result({ protocolVersion: message.params?.protocolVersion || '2025-03-26',
        capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'pokeidle-codex', version: VERSION, icons } });
      break;
    case 'ping': result({}); break;
    case 'tools/list': result({ tools }); break;
    case 'tools/call': {
      try {
        switch (message.params?.name) {
          case 'sync_pokeidle_github': {
            const args = message.params.arguments || {};
            const sync = args.action === 'status' ? github.status()
              : args.action === 'configure' ? await github.configure(args.repository, args.create === true, args.branch, args.allowPublic === true)
              : await github.synchronize(args.action);
            const document = storage.read();
            result({ content: [], structuredContent: { ...document, sync } });
            break;
          }
          case 'play_pokeidle':
            storage.read();
            result({ content: [{ type: 'text', text: 'PokeIdle est disponible directement dans le panneau Codex.' }],
              structuredContent: { ready: true, version: VERSION } });
            break;
          case 'get_pokeidle_storage': {
            const document = storage.read();
            result({ content: [], structuredContent: { entries: document.entries, revision: document.revision, sync: github.status() } });
            break;
          }
          case 'save_pokeidle_storage': {
            const args = message.params.arguments || {};
            const document = storage.write(args.entries, args.revision);
            result({ content: [], structuredContent: { revision: document.revision } });
            break;
          }
          case 'read_pokeidle_vscode_save': {
            const filePath = path.join(os.homedir(), '.poke-idle-save.json');
            const state = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
            result({ content: [], structuredContent: { state } });
            break;
          }
          default: error(-32602, 'Outil inconnu.');
        }
      } catch (err) {
        result({ isError: true, content: [{ type: 'text', text: err.message }] });
      }
      break;
    }
    case 'resources/list':
      result({ resources: [{ uri: UI_URI, name: 'PokeIdle', mimeType: 'text/html;profile=mcp-app', _meta: uiMeta }] });
      break;
    case 'resources/templates/list': result({ resourceTemplates: [] }); break;
    case 'resources/read': {
      const uri = message.params?.uri;
      if (uri !== UI_URI && !/^ui:\/\/pokeidle\/game(?:\/v[\d.]+\.html)?$/.test(uri || '')) {
        error(-32602, 'Ressource inconnue.'); break;
      }
      const html = buildGameHtml(PROJECT_ROOT, storage.read());
      result({ contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: html, _meta: uiMeta }] });
      break;
    }
    default: if (message.id !== undefined) error(-32601, 'Méthode inconnue.');
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    handle(message).catch((err) => {
      process.stderr.write(`PokeIdle MCP: ${err.message}\n`);
      if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: err.message } });
    });
  } catch (err) { process.stderr.write(`PokeIdle MCP: ${err.message}\n`); }
});
