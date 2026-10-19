const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const readline = require('node:readline');

const VERSION = '1.0.6';
const PROJECT_ROOT = process.env.POKEIDLE_PROJECT_ROOT || require('./project.json').projectRoot;
const GAME_URL = 'http://127.0.0.1:4173/';
const GAME_SERVER = path.join(PROJECT_ROOT, 'codex-server.js');
const UI_URI = `ui://pokeidle/game/v${VERSION}.html`;
let serverStart;
let ownedServer;
let inputClosed = false;

function gameIsReady() {
  return new Promise((resolve) => {
    const request = http.get(`${GAME_URL}api/health`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).app === 'pokeidle'); }
        catch { resolve(false); }
      });
      response.on('error', () => resolve(false));
    });
    request.setTimeout(1500, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function ensureGameServer() {
  if (serverStart) return serverStart;
  serverStart = (async () => {
    if (await gameIsReady()) return;
    try {
      const { startGameServer } = require(GAME_SERVER);
      ownedServer = await startGameServer();
      if (inputClosed) ownedServer.close();
    } catch (error) {
      // Another MCP connection may have started the same local server.
      if (error.code !== 'EADDRINUSE') throw error;
    }
    if (!(await gameIsReady())) throw new Error('Le serveur PokeIdle ne répond pas sur le port 4173.');
  })();
  try { await serverStart; }
  finally { serverStart = undefined; }
}

const uiMeta = {
  ui: { csp: { frameDomains: ['http://127.0.0.1:4173'] } },
  'openai/widgetCSP': {
    connect_domains: [], resource_domains: [], frame_domains: ['http://127.0.0.1:4173']
  },
  'openai/ui': { availableDisplayModes: ['fullscreen', 'inline'] }
};

const tool = {
  name: 'open_pokeidle',
  title: 'PokeIdle',
  description: 'Démarre le serveur local et ouvre PokeIdle dans Codex Desktop.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  _meta: {
    ui: { resourceUri: UI_URI },
    'openai/outputTemplate': UI_URI,
    'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] }
  }
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || typeof message !== 'object') return;
  if (message.method?.startsWith('notifications/')) return;
  const id = message.id;
  const result = (value) => send({ jsonrpc: '2.0', id, result: value });
  const error = (code, text) => send({ jsonrpc: '2.0', id, error: { code, message: text } });

  switch (message.method) {
    case 'initialize':
      await ensureGameServer().catch((err) => process.stderr.write(`PokeIdle: ${err.message}\n`));
      result({
        protocolVersion: message.params?.protocolVersion || '2025-03-26',
        capabilities: { tools: {}, resources: { listChanged: false } },
        serverInfo: { name: 'pokeidle-codex', version: VERSION }
      });
      break;
    case 'ping': result({}); break;
    case 'tools/list': result({ tools: [tool] }); break;
    case 'tools/call':
      if (message.params?.name !== tool.name) { error(-32602, 'Outil inconnu.'); break; }
      try {
        await ensureGameServer();
        result({
          content: [{ type: 'text', text: 'Le serveur PokeIdle répond. Le panneau peut charger le jeu.' }],
          structuredContent: { ready: true, url: GAME_URL }
        });
      } catch (err) {
        result({ isError: true, content: [{ type: 'text', text: `PokeIdle ne peut pas démarrer : ${err.message}` }] });
      }
      break;
    case 'resources/list':
      result({ resources: [{ uri: UI_URI, name: 'PokeIdle', mimeType: 'text/html;profile=mcp-app', _meta: uiMeta }] });
      break;
    case 'resources/templates/list': result({ resourceTemplates: [] }); break;
    case 'resources/read': {
      if (message.params?.uri !== UI_URI) { error(-32602, 'Ressource inconnue.'); break; }
      let startupError = null;
      try { await ensureGameServer(); }
      catch (err) { startupError = err.message; }
      const appHtml = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8')
        .replace('__STARTUP_ERROR__', JSON.stringify(startupError).replace(/</g, '\\u003c'));
      result({ contents: [{ uri: UI_URI, mimeType: 'text/html;profile=mcp-app', text: appHtml, _meta: uiMeta }] });
      break;
    }
    default: if (id !== undefined) error(-32601, 'Méthode inconnue.');
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
  } catch { process.stderr.write('PokeIdle MCP: message JSON invalide.\n'); }
});
input.on('close', () => {
  inputClosed = true;
  if (ownedServer) ownedServer.close();
});
