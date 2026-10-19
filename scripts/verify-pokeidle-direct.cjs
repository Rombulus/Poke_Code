const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const pluginRoot = process.env.POKEIDLE_TEST_PLUGIN_ROOT || path.join(projectRoot, '.codex/plugins/pokeidle-codex');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeidle-direct-check-'));
const original = fs.readFileSync(path.join(projectRoot, '.pokeidle/storage.json'), 'utf8');
fs.writeFileSync(path.join(dataDir, 'storage.json'), original);

function connect() {
  const env = { ...process.env, POKEIDLE_DATA_DIR: dataDir };
  delete env.POKEIDLE_PROJECT_ROOT;
  const child = spawn(process.execPath, [path.join(pluginRoot, 'mcp-direct.js')], {
    cwd: pluginRoot, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
  });
  let id = 0;
  let stderr = '';
  const pending = new Map();
  const lines = readline.createInterface({ input: child.stdout });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  lines.on('line', (line) => {
    const message = JSON.parse(line);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const exit = new Promise((resolve) => child.once('exit', resolve));
  return {
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const timer = setTimeout(() => reject(new Error(`No response: ${method} ${stderr}`)), 8000);
        pending.set(requestId, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
      });
    },
    async close() {
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 2000);
      const code = await exit;
      clearTimeout(timer);
      lines.close();
      assert.equal(code, 0);
      assert.equal(stderr, '');
    }
  };
}

async function initialize(client) {
  const response = await client.call('initialize', {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'direct-game-check', version: '1' }
  });
  assert.equal(response.serverInfo.version, '1.2.3');
}

async function run() {
  let client = connect();
  try {
    await initialize(client);
    const listing = await client.call('tools/list');
    assert.equal(listing.tools.length, 5);
    assert.deepEqual(listing.tools.find((t) => t.name === 'save_pokeidle_storage')._meta.ui.visibility, ['app']);
    const uri = listing.tools.find((t) => t.name === 'play_pokeidle')._meta.ui.resourceUri;
    const resource = await client.call('resources/read', { uri });
    const html = resource.contents[0].text;
    assert.doesNotMatch(html, /<iframe|127\.0\.0\.1|<script[^>]+src=/i);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 6);
    scripts.forEach((script) => new vm.Script(script[1]));
    assert.deepEqual(resource.contents[0]._meta.ui.csp.connectDomains, ['https://pokeapi.co']);
    const loaded = await client.call('tools/call', { name: 'get_pokeidle_storage', arguments: {} });
    const initial = loaded.structuredContent;
    assert.deepEqual(initial.entries, JSON.parse(original.replace(/^\uFEFF/, '')).entries);
    const state = JSON.parse(initial.entries['pokeidle.codex.save.v1']);
    state.coins += 1;
    const entries = { ...initial.entries, 'pokeidle.codex.save.v1': JSON.stringify(state) };
    const saved = await client.call('tools/call', {
      name: 'save_pokeidle_storage', arguments: { entries, revision: initial.revision }
    });
    assert.notEqual(saved.isError, true, saved.content?.[0]?.text);
    assert.equal(saved.structuredContent.revision, initial.revision + 1);
    const stale = await client.call('tools/call', {
      name: 'save_pokeidle_storage', arguments: { entries: initial.entries, revision: initial.revision }
    });
    assert.equal(stale.isError, true);
    const invalid = await client.call('tools/call', {
      name: 'save_pokeidle_storage', arguments: { entries: { 'other-app': 'invalid' }, revision: saved.structuredContent.revision }
    });
    assert.equal(invalid.isError, true);
    await client.close();
    client = connect();
    await initialize(client);
    const restarted = await client.call('tools/call', { name: 'get_pokeidle_storage', arguments: {} });
    assert.deepEqual(restarted.structuredContent.entries, entries);
    assert.equal(restarted.structuredContent.revision, initial.revision + 1);
    assert.ok(fs.existsSync(path.join(dataDir, 'storage.previous.json')));
    assert.equal(fs.readFileSync(path.join(projectRoot, '.pokeidle/storage.json'), 'utf8'), original);
    console.log('PASS: direct UI has no local iframe; save, restart, stale-window protection, invalid-input protection and backup verified. Original progression unchanged.');
  } finally { await client.close(); }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (entry.isFile() && /^(?:storage\.json|storage\.previous\.json|\.storage-\d+-\d+\.tmp)$/.test(entry.name)) {
      fs.unlinkSync(path.join(dataDir, entry.name));
    }
  }
  if (!fs.readdirSync(dataDir).length) fs.rmdirSync(dataDir);
});
