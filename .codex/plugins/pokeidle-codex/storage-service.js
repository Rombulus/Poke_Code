const fs = require('node:fs');
const path = require('node:path');

function createStorageService(dataDir) {
  const filePath = path.join(dataDir, 'storage.json');
  let sequence = 0;

  function validateEntries(entries) {
    if (!entries || Array.isArray(entries) || typeof entries !== 'object') throw new Error('Sauvegarde invalide.');
    if (Buffer.byteLength(JSON.stringify(entries)) > 5 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
    for (const [key, value] of Object.entries(entries)) {
      if (!key.startsWith('pokeidle.codex.') || typeof value !== 'string') throw new Error('Clé de sauvegarde invalide.');
      if (key === 'pokeidle.codex.save.v1' || key.startsWith('pokeidle.codex.backup.v1.')) {
        const state = JSON.parse(value);
        if (!Array.isArray(state.pokedex) || !state.inventory || typeof state.inventory !== 'object') {
          throw new Error('La progression Pokémon est invalide.');
        }
      }
    }
  }

  function read() {
    if (!fs.existsSync(filePath)) return { schemaVersion: 1, revision: 0, entries: {} };
    const document = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
    validateEntries(document.entries);
    if (!Number.isInteger(document.revision) || document.revision < 0) throw new Error('Version de sauvegarde invalide.');
    return document;
  }

  function write(entries, revision) {
    validateEntries(entries);
    const current = read();
    if (revision !== current.revision) {
      throw new Error('Une autre fenêtre a modifié la partie. Recharge la sauvegarde avant de continuer.');
    }
    fs.mkdirSync(dataDir, { recursive: true });
    const document = { schemaVersion: 1, revision: revision + 1, entries, updatedAt: new Date().toISOString() };
    const temporaryPath = path.join(dataDir, `.storage-${process.pid}-${++sequence}.tmp`);
    fs.writeFileSync(temporaryPath, JSON.stringify(document, null, 2));
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, path.join(dataDir, 'storage.previous.json'));
    fs.renameSync(temporaryPath, filePath);
    return document;
  }

  return { read, write, filePath };
}

module.exports = { createStorageService };
