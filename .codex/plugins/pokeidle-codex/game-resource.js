const fs = require('node:fs');
const path = require('node:path');

function buildGameHtml(projectRoot, document) {
  const read = (name) => fs.readFileSync(path.join(projectRoot, name), 'utf8');
  const script = (source) => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
  const bootstrap = JSON.stringify({ entries: document.entries, revision: document.revision }).replace(/</g, '\\u003c');
  const coinImage = `data:image/png;base64,${fs.readFileSync(path.join(projectRoot, 'media/pokedollar.png')).toString('base64')}`;
  const hostScript = read('media/github-host.js');
  let html = read('codex.html');
  html = html.replace('<script>window.POKEIDLE_HTTP_HOST = true;</script>', '').replace('<script src="/media/github-host.js"></script>', '');
  html = html.replace('<link rel="stylesheet" href="/media/style.css">', `<style>${read('media/style.css')}</style>`);
  html = html.replace('src="/media/pokedollar.png"', `src="${coinImage}"`);
  html = html.replace('<script>window.POKEDOLLAR_URI = "/media/pokedollar.png";</script>', script(`window.POKEDOLLAR_URI = ${JSON.stringify(coinImage)};`));
  html = html.replace('<script src="/media/codex-bridge.js"></script>',
    script(`window.POKEIDLE_BOOTSTRAP = ${bootstrap};`) + script(hostScript) + script(read('media/codex-bridge.js')));
  html = html.replace('<script src="/media/main.js"></script>', script(read('media/main.js')));
  html = html.replace('<script src="/media/item-icons.js"></script>', script(read('media/item-icons.js')));
  for (const name of ['evolution-data.js', 'evolutions.js', 'challenges.js']) {
    html = html.replace(`<script src="/media/${name}"></script>`, script(read(`media/${name}`)));
  }
  html = html.replace('<body>', `<body>
    <div id="pokeidle-host-status" role="status"><span id="pokeidle-host-message">Chargement de ta partie…</span><button id="pokeidle-host-retry" hidden>Réessayer</button></div>`);
  html = html.replace('</head>', `<style>
    #pokeidle-host-status { position:fixed; top:0; left:0; right:0; z-index:100; padding:12px; background:#282830; color:white; font:14px system-ui; }
    #pokeidle-host-status[hidden] { display:none; }
    #pokeidle-host-retry { margin-left:12px; padding:6px 12px; background:#484850; color:white; border:1px solid #888; border-radius:6px; cursor:pointer; }
    .pokeidle-confirm { max-width:min(440px,90vw); background:#222229; color:white; border:1px solid #666; border-radius:12px; padding:22px; }
    .pokeidle-confirm::backdrop { background:#0009; }
    .pokeidle-confirm button { margin-right:12px; padding:8px 16px; cursor:pointer; }
  </style></head>`);
  html = html.replace('La progression est gardée dans Codex Desktop.', 'La progression est enregistrée sur cet ordinateur.');
  return html;
}

module.exports = { buildGameHtml };
