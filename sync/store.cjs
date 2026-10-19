const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const SAVE_KEY = 'pokeidle.codex.save.v1';
const defaultDirectory = () => process.env.POKEIDLE_DATA_DIR || path.join(os.homedir(), '.pokeidle');
const parse = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function validateState(state) {
  if (!state || !Array.isArray(state.pokedex) || !state.inventory || typeof state.inventory !== 'object' || Array.isArray(state.inventory)) {
    throw new Error('Format de partie PokeIdle invalide.');
  }
  if (Buffer.byteLength(JSON.stringify(state)) > 5 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
  return state;
}
function fingerprint(state) {
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    return value;
  }
  return state == null ? null : crypto.createHash('sha256').update(JSON.stringify(stable(state))).digest('hex');
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function lock(directory, name) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name + '.lock');
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
      return () => { if (fs.existsSync(file) && parse(file).token === token) fs.unlinkSync(file); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = parse(file);
      try { process.kill(owner.pid, 0); }
      catch (probe) { if (probe.code === 'ESRCH') { fs.unlinkSync(file); continue; } }
      throw new Error('Une autre fenêtre utilise la sauvegarde. Réessaie dans quelques secondes.');
    }
  }
  throw new Error('Sauvegarde occupée.');
}
function createStorageService(dataDir = defaultDirectory()) {
  const filePath = path.join(dataDir, 'storage.json');
  function validateEntries(entries) {
    if (!entries || Array.isArray(entries) || typeof entries !== 'object') throw new Error('Sauvegarde invalide.');
    if (Buffer.byteLength(JSON.stringify(entries)) > 5 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
    for (const [key, value] of Object.entries(entries)) {
      if (!key.startsWith('pokeidle.codex.') || typeof value !== 'string') throw new Error('Clé de sauvegarde invalide.');
      if (key === SAVE_KEY || key.startsWith('pokeidle.codex.backup.v1.')) validateState(JSON.parse(value));
    }
  }
  function read() {
    if (!fs.existsSync(filePath)) return { schemaVersion: 1, revision: 0, entries: {} };
    const document = parse(filePath);
    validateEntries(document.entries);
    if (!Number.isInteger(document.revision) || document.revision < 0) throw new Error('Version de sauvegarde invalide.');
    return document;
  }
  function archive(value, label = 'local') {
    const file = path.join(dataDir, 'conflicts', `${Date.now()}-${label}-${crypto.randomUUID()}.json`);
    atomicJson(file, value);
    return file;
  }
  function write(entries, revision) {
    validateEntries(entries);
    const release = lock(dataDir, 'storage');
    try {
      const current = read();
      if (revision !== current.revision) {
        const file = archive(entries[SAVE_KEY] ? JSON.parse(entries[SAVE_KEY]) : { schemaVersion: 1, entries }, 'fenetre');
        throw new Error(`Une autre fenêtre a modifié la partie. Ta version est conservée dans ${file}. Recharge la partie.`);
      }
      const document = { schemaVersion: 1, revision: revision + 1, entries, updatedAt: new Date().toISOString() };
      if (fs.existsSync(filePath)) fs.copyFileSync(filePath, path.join(dataDir, 'storage.previous.json'));
      atomicJson(filePath, document);
      return document;
    } finally { release(); }
  }
  function state(document = read()) { return document.entries[SAVE_KEY] ? validateState(JSON.parse(document.entries[SAVE_KEY])) : null; }
  function replace(stateValue, revision) {
    validateState(stateValue);
    const document = read();
    return write({ ...document.entries, [SAVE_KEY]: JSON.stringify(stateValue), 'pokeidle.codex.fresh-start.v1': 'true' }, revision);
  }
  function migrate(legacyDirectory, legacyFile) {
    if (fs.existsSync(filePath)) return;
    const oldFile = legacyDirectory && path.join(legacyDirectory, 'storage.json');
    if (oldFile && path.resolve(oldFile) !== path.resolve(filePath) && fs.existsSync(oldFile)) {
      const legacy = parse(oldFile);
      validateEntries(legacy.entries);
      write(legacy.entries, 0);
    } else if (legacyFile && fs.existsSync(legacyFile)) {
      replace(validateState(parse(legacyFile)), 0);
    }
  }
  return { read, write, state, replace, archive, migrate, filePath, dataDir };
}
module.exports = { SAVE_KEY, createStorageService, defaultDirectory, validateState, fingerprint, atomicJson, lock, parse };
