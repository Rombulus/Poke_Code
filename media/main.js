(function () {
    const vscode = acquireVsCodeApi();
    let stateGeneration = 0;

    let state = {
        pokedex: [],
        inventory: {
            balls: { pokeball: 20 },
            stones: {}
        },
        coins: 200,
        xp: 0,
        level: 1,
        missions: {
            captures: 0,
            evolutions: 0,
            typeProgress: {},
            claimed: []
        },
        spawnTimer: 180,
        discovery: {}, // ID -> { name, sprite }
        sessionStartTime: Date.now(),
        lastCaptureTimestamp: Date.now(),
        lastEvoTimestamp: Date.now(),
        lastPurchaseTimestamp: Date.now(),
        clickProgress: 0
    };

    const UI = {
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        spawnArea: document.getElementById('spawn-area'),
        coinCount: document.getElementById('coin-count'),
        pokedexCount: document.getElementById('pokedex-count'),
        pokedexList: document.getElementById('pokedex-list'),
        playerLevel: document.getElementById('player-level'),
        xpProgress: document.getElementById('xp-progress'),
        shopList: document.getElementById('shop-list'),
        itemSlots: document.querySelectorAll('.item-slot'),
        missionCaptureTarget: document.getElementById('mission-capture-target'),
        missionCaptureProgress: document.getElementById('mission-capture-progress'),
        claimMission1: document.getElementById('claim-mission-1'),
        pokeSearch: document.getElementById('poke-search'),
        pokeSort: document.getElementById('pokedex-sort'),
        pokedexControls: document.getElementById('pokedex-controls'),
        trainerTitle: document.getElementById('trainer-title'),
        safariNotificationsButton: document.getElementById('btn-safari-notifications'),
        safariNotificationsStatus: document.getElementById('safari-notifications-status'),
        githubSync: document.getElementById('btn-github-sync'),
        syncStatus: document.getElementById('sync-status'),
        exportBtn: document.getElementById('btn-export'),
        importBtn: document.getElementById('btn-import')
    };

    let currentPokemon = null;
    let selectedBall = 'pokeball';
    let ballThrowPending = false;
    let dayNightInterval = null;
    let gameLoopInterval = null;
    let spawnPending = false;
    let gameClockLoaded = false;
    // The game keeps running while its host editor is open, even when its
    // panel is in the background. pagehide/pageshow mark an actual page close.
    let gamePageActive = true;
    let lastClockPerformance = 0;
    let lastClockWall = 0;
    const evolutions = window.POKEIDLE_EVOLUTIONS;
    const challenges = window.POKEIDLE_CHALLENGES;
    let challengeFilter = 'recommended';
    let challengeNotice = '';
    let challengeRenderSignature = '';
    const evolutionLocks = new Set();
    const evolutionPayloads = new Map();
    let evolutionDialog = null;
    const expandedSpecies = new Set();
    const rarityEntries = Object.entries(evolutions.data.species).map(([id, species]) => ({ id: Number(id), ...species }));
    const legendaryIds = new Set(rarityEntries.filter(s => s.isLegendary || s.isMythical).map(s => s.id));
    const semiLegendaryIds = new Set(rarityEntries.filter(s => s.isSemiLegendary).map(s => s.id));
    const rareWildIds = new Set(rarityEntries.filter(s => s.captureRate <= 45 &&
        !legendaryIds.has(s.id) && !semiLegendaryIds.has(s.id)).map(s => s.id));
    const uncommonWildIds = new Set(rarityEntries.filter(s => s.captureRate > 45 && s.captureRate <= 100 &&
        !legendaryIds.has(s.id) && !semiLegendaryIds.has(s.id)).map(s => s.id));
    const commonSpeciesIds = rarityEntries.map(s => s.id)
        .filter(id => !legendaryIds.has(id) && !semiLegendaryIds.has(id) && !rareWildIds.has(id) && !uncommonWildIds.has(id));
    const collectionTracks = [
        { id: 'national', title: 'Pokédex national', description: 'Enregistre des espèces différentes dans ton Pokédex.', metric: 'species', icon: '📘',
            milestones: [[25, 'Novice du Pokédex'], [100, 'Explorateur Pokémon'], [250, 'Dresseur confirmé'], [500, 'Maître régional'], [750, 'Maître du Pokédex'], [1025, 'Maître national']] },
        { id: 'forms', title: 'Album des formes', description: 'Capture les variantes spéciales retenues dans le Safari.', metric: 'forms', icon: '🎨',
            milestones: [[3, 'Curieux des formes'], [10, 'Œil affûté'], [25, 'Collectionneur de formes'], [50, 'Archiviste des formes'], [100, 'Maître des formes']] },
        { id: 'evolutions', title: 'Collection évoluée', description: 'Ajoute à ta collection des espèces issues d’une évolution.', metric: 'evolutions', icon: '✨',
            milestones: [[5, 'Observateur des évolutions'], [15, 'Dresseur expérimenté'], [35, 'Spécialiste des évolutions'], [75, 'Savant Pokémon'], [150, 'Maître évolutif']] },
        { id: 'rare', title: 'Rencontres remarquables', description: 'Capture des Pokémon classés rares, semi-légendaires ou légendaires dans le Safari.', metric: 'rare', icon: '🌟',
            milestones: [[1, 'Rencontre rare'], [5, 'Pisteur de légendes'], [15, 'Chasseur de raretés'], [30, 'Gardien des légendes'], [50, 'Mythe du Safari'], [80, 'Légende vivante']] }
    ];
    const allCollectionTitles = collectionTracks.flatMap(track => track.milestones.map(([threshold, name]) => ({
        id: `${track.id}:${threshold}`, name, track: track.title, threshold, metric: track.metric
    })));
    allCollectionTitles.push({ id: 'master:all', name: 'Maître collectionneur', track: 'Toutes les collections', metric: 'master', threshold: 1 });

    function chooseEncounter(level, recentIds = []) {
        const levelScale = Math.max(0, Math.min(1, ((Number(level) || 1) - 1) / 49));
        const recent = new Set(recentIds);
        const available = ids => ids.filter(id => !recent.has(id));
        const buckets = [
            { ids: available([...legendaryIds]), rate: 0.01 * levelScale, rarity: 'Légendaire' },
            { ids: available([...semiLegendaryIds]), rate: 0.02 * levelScale, rarity: 'Semi-légendaire' },
            { ids: available([...rareWildIds]), rate: 0.04 * levelScale, rarity: 'Rare' },
            { ids: available([...uncommonWildIds]), rate: 0.03 * levelScale, rarity: 'Peu commun' }
        ].filter(bucket => bucket.ids.length && bucket.rate > 0);
        const roll = Math.random();
        let cumulative = 0;
        for (const bucket of buckets) {
            cumulative += bucket.rate;
            if (roll < cumulative) return { id: bucket.ids[Math.floor(Math.random() * bucket.ids.length)], rarity: bucket.rarity };
        }
        const ordinary = available(commonSpeciesIds);
        return { id: ordinary[Math.floor(Math.random() * ordinary.length)], rarity: 'Commun' };
    }

    if (!window.POKEIDLE_MCP_HOST) {
        for (const [id, action] of Object.entries({
            'github-configure': 'configure', 'github-push': 'push', 'github-pull': 'pull',
            'github-keep-local': 'keep-local', 'github-keep-remote': 'keep-github',
            'btn-new-game': 'newGame', 'btn-restore-game': 'restoreGame'
        })) document.getElementById(id)?.addEventListener('click', () => {
            if (action === 'newGame' || action === 'restoreGame') vscode.postMessage({ type: action });
            else vscode.postMessage({ type: 'githubAction', action, repository: document.getElementById('github-repository')?.value.trim(),
                branch: document.getElementById('github-branch')?.value.trim(), allowPublic: document.getElementById('github-allow-public')?.checked });
        });
    }

    // Initialisation
    vscode.postMessage({ type: 'getState' });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'loadState') {
            if (!message.value) return;
            stateGeneration = message.generation ?? stateGeneration;
            evolutionDialog?.close();
            gameClockLoaded = false;
            state = message.value;
            challengeRenderSignature = '';
            challengeNotice = '';

            // Initialisation des modes UI
            UI.pokedexMode = UI.pokedexMode || 'collection';
            if (typeof state.collectionTitle !== 'string') state.collectionTitle = '';
            if (typeof state.safariNotifications !== 'boolean') state.safariNotifications = false;

            // Migrations de donnees
            if (!state.inventory) state.inventory = { balls: { pokeball: 20 }, stones: {} };
            if (!state.inventory.balls) state.inventory.balls = { pokeball: 20 };
            if (!state.inventory.stones) state.inventory.stones = {};

            if (state.spawnTimer === undefined || isNaN(state.spawnTimer)) {
                state.spawnTimer = 180;
            }
            if (!state.missions) state.missions = { captures: 0, evolutions: 0, typeProgress: {}, claimed: [] };
            if (!state.missions.typeProgress) state.missions.typeProgress = {};
            if (!state.stats) state.stats = { totalCoins: 0, shinies: 0, epics: 0, uniques: 0, evolved: 0, liberated: 0, totalItemsBought: 0, totalBallsBought: 0, totalClicks: 0 };
            if (!state.stats.totalItemsBought) state.stats.totalItemsBought = 0;
            if (!state.stats.totalBallsBought) state.stats.totalBallsBought = 0;
            if (!state.stats.totalClicks) state.stats.totalClicks = 0;
            if (!state.sessionStartTime) state.sessionStartTime = Date.now();
            if (!state.lastCaptureTimestamp) state.lastCaptureTimestamp = Date.now();
            if (!state.lastEvoTimestamp) state.lastEvoTimestamp = Date.now();
            if (!state.lastPurchaseTimestamp) state.lastPurchaseTimestamp = Date.now();
            if (state.clickProgress === undefined) state.clickProgress = 0;

            // New Quest States
            if (state.middayCaptures === undefined) state.middayCaptures = 0;
            if (state.dawnCaptureAchieved === undefined) state.dawnCaptureAchieved = false;
            if (state.soldLevel50 === undefined) state.soldLevel50 = false;
            if (!state.recentEvoTimestamps) state.recentEvoTimestamps = [];
            if (state.ningaleEvolvedWithBalls === undefined) state.ningaleEvolvedWithBalls = false;
            if (state.boughtAbove10000 === undefined) state.boughtAbove10000 = false;

            if (!state.released) state.released = [];
            if (!state.recentSpawns) state.recentSpawns = [];
            state.recentSpawns = [...new Set(state.recentSpawns.map(id => evolutions.speciesIdOf({ id })).filter(Boolean))].slice(-5);

            if (!state.discovery) {
                state.discovery = {};
            } else if (Array.isArray(state.discovery)) {
                // Migration propre : on garde les IDs mais on n'a pas encore les noms/sprites
                const oldDiscovery = state.discovery;
                state.discovery = {};
                oldDiscovery.forEach(id => {
                    state.discovery[id] = { name: "Pokemon Decouvert", sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` };
                });
            }

            // Migration : Ajouter des IDs et Niveaux aux Pokemon qui n'en ont pas
            if (Array.isArray(state.pokedex)) {
                state.pokedex.forEach(p => {
                    if (p) {
                        if (!p.instanceId) p.instanceId = Date.now() + Math.random();
                        if (!p.level) p.level = 5;
                        if (p.xp === undefined) p.xp = 0;
                        if (p.speciesId > 10000) p.speciesId = null;
                        if (!p.speciesId && p.id <= 10000) p.speciesId = p.id;
                        if (p.nextEvoLevel === "Erreur") p.nextEvoLevel = null;
                        if (!p.captureTimestamp) p.captureTimestamp = Date.now();

                        // Migration de genre robuste
                        if (p.gender === 'mâle') p.gender = 'male';
                        if (p.gender === 'femelle') p.gender = 'female';
                        if (p.gender === 'asexué') p.gender = 'genderless';

                        // Genres forcés pour certaines espèces connues
                        const maleOnly = [32, 33, 34, 106, 107, 128, 236, 237, 538, 539, 627, 628, 641, 642, 645];
                        const femaleOnly = [29, 30, 31, 113, 115, 124, 238, 241, 242, 440, 548, 549, 629, 630, 488];

                        if (maleOnly.includes(p.id)) p.gender = 'male';
                        if (femaleOnly.includes(p.id)) p.gender = 'female';

                        if (!p.gender || (p.gender !== 'male' && p.gender !== 'female' && p.gender !== 'genderless')) {
                            p.gender = Math.random() < 0.5 ? 'male' : 'female';
                        }

                        // On marque pour une future synchronization API preçise
                        window.POKEIDLE_EVOLUTIONS.syncPokemon(p);
                    }
                });
            } else {
                state.pokedex = [];
            }

            initializeActiveClock();
            translateExistingPokedex();
            syncDiscovery();
            if (!('Notification' in window) || Notification.permission !== 'granted') state.safariNotifications = false;
            if (!getCollectionTitles().some(title => title.id === state.collectionTitle)) state.collectionTitle = '';
            challenges.update(state);
            saveState();
            updateUI();
            renderPokedex();
            updateSafariNotificationSettings();
            renderMissions();

            updateDayNight();
            if (dayNightInterval) clearInterval(dayNightInterval);
            dayNightInterval = setInterval(updateDayNight, 60000);

            startGameLoop();
        } else if (message.type === 'syncPause') {
            window.POKEIDLE_SYNC_BUSY = Boolean(message.value);
            resetClockSample();
            const app = document.getElementById('app'); if (app) app.inert = Boolean(message.value);
        } else if (message.type === 'githubStatus') {
            const cloud = document.getElementById('github-sync-status');
            if (cloud) cloud.textContent = message.value.message || (message.value.configured ? 'GitHub prêt' : 'GitHub non configuré');
            const repository = document.getElementById('github-repository');
            if (repository && message.value.repository) repository.value = message.value.repository;
            const branch = document.getElementById('github-branch'); if (branch && message.value.branch) branch.value = message.value.branch;
            const publicSave = document.getElementById('github-allow-public'); if (publicSave) publicSave.checked = message.value.publicSaveApproved === true;
            const conflict = document.getElementById('github-conflict');
            if (conflict) conflict.hidden = message.value.state !== 'conflict';
        } else if (message.type === 'syncStatus') {
            updateSyncStatus(message.value, message.date);
        } else if (message.type === 'copyToClipboard') {
            navigator.clipboard.writeText(message.value);
        }
    });

    function updateSyncStatus(status, date) {
        if (!UI.syncStatus) return;
        if (status === 'inprogress') {
            UI.syncStatus.innerText = "Synchronisation en cours...";
            UI.syncStatus.className = "sync-status loading";
        } else if (status === 'success') {
            UI.syncStatus.innerText = `Dernière synchro : ${date}`;
            UI.syncStatus.className = "sync-status success";
        } else if (status === 'local') {
            UI.syncStatus.innerText = 'Partie enregistrée sur ce PC';
            UI.syncStatus.className = 'sync-status';
        } else if (status === 'error') {
            UI.syncStatus.innerText = "Erreur de synchronisation";
            UI.syncStatus.className = "sync-status error";
        }
    }

    function updateDayNight() {
        const hour = new Date().getHours();
        // Jour de 7h a 19h
        const isNight = hour >= 19 || hour < 7;
        document.body.classList.toggle('night-mode', isNight);
    }

    function mergeDiscovery(discoveries, pokemon, caught, recordEncounter = true) {
        const p = { ...pokemon };
        evolutions.syncPokemon(p);
        const speciesId = evolutions.speciesIdOf(p);
        if (!speciesId) return;
        const form = evolutions.formOf(p);
        const entry = discoveries[speciesId] ||= {
            speciesId, name: evolutions.speciesLabel(p), sprite: p.sprite, caught: false, variants: []
        };
        if (!entry.sprite || (!entry.caught && caught)) entry.sprite = p.sprite;
        entry.caught = Boolean(entry.caught || caught);
        entry.name = evolutions.speciesLabel(p);
        entry.speciesId = speciesId;
        entry.variants ||= [];
        const formId = form?.id || p.formId || p.id;
        const variant = entry.variants.find(v => v.formId === formId);
        if (variant) {
            variant.caught = Boolean(variant.caught || caught);
            if (!variant.sprite) variant.sprite = p.sprite;
            if (recordEncounter && p.rarity) variant.rarity = p.rarity;
        } else {
            entry.variants.push({ formId, id: p.id, name: p.name,
                label: evolutions.variantLabel(p), sprite: p.sprite,
                rarity: recordEncounter ? (p.rarity || '') : '', caught: Boolean(caught) });
        }
        entry.variants.sort((a, b) => a.formId - b.formId);
    }

    function discoveryCount(caughtOnly = false) {
        return Object.entries(state.discovery || {}).filter(([id, d]) =>
            evolutions.data.species[id] && (!caughtOnly || d.caught)).length;
    }

    function collectionMetrics() {
        const caughtEntries = Object.entries(state.discovery || {}).filter(([id, entry]) =>
            evolutions.data.species[id] && entry?.caught);
        const caughtSpecies = new Set(caughtEntries.map(([id]) => Number(id)));
        const evolutionTargets = new Set(evolutions.data.rules.map(rule => Number(rule.to)));
        const rareSpecies = new Set([...legendaryIds, ...semiLegendaryIds, ...rareWildIds]);
        const caughtForms = new Set();
        for (const [id, entry] of caughtEntries) {
            const speciesId = Number(id);
            const defaultForm = Number(evolutions.data.defaultForms[speciesId] || speciesId);
            const allowedForms = new Set(evolutions.formsForSpecies(speciesId).map(form => Number(form.id)));
            for (const variant of entry.variants || []) {
                const formId = Number(variant.formId);
                if (variant.caught && formId !== defaultForm && allowedForms.has(formId)) caughtForms.add(`${speciesId}:${formId}`);
            }
        }
        return {
            species: { value: caughtSpecies.size, total: Object.keys(evolutions.data.species).length },
            forms: { value: caughtForms.size, total: Object.entries(evolutions.data.forms).filter(([id, form]) =>
                Number(id) !== Number(evolutions.data.defaultForms[form.speciesId] || form.speciesId) &&
                evolutions.formsForSpecies(form.speciesId).some(allowed => Number(allowed.id) === Number(id))).length },
            evolutions: { value: [...caughtSpecies].filter(id => evolutionTargets.has(id)).length, total: [...evolutionTargets].length },
            rare: { value: caughtEntries.filter(([id, entry]) => {
                const speciesId = Number(id);
                return legendaryIds.has(speciesId) || semiLegendaryIds.has(speciesId) ||
                    entry.variants?.some(variant => variant.caught && variant.rarity === 'Rare');
            }).length, total: rareSpecies.size }
        };
    }

    function getCollectionTitles(metrics = collectionMetrics()) {
        const unlocked = [];
        for (const track of collectionTracks) {
            for (const [threshold, name] of track.milestones) {
                if (metrics[track.metric].value >= threshold) unlocked.push({ id: `${track.id}:${threshold}`, name, track: track.title });
            }
        }
        if (collectionTracks.every(track => metrics[track.metric].value >= track.milestones[track.milestones.length - 1][0])) {
            unlocked.push({ id: 'master:all', name: 'Maître collectionneur', track: 'Toutes les collections' });
        }
        return unlocked;
    }

    function recordDiscovery(p, caught, recordEncounter = true) {
        mergeDiscovery(state.discovery, p, caught, recordEncounter);
        if (state.stats) state.stats.uniques = discoveryCount(true);
    }

    function syncDiscovery() {
        const previous = JSON.stringify(state.discovery || {});
        const normalized = {};
        for (const [id, discovery] of Object.entries(state.discovery || {})) {
            if (discovery.variants?.length) {
                for (const variant of discovery.variants) {
                    mergeDiscovery(normalized, { ...variant, speciesId: Number(id) }, variant.caught);
                }
                if (normalized[id]) normalized[id].caught ||= Boolean(discovery.caught);
            } else {
                const legacy = { ...discovery, id: Number(id) };
                if (evolutions.speciesIdOf(legacy)) mergeDiscovery(normalized, legacy, discovery.caught);
                else normalized[id] = discovery; // Keep unmapped historical records for compatibility.
            }
        }
        for (const p of state.pokedex || []) if (p) mergeDiscovery(normalized, p, true, !p.hasEvolved);
        state.discovery = normalized;
        state.stats.uniques = discoveryCount(true);
        if (JSON.stringify(normalized) !== previous) saveState();
    }

    async function translateExistingPokedex() {
        let changed = false;
        for (let p of state.pokedex) {
            if (!p) continue;
            if (p.name === p.name.toLowerCase() && !p.name.includes(' ')) {
                try {
                    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}/`);
                    const data = await res.json();
                    const fr = data.names.find(n => n.language.name === 'fr')?.name;
                    if (fr) {
                        p.name = fr;
                        changed = true;
                    }
                } catch (e) { }
            }
        }
        if (changed) {
            renderPokedex();
            saveState();
        }
    }

    function init() {
        try {
            setupInventoryScrollControls();
            // Gestion des Onglets
            if (UI.tabs) {
                UI.tabs.forEach(btn => {
                    btn.addEventListener('click', () => {
                        try {
                            const tabId = btn.dataset.tab;
                            UI.tabs.forEach(b => b.classList.remove('active'));
                            UI.tabContents.forEach(c => c.classList.add('hidden'));

                            btn.classList.add('active');
                            const content = document.getElementById(tabId);
                            if (content) content.classList.remove('hidden');

                            if (tabId === 'pokedex-tab') renderPokedex();
                            if (tabId === 'shop-tab') renderShop();
                            if (tabId === 'missions-tab') renderMissions();
                            if (tabId === 'settings-tab') renderMissions();
                        } catch (err) {
                            console.error("Tab error:", err);
                        }
                    });
                });
            }

            // Click tracking global
            document.addEventListener('click', () => {
                if (!state.stats) state.stats = {};
                state.stats.totalClicks = (state.stats.totalClicks || 0) + 1;
            });

            // Gestion de la recherche dans le Pokédex
            if (UI.pokeSearch) {
                UI.pokeSearch.addEventListener('input', () => {
                    try {
                        renderPokedex();
                    } catch (err) { }
                });
            }

            // Gestion du tri
            if (UI.pokeSort) {
                UI.pokeSort.addEventListener('change', () => {
                    renderPokedex();
                });
            }

            // GitHub Sync
            if (UI.githubSync) {
                UI.githubSync.addEventListener('click', () => {
                    vscode.postMessage({ type: 'githubSync' });
                });
            }

            // Export
            if (UI.exportBtn) {
                UI.exportBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'exportState' });
                });
            }

            // Import
            if (UI.importBtn) {
                UI.importBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'importState' });
                });
            }

            if (UI.safariNotificationsButton) {
                UI.safariNotificationsButton.addEventListener('click', toggleSafariNotifications);
            }
        } catch (err) {
            console.error("Init error:", err);
        }
    }

    // Lancer l'init au chargement
    init();

    function updateUI() {
        try {
            const playStatus = document.getElementById('active-play-status');
            if (playStatus) {
                const seconds = Math.floor(activeNow() / 1000);
                playStatus.textContent = `Temps de jeu actif : ${Math.floor(seconds / 3600)} h ${Math.floor(seconds / 60) % 60} min ${seconds % 60} s. Les compteurs sont en pause quand le jeu est fermé ou suspendu.`;
            }
            if (UI.coinCount) UI.coinCount.innerText = state.coins || 0;
            if (UI.pokedexCount) UI.pokedexCount.innerText = new Set((state.pokedex || []).filter(Boolean).map(p => evolutions.speciesIdOf(p))).size;
            if (UI.playerLevel) UI.playerLevel.innerText = state.level || 1;
            if (UI.trainerTitle) {
                const equipped = allCollectionTitles.find(title => title.id === state.collectionTitle);
                UI.trainerTitle.textContent = equipped ? `✦ ${equipped.name}` : '';
                UI.trainerTitle.hidden = !equipped;
            }

            const lvl = state.level || 1;
            const xpToNext = Math.floor(Math.pow(lvl, 1.8) * 150);
            const progress = Math.min(100, ((state.xp || 0) / xpToNext) * 100);
            if (UI.xpProgress) UI.xpProgress.style.width = `${progress}%`;

            renderBallInventory();
            renderStoneInventory();
            renderMissions();

            // Gestion des badges de notification
            const badgeSafari = document.getElementById('badge-safari');
            if (badgeSafari) {
                badgeSafari.classList.toggle('active', currentPokemon !== null);
                badgeSafari.setAttribute('aria-hidden', 'true');
            }
            const safariTab = document.querySelector('[data-tab="safari-tab"]');
            if (safariTab) {
                if (currentPokemon) safariTab.setAttribute('aria-label', `Safari — ${currentPokemon.name} est apparu`);
                else safariTab.removeAttribute('aria-label');
            }

            const badgeMissions = document.getElementById('badge-missions');
            if (badgeMissions) {
                const hasClaimable = challenges.models(state).some(m => !m.complete && m.progress.ready);
                badgeMissions.classList.toggle('active', hasClaimable);
            }

            // Easter Egg Debug
            let debugClicks = 0;
            const header = document.querySelector('header');
            if (header) {
                header.onclick = () => {
                    debugClicks++;
                    if (debugClicks >= 5) {
                        state.coins += 2000;
                        debugClicks = 0;
                        vscode.postMessage({ type: 'showInfo', value: "DEBUG: +2000 pieces ajoutees !" });
                        updateUI();
                        saveState();
                    }
                };
            }
        } catch (err) {
            console.error("updateUI error:", err);
        }
    }

    const BALL_TYPES = [
        { id: 'pokeball', name: 'Poké Ball', rate: 0.4, price: 20, img: 'poke-ball' },
        { id: 'superball', name: 'Super Ball', rate: 0.6, price: 100, img: 'great-ball' },
        { id: 'hyperball', name: 'Hyper Ball', rate: 0.85, price: 400, img: 'ultra-ball' },
        { id: 'masterball', name: 'Master Ball', rate: 1.0, price: 5000, img: 'master-ball' },
        { id: 'sombreball', name: 'Sombre Ball', rate: 0.7, price: 150, img: 'dusk-ball' },
        { id: 'quickball', name: 'Rapide Ball', rate: 0.7, price: 150, img: 'quick-ball' },
        { id: 'luxeball', name: 'Luxe Ball', rate: 0.5, price: 200, img: 'luxury-ball' },
        { id: 'soinball', name: 'Soin Ball', rate: 0.4, price: 50, img: 'heal-ball' },
        { id: 'filetball', name: 'Filet Ball', rate: 0.6, price: 120, img: 'net-ball' },
        { id: 'faibleball', name: 'Faible Ball', rate: 0.5, price: 80, img: 'nest-ball' },
        { id: 'scaphandreball', name: 'Scaphandre Ball', rate: 0.6, price: 120, img: 'dive-ball' },
        { id: 'amourball', name: 'Love Ball', rate: 0.5, price: 250, img: 'love-ball' }
    ];

    function getPokeDollarIcon() {
        return window.POKEDOLLAR_URI || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/nugget.png';
    }

    const itemIconMapping = {
        'alora-sand': 'soft-sand',
        'rock-peak': 'hard-stone',
        'galar-vapor': 'smoke-ball',
        'ancient-manuscript': 'enigma-stone',
        'boussole-magnetique': 'magnet',
        'cable-croise': 'up-grade',
        'masque-maudit': 'spell-tag',
        'carte-de-voyage': 'town-map',
        'pokego-candy': 'rare-candy',
        'linking-cord': 'linking-cord',
        'link-cable': 'linking-cord',
        'cable-link': 'linking-cord',
        'link-cord': 'linking-cord',
        'upgrade': 'up-grade',
        'syrupy-apple': 'syrupy-apple',
        'sweet-apple': 'sweet-apple',
        'tart-apple': 'tart-apple',
        'unremarkable-teacup': 'unremarkable-teacup',
        'masterpiece-teacup': 'masterpiece-teacup',
        'metal-alloy': 'metal-alloy',
        'leaders-crest': 'leaders-crest',
        'gimmighoul-coin': 'gimmighoul-coin',
        'scroll-of-darkness': 'enigma-stone',
        'scroll-of-waters': 'enigma-stone',
        'strawberry-sweet': 'strawberry-sweet',
        'love-sweet': 'love-sweet',
        'berry-sweet': 'berry-sweet',
        'clover-sweet': 'clover-sweet',
        'flower-sweet': 'flower-sweet',
        'star-sweet': 'star-sweet',
        'ribbon-sweet': 'ribbon-sweet'
    };

    function getItemIcon(id) {
        const mappedId = itemIconMapping[id] || id;
        return window.POKEIDLE_ITEM_ICONS?.[mappedId]
            || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${mappedId}.png`;
    }

    function setupInventoryScrollControls() {
        document.querySelectorAll('.inventory-scroll-btn').forEach(btn => {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', event => {
                event.stopPropagation();
                const target = document.getElementById(btn.dataset.scrollTarget);
                if (!target) return;
                const direction = Number(btn.dataset.scrollDirection) || 1;
                const amount = Math.max(120, target.clientWidth * 0.8);
                target.scrollBy({ left: direction * amount, behavior: 'smooth' });
            });
        });
        document.querySelectorAll('.inventory-bar').forEach(bar => {
            if (bar.dataset.wheelBound === 'true') return;
            bar.dataset.wheelBound = 'true';
            bar.addEventListener('wheel', event => {
                if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                event.preventDefault();
                bar.scrollBy({ left: event.deltaY, behavior: 'smooth' });
            }, { passive: false });
        });
    }

    document.addEventListener('error', event => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-pokeidle-item') || image.dataset.fallbackApplied) return;
        image.dataset.fallbackApplied = 'true';
        image.src = window.POKEIDLE_ITEM_ICONS?.__fallback || getPokeDollarIcon();
    }, true);

    function renderBallInventory() {
        const container = document.getElementById('ball-inventory');
        container.innerHTML = '';
        BALL_TYPES.forEach(ball => {
            const count = state.inventory.balls[ball.id] || 0;
            const slot = document.createElement('div');
            slot.className = `item-slot ${selectedBall === ball.id ? 'active' : ''}`;
            slot.innerHTML = `
                <img src="${getItemIcon(ball.img)}" alt="${ball.name}" data-pokeidle-item>
                <span>${count}</span>
            `;
            slot.onclick = () => {
                selectedBall = ball.id;
                updateUI();
            };
            container.appendChild(slot);
        });
    }

    function renderStoneInventory() {
        const container = document.getElementById('stone-inventory');
        if (!container) return;
        container.innerHTML = '';
        const stones = (state.inventory && state.inventory.stones) ? state.inventory.stones : {};
        Object.entries(stones).forEach(([stone, count]) => {
            if (count > 0) {
                const slot = document.createElement('div');
                slot.className = 'item-slot';
                slot.title = challenges.itemName(stone);
                const img = document.createElement('img');
                img.src = getItemIcon(stone);
                img.alt = challenges.itemName(stone);
                img.setAttribute('data-pokeidle-item', '');
                const span = document.createElement('span');
                span.textContent = count;
                slot.appendChild(img);
                slot.appendChild(span);
                container.appendChild(slot);
            }
        });
    }

    function createPPDisplay() {
        const stats = document.querySelector('.stats');
        const ppSpan = document.createElement('span');
        ppSpan.id = 'pp-count';
        ppSpan.style.color = '#ffd700';
        ppSpan.style.marginLeft = '10px';
        stats.appendChild(ppSpan);
        const ppIcon = document.createElement('img');
        ppIcon.src = getItemIcon('rare-candy');
        ppIcon.alt = 'Bonbon';
        ppIcon.setAttribute('data-pokeidle-item', '');
        ppIcon.className = 'mini-icon';
        stats.appendChild(ppIcon);
        return ppSpan;
    }

    function activeNow() {
        return Number.isFinite(state.activeTimeMs) ? state.activeTimeMs : 0;
    }

    function activeElapsed(marker) {
        return Math.max(0, activeNow() - (Number.isFinite(state[marker]) ? state[marker] : activeNow()));
    }

    function initializeActiveClock() {
        // Legacy wall timestamps contain unknown offline time. Never convert them
        // into earned play time, nor revoke items/rewards already obtained.
        const migrated = state.activeTimeVersion !== 1;
        if (migrated) {
            state.activeTimeVersion = 1;
            state.activeTimeMs = 0;
            state.activeTickRemainderMs = 0;
            state.passiveXpElapsedMs = 0;
            state.passiveCoinsElapsedMs = 0;
            state.recentEvolutionActiveTimes = [];
            for (const marker of ['lastCaptureAtActiveMs', 'lastEvolutionAtActiveMs',
                'lastPurchaseAtActiveMs', 'lastBallPurchaseAtActiveMs']) state[marker] = 0;
        }
        if (!Number.isFinite(state.activeTimeMs) || state.activeTimeMs < 0) state.activeTimeMs = 0;
        for (const marker of ['lastCaptureAtActiveMs', 'lastEvolutionAtActiveMs',
            'lastPurchaseAtActiveMs', 'lastBallPurchaseAtActiveMs']) {
            if (!Number.isFinite(state[marker]) || state[marker] > activeNow() || state[marker] < 0) state[marker] = activeNow();
        }
        for (const [key, period] of [['activeTickRemainderMs', 1000], ['passiveXpElapsedMs', 3000], ['passiveCoinsElapsedMs', 60000]]) {
            if (!Number.isFinite(state[key]) || state[key] < 0 || state[key] >= period) state[key] = 0;
        }
        state.recentEvolutionActiveTimes = (Array.isArray(state.recentEvolutionActiveTimes) ? state.recentEvolutionActiveTimes : []).filter(t =>
            Number.isFinite(t) && t <= activeNow() && activeNow() - t < 120000);
        state.recentEvoCount = state.recentEvolutionActiveTimes.length;
        for (const p of state.pokedex) {
            if (!p) continue;
            if (migrated || !Number.isFinite(p.capturedAtActiveMs) || p.capturedAtActiveMs > activeNow() || p.capturedAtActiveMs < 0) {
                p.capturedAtActiveMs = activeNow();
            }
        }
        gameClockLoaded = true;
        if (migrated) saveState();
    }

    function resetClockSample() {
        lastClockPerformance = performance.now();
        lastClockWall = Date.now();
    }

    function setGamePageActive(active) {
        const next = Boolean(active);
        const changed = gamePageActive !== next;
        gamePageActive = next;
        resetClockSample();
        if (changed && !next && gameClockLoaded && !window.POKEIDLE_SYNC_BUSY) saveState();
    }

    window.addEventListener('pagehide', () => {
        setGamePageActive(false);
    });
    window.addEventListener('pageshow', () => setGamePageActive(true));

    function startGameLoop() {
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        resetClockSample();
        gameLoopInterval = setInterval(() => {
            const monotonic = performance.now();
            const wall = Date.now();
            const elapsed = monotonic - lastClockPerformance;
            const wallElapsed = wall - lastClockWall;
            lastClockPerformance = monotonic;
            lastClockWall = wall;
            // Background editor panels may throttle timers to roughly one tick
            // per minute. Credit that live time, but ignore long gaps caused by
            // sleep, a closed page, host synchronization or a frozen webview.
            const maxLiveTickGapMs = 65000;
            if (!gameClockLoaded || !gamePageActive || window.POKEIDLE_SYNC_BUSY ||
                elapsed <= 0 || elapsed > maxLiveTickGapMs || wallElapsed < 0 || wallElapsed > maxLiveTickGapMs) return;
            const creditedMs = Math.floor(elapsed);
            state.activeTimeMs += creditedMs;
            state.activeTickRemainderMs += creditedMs;
            const seconds = Math.floor(state.activeTickRemainderMs / 1000);
            state.activeTickRemainderMs %= 1000;
            if (!currentPokemon && !spawnPending) {
                state.spawnTimer = Math.max(0, state.spawnTimer - seconds);
                if (state.spawnTimer <= 0) {
                    state.spawnTimer = Math.floor(Math.random() * (180 - 30 + 1)) + 30;
                    spawnPokemon();
                }
            }
            state.passiveXpElapsedMs += creditedMs;
            const xpTicks = Math.floor(state.passiveXpElapsedMs / 3000);
            state.passiveXpElapsedMs %= 3000;
            for (let tick = 0; tick < xpTicks; tick++) gainPassiveXP();
            state.passiveCoinsElapsedMs += creditedMs;
            const coinTicks = Math.floor(state.passiveCoinsElapsedMs / 60000);
            state.passiveCoinsElapsedMs %= 60000;
            if (coinTicks) state.coins += 20 * coinTicks;
            state.recentEvolutionActiveTimes = state.recentEvolutionActiveTimes.filter(t => activeNow() - t < 120000);
            state.recentEvoCount = state.recentEvolutionActiveTimes.length;
            updateSpawnTimerUI();
            if (seconds || coinTicks) updateUI();
            saveState();
        }, 1000);
    }

    function updateSpawnTimerUI() {
        const timerEl = document.getElementById('spawn-timer-display');
        if (timerEl && !currentPokemon) {
            const mins = Math.floor(state.spawnTimer / 60);
            const secs = state.spawnTimer % 60;
            timerEl.innerText = `Prochain Pokemon dans : ${mins}:${secs.toString().padStart(2, '0')}`;
        } else if (timerEl) {
            timerEl.innerText = "Un Pokemon est apparu !";
        }
    }

    function gainPassiveXP() {
        const leveledPokemon = [];
        state.pokedex.forEach(p => {
            if (!p) return;
            // Gain de 1 XP toutes les 3 secondes
            p.xp = (p.xp || 0) + 1;
            const xpToNext = calculatePokeXPToNext(p.level || 1);
            if (p.xp >= xpToNext) {
                p.level = (p.level || 1) + 1;
                p.xp = 0;
                leveledPokemon.push(p);
                // Evolutions remain manual so the player can choose a branch.
            }
        });

        // Update XP fields in place: rebuilding the collection also reloads every sprite.
        const isPokedexOpen = !document.getElementById('pokedex-tab').classList.contains('hidden');
        if (isPokedexOpen) updatePokedexProgress(leveledPokemon);

        // Toujours sauvegarder le gain d'XP
        saveState();
    }

    function updatePokedexProgress(leveledPokemon = []) {
        if (UI.pokedexMode !== 'collection' || !UI.pokedexList) return;
        const cards = new Map([...UI.pokedexList.querySelectorAll('.pokedex-item')]
            .map(item => [item.dataset.instanceId, item]));
        const leveledIds = new Set(leveledPokemon.map(p => String(p.instanceId)));

        state.pokedex.forEach(p => {
            if (!p) return;
            const item = cards.get(String(p.instanceId));
            if (!item) return;

            const xpToNext = calculatePokeXPToNext(p.level || 1);
            const xpProgress = Math.min(100, ((p.xp || 0) / xpToNext) * 100);
            const level = item.querySelector('.p-lvl');
            const progress = item.querySelector('.p-xp-bar > div');
            if (level) level.textContent = `Nv.${p.level || '?'}`;
            if (progress) progress.style.width = `${xpProgress}%`;

            if (leveledIds.has(String(p.instanceId))) {
                const evolution = item.querySelector('.evo-timer');
                if (evolution) {
                    const status = calculateEvoTime(p);
                    evolution.textContent = status;
                    evolution.classList.toggle('evo-ready', status === 'Évolution prête !');
                }
            }
        });
    }

    function calculatePokeXPToNext(level) {
        return Math.floor(Math.pow(level, 1.5) * 20);
    }

    async function fetchPokeApiJson(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return await response.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    async function spawnPokemon() {
        if (spawnPending || !gamePageActive || window.POKEIDLE_SYNC_BUSY) return;
        spawnPending = true;
        const spawnState = state;
        UI.spawnArea.innerHTML = `
            <div class="hunting-container">
                <div class="shaking-grass">🌾</div>
                <div class="loader">Un Pokemon approche...</div>
            </div>
        `;
        vscode.postMessage({ type: 'updateStatus', active: true });

        try {
            let data = null;
            let speciesData = null;
            let found = false;

            while (!found) {
                const encounter = chooseEncounter(state.level, state.recentSpawns);
                const id = encounter.id;
                speciesData = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);

                // One species draw, followed by one appearance draw. Species with
                // many forms do not receive extra encounter probability.
                const forms = evolutions.formsForSpecies(speciesData.id);
                if (!forms.length) continue;
                const form = forms[Math.floor(Math.random() * forms.length)];
                data = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon/${form.pokemonId}/`);
                let sprite = data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default;
                const formId = form.id;
                if (data.forms.length > 1) {
                    const formData = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon-form/${formId}/`);
                    sprite = formData.sprites.front_default || sprite;
                }

                const capRate = speciesData.capture_rate;

                if (state !== spawnState || !gamePageActive || window.POKEIDLE_SYNC_BUSY) return;
                found = true;

                // Mise a jour des doublons
                state.recentSpawns.push(speciesData.id);
                if (state.recentSpawns.length > 5) state.recentSpawns.shift();

                currentPokemon = {
                    id: data.id,
                    speciesId: speciesData.id,
                    formId,
                    name: evolutions.targetLabel(form),
                    rarity: encounter.rarity,
                    captureRate: capRate,
                    genderRate: speciesData.gender_rate, // On stocke pour la capture
                    sprite: sprite,
                    types: data.types.map(t => t.type.name),
                    isShiny: Math.random() < (1 / 512),
                    baseExperience: data.base_experience || 50,
                    level: Math.max(1, Math.floor(state.level * 0.8) + Math.floor(Math.random() * 5))
                };

                recordDiscovery(currentPokemon, false);
                saveState();
            }

            renderPokemon();
            notifySafariEncounter(currentPokemon);
        } catch (error) {
            console.error("Spawn error:", error);
            if (state === spawnState) {
                state.spawnTimer = 10; // Retry only in the same game.
                UI.spawnArea.innerHTML = '<div class="loader" id="spawn-timer-display">La recherche a échoué. Nouvelle tentative…</div>';
                updateSpawnTimerUI();
                saveState();
            }
            vscode.postMessage({ type: 'updateStatus', active: false });
        } finally { spawnPending = false; }
    }

    function renderPokemon() {
        UI.spawnArea.innerHTML = `
            <div class="pokemon-card ${currentPokemon.isShiny ? 'shiny-glow' : ''}" id="active-pokemon">
                <div class="rarity-tag ${currentPokemon.rarity.toLowerCase()}">${currentPokemon.rarity}</div>
                <img src="${currentPokemon.sprite}" class="pokemon-sprite">
                <div class="pokemon-name">
                    ${currentPokemon.isShiny ? '✨ ' : ''}${currentPokemon.name}
                    ${currentPokemon.gender === 'male' ? '<span class="gender-m">♂</span>' : (currentPokemon.gender === 'female' ? '<span class="gender-f">♀</span>' : '')}
                    <span class="lvl">Nv.${currentPokemon.level}</span>
                </div>
                <div class="capture-hint">Cliquez pour capturer !</div>
            </div>
        `;

        document.getElementById('active-pokemon').addEventListener('click', catchPokemon);
        const safariTab = document.querySelector('[data-tab="safari-tab"]');
        const badge = document.getElementById('badge-safari');
        if (safariTab) safariTab.setAttribute('aria-label', `Safari — ${currentPokemon.name} est apparu`);
        if (badge) badge.setAttribute('aria-label', `${currentPokemon.name} est apparu dans le Safari`);
    }

    async function toggleSafariNotifications() {
        if (state.safariNotifications) {
            state.safariNotifications = false;
            saveState(); updateSafariNotificationSettings();
            return;
        }
        if (!('Notification' in window)) {
            if (UI.safariNotificationsStatus) UI.safariNotificationsStatus.textContent = 'Les notifications de bureau ne sont pas disponibles dans cet éditeur. Le badge Safari reste actif dans le jeu.';
            return;
        }
        try {
            const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
            state.safariNotifications = permission === 'granted';
            saveState(); updateSafariNotificationSettings();
            if (!state.safariNotifications && UI.safariNotificationsStatus) {
                UI.safariNotificationsStatus.textContent = permission === 'denied'
                    ? 'Autorisation refusée. Tu peux la modifier dans les paramètres de notifications de Codex.'
                    : 'Autorisation non accordée. Le badge Safari reste actif dans le jeu.';
            }
        } catch (error) {
            state.safariNotifications = false;
            updateSafariNotificationSettings();
            if (UI.safariNotificationsStatus) UI.safariNotificationsStatus.textContent = 'Codex ne permet pas les notifications de bureau dans ce panneau. Le badge Safari reste actif dans le jeu.';
        }
    }

    function updateSafariNotificationSettings() {
        if (UI.safariNotificationsButton) {
            UI.safariNotificationsButton.textContent = state.safariNotifications ? 'Désactiver les notifications' : 'Activer les notifications';
            UI.safariNotificationsButton.setAttribute('aria-pressed', String(Boolean(state.safariNotifications)));
        }
        if (UI.safariNotificationsStatus && state.safariNotifications) {
            UI.safariNotificationsStatus.textContent = 'Notifications activées — elles s’afficheront quand PokeIdle est en arrière-plan.';
        } else if (UI.safariNotificationsStatus && (!('Notification' in window) || Notification.permission !== 'denied')) {
            UI.safariNotificationsStatus.textContent = 'Notifications désactivées';
        }
    }

    function notifySafariEncounter(pokemon) {
        const badge = document.getElementById('badge-safari');
        if (badge) badge.classList.add('active');
        // Codex cannot add a dynamic badge to the plugin's global sidebar icon.
        // Show the host's visible toast whenever an encounter arrives instead.
        vscode.postMessage({ type: 'showInfo', value: `${pokemon.name} est apparu dans le Safari !` });
        if (!state.safariNotifications || !('Notification' in window) || Notification.permission !== 'granted') return;
        if (document.visibilityState !== 'hidden' && document.hasFocus()) return;
        try {
            const notification = new Notification('Pokémon apparu dans le Safari !', {
                body: `${pokemon.name}${pokemon.isShiny ? ' ✨' : ''} attend dans PokeIdle.`,
                icon: '/media/pokeball-icon.png',
                tag: 'pokeidle-safari-encounter',
                renotify: true
            });
            notification.onclick = () => { window.focus(); notification.close(); };
        } catch (error) {
            console.warn('Notification Safari indisponible dans cet éditeur.', error);
        }
    }

    function catchPokemon() {
        if (!currentPokemon || ballThrowPending) return;
        if ((state.inventory.balls[selectedBall] || 0) <= 0) {
            vscode.postMessage({ type: 'showInfo', value: "Plus de Balls ! Attendez que vos pièces s'accumulent." });
            return;
        }

        const pokeEl = document.getElementById('active-pokemon');
        if (!pokeEl) return;
        const ball = BALL_TYPES.find(b => b.id === selectedBall);
        ballThrowPending = true;
        pokeEl.classList.add('ball-throw-pending');

        // --- Décrémentation immédiate ---
        state.inventory.balls[selectedBall]--;
        updateUI();
        saveState();

        // --- Animation de Lancer ---
        const ballImg = document.createElement('img');
        ballImg.src = getItemIcon(ball.img);
        ballImg.alt = ball.name;
        ballImg.setAttribute('data-pokeidle-item', '');
        ballImg.className = 'thrown-ball throw-arc';

        // Positionner la ball par rapport au Pokémon
        const rect = pokeEl.getBoundingClientRect();
        ballImg.style.left = `${rect.left + rect.width / 2 - 15}px`;
        ballImg.style.top = `${rect.top + rect.height / 2 - 15}px`;

        document.body.appendChild(ballImg);

        // Retirer la ball et déclencher la capture après l'animation
        setTimeout(() => {
            ballImg.remove();
            executeCatchLogic(ball);
        }, 600);
    }

    function finishBallThrow() {
        ballThrowPending = false;
        const pokeEl = document.getElementById('active-pokemon');
        if (!pokeEl) return;
        pokeEl.classList.remove('ball-throw-pending');
    }

    function executeCatchLogic(ball) {
        if (!currentPokemon) { finishBallThrow(); return; }
        let catchSuccess = false;

        if (ball.id === 'masterball') {
            catchSuccess = true;
        } else {
            // currentPokemon.captureRate varie de 3 (Légendaire) à 255 (très commun)
            let chance = currentPokemon.captureRate / 255.0;

            // On ajoute un bonus fixe selon la puissance de la Pokéball
            // ball.rate est de 0.4 pour la Pokéball standard, donc (0.4 - 0.4) = +0%
            // Hyperball a 0.85, donc (0.85 - 0.4) = +45% de chance de capture
            chance += (ball.rate - 0.4);

            // On s'assure que la chance est entre 5% et 100%
            chance = Math.max(0.05, Math.min(1.0, chance));

            catchSuccess = Math.random() < chance;
        }

        const pokemonEl = document.getElementById('active-pokemon');

        if (catchSuccess) {
            pokemonEl?.classList.add('captured-anim');
            setTimeout(() => {
                try { finalizeCapture(ball.id); }
                finally { finishBallThrow(); }
            }, 500);
        } else {
            pokemonEl?.classList.add('shake-anim');
            setTimeout(() => {
                pokemonEl?.classList.remove('shake-anim');
                finishBallThrow();
            }, 500);

            // Vérifier si le joueur est à court de TOUTES les balls
            const totalBalls = Object.values(state.inventory.balls).reduce((a, b) => a + b, 0);
            if (totalBalls <= 0) {
                vscode.postMessage({ type: 'showInfo', value: `Plus de Balls ! ${currentPokemon.name} s'enfuit pendant que vous fouillez vos poches...` });
                currentPokemon = null;
                UI.spawnArea.innerHTML = '<div class="loader">Recherche...</div>';
                vscode.postMessage({ type: 'updateStatus', active: false });
                saveState();
                updateUI();
            }
        }
    }

    function finalizeCapture(captureBall) {
        let gender = 'genderless';
        if (currentPokemon.genderRate !== -1 && currentPokemon.genderRate !== undefined) {
            // gender_rate est la chance sur 8 d'etre femelle
            gender = Math.random() < (currentPokemon.genderRate / 8) ? 'female' : 'male';
        }

        const newPoke = {
            ...currentPokemon,
            instanceId: Date.now() + Math.random(),
            xp: 0,
            gender: gender,
            date: new Date().toLocaleDateString(),
            captureTimestamp: Date.now(),
            capturedAtActiveMs: activeNow(),
            captureBall
        };

        state.pokedex.push(newPoke);
        state.coins += 5;
        state.xp += Math.floor(currentPokemon.baseExperience / 5);
        state.missions.captures++;

        // Special Quests: Time-based
        const hour = new Date().getHours();
        const mins = new Date().getMinutes();

        state.lastCaptureTimestamp = Date.now();
        state.lastCaptureAtActiveMs = activeNow();
        if (!state.stats) state.stats = {};
        state.stats.captures = (state.stats.captures || 0) + 1;

        if (hour >= 10 && hour < 14) {
            state.middayCaptures = (state.middayCaptures || 0) + 1;
        }
        if (hour === 5 && mins >= 0 && mins <= 10) {
            state.dawnCaptureAchieved = true;
        }

        state.stats.totalCoins = (state.stats.totalCoins || 0) + 5;

        // Mise à jour de la liste des découvertes (Pokédex permanent)
        recordDiscovery(newPoke, true);

        currentPokemon.types.forEach(t => {
            state.missions.typeProgress[t] = (state.missions.typeProgress[t] || 0) + 1;
        });

        challenges.update(state);
        checkLevelUp();
        currentPokemon = null;
        state.spawnTimer = 180;
        UI.spawnArea.innerHTML = '<div class="loader" id="spawn-timer-display">Recherche...</div>';
        vscode.postMessage({ type: 'updateStatus', active: false });
        saveState();
        updateUI();
        renderPokedex();
        if (typeof renderMissions === 'function') renderMissions();
    }

    function checkLevelUp() {
        const xpToNext = Math.floor(Math.pow(state.level, 1.8) * 150);
        if (state.xp >= xpToNext) {
            state.xp -= xpToNext;
            state.level++;
            vscode.postMessage({ type: 'showInfo', value: `NIVEAU SUPERIEUR ! Passage au niveau ${state.level}.` });
        }
    }

    function renderShop() {
        UI.shopList.innerHTML = '<h3>Poké Balls</h3>';
        BALL_TYPES.forEach(item => {
            const owned = state.inventory.balls[item.id] || 0;
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.innerHTML = `
                <img src="${getItemIcon(item.img)}" alt="${item.name}" data-pokeidle-item>
                <div class="item-info">
                    <span>${item.name}</span>
                    <span class="owned">Possédé : ${owned}</span>
                    <span class="price">${item.price} <img src="${getPokeDollarIcon()}" class="pokedollar-icon" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;"></span>
                </div>
                <button onclick="buyItem('${item.id}', ${item.price})">Acheter</button>
            `;
            UI.shopList.appendChild(card);
        });

        const itemsHeader = document.createElement('h3');
        itemsHeader.innerText = "Objets d'Évolution";
        itemsHeader.style.marginTop = "20px";
        UI.shopList.appendChild(itemsHeader);
        const challengeLink = document.createElement('button'); challengeLink.type = 'button'; challengeLink.className = 'mini-btn';
        challengeLink.textContent = 'Débloquer des objets avec les défis';
        challengeLink.addEventListener('click', () => document.querySelector('[data-tab="missions-tab"]')?.click());
        UI.shopList.appendChild(challengeLink);

        const availableItemsContainer = challenges.items.map(item => challenges.shopStatus(state, item.id)).filter(item => item.unlocked);
        if (availableItemsContainer.length === 0) {
            const msg = document.createElement('p');
            msg.innerText = "Tes premiers objets arrivent avec les défis. Chaque premier palier offre les objets et débloque leur achat en boutique.";
            msg.style.opacity = 0.7;
            msg.style.margin = "10px 0";
            msg.style.fontStyle = "italic";
            UI.shopList.appendChild(msg);
        } else {
            availableItemsContainer.forEach(item => {
                const owned = (state.inventory.stones && state.inventory.stones[item.id]) ? state.inventory.stones[item.id] : 0;
                const card = document.createElement('div');
                card.className = 'shop-item';

                let discountBadge = '';
                if (item.tier === 2) discountBadge = '<span class="discount-badge">−20 %</span>';
                if (item.tier >= 3) discountBadge = '<span class="discount-badge">−40 %</span>';
                const quantity = item.packSize || 1;
                const finalPrice = Math.max(1, Math.ceil(item.price * quantity * item.multiplier));

                card.innerHTML = `
                    <div style="position:relative">
                        <img src="${getItemIcon(item.id)}" alt="${item.name}" data-pokeidle-item>
                        ${discountBadge}
                    </div>
                    <div class="item-info">
                        <span>${item.name}${quantity > 1 ? ` ×${quantity}` : ''}</span>
                        <span class="owned">Possédé : ${owned}</span>
                        <span class="price">${finalPrice} <img src="${getPokeDollarIcon()}" class="pokedollar-icon" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;"></span>
                    </div>
                    <button onclick="buyStone('${item.id}', ${quantity})">Acheter${quantity > 1 ? ` ×${quantity}` : ''}</button>
                `;
                UI.shopList.appendChild(card);
            });
        }
    }

    window.buyItem = (id, price) => {
        if (state.coins >= price) {
            if (state.coins > 10000) state.boughtAbove10000 = true;
            state.coins -= price;
            state.inventory.balls[id] = (state.inventory.balls[id] || 0) + 1;
            state.stats.totalItemsBought = (state.stats.totalItemsBought || 0) + 1;
            state.stats.totalBallsBought = (state.stats.totalBallsBought || 0) + 1;
            state.lastBallPurchaseAtActiveMs = activeNow();
            state.lastBallPurchaseTimestamp = Date.now();
            state.lastPurchaseTimestamp = Date.now();
            state.lastPurchaseAtActiveMs = activeNow();
            updateUI();
            saveState();
            renderShop();
        } else {
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pièces !" });
        }
    };

    window.buyStone = (id, quantity = 1) => {
        if (window.POKEIDLE_SYNC_BUSY) return;
        const item = challenges.shopStatus(state, id);
        if (!item?.unlocked || !Number.isInteger(quantity) || ![1, item.packSize].includes(quantity)) return;
        const price = Math.max(1, Math.ceil(item.price * quantity * item.multiplier));
        if (state.coins < price) { vscode.postMessage({ type: 'showInfo', value: 'Pas assez de pièces !' }); return; }
        state.coins -= price;
        state.inventory.stones[id] = (state.inventory.stones[id] || 0) + quantity;
        state.stats.totalItemsBought = (state.stats.totalItemsBought || 0) + quantity;
        state.lastPurchaseTimestamp = Date.now();
        state.lastPurchaseAtActiveMs = activeNow();
        saveState(); updateUI(); renderShop();
    };

    window.addBall = (ballId, amount) => {
        if (!state.inventory.balls) state.inventory.balls = {};
        state.inventory.balls[ballId] = (state.inventory.balls[ballId] || 0) + amount;
        saveState();
        updateUI();
    };

    function confirmPokemonRelease(pokemon) {
        return new Promise(resolve => {
            const dialog = document.createElement('dialog');
            dialog.className = 'pokemon-release-dialog';
            dialog.setAttribute('aria-labelledby', 'pokemon-release-title');
            dialog.setAttribute('aria-describedby', 'pokemon-release-description');

            const heading = document.createElement('div');
            heading.className = 'pokemon-release-heading';
            const emblem = document.createElement('span');
            emblem.className = 'pokemon-release-emblem';
            emblem.setAttribute('aria-hidden', 'true');
            emblem.innerHTML = '<svg viewBox="0 0 40 40" focusable="false"><circle cx="20" cy="20" r="17" fill="#f7f4e9" stroke="#17324d" stroke-width="3"/><path d="M3.7 17.5h32.6a17 17 0 0 1-32.6 0Z" fill="#e94b4b"/><path d="M3 20h34" stroke="#17324d" stroke-width="4"/><circle cx="20" cy="20" r="5.5" fill="#f7f4e9" stroke="#17324d" stroke-width="3"/><circle cx="20" cy="20" r="2" fill="#8fd9d2"/></svg>';
            const title = document.createElement('h2');
            title.id = 'pokemon-release-title';
            title.textContent = 'Libérer ce Pokémon ?';
            heading.append(emblem, title);

            const summary = document.createElement('div');
            summary.className = 'pokemon-release-summary';
            const sprite = document.createElement('img');
            sprite.className = 'pokemon-release-sprite';
            sprite.src = pokemon.sprite;
            sprite.alt = '';
            sprite.setAttribute('aria-hidden', 'true');
            sprite.addEventListener('error', () => { sprite.hidden = true; }, { once: true });
            const description = document.createElement('p');
            description.id = 'pokemon-release-description';
            description.className = 'pokemon-release-description';
            description.textContent = `Veux-tu vraiment libérer ${pokemon.name} ?`;
            summary.append(sprite, description);

            const reward = document.createElement('div');
            reward.className = 'pokemon-release-reward';
            const rewardLabel = document.createElement('span');
            rewardLabel.textContent = 'Tu recevras';
            const rewardAmount = document.createElement('strong');
            rewardAmount.textContent = '+10 Pokédollars';
            reward.append(rewardLabel, rewardAmount);

            if (pokemon.isShiny) {
                const warning = document.createElement('p');
                warning.className = 'pokemon-release-warning';
                warning.textContent = 'Attention : ce Pokémon est chromatique !';
                summary.appendChild(warning);
            }

            const actions = document.createElement('div');
            actions.className = 'pokemon-release-actions';
            const cancel = document.createElement('button');
            cancel.className = 'pokemon-release-cancel';
            cancel.type = 'button';
            cancel.textContent = 'Garder';
            cancel.autofocus = true;
            const accept = document.createElement('button');
            accept.className = 'pokemon-release-accept';
            accept.type = 'button';
            accept.textContent = 'Libérer';
            cancel.addEventListener('click', () => dialog.close('cancel'));
            accept.addEventListener('click', () => dialog.close('release'));
            actions.append(cancel, accept);

            dialog.append(heading, summary, reward, actions);
            dialog.addEventListener('close', () => {
                const approved = dialog.returnValue === 'release';
                dialog.remove();
                resolve(approved);
            }, { once: true });
            document.body.appendChild(dialog);
            dialog.showModal();
            cancel.focus();
        });
    }

    window.liberatePokemon = async (instanceId) => {
        const index = state.pokedex.findIndex(p => p.instanceId == instanceId);
        if (index < 0) return;
        const pokemon = state.pokedex[index];
        const approved = await confirmPokemonRelease(pokemon);
        if (!approved) return;

        // The confirmation is asynchronous; make sure this exact Pokémon is
        // still in the collection before changing the save.
        const currentIndex = state.pokedex.findIndex(p => p.instanceId == instanceId);
        if (currentIndex < 0) return;
        const p = state.pokedex[currentIndex];
        if ((p.level || 1) >= 50) state.soldLevel50 = true;

        challenges.recordRelease(state, p);
        state.pokedex.splice(currentIndex, 1);
        state.coins += 10;
        if (!state.stats) state.stats = {};
        state.stats.liberated = (state.stats.liberated || 0) + 1;
        state.stats.totalCoins = (state.stats.totalCoins || 0) + 10;

        saveState();
        renderPokedex();
        updateUI();
        renderShop();
        if (typeof renderMissions === 'function') renderMissions();
    };

    function renderPokedex() {
        if (!UI.pokedexList) return;
        UI.pokedexList.innerHTML = '';
        if (UI.pokedexControls) UI.pokedexControls.hidden = UI.pokedexMode !== 'collection';

        const encounteredCount = discoveryCount();
        const capturedCount = discoveryCount(true);

        // Affichage du progrès global
        const statsHeader = document.createElement('div');
        statsHeader.className = 'pokedex-header-stats';
        statsHeader.innerHTML = `
            <div class="stats-row">
                <div class="discovery-count">National : <span>${capturedCount}</span> / 1025</div>
                <div class="current-count">Rencontrés : <span>${encounteredCount}</span></div>
            </div>
            <div class="pokedex-mode-toggle">
                <button id="btn-view-collection" class="mini-btn ${UI.pokedexMode === 'national' ? '' : 'active'}">Ma Collection</button>
                <button id="btn-view-national" class="mini-btn ${UI.pokedexMode === 'national' ? 'active' : ''}">Pokédex National</button>
                <button id="btn-view-achievements" class="mini-btn ${UI.pokedexMode === 'achievements' ? 'active' : ''}">Palmarès</button>
            </div>
        `;
        UI.pokedexList.appendChild(statsHeader);

        // Event listeners pour le toggle (on utilise une variable globale simple)
        statsHeader.querySelector('#btn-view-collection').onclick = () => {
            UI.pokedexMode = 'collection';
            renderPokedex();
        };
        statsHeader.querySelector('#btn-view-national').onclick = () => {
            UI.pokedexMode = 'national';
            renderPokedex();
        };
        statsHeader.querySelector('#btn-view-achievements').onclick = () => {
            UI.pokedexMode = 'achievements';
            renderPokedex();
        };

        if (UI.pokedexMode === 'national') {
            renderNationalPokedex();
            return;
        }
        if (UI.pokedexMode === 'achievements') {
            renderCollectionAchievements();
            return;
        }

        const search = (UI.pokeSearch?.value || '').toLowerCase();

        // Sécurité : s'assurer que pokedex est un tableau
        if (!Array.isArray(state.pokedex)) state.pokedex = [];

        let filtered = state.pokedex.filter(p => p && p.name && `${evolutions.speciesLabel(p)} ${p.name}`.toLowerCase().includes(search));
        const sortMode = UI.pokeSort ? UI.pokeSort.value : 'id';

        // Filtrer les doublons si demandé
        if (sortMode === 'duplicates') {
            const counts = {};
            state.pokedex.forEach(p => {
                if (p) { const id = evolutions.speciesIdOf(p); counts[id] = (counts[id] || 0) + 1; }
            });
            filtered = filtered.filter(p => counts[evolutions.speciesIdOf(p)] > 1);
        }

        // --- Système de Tri ---
        const sorted = filtered.sort((a, b) => {
            if (sortMode === 'name-asc') return evolutions.speciesLabel(a).localeCompare(evolutions.speciesLabel(b));
            if (sortMode === 'name-desc') return evolutions.speciesLabel(b).localeCompare(evolutions.speciesLabel(a));
            if (sortMode === 'level-desc') return b.level - a.level;
            if (sortMode === 'level-asc') return a.level - b.level;
            if (sortMode === 'can-evolve') {
                const aCan = evolutions.choices(a, state).some(option => option.ready);
                const bCan = evolutions.choices(b, state).some(option => option.ready);
                if (aCan !== bCan) return bCan - aCan;
                return (evolutions.speciesIdOf(a) || 0) - (evolutions.speciesIdOf(b) || 0);
            }
            if (sortMode === 'final-stage') {
                const aFinal = evolutions.choices(a, state).length === 0;
                const bFinal = evolutions.choices(b, state).length === 0;
                if (aFinal !== bFinal) return bFinal - aFinal;
                return (evolutions.speciesIdOf(a) || 0) - (evolutions.speciesIdOf(b) || 0);
            }
            return (evolutions.speciesIdOf(a) || 0) - (evolutions.speciesIdOf(b) || 0);
        });

        const groups = new Map();
        for (const p of sorted) {
            const id = evolutions.speciesIdOf(p);
            if (!groups.has(id)) groups.set(id, []);
            groups.get(id).push(p);
        }
        for (const [speciesId, members] of groups) {
            let parent = UI.pokedexList;
            if (members.length > 1) {
                const group = document.createElement('details'); group.className = 'species-group';
                group.open = expandedSpecies.has(speciesId);
                const summary = document.createElement('summary');
                const portrait = document.createElement('img'); portrait.src = members[0].sprite; portrait.alt = '';
                const label = document.createElement('strong'); label.textContent = evolutions.speciesLabel(members[0]);
                const count = document.createElement('span'); count.className = 'species-count';
                const variants = new Set(members.map(p => evolutions.formOf(p)?.id || p.formId || p.id)).size;
                count.textContent = `${members.length} exemplaires · ${variants} variante${variants > 1 ? 's' : ''}`;
                summary.append(portrait, label, count);
                if (members.some(p => evolutions.choices(p, state).some(option => option.ready))) {
                    const ready = document.createElement('span'); ready.className = 'species-ready'; ready.textContent = 'Évolution prête'; summary.appendChild(ready);
                }
                group.appendChild(summary);
                group.addEventListener('toggle', () => {
                    if (group.isConnected) {
                        if (group.open) expandedSpecies.add(speciesId); else expandedSpecies.delete(speciesId);
                    }
                });
                const body = document.createElement('div'); body.className = 'species-members'; group.appendChild(body);
                UI.pokedexList.appendChild(group); parent = body;
            }
            members.forEach(p => {
            if (!p) return;
            const item = document.createElement('div');
            item.className = `pokedex-item ${p.isShiny ? 'shiny-border' : ''}`;
            item.dataset.instanceId = String(p.instanceId);
            const evoInfo = calculateEvoTime(p);

            const genderSign = p.gender === 'male' ? '<span class="gender-m">♂</span>' : (p.gender === 'female' ? '<span class="gender-f">♀</span>' : '');

            let evoDisplay = '';
            if (evoInfo !== 'MAX') {
                const readyClass = evoInfo === 'Évolution prête !' ? 'evo-ready' : '';
                const clickAttr = `role="button" tabindex="0" onclick="manualEvolve('${p.instanceId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();manualEvolve('${p.instanceId}')}"`;
                evoDisplay = `<div class="evo-timer ${readyClass}" ${clickAttr}>${evoInfo}</div>`;
            }

            const xpToNext = calculatePokeXPToNext(p.level || 1);
            const xpProgress = Math.min(100, (p.xp / xpToNext) * 100);

            // On utilise les icones de la Gen VIII pour le look "PC"
            const iconUrl = evolutions.variantLabel(p) ? p.sprite : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${p.id}.png`;

            item.innerHTML = `
                <div class="tooltip">
                    <span class="tooltip-title">${p.isShiny ? '✨ ' : ''}${p.name}</span>
                    <div class="tooltip-row"><span class="tooltip-label">Nv.</span><span>${p.level}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Rarete</span><span>${p.rarity}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Genre</span><span>${p.gender === 'male' ? 'Mâle' : (p.gender === 'female' ? 'Femelle' : 'Asexué')}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Capture le</span><span>${p.date || 'Inconnue'}</span></div>
                </div>
                <div class="poke-info">
                    <img src="${iconUrl}" onerror="this.onerror=null;this.src='${p.sprite}'">
                    <span class="p-name">${evolutions.speciesLabel(p)} ${genderSign} ${p.isShiny ? '✨' : ''}</span>
                    <span class="p-variant">${evolutions.variantLabel(p)}</span>
                    <span class="p-lvl">Nv.${p.level || '?'}</span>
                    <div class="p-xp-bar"><div style="width: ${xpProgress}%"></div></div>
                    ${evoDisplay}
                </div>
                <div class="poke-actions">
                    <button class="sell-btn" onclick="liberatePokemon('${p.instanceId}')">Liberer (10$)</button>
                </div>
            `;
            parent.appendChild(item);
            });
        }
    }

    function renderCollectionAchievements() {
        const metrics = collectionMetrics();
        const unlocked = getCollectionTitles(metrics);
        if (state.collectionTitle && !unlocked.some(title => title.id === state.collectionTitle)) state.collectionTitle = '';

        const section = document.createElement('section');
        section.className = 'collection-ledger';
        const intro = document.createElement('div');
        intro.className = 'collection-ledger-intro';
        intro.innerHTML = '<h2>Palmarès du Dresseur</h2><p>Des objectifs de collection à ton rythme. Les récompenses sont des titres uniquement : elles ne changent ni les rencontres ni le déblocage des objets.</p>';
        section.appendChild(intro);

        const titleLabel = document.createElement('label');
        titleLabel.className = 'collection-title-label';
        titleLabel.htmlFor = 'collection-title-select';
        titleLabel.textContent = 'Titre affiché sur ta carte de Dresseur';
        const titleSelect = document.createElement('select');
        titleSelect.id = 'collection-title-select';
        titleSelect.className = 'collection-title-select';
        titleSelect.setAttribute('aria-label', 'Choisir le titre de Dresseur');
        const noTitle = document.createElement('option'); noTitle.value = ''; noTitle.textContent = 'Aucun titre'; titleSelect.appendChild(noTitle);
        for (const title of unlocked) {
            const option = document.createElement('option'); option.value = title.id;
            option.textContent = `${title.name} · ${title.track}`;
            titleSelect.appendChild(option);
        }
        titleSelect.value = state.collectionTitle || '';
        titleSelect.addEventListener('change', () => {
            state.collectionTitle = titleSelect.value;
            saveState(); updateUI();
        });
        const titlePicker = document.createElement('div');
        titlePicker.className = 'collection-title-picker';
        titlePicker.append(titleLabel, titleSelect);
        section.appendChild(titlePicker);

        const grid = document.createElement('div');
        grid.className = 'collection-track-grid';
        for (const track of collectionTracks) {
            const metric = metrics[track.metric];
            const completed = track.milestones.filter(([threshold]) => metric.value >= threshold).length;
            const next = track.milestones.find(([threshold]) => metric.value < threshold);
            const card = document.createElement('article');
            card.className = `collection-track-card${completed === track.milestones.length ? ' collection-track-complete' : ''}`;
            const heading = document.createElement('div'); heading.className = 'collection-track-heading';
            const icon = document.createElement('span'); icon.className = 'collection-track-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = track.icon;
            const title = document.createElement('h3'); title.textContent = track.title;
            heading.append(icon, title);
            const description = document.createElement('p'); description.className = 'collection-track-description'; description.textContent = track.description;
            const count = document.createElement('p'); count.className = 'collection-track-count';
            count.textContent = `${metric.value.toLocaleString('fr-FR')} / ${metric.total.toLocaleString('fr-FR')} · ${completed}/${track.milestones.length} paliers`;
            const progress = document.createElement('progress'); progress.className = 'collection-track-progress';
            progress.max = next ? next[0] : metric.value || 1;
            progress.value = next ? Math.min(metric.value, next[0]) : progress.max;
            progress.setAttribute('aria-label', `Progression ${track.title}`);
            const milestoneList = document.createElement('ol'); milestoneList.className = 'collection-milestones';
            for (const [threshold, reward] of track.milestones) {
                const item = document.createElement('li');
                const reached = metric.value >= threshold;
                item.className = reached ? 'collection-milestone reached' : 'collection-milestone';
                const stamp = document.createElement('span'); stamp.className = 'collection-milestone-stamp';
                stamp.setAttribute('aria-hidden', 'true'); stamp.textContent = reached ? '✓' : '◇';
                const detail = document.createElement('span'); detail.className = 'collection-milestone-detail';
                const rewardName = document.createElement('strong'); rewardName.textContent = reward;
                const requirement = document.createElement('small'); requirement.textContent = `${threshold.toLocaleString('fr-FR')} ${track.metric === 'species' ? 'espèces' : track.metric === 'forms' ? 'formes' : track.metric === 'evolutions' ? 'espèces évoluées' : 'raretés'}`;
                detail.append(rewardName, requirement); item.append(stamp, detail); milestoneList.appendChild(item);
            }
            card.append(heading, description, count, progress, milestoneList);
            grid.appendChild(card);
        }
        section.appendChild(grid);
        const master = document.createElement('p');
        master.className = unlocked.some(title => title.id === 'master:all') ? 'collection-master-title unlocked' : 'collection-master-title';
        master.textContent = unlocked.some(title => title.id === 'master:all')
            ? 'Toutes les collections sont terminées : le titre « Maître collectionneur » est à toi.'
            : 'Termine le dernier palier de chaque collection pour décrocher le titre Maître collectionneur.';
        section.appendChild(master);
        UI.pokedexList.appendChild(section);
    }

    function renderNationalPokedex() {
        const container = document.createElement('div');
        container.className = 'national-grid';

        for (let i = 1; i <= 1025; i++) {
            const disc = state.discovery[i];
            const item = document.createElement('div');

            const isCaught = disc && disc.caught;
            const isSeen = !!disc;

            item.className = `national-item ${isCaught ? 'caught' : (isSeen ? 'seen' : 'unknown')}`;

            const spriteUrl = isSeen ? disc.sprite : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;
            const name = isSeen ? evolutions.data.species[i].label : `???`;
            const variantCount = (disc?.variants || []).length;

            item.innerHTML = `
                <span class="nat-id">#${i}</span>
                <img src="${spriteUrl}" loading="lazy" class="${isCaught ? '' : 'silhouette'}">
                <span class="nat-name">${name}</span>
                ${variantCount > 1 ? `<span class="nat-variants">${variantCount} variantes observées</span>` : ''}
            `;
            container.appendChild(item);
        }
        UI.pokedexList.appendChild(container);
    }

    function calculateEvoTime(p) {
        evolutions.syncPokemon(p);
        const options = evolutions.choices(p, state);
        p.synced = true;
        p.fetchingEvo = false;
        p.nextEvoLevel = options.length ? 'Choix d’évolution' : 'MAX';
        if (!options.length) return 'MAX';
        if (options.some(option => option.ready)) return 'Évolution prête !';
        return options.length === 1 ? 'Voir les conditions' : `${options.length} évolutions : voir les conditions`;
    }

    window.manualEvolve = (instanceId) => {
        if (window.POKEIDLE_SYNC_BUSY) return;
        const pokemon = state.pokedex.find(p => p.instanceId == instanceId);
        if (!pokemon || evolutionLocks.has(pokemon.instanceId)) return;
        evolutionDialog?.close();
        const dialog = document.createElement('dialog');
        dialog.className = 'evolution-dialog';
        const title = document.createElement('h2');
        title.textContent = `Faire évoluer ${pokemon.name}`;
        dialog.appendChild(title);
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'Choisis la destination. Les objets indiqués seront consommés. Les conditions sont vérifiées au moment du clic.';
        dialog.appendChild(hint);
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        const optionsArea = document.createElement('div');
        dialog.appendChild(optionsArea);
        const refresh = () => {
            optionsArea.replaceChildren();
            const current = state.pokedex.find(p => p.instanceId === pokemon.instanceId);
            if (!current || current.id !== pokemon.id) { dialog.close(); return; }
            const options = evolutions.choices(current, state);
            if (!options.length) {
                const text = document.createElement('p'); text.textContent = 'Ce Pokémon n’a pas d’évolution classique.'; optionsArea.appendChild(text);
            }
            for (const option of options) {
                const card = document.createElement('section'); card.className = 'evolution-option';
                const heading = document.createElement('h3'); heading.textContent = option.label; card.appendChild(heading);
                const conditions = document.createElement('ul');
                for (const req of option.requirements) {
                    const li = document.createElement('li'); li.textContent = `${req.met ? '✓' : '○'} ${req.label}`;
                    li.className = req.met ? 'condition-met' : 'condition-missing'; conditions.appendChild(li);
                }
                if (!option.requirements.length) { const li = document.createElement('li'); li.textContent = 'Évolution disponible'; conditions.appendChild(li); }
                card.appendChild(conditions);
                if (option.adaptations.length) {
                    const note = document.createElement('p'); note.className = 'hint';
                    note.textContent = 'Adaptation idle : ' + option.adaptations.join(' '); card.appendChild(note);
                }
                if (option.target.speciesId === 291) {
                    const note = document.createElement('p'); note.className = 'hint';
                    note.textContent = 'Bonus : Munja rejoint aussi la collection si une Poké Ball standard est disponible (elle sera consommée).'; card.appendChild(note);
                }
                const button = document.createElement('button'); button.className = 'mini-btn';
                button.textContent = option.ready ? `Évoluer en ${option.label}` : 'Conditions à remplir';
                button.disabled = !option.ready;
                button.addEventListener('click', async () => {
                    for (const control of dialog.querySelectorAll('button')) control.disabled = true;
                    status.textContent = 'Préparation de l’évolution…';
                    const success = await evolvePokemon(current, option.key);
                    if (success) dialog.close();
                    else { status.textContent = 'Évolution interrompue. Vérifie les conditions et la connexion ; aucun objet n’a été consommé.'; refresh(); close.disabled = false; refreshButton.disabled = false; }
                });
                card.appendChild(button); optionsArea.appendChild(card);
            }
        };
        dialog.appendChild(status);
        const refreshButton = document.createElement('button'); refreshButton.className = 'mini-btn';
        refreshButton.textContent = 'Actualiser les conditions'; refreshButton.addEventListener('click', refresh);
        dialog.appendChild(refreshButton);
        const close = document.createElement('button'); close.className = 'mini-btn'; close.textContent = 'Fermer';
        close.addEventListener('click', () => dialog.close()); dialog.appendChild(close);
        dialog.addEventListener('close', () => { dialog.remove(); if (evolutionDialog === dialog) evolutionDialog = null; });
        document.body.appendChild(dialog); evolutionDialog = dialog; refresh(); dialog.showModal();
    };

    async function evolutionPayload(form) {
        if (!evolutionPayloads.has(form.id)) {
            const promise = (async () => {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${form.pokemonId}/`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const pokemon = await res.json();
                let sprites = pokemon.sprites;
                if (pokemon.forms.length > 1) {
                    const formRes = await fetch(`https://pokeapi.co/api/v2/pokemon-form/${form.id}/`);
                    if (!formRes.ok) throw new Error('HTTP ' + formRes.status);
                    const cosmetic = await formRes.json();
                    if (cosmetic.sprites.front_default) sprites = cosmetic.sprites;
                }
                return { pokemon, sprites };
            })();
            evolutionPayloads.set(form.id, promise);
            promise.catch(() => evolutionPayloads.delete(form.id));
        }
        return evolutionPayloads.get(form.id);
    }

    function makeEvolvedPokemon(old, form, payload) {
        const { pokemon, sprites } = payload;
        const artwork = pokemon.sprites.other?.['official-artwork'];
        const sprite = old.isShiny
            ? (sprites.front_shiny || artwork?.front_shiny || sprites.front_default)
            : (sprites.other?.['official-artwork']?.front_default || sprites.front_default || artwork?.front_default);
        const evolved = {
            ...old, id: pokemon.id, speciesId: form.speciesId, formId: form.id,
            name: evolutions.targetLabel(form), sprite, types: pokemon.types.map(t => t.type.name),
            baseExperience: pokemon.base_experience || old.baseExperience,
            genderRate: evolutions.data.species[form.speciesId].genderRate,
            captureRate: evolutions.data.species[form.speciesId].captureRate,
            rarity: '',
            nextEvoLevel: null, fetchingEvo: false, synced: true,
            hasEvolved: true
        };
        evolutions.syncPokemon(evolved);
        return evolved;
    }

    async function evolvePokemon(oldPoke, optionKey) {
        const instanceId = oldPoke.instanceId;
        if (window.POKEIDLE_SYNC_BUSY || evolutionLocks.has(instanceId)) return false;
        const originalState = state;
        const originalGeneration = stateGeneration;
        evolutionLocks.add(instanceId);
        try {
            let option = evolutions.choices(oldPoke, state).find(o => o.key === optionKey && o.ready);
            if (!option) return false;
            const payload = await evolutionPayload(option.target);
            // All network work precedes inventory changes, including optional Shedinja.
            let shedinja = null;
            if (option.target.speciesId === 291 && (state.inventory.balls.pokeball || 0) > 0) {
                try {
                    const form = evolutions.data.forms[292];
                    shedinja = { form, payload: await evolutionPayload(form) };
                } catch (error) { console.error('Munja indisponible : évolution reportée', error); return false; }
            }
            const index = state.pokedex.findIndex(p => p === oldPoke);
            if (state !== originalState || stateGeneration !== originalGeneration || index < 0 || window.POKEIDLE_SYNC_BUSY) return false;
            // Another evolution may have consumed a required item during the download.
            option = evolutions.choices(oldPoke, state).find(o => o.key === optionKey && o.ready);
            if (!option) return false;
            const evolved = makeEvolvedPokemon(oldPoke, option.target, payload);
            evolved.evolvedViaLevel = Object.keys(option.items).length === 0;
            const bonus = shedinja && state.inventory.balls.pokeball > 0
                ? makeEvolvedPokemon({ ...oldPoke, instanceId: Date.now() + Math.random() }, shedinja.form, shedinja.payload) : null;
            for (const [id, count] of Object.entries(option.items)) state.inventory.stones[id] -= count;
            state.pokedex[index] = evolved;
            if (bonus) { state.inventory.balls.pokeball--; state.pokedex.push(bonus); }
            if (oldPoke.speciesId === 290) {
                const ballsBefore = Object.values(state.inventory.balls).reduce((sum, count) => sum + count, 0) + (bonus ? 1 : 0);
                if (oldPoke.level >= 20 && ballsBefore >= 100) state.ningaleEvolvedWithBalls = true;
            }
            state.recentEvolutionActiveTimes = [...state.recentEvolutionActiveTimes, activeNow()].filter(t => activeNow() - t < 120000);
            state.recentEvoCount = state.recentEvolutionActiveTimes.length;
            for (const p of [evolved, bonus].filter(Boolean)) recordDiscovery(p, true, false);
            state.missions.evolutions = (state.missions.evolutions || 0) + 1;
            state.stats.evolved = (state.stats.evolved || 0) + 1;
            challenges.recordEvolution(state, option.ruleId, option);
            state.lastEvoTimestamp = Date.now();
            state.lastEvolutionAtActiveMs = activeNow();
            challenges.update(state);
            saveState(); renderPokedex(); updateUI(); renderMissions(); renderShop();
            vscode.postMessage({ type: 'showInfo', value: `Évolution en ${evolved.name} !${bonus ? ' Munja rejoint aussi la collection !' : ''}` });
            return true;
        } catch (error) {
            console.error('Evolution failed', error);
            return false;
        } finally { evolutionLocks.delete(instanceId); }
    }

    function getStoneForType(type) {
        const map = {
            fire: 'fire-stone', water: 'water-stone', grass: 'leaf-stone',
            electric: 'thunder-stone', ice: 'ice-stone', normal: 'moon-stone',
            psychic: 'sun-stone', poison: 'dusk-stone', fairy: 'shiny-stone',
            fighting: 'kings-rock', steel: 'metal-coat', rock: 'protector',
            ground: 'razor-fang', bug: 'razor-claw', ghost: 'reaper-cloth',
            dragon: 'dragon-scale', flying: 'prism-scale'
        };
        return map[type] || 'moon-stone';
    }

    const challengeCategories = {
        recommended: 'Conseillés', elements: 'Éléments', evolution: 'Évolution', exploration: 'Exploration', all: 'Tous'
    };

    function renderMissions() {
        const container = document.getElementById('missions-list');
        if (!container) return;
        const models = challenges.models(state);
        const summary = {
            claimed: state.challenges.claimed.length,
            unlocked: challenges.items.filter(item => challenges.shopStatus(state, item.id).unlocked).length,
            ready: models.filter(m => !m.complete && m.progress.ready).length
        };
        let visible = models;
        if (challengeFilter === 'recommended') {
            visible = models.filter(m => !m.complete).sort((a, b) =>
                Number(b.progress.ready) - Number(a.progress.ready) || Number(b.needed) - Number(a.needed) || b.progress.ratio - a.progress.ratio || a.order - b.order).slice(0, 6);
        } else if (challengeFilter !== 'all') visible = models.filter(m => m.category === challengeFilter);
        const signature = JSON.stringify({ summary, filter: challengeFilter, visible, notice: challengeNotice });
        if (signature === challengeRenderSignature && container.childElementCount) return;
        challengeRenderSignature = signature;
        const focusedFamily = container.contains(document.activeElement) ? document.activeElement?.dataset.challengeFamily : null;
        container.replaceChildren();
        const header = document.createElement('header'); header.className = 'challenge-header';
        const title = document.createElement('h2'); title.textContent = 'Carnet de défis';
        const intro = document.createElement('p'); intro.textContent = 'Explore, capture, fais évoluer et entraîne tes compagnons. Chaque palier exige de remplir toutes ses conditions.';
        const totals = document.createElement('p'); totals.className = 'challenge-totals';
        totals.textContent = `${summary.claimed}/${challenges.families.length * 3} paliers réclamés · ${summary.unlocked}/${challenges.items.length} objets débloqués${summary.ready ? ` · ${summary.ready} récompense${summary.ready > 1 ? 's' : ''} prête${summary.ready > 1 ? 's' : ''}` : ''}`;
        header.append(title, intro, totals); container.appendChild(header);
        const filters = document.createElement('div'); filters.className = 'challenge-filters'; filters.setAttribute('aria-label', 'Filtrer les défis');
        for (const [id, label] of Object.entries(challengeCategories)) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'challenge-filter';
            button.textContent = label; button.setAttribute('aria-pressed', String(challengeFilter === id));
            button.addEventListener('click', () => {
                challengeFilter = id; renderMissions();
                container.querySelector(`.challenge-filter[aria-pressed="true"]`)?.focus({ preventScroll: true });
            });
            filters.appendChild(button);
        }
        container.appendChild(filters);
        const notice = document.createElement('p'); notice.className = 'challenge-notice'; notice.setAttribute('role', 'status');
        notice.textContent = challengeNotice; notice.hidden = !challengeNotice; container.appendChild(notice);
        if (!visible.length) {
            const empty = document.createElement('p'); empty.className = 'hint';
            empty.textContent = 'Tous les parcours sont terminés. Retrouve tes objets et leurs remises dans la boutique.'; container.appendChild(empty);
        }
        const grid = document.createElement('div'); grid.className = 'challenge-grid';
        for (const model of visible) {
            const card = document.createElement('article'); card.className = `mission-card challenge-card${model.progress.ready && !model.complete ? ' challenge-ready' : ''}${model.complete ? ' challenge-complete' : ''}`;
            const meta = document.createElement('p'); meta.className = 'challenge-meta';
            meta.textContent = `${challengeCategories[model.category]} · ${model.complete ? 'Parcours terminé' : `Palier ${model.stage}/3`}${model.needed ? ' · Utile à ta collection' : ''}`;
            const heading = document.createElement('h3'); heading.textContent = model.label;
            const flavor = document.createElement('p'); flavor.className = 'challenge-flavor'; flavor.textContent = model.flavor;
            card.append(meta, heading, flavor);
            if (!model.complete) {
                const choice = document.createElement('p'); choice.className = 'challenge-choice'; choice.textContent = 'Toutes ces conditions sont requises :'; card.appendChild(choice);
                const list = document.createElement('ul'); list.className = 'challenge-objectives';
                for (const part of model.progress.parts) {
                    const li = document.createElement('li'); const met = part.current >= part.target;
                    li.className = met ? 'challenge-objective-met' : '';
                    const label = document.createElement('span'); label.textContent = `${met ? '✓ ' : ''}${part.label}`;
                    const count = document.createElement('strong'); count.textContent = `${Math.min(part.current, part.target)}/${part.target}`;
                    li.append(label, count); list.appendChild(li);
                }
                card.appendChild(list);
                const progress = document.createElement('progress'); progress.className = 'challenge-progress'; progress.max = 1; progress.value = model.progress.ratio;
                progress.setAttribute('aria-label', `Progression du palier ${model.stage} : ${Math.round(model.progress.ratio * 100)} %`); card.appendChild(progress);
                const rewards = document.createElement('div'); rewards.className = 'challenge-rewards';
                for (const gift of model.reward.items) {
                    const reward = document.createElement('span'); reward.className = 'challenge-item';
                    const icon = document.createElement('img'); icon.src = getItemIcon(gift.id); icon.alt = ''; icon.setAttribute('data-pokeidle-item', '');
                    const text = document.createElement('span'); text.textContent = `${gift.quantity} × ${challenges.itemName(gift.id)}`;
                    reward.append(icon, text); rewards.appendChild(reward);
                }
                const coins = document.createElement('span'); coins.className = 'challenge-item'; coins.textContent = `+ ${model.reward.coins} pièces`; rewards.appendChild(coins);
                card.appendChild(rewards);
                const effect = document.createElement('p'); effect.className = 'challenge-effect';
                effect.textContent = model.stage === 1 ? 'Débloque aussi ces objets en boutique, au prix normal.' : `Remise permanente de ${model.stage === 2 ? 20 : 40} % sur ces objets en boutique.`;
                card.appendChild(effect);
                const claim = document.createElement('button'); claim.type = 'button'; claim.className = 'claim-btn';
                claim.dataset.challengeFamily = model.id; claim.disabled = !model.progress.ready;
                claim.textContent = model.progress.ready ? 'Réclamer la récompense' : 'Objectif à remplir';
                claim.addEventListener('click', () => window.claimMission(model.key)); card.appendChild(claim);
            } else {
                const done = document.createElement('p'); done.className = 'challenge-effect'; done.textContent = 'Objets débloqués · remise permanente de 40 %'; card.appendChild(done);
            }
            grid.appendChild(card);
        }
        container.appendChild(grid);
        if (focusedFamily) {
            const next = [...container.querySelectorAll('[data-challenge-family]')].find(button => button.dataset.challengeFamily === focusedFamily && !button.disabled);
            (next || container.querySelector('.challenge-filter[aria-pressed="true"]'))?.focus({ preventScroll: true });
        }
    }

    window.claimMission = key => {
        if (window.POKEIDLE_SYNC_BUSY) return;
        const result = challenges.claim(state, key);
        if (!result) return;
        challengeNotice = `${result.label} — palier ${result.stage} réclamé : objets reçus et ${result.reward.coins} pièces ajoutées.${result.stage === 1 ? ' Achat débloqué en boutique.' : ` Remise de ${result.stage === 2 ? 20 : 40} % débloquée.`}`;
        saveState(); updateUI(); renderShop();
        vscode.postMessage({ type: 'showInfo', value: challengeNotice });
    };

    function saveState() {
        state.lastUpdate = Date.now();
        vscode.postMessage({ type: 'saveState', value: state, generation: stateGeneration });
    }

})();
