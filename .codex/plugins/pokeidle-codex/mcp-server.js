const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

const PROJECT_ROOT = process.env.POKEIDLE_PROJECT_ROOT || path.resolve(__dirname, '../../..');
const GAME_URL = 'http://127.0.0.1:4173/';
const GAME_SERVER = path.join(PROJECT_ROOT, 'codex-server.js');
const UI_URI = 'ui://pokeidle/game';
let serverStart;

const appHtml = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>PokeIdle</title>
  <style>
    * { box-sizing: border-box; }
    html, body, main { width: 100%; height: 100%; margin: 0; }
    body { background: #0f0f12; color: #f5f5f5; font: 14px system-ui, sans-serif; }
    main { display: flex; flex-direction: column; }
    iframe { flex: 1; width: 100%; border: 0; background: #0f0f12; }
    #status { padding: 12px 16px; background: #1c1c21; color: #c9c9d1; }
    #status a { color: #b79aff; }
  </style>
</head>
<body>
  <main>
    <div id="status" role="status">Démarrage de PokeIdle…</div>
    <iframe id="game" title="PokeIdle"></iframe>
  </main>
  <script>
    const frame = document.getElementById('game');
    const status = document.getElementById('status');
    let ready = false;
    let attempt = 0;
    const loadGame = () => {
      attempt += 1;
      status.textContent = attempt === 1 ? 'Connexion à PokeIdle…' : 'Le serveur démarre, nouvelle tentative…';
      frame.src = '${GAME_URL}?codex-retry=' + attempt;
    };
    const retry = setInterval(() => {
      if (!ready) loadGame();
    }, 2000);
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow || event.data?.type !== 'pokeidle-ready') return;
      ready = true;
      clearInterval(retry);
      status.hidden = true;
    });
    loadGame();
    setTimeout(() => {
      if (!ready) status.textContent = 'PokeIdle ne répond pas encore. Le panneau réessaie automatiquement.';
    }, 10000);
  </script>
</body>
</html>`;

function ensureGameServer() {
  if (serverStart) return;
  serverStart = true;
  try {
    const child = spawn(process.execPath, [GAME_SERVER], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.on('error', (error) => process.stderr.write(`PokeIdle: démarrage du serveur impossible (${error.message}).\n`));
    child.unref();
  } catch (error) {
    process.stderr.write(`PokeIdle: démarrage du serveur impossible (${error.message}).\n`);
  }
}

const tool = {
  name: 'open_pokeidle',
  title: 'Ouvrir PokeIdle',
  description: 'Ouvre le jeu PokeIdle dans la barre latérale de Codex Desktop.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  _meta: {
    ui: { resourceUri: UI_URI },
    'openai/ui': {
      entrypoints: [{ type: 'global' }]
    }
  }
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || typeof message !== 'object') return;
  if (message.method === 'notifications/initialized' || message.method?.startsWith('notifications/')) return;

  const id = message.id;
  const result = (value) => send({ jsonrpc: '2.0', id, result: value });
  const error = (code, text) => send({ jsonrpc: '2.0', id, error: { code, message: text } });

  switch (message.method) {
    case 'initialize':
      ensureGameServer();
      result({
        protocolVersion: message.params?.protocolVersion || '2025-03-26',
        capabilities: { tools: {}, resources: { listChanged: false } },
        serverInfo: { name: 'pokeidle-codex', version: '1.0.4' }
      });
      break;
    case 'ping':
      result({});
      break;
    case 'tools/list':
      result({ tools: [tool] });
      break;
    case 'tools/call':
      if (message.params?.name !== tool.name) {
        error(-32602, 'Outil inconnu.');
        break;
      }
      ensureGameServer();
      result({ content: [{ type: 'text', text: 'PokeIdle est prêt à jouer.' }], _meta: { ui: { resourceUri: UI_URI } } });
      break;
    case 'resources/list':
      result({ resources: [{
        uri: UI_URI,
        name: 'PokeIdle',
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { csp: { frameDomains: ['http://127.0.0.1:4173'] } } }
      }] });
      break;
    case 'resources/read':
      if (message.params?.uri !== UI_URI) {
        error(-32602, 'Ressource inconnue.');
        break;
      }
      ensureGameServer();
      result({ contents: [{
        uri: UI_URI,
        mimeType: 'text/html;profile=mcp-app',
        text: appHtml,
        _meta: { ui: { csp: { frameDomains: ['http://127.0.0.1:4173'] } } }
      }] });
      break;
    default:
      if (id !== undefined) error(-32601, 'Méthode inconnue.');
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    handle(message).catch((err) => process.stderr.write(`PokeIdle MCP: ${err.message}\n`));
  } catch {
    process.stderr.write('PokeIdle MCP: message JSON invalide.\n');
  }
});
