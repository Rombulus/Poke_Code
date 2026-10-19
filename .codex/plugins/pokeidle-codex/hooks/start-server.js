const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');

const host = '127.0.0.1';
const port = 4173;
let configuredRoot;
try { configuredRoot = require('../project.json').projectRoot; } catch { /* Use the repository-relative fallback below. */ }
const projectRoot = process.env.POKEIDLE_PROJECT_ROOT || configuredRoot || path.resolve(__dirname, '../../../..');
const serverPath = path.join(projectRoot, 'codex-server.js');
const socket = net.createConnection({ host, port });
let finished = false;

function finish(startServer) {
  if (finished) return;
  finished = true;
  socket.destroy();
  if (!startServer) return;

  const child = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.on('error', (error) => process.stderr.write(`PokeIdle: ${error.message}\\n`));
  child.unref();
}

socket.setTimeout(1500);
socket.once('connect', () => finish(false));
socket.once('error', () => finish(true));
socket.once('timeout', () => finish(true));
