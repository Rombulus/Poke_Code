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
    #pokeidle-host-status { position:fixed; top:0; left:0; right:0; z-index:100; padding:12px 16px; background:linear-gradient(110deg,#294967,#172b40); color:#f8f6eb; border-bottom:2px solid #8bdad6; box-shadow:0 6px 20px #0007; font:14px system-ui; }
    #pokeidle-host-status[hidden] { display:none; }
    #pokeidle-host-retry { margin-left:12px; padding:8px 14px; background:linear-gradient(#e95a57,#c63c49); color:white; border:1px solid #fff0dc; border-radius:9px; font-weight:700; cursor:pointer; }
    .pokeidle-confirm { max-width:min(440px,90vw); background:linear-gradient(155deg,#294967,#172b40 72%); color:#f8f6eb; border:3px solid #f4f0df; border-radius:16px; padding:22px; box-shadow:0 0 0 3px #2f7fa3,0 18px 54px #0009; }
    .pokeidle-confirm::backdrop { background:#030912c7; backdrop-filter:blur(3px); }
    .pokeidle-confirm button { min-width:96px; min-height:42px; margin:8px 8px 0 0; padding:9px 16px; border:1px solid #f4f0df; border-radius:9px; background:linear-gradient(#315878,#244765); color:#fffaf0; font-weight:700; cursor:pointer; }
    .pokeidle-confirm button:last-child { background:linear-gradient(#e95a57,#c63c49); }
  </style></head>`);
  html = html.replace('La progression est gardée dans Codex Desktop.', 'La progression est enregistrée sur cet ordinateur.');
  return html;
}

module.exports = { buildGameHtml };
