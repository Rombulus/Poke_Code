(function () {
  const statusBar = document.getElementById('pokeidle-host-status');
  const statusText = document.getElementById('pokeidle-host-message');
  const retryButton = document.getElementById('pokeidle-host-retry');
  let entries = { ...window.POKEIDLE_BOOTSTRAP.entries };
  let revision = window.POKEIDLE_BOOTSTRAP.revision;
  let rpcId = 0;
  let dirty = false;
  let saving = false;
  let timer;
  let conflicted = false;
  const pending = new Map();

  function showError(error) {
    statusText.textContent = 'Sauvegarde non confirmée : ' + error.message;
    statusBar.hidden = false;
    retryButton.hidden = false;
  }

  function rpcRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = `pokeidle-${++rpcId}`;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Codex ne répond pas.'));
      }, 10000);
      pending.set(id, { resolve, reject, timeout });
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    const message = event.data;
    if (message.method) return;
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  const bridgeReady = rpcRequest('ui/initialize', {
    appInfo: { name: 'pokeidle', version: '1.1.2' },
    appCapabilities: {},
    protocolVersion: '2026-01-26'
  }).then(() => {
    window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*');
  });
  bridgeReady.catch(showError);

  async function callTool(name, args = {}) {
    await bridgeReady;
    const result = await rpcRequest('tools/call', { name, arguments: args });
    if (result.isError) throw new Error(result.content?.[0]?.text || 'Opération impossible.');
    return result.structuredContent;
  }

  async function flush() {
    clearTimeout(timer);
    if (!dirty || saving || conflicted) return;
    saving = true;
    dirty = false;
    const snapshot = { ...entries };
    const saveStatus = document.getElementById('sync-status');
    if (saveStatus) saveStatus.textContent = 'Sauvegarde en cours…';
    try {
      const response = await callTool('save_pokeidle_storage', { entries: snapshot, revision });
      revision = response.revision;
      if (saveStatus) saveStatus.textContent = 'Partie sauvegardée sur cet ordinateur';
      statusBar.hidden = true;
    } catch (error) {
      dirty = true;
      conflicted = /autre fenêtre/.test(error.message);
      if (saveStatus) saveStatus.textContent = 'Sauvegarde non confirmée';
      showError(error);
    } finally {
      saving = false;
      if (dirty && !conflicted) timer = setTimeout(flush, 3000);
    }
  }

  function changed() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 150);
  }

  window.POKEIDLE_STORAGE = {
    get length() { return Object.keys(entries).length; },
    key(index) { return Object.keys(entries)[index] ?? null; },
    getItem(key) { return entries[key] ?? null; },
    setItem(key, value) { entries[key] = String(value); changed(); },
    removeItem(key) { delete entries[key]; changed(); }
  };

  function confirmAction(text) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'pokeidle-confirm';
      const message = document.createElement('p');
      message.textContent = text;
      const cancel = document.createElement('button');
      cancel.textContent = 'Annuler';
      const accept = document.createElement('button');
      accept.textContent = 'Continuer';
      cancel.addEventListener('click', () => dialog.close('cancel'));
      accept.addEventListener('click', () => dialog.close('accept'));
      dialog.append(message, cancel, accept);
      document.body.appendChild(dialog);
      dialog.addEventListener('close', () => {
        const approved = dialog.returnValue === 'accept';
        dialog.remove();
        resolve(approved);
      }, { once: true });
      dialog.showModal();
    });
  }

  window.POKEIDLE_MCP_HOST = {
    ready: Promise.resolve(),
    confirm: confirmAction,
    async readVsCodeSave() { return (await callTool('read_pokeidle_vscode_save')).state; }
  };

  window.addEventListener('pokeidle-game-ready', () => { statusBar.hidden = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  retryButton.addEventListener('click', async () => {
    retryButton.disabled = true;
    try {
      if (conflicted) {
        const latest = await callTool('get_pokeidle_storage');
        entries = { ...latest.entries };
        revision = latest.revision;
        dirty = false;
        conflicted = false;
        window.acquireVsCodeApi().postMessage({ type: 'getState' });
      } else {
        await flush();
      }
    } catch (error) { showError(error); }
    finally { retryButton.disabled = false; }
  });
})();
