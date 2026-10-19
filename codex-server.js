const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const HOST = '127.0.0.1';
const PORT = Number(process.env.POKEIDLE_PORT || 4173);
const ROOT = __dirname;
const SAVE_FILE = path.join(os.homedir(), '.poke-idle-save.json');
const github = require('./sync/runtime.cjs').createRuntime(ROOT);
const CONTENT_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const server = http.createServer(async (request, response) => {
    if (request.headers.host !== `${HOST}:${PORT}`) {
        response.writeHead(403).end();
        return;
    }

    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    response.setHeader('Cache-Control', 'no-store');

    if (['/api/storage', '/api/github', '/api/legacy-save'].includes(url.pathname)) {
        const send = (value, status = 200) => response.writeHead(status, { 'Content-Type': CONTENT_TYPES['.json'] }).end(JSON.stringify(value));
        try {
            if (request.method === 'GET' && url.pathname === '/api/storage') {
                send({ ...github.store.read(), sync: github.status() }); return;
            }
            if (request.method === 'GET' && url.pathname === '/api/legacy-save') {
                send({ state: fs.existsSync(SAVE_FILE) ? JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8').replace(/^\uFEFF/, '')) : null }); return;
            }
            if (request.method !== 'POST') { send({ error: 'Méthode non autorisée.' }, 405); return; }
            if (request.headers.origin !== `http://${HOST}:${PORT}` || !request.headers['content-type']?.startsWith('application/json')) {
                send({ error: 'Origine non autorisée.' }, 403); return;
            }
            const chunks = [];
            let bytes = 0;
            for await (const chunk of request) {
                bytes += chunk.length;
                if (bytes > 6 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
                chunks.push(chunk);
            }
            const args = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (url.pathname === '/api/storage') { send(github.store.write(args.entries, args.revision)); return; }
            if (url.pathname !== '/api/github') { send({ error: 'Méthode non autorisée.' }, 405); return; }
            const sync = args.action === 'status' ? github.status()
                : args.action === 'configure' ? await github.configure(args.repository, args.create === true, args.branch, args.allowPublic === true)
                : await github.synchronize(args.action);
            send({ ...github.store.read(), sync });
        } catch (error) { send({ error: error.message }, 400); }
        return;
    }

    if (url.pathname === '/api/health') {
        response.writeHead(200, { 'Content-Type': CONTENT_TYPES['.json'] });
        response.end(JSON.stringify({ app: 'pokeidle', ready: true }));
        return;
    }

    if (url.pathname === '/api/initial-save') {
        if (request.method !== 'GET') {
            response.writeHead(405).end();
            return;
        }
        try {
            const save = fs.readFileSync(SAVE_FILE, 'utf8');
            JSON.parse(save);
            response.writeHead(200, { 'Content-Type': CONTENT_TYPES['.json'] }).end(save);
        } catch (error) {
            if (error.code === 'ENOENT') {
                response.writeHead(204).end();
            } else {
                response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Impossible de lire la sauvegarde PokeIdle.');
            }
        }
        return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405).end();
        return;
    }

    let relativePath;
    try {
        relativePath = decodeURIComponent(url.pathname === '/' ? '/codex.html' : url.pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }

    const filePath = path.resolve(ROOT, `.${relativePath}`);
    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
        response.writeHead(403).end();
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
            return;
        }
        response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream' });
        response.end(request.method === 'HEAD' ? undefined : content);
    });
});

function startGameServer() {
    if (server.listening) return Promise.resolve(server);
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve(server);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(PORT, HOST);
    });
}

module.exports = { startGameServer };

if (require.main === module) {
    startGameServer().then(() => {
        console.error(`PokeIdle pour Codex prêt : http://${HOST}:${PORT}`);
    }).catch((error) => {
        console.error(`PokeIdle : ${error.message}`);
        process.exitCode = 1;
    });
}
