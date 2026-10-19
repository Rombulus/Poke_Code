const os = require('node:os');
const path = require('node:path');
const { createStorageService, defaultDirectory } = require('./store.cjs');
const { createGitHubSync } = require('./github.cjs');
function createRuntime(projectRoot, legacyDirectory) {
  const store = createStorageService(defaultDirectory());
  store.migrate(legacyDirectory || path.join(projectRoot, '.pokeidle'), path.join(os.homedir(), '.poke-idle-save.json'));
  return createGitHubSync({ store });
}
module.exports = { createRuntime };
