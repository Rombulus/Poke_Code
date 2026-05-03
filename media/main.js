(function () {
    const vscode = acquireVsCodeApi();

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
        githubSync: document.getElementById('btn-github-sync'),
        syncStatus: document.getElementById('sync-status'),
        exportBtn: document.getElementById('btn-export'),
        importBtn: document.getElementById('btn-import')
    };

    let currentPokemon = null;
    let selectedBall = 'pokeball';
    let speciesCache = {}; // Cache pour limiter les appels API
    let dayNightInterval = null;

    // Initialisation
    vscode.postMessage({ type: 'getState' });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'loadState') {
            if (!message.value) return;
            state = message.value;

            // Initialisation des modes UI
            UI.pokedexMode = UI.pokedexMode || 'collection';

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
                        if (p.synced === undefined) p.synced = false;
                    }
                });
            } else {
                state.pokedex = [];
            }

            translateExistingPokedex();
            syncDiscovery();
            updateUI();
            renderShop();

            updateDayNight();
            if (dayNightInterval) clearInterval(dayNightInterval);
            dayNightInterval = setInterval(updateDayNight, 60000); // Check toutes les minutes

            startGameLoop();
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

    function syncDiscovery() {
        let changed = false;
        if (!state.discovery) state.discovery = {};

        // S'assurer que tout ce qui est dans le pokedex (collection) est marque comme capture
        if (Array.isArray(state.pokedex)) {
            state.pokedex.forEach(p => {
                if (p && p.id) {
                    if (!state.discovery[p.id] || !state.discovery[p.id].caught) {
                        state.discovery[p.id] = {
                            name: p.name,
                            sprite: p.sprite,
                            caught: true
                        };
                        changed = true;
                    }
                }
            });
        }

        let count = 0;
        Object.keys(state.discovery).forEach(k => {
            if (state.discovery[k].caught) count++;
        });
        state.stats.uniques = count;

        if (changed) {
            saveState();
        }
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
                        } catch (err) {
                            console.error("Tab error:", err);
                        }
                    });
                });
            }

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
        } catch (err) {
            console.error("Init error:", err);
        }
    }

    // Lancer l'init au chargement
    init();

    const stoneTranslations = {
        'fire-stone': 'Pierre Feu', 'water-stone': 'Pierre Eau', 'leaf-stone': 'Pierre Plante',
        'thunder-stone': 'Pierre Foudre', 'ice-stone': 'Pierre Glace', 'moon-stone': 'Pierre Lune',
        'sun-stone': 'Pierre Soleil', 'dusk-stone': 'Pierre Nuit', 'shiny-stone': 'Pierre Éclat',
        'dawn-stone': 'Pierre Aube', 'kings-rock': 'Roche Royale', 'metal-coat': 'Peau Métal',
        'protector': 'Protecteur', 'reaper-cloth': 'Tissu Fauche', 'dragon-scale': 'Écaille Draco',
        'prism-scale': "Bel'Écaille", 'razor-claw': 'Griffe Rasoir', 'razor-fang': 'Croc Rasoir',
        'black-augurite': 'Obsidienne', 'linking-cord': 'Câble Link', 'soothe-bell': 'Grelot Zen',
        'upgrade': 'Améliorator', 'dubious-disc': 'CD Douteux', 'electirizer': 'Électriseur',
        'magmarizer': 'Magmariseur', 'peat-block': 'Bloc de Tourbe', 'galarica-cuff': 'Bracelet Galanoa',
        'galarica-wreath': 'Couronne Galanoa', 'sweet-apple': 'Pomme Sucrée', 'tart-apple': 'Pomme Acide',
        'chipped-pot': 'Théière Ébréchée', 'cracked-pot': 'Théière Fêlée', 'auspicious-armor': 'Armure Fortune',
        'malicious-armor': 'Armure Rancune', 'scroll-of-darkness': 'Rouleau Ténèbres',
        'scroll-of-waters': 'Rouleau Eau', 'gimmighoul-coin': 'Pièce de Mordudor',
        'syrupy-apple': 'Pomme en Alliage', 'unremarkable-teacup': 'Bol Médiocre',
        'masterpiece-teacup': 'Bol Exceptionnel', 'metal-alloy': 'Métal Composite',
        'sachet': 'Sachet Senteur', 'whipped-dream': 'Chantibonbon',
        'deep-sea-tooth': 'Dent Océan', 'deep-sea-scale': 'Écaille Océan',
        'leaders-crest': 'Emblème du Général', 'strawberry-sweet': 'Objet en Sucre'
    };

    function updateUI() {
        try {
            if (UI.coinCount) UI.coinCount.innerText = state.coins || 0;
            if (UI.pokedexCount) UI.pokedexCount.innerText = state.pokedex ? state.pokedex.length : 0;
            if (UI.playerLevel) UI.playerLevel.innerText = state.level || 1;

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
            }

            const badgeMissions = document.getElementById('badge-missions');
            if (badgeMissions && typeof MISSIONS !== 'undefined') {
                const hasClaimable = MISSIONS.some(m => {
                    if (state.missions.claimed.includes(m.id)) return false;
                    let curr = 0;
                    if (m.reqType === 'type') curr = state.missions.typeProgress[m.type] || 0;
                    if (m.reqType === 'stat') curr = state.stats[m.statKey] || 0;
                    return curr >= m.target;
                });
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

    function renderBallInventory() {
        const container = document.getElementById('ball-inventory');
        container.innerHTML = '';
        BALL_TYPES.forEach(ball => {
            const count = state.inventory.balls[ball.id] || 0;
            const slot = document.createElement('div');
            slot.className = `item-slot ${selectedBall === ball.id ? 'active' : ''}`;
            slot.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${ball.img}.png">
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
                slot.title = stoneTranslations[stone] || stone;
                const img = document.createElement('img');
                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${stone}.png`;
                img.onerror = () => { img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'; };
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
        ppIcon.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png';
        ppIcon.className = 'mini-icon';
        stats.appendChild(ppIcon);
        return ppSpan;
    }

    function startGameLoop() {
        setInterval(() => {
            if (!currentPokemon) {
                state.spawnTimer--;
                if (state.spawnTimer <= 0) {
                    spawnPokemon();
                    state.spawnTimer = Math.floor(Math.random() * (180 - 30 + 1)) + 30;
                }
            }
            if (new Date().getSeconds() % 3 === 0) {
                gainPassiveXP();
            }
            // 20$ par minute
            if (new Date().getTime() % 60000 < 1000) {
                state.coins += 20;
                updateUI();
                saveState();
            }
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
        let leveledUp = false;
        state.pokedex.forEach(p => {
            if (!p) return;
            // Gain de 1 XP toutes les 3 secondes
            p.xp = (p.xp || 0) + 1;
            const xpToNext = calculatePokeXPToNext(p.level || 1);
            if (p.xp >= xpToNext) {
                p.level = (p.level || 1) + 1;
                p.xp = 0;
                leveledUp = true;
                checkAutoEvolution(p, false); // isManual = false
            }
        });

        // Mise à jour visuelle si on est sur l'onglet pokedex
        const isPokedexOpen = !document.getElementById('pokedex-tab').classList.contains('hidden');
        if (isPokedexOpen || leveledUp) {
            renderPokedex();
        }

        // Toujours sauvegarder le gain d'XP
        saveState();
    }

    function calculatePokeXPToNext(level) {
        return Math.floor(Math.pow(level, 1.5) * 20);
    }

    async function spawnPokemon() {
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
                const id = Math.floor(Math.random() * 1025) + 1;
                const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
                speciesData = await speciesRes.json();

                // 1. Choisir une variété (Normal, Alola, Galar, etc.)
                // On exclut les Megas/Gmax pour l'instant pour garder les évolutions classiques
                const validVarieties = speciesData.varieties.filter(v => !v.pokemon.name.includes('-mega') && !v.pokemon.name.includes('-gmax'));
                const variety = validVarieties[Math.floor(Math.random() * validVarieties.length)];

                const response = await fetch(variety.pokemon.url);
                data = await response.json();

                // 2. Choisir une forme esthétique (Vivaldaim, Meteno, etc.)
                let sprite = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
                let formName = "";

                if (data.forms.length > 1) {
                    const formIndex = Math.floor(Math.random() * data.forms.length);
                    const formRes = await fetch(data.forms[formIndex].url);
                    const formData = await formRes.json();
                    sprite = formData.sprites.front_default; // Les formes n'ont pas toujours d'official-artwork
                    if (formData.form_name) formName = ` (${formData.form_name})`;
                }

                // Logique de rareté
                const capRate = speciesData.capture_rate;
                let rarity = "Commun";
                let chance = 1;

                if (capRate <= 3) { rarity = "Légendaire"; chance = 0.01; }
                else if (capRate <= 45) { rarity = "Épique"; chance = 0.1; }
                else if (capRate <= 100) { rarity = "Rare"; chance = 0.3; }
                else if (capRate <= 150) { rarity = "Peu Commun"; chance = 0.6; }

                const minLevelRequired = rarity === "Légendaire" ? 50 : (rarity === "Épique" ? 20 : 1);

                // Anti-doublon (recentSpawns)
                const isRecent = state.recentSpawns.includes(data.id);

                if (state.level >= minLevelRequired && Math.random() < chance && !isRecent) {
                    found = true;

                    // Mise a jour des doublons
                    state.recentSpawns.push(data.id);
                    if (state.recentSpawns.length > 5) state.recentSpawns.shift();

                    let frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || speciesData.name;

                    // Gérer le nom des formes régionales
                    if (variety.pokemon.name.includes('-alola')) frenchName += " d'Alola";
                    if (variety.pokemon.name.includes('-galar')) frenchName += " de Galar";
                    if (variety.pokemon.name.includes('-hisui')) frenchName += " de Hisui";
                    if (variety.pokemon.name.includes('-paldea')) frenchName += " de Paldea";

                    currentPokemon = {
                        id: data.id,
                        speciesId: speciesData.id,
                        name: frenchName + formName,
                        rarity: rarity,
                        captureRate: capRate,
                        genderRate: speciesData.gender_rate, // On stocke pour la capture
                        sprite: sprite,
                        types: data.types.map(t => t.type.name),
                        isShiny: Math.random() < (1 / 512),
                        baseExperience: data.base_experience || 50,
                        level: Math.max(1, Math.floor(state.level * 0.8) + Math.floor(Math.random() * 5))
                    };

                    // Ajout aux découvertes en tant que "Rencontré"
                    if (!state.discovery[currentPokemon.id]) {
                        state.discovery[currentPokemon.id] = {
                            name: currentPokemon.name,
                            sprite: currentPokemon.sprite,
                            caught: false
                        };
                        saveState();
                        // Pas de refresh UI ici pour ne pas spoil si on est sur l'onglet Pokedex, 
                        // ou alors on le fait si on veut que ├ºa s'affiche direct
                    }
                }
            }

            renderPokemon();
        } catch (error) {
            console.error("Spawn error:", error);
            state.spawnTimer = 10; // Réessaie vite en cas d'erreur API
            vscode.postMessage({ type: 'updateStatus', active: false });
        }
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
    }

    function catchPokemon() {
        if (!currentPokemon) return;
        if ((state.inventory.balls[selectedBall] || 0) <= 0) {
            vscode.postMessage({ type: 'showInfo', value: "Plus de Balls ! Attendez que vos pièces s'accumulent." });
            return;
        }

        const ball = BALL_TYPES.find(b => b.id === selectedBall);

        // --- Décrémentation immédiate ---
        state.inventory.balls[selectedBall]--;
        updateUI();
        saveState();

        // --- Animation de Lancer ---
        const ballImg = document.createElement('img');
        ballImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${ball.img}.png`;
        ballImg.className = 'thrown-ball throw-arc';

        // Positionner la ball par rapport au Pokémon
        const pokeEl = document.getElementById('active-pokemon');
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

    function executeCatchLogic(ball) {
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
            pokemonEl.classList.add('captured-anim');
            setTimeout(() => {
                finalizeCapture();
            }, 500);
        } else {
            pokemonEl.classList.add('shake-anim');
            setTimeout(() => { pokemonEl.classList.remove('shake-anim'); }, 500);

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

    function finalizeCapture() {
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
            captureTimestamp: Date.now()
        };

        state.pokedex.push(newPoke);
        state.coins += 5;
        state.xp += Math.floor(currentPokemon.baseExperience / 5);
        state.missions.captures++;

        // Special Quests: Time-based
        const hour = new Date().getHours();
        const mins = new Date().getMinutes();
        if (hour >= 10 && hour < 14) state.middayCaptures = (state.middayCaptures || 0) + 1;
        if (hour === 5 && mins <= 10) state.dawnCaptureAchieved = true;

        // Mise à jour de la liste des découvertes (Pokédex permanent)
        state.discovery[newPoke.id] = {
            name: newPoke.name,
            sprite: newPoke.sprite,
            caught: true
        };

        currentPokemon.types.forEach(t => {
            state.missions.typeProgress[t] = (state.missions.typeProgress[t] || 0) + 1;
        });

        checkLevelUp();
        currentPokemon = null;
        state.spawnTimer = 180;
        UI.spawnArea.innerHTML = '<div class="loader" id="spawn-timer-display">Recherche...</div>';
        vscode.postMessage({ type: 'updateStatus', active: false });
        state.lastCaptureTimestamp = Date.now();
        saveState();
        updateUI();
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
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.img}.png">
                <div class="item-info">
                    <span>${item.name}</span>
                    <span class="owned">Possédé : ${owned}</span>
                    <span class="price">${item.price} <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/nugget.png" class="mini-icon"></span>
                </div>
                <button onclick="buyItem('${item.id}', ${item.price})">Acheter</button>
            `;
            UI.shopList.appendChild(card);
        });

        const itemsHeader = document.createElement('h3');
        itemsHeader.innerText = "Objets d'Évolution";
        itemsHeader.style.marginTop = "20px";
        UI.shopList.appendChild(itemsHeader);

        const EVOLUTION_ITEMS = [
            { id: 'linking-cord', name: 'Câble Link', price: 1000 },
            { id: 'fire-stone', name: 'Pierre Feu', price: 500 },
            { id: 'water-stone', name: 'Pierre Eau', price: 500 },
            { id: 'thunder-stone', name: 'Pierre Foudre', price: 500 },
            { id: 'leaf-stone', name: 'Pierre Plante', price: 500 },
            { id: 'moon-stone', name: 'Pierre Lune', price: 500 },
            { id: 'sun-stone', name: 'Pierre Soleil', price: 500 },
            { id: 'ice-stone', name: 'Pierre Glace', price: 500 },
            { id: 'dusk-stone', name: 'Pierre Nuit', price: 500 },
            { id: 'shiny-stone', name: 'Pierre Éclat', price: 500 },
            { id: 'dawn-stone', name: 'Pierre Aube', price: 500 },
            { id: 'metal-coat', name: 'Peau Métal', price: 1500 },
            { id: 'kings-rock', name: 'Roche Royale', price: 1500 },
            { id: 'dragon-scale', name: 'Écaille Draco', price: 1500 },
            { id: 'upgrade', name: 'Améliorator', price: 1500 },
            { id: 'dubious-disc', name: 'CD Douteux', price: 2000 },
            { id: 'protector', name: 'Protecteur', price: 1500 },
            { id: 'reaper-cloth', name: 'Tissu Fauche', price: 1500 },
            { id: 'electirizer', name: 'Électriseur', price: 1500 },
            { id: 'magmarizer', name: 'Magmariseur', price: 1500 },
            { id: 'prism-scale', name: "Bel'Écaille", price: 1500 },
            { id: 'razor-claw', name: 'Griffe Rasoir', price: 1500 },
            { id: 'razor-fang', name: 'Croc Rasoir', price: 1500 },
            { id: 'sweet-apple', name: 'Pomme Sucrée', price: 800 },
            { id: 'tart-apple', name: 'Pomme Acide', price: 800 },
            { id: 'syrupy-apple', name: 'Pomme en Alliage', price: 800 },
            { id: 'cracked-pot', name: 'Théière Fêlée', price: 800 },
            { id: 'chipped-pot', name: 'Théière Ébréchée', price: 1500 },
            { id: 'malicious-armor', name: 'Armure Rancune', price: 1500 },
            { id: 'auspicious-armor', name: 'Armure Fortune', price: 1500 },
            { id: 'black-augurite', name: 'Obsidienne', price: 1500 },
            { id: 'peat-block', name: 'Bloc de Tourbe', price: 1500 },
            { id: 'galarica-cuff', name: 'Bracelet Galanoa', price: 1500 },
            { id: 'galarica-wreath', name: 'Couronne Galanoa', price: 1500 },
            { id: 'unremarkable-teacup', name: 'Bol Médiocre', price: 800 },
            { id: 'masterpiece-teacup', name: 'Bol Exceptionnel', price: 1500 },
            { id: 'metal-alloy', name: 'Métal Composite', price: 1500 },
            { id: 'sachet', name: 'Sachet Senteur', price: 1000 },
            { id: 'whipped-dream', name: 'Chantibonbon', price: 1000 },
            { id: 'deep-sea-tooth', name: 'Dent Océan', price: 1500 },
            { id: 'deep-sea-scale', name: 'Écaille Océan', price: 1500 },
            { id: 'leaders-crest', name: 'Emblème du Général', price: 1500 },
            { id: 'strawberry-sweet', name: 'Objet en Sucre', price: 800 }
        ];

        const unlockedItems = new Set();
        if (typeof MISSIONS !== 'undefined' && state.missions && state.missions.claimed) {
            // Pour chaque objet du jeu d'évolution
            EVOLUTION_ITEMS.forEach(evoItem => {
                // On compte combien de quêtes terminées récompensent cet objet
                const count = MISSIONS.filter(m => m.item === evoItem.id && state.missions.claimed.includes(m.id)).length;
                if (count >= 3) {
                    unlockedItems.add(evoItem.id);
                }
            });
        }

        const availableEvoItems = EVOLUTION_ITEMS.filter(item => unlockedItems.has(item.id));

        if (availableEvoItems.length === 0) {
            const msg = document.createElement('p');
            msg.innerText = "Accomplissez les 3 paliers de missions d'un objet pour le débloquer ici !";
            msg.style.opacity = 0.7;
            msg.style.margin = "10px 0";
            msg.style.fontStyle = "italic";
            UI.shopList.appendChild(msg);
        } else {
            availableEvoItems.forEach(item => {
                const owned = (state.inventory.stones && state.inventory.stones[item.id]) ? state.inventory.stones[item.id] : 0;
                const card = document.createElement('div');
                card.className = 'shop-item';
                card.innerHTML = `
                    <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.id}.png" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
                    <div class="item-info">
                        <span>${item.name}</span>
                        <span class="owned">Possédé : ${owned}</span>
                        <span class="price">${item.price} <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/nugget.png" class="mini-icon"></span>
                    </div>
                    <button onclick="buyStone('${item.id}', ${item.price})">Acheter</button>
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
            state.lastPurchaseTimestamp = Date.now();
            updateUI();
            saveState();
            renderShop();
        } else {
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pièces !" });
        }
    };

    window.buyStone = (id, price) => {
        if (state.coins >= price) {
            if (state.coins > 10000) state.boughtAbove10000 = true;
            state.coins -= price;
            if (!state.inventory.stones) state.inventory.stones = {};
            state.inventory.stones[id] = (state.inventory.stones[id] || 0) + 1;
            updateUI();
            saveState();
            renderShop();
        } else {
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pièces !" });
        }
    };


    function renderPokedex() {
        if (!UI.pokedexList) return;
        UI.pokedexList.innerHTML = '';

        const discoveries = Object.values(state.discovery || {});
        const encounteredCount = discoveries.length;
        const capturedCount = discoveries.filter(d => d.caught).length;

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

        if (UI.pokedexMode === 'national') {
            renderNationalPokedex();
            return;
        }

        const search = (UI.pokeSearch?.value || '').toLowerCase();

        // Sécurité : s'assurer que pokedex est un tableau
        if (!Array.isArray(state.pokedex)) state.pokedex = [];

        let filtered = state.pokedex.filter(p => p && p.name && p.name.toLowerCase().includes(search));

        // --- Système de Tri ---
        const sortMode = UI.pokeSort ? UI.pokeSort.value : 'id';
        const sorted = filtered.sort((a, b) => {
            if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
            if (sortMode === 'name-desc') return b.name.localeCompare(a.name);
            if (sortMode === 'level-desc') return b.level - a.level;
            if (sortMode === 'level-asc') return a.level - b.level;
            if (sortMode === 'can-evolve') {
                const aCan = (typeof a.nextEvoLevel === 'number' && a.level >= a.nextEvoLevel) || a.nextEvoLevel === 'Item requis';
                const bCan = (typeof b.nextEvoLevel === 'number' && b.level >= b.nextEvoLevel) || b.nextEvoLevel === 'Item requis';
                if (aCan !== bCan) return bCan - aCan;
                return (a.id || 0) - (b.id || 0);
            }
            if (sortMode === 'final-stage') {
                const aFinal = a.nextEvoLevel === 'MAX';
                const bFinal = b.nextEvoLevel === 'MAX';
                if (aFinal !== bFinal) return bFinal - aFinal;
                return (a.id || 0) - (b.id || 0);
            }
            return (a.id || 0) - (b.id || 0);
        });

        sorted.forEach(p => {
            if (!p) return;
            const item = document.createElement('div');
            item.className = `pokedex-item ${p.isShiny ? 'shiny-border' : ''}`;
            const evoInfo = calculateEvoTime(p);

            const genderSign = p.gender === 'male' ? '<span class="gender-m">♂</span>' : (p.gender === 'female' ? '<span class="gender-f">♀</span>' : '');

            let evoDisplay = '';
            if (evoInfo !== 'MAX') {
                const readyClass = evoInfo === 'Évolution prête !' ? 'evo-ready' : '';
                const clickAttr = readyClass ? `onclick="manualEvolve('${p.instanceId}')"` : '';
                evoDisplay = `<div class="evo-timer ${readyClass}" ${clickAttr}>${evoInfo}</div>`;
            }

            const xpToNext = calculatePokeXPToNext(p.level || 1);
            const xpProgress = Math.min(100, (p.xp / xpToNext) * 100);

            // On utilise les icones de la Gen VIII pour le look "PC"
            const iconUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${p.id}.png`;

            item.innerHTML = `
                <div class="tooltip">
                    <span class="tooltip-title">${p.isShiny ? '✨ ' : ''}${p.name}</span>
                    <div class="tooltip-row"><span class="tooltip-label">Nv.</span><span>${p.level}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Rarete</span><span>${p.rarity}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Genre</span><span>${p.gender === 'male' ? 'Mâle' : (p.gender === 'female' ? 'Femelle' : 'Asexué')}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Capture le</span><span>${p.date || 'Inconnue'}</span></div>
                </div>
                <div class="poke-info">
                    <img src="${iconUrl}" onerror="this.src='${p.sprite}'">
                    <span class="p-name">${p.name || 'Inconnu'} ${genderSign} ${p.isShiny ? '✨' : ''}</span>
                    <span class="p-lvl">Nv.${p.level || '?'}</span>
                    <div class="p-xp-bar"><div style="width: ${xpProgress}%"></div></div>
                    ${evoDisplay}
                </div>
                <div class="poke-actions">
                    <button class="sell-btn" onclick="sellPokemon('${p.instanceId}')">Liberer (40$)</button>
                </div>
            `;
            UI.pokedexList.appendChild(item);
        });
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
            const name = isSeen ? disc.name : `???`;

            item.innerHTML = `
                <span class="nat-id">#${i}</span>
                <img src="${spriteUrl}" loading="lazy" class="${isCaught ? '' : 'silhouette'}">
                <span class="nat-name">${name}</span>
            `;
            container.appendChild(item);
        }
        UI.pokedexList.appendChild(container);
    }

    function calculateEvoTime(p) {
        if (!p.nextEvoLevel || p.synced === false) {
            fetchNextEvoLevel(p);
            if (!p.nextEvoLevel) return "Analyse...";
        }
        if (p.nextEvoLevel === "MAX") return "MAX";
        if (typeof p.nextEvoLevel === "string") {
            if (p.nextEvoLevel.startsWith("item:")) {
                const reqItem = p.nextEvoLevel.split(":")[1];
                if (state.inventory.stones && state.inventory.stones[reqItem] > 0) {
                    return "Évolution prête !";
                } else {
                    return `Requiert: ${stoneTranslations[reqItem] || reqItem.replace('-', ' ')}`;
                }
            }
            if (p.nextEvoLevel.startsWith("loyalty:")) {
                const targetSecs = parseInt(p.nextEvoLevel.split(":")[1]);
                const currentSecs = (Date.now() - (p.captureTimestamp || Date.now())) / 1000;
                if (currentSecs >= targetSecs) {
                    return "Évolution prête !";
                } else {
                    const remaining = Math.ceil((targetSecs - currentSecs) / 60);
                    return `Amitié: ${remaining} min restantes`;
                }
            }
            return p.nextEvoLevel;
        }
        return p.level >= p.nextEvoLevel ? "Évolution prête !" : `Nv. requis : ${p.nextEvoLevel}`;
    }

    async function getSpeciesId(p) {
        if (p.speciesId && p.speciesId <= 10000) return p.speciesId;
        if (p.id <= 10000) {
            p.speciesId = p.id;
            return p.id;
        }
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.id}/`);
            if (!res.ok) return p.id;
            const data = await res.json();
            const parts = data.species.url.split('/');
            const sId = parseInt(parts[parts.length - 2]);
            p.speciesId = sId;
            return sId;
        } catch (e) {
            return p.id;
        }
    }

    async function fetchNextEvoLevel(p, retryCount = 0) {
        if (p.fetchingEvo) return;
        p.fetchingEvo = true;
        try {
            const sId = await getSpeciesId(p);

            if (!speciesCache[sId]) {
                const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${sId}/`);
                if (!speciesRes.ok) {
                    if (speciesRes.status === 404) {
                        p.nextEvoLevel = "MAX";
                        renderPokedex();
                        p.fetchingEvo = false;
                        return;
                    }
                    throw new Error("HTTP " + speciesRes.status);
                }
                const speciesData = await speciesRes.json();
                const evoRes = await fetch(speciesData.evolution_chain.url);
                const evoData = await evoRes.json();
                speciesCache[sId] = { species: speciesData, chain: evoData };
            }


            const cache = speciesCache[sId];

            // Correction dynamique du genre si erroné (ex: Migration 50/50 sur un Nidoking)
            if (cache.species.gender_rate === 0) p.gender = 'male';
            if (cache.species.gender_rate === 8) p.gender = 'female';
            if (cache.species.gender_rate === -1) p.gender = 'genderless';

            const englishName = cache.species.name;
            const evoDetails = findEvoDetails(cache.chain.chain, englishName);

            if (evoDetails && evoDetails.length > 0) {
                const detail = evoDetails[0];
                if (detail.trigger.name === "level-up" && !detail.item && !detail.held_item) {
                    if (detail.min_happiness) {
                        p.nextEvoLevel = "loyalty:1800"; // 30 minutes d'amitié
                    } else {
                        p.nextEvoLevel = detail.min_level || 1;
                    }
                } else if (detail.item) {
                    p.nextEvoLevel = `item:${detail.item.name}`;
                } else if (detail.held_item) {
                    p.nextEvoLevel = `item:${detail.held_item.name}`;
                } else if (detail.trigger.name === "trade") {
                    p.nextEvoLevel = `item:linking-cord`;
                } else {
                    // Fallback
                    p.nextEvoLevel = `item:moon-stone`;
                }
            } else {
                p.nextEvoLevel = "MAX";
            }
            p.synced = true; // On marque comme synchronis├® avec les vraies donn├®es API
            renderPokedex();
        } catch (e) {
            console.error("Evo analysis error", p.name, e);
            if (retryCount < 2) {
                setTimeout(() => { p.fetchingEvo = false; fetchNextEvoLevel(p, retryCount + 1); }, 1500);
            } else {
                p.nextEvoLevel = "Erreur";
                renderPokedex();
            }
        }
        p.fetchingEvo = false;
    }

    window.sellPokemon = (instanceId) => {
        const index = state.pokedex.findIndex(p => p.instanceId == instanceId);
        if (index > -1) {
            state.coins += 40;
            state.stats.totalCoins += 40;
            state.stats.liberated++;
            if (!state.released) state.released = [];
            state.released.push(state.pokedex[index].instanceId);
            if (state.pokedex[index].level >= 50) state.soldLevel50 = true;
            state.pokedex.splice(index, 1);
            saveState();
            updateUI();
            renderPokedex();
        }
    };

    window.manualEvolve = (instanceId) => {
        const p = state.pokedex.find(poke => poke.instanceId == instanceId);
        if (p) checkAutoEvolution(p, true); // isManual = true
    };

    async function checkAutoEvolution(pokemon, isManual = false) {
        if (!pokemon) return;
        try {
            const speciesId = await getSpeciesId(pokemon);
            if (!speciesCache[speciesId]) await fetchNextEvoLevel(pokemon);
            const cache = speciesCache[speciesId];
            if (!cache) return;

            const englishName = cache.species.name;
            const evoDetails = findEvoDetails(cache.chain.chain, englishName);
            if (evoDetails && evoDetails.length > 0) {
                const detail = evoDetails[0];
                let isReady = false;
                let reqItem = null;

                if (detail.trigger.name === "level-up" && !detail.item && !detail.held_item) {
                    const levelMet = pokemon.level >= (detail.min_level || 1);
                    let happinessMet = true;
                    if (detail.min_happiness) {
                        const loyaltySecs = (Date.now() - (pokemon.captureTimestamp || Date.now())) / 1000;
                        happinessMet = loyaltySecs >= 1800; // 30 minutes
                    }
                    if (levelMet && happinessMet) isReady = true;
                } else if (detail.item || detail.held_item || detail.trigger.name === "trade" || detail.trigger.name === "use-item") {
                    // Si ce n'est pas un clic manuel, on n'auto-evolue PAS avec des objets
                    if (!isManual) return;

                    reqItem = 'linking-cord';
                    if (detail.item) reqItem = detail.item.name;
                    if (detail.held_item) reqItem = detail.held_item.name;

                    if (state.inventory.stones && state.inventory.stones[reqItem] > 0) {
                        isReady = true;
                    }
                }

                if (isReady) {
                    if (reqItem) {
                        state.inventory.stones[reqItem]--;
                    }
                    evolvePokemon(pokemon, detail.species_name);
                }
            } else {
                pokemon.nextEvoLevel = "MAX";
            }
        } catch (e) { console.error("Auto-evo check error", e); }
    }

    function findEvoDetails(chain, currentName) {
        if (chain.species.name === currentName) {
            return chain.evolves_to.map(e => ({ species_name: e.species.name, ...e.evolution_details[0] }));
        }
        for (let next of chain.evolves_to) {
            const res = findEvoDetails(next, currentName);
            if (res) return res;
        }
        return null;
    }

    async function evolvePokemon(oldPoke, newSpeciesName) {
        try {
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${newSpeciesName}`);
            const speciesData = await speciesRes.json();

            let targetVarietyUrl = speciesData.varieties.find(v => v.is_default).pokemon.url;

            let currentPokemonRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${oldPoke.id}`);
            let currentPokemonData = await currentPokemonRes.json();

            let currentNameParts = currentPokemonData.name.split('-');
            if (currentNameParts.length > 1) {
                const suffix = currentNameParts.slice(1).join('-');
                const matchingVariety = speciesData.varieties.find(v => v.pokemon.name.includes(suffix));
                if (matchingVariety) {
                    targetVarietyUrl = matchingVariety.pokemon.url;
                }
            }

            const response = await fetch(targetVarietyUrl);
            const data = await response.json();

            let frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || speciesData.name;
            if (data.name.includes('-alola')) frenchName += " d'Alola";
            if (data.name.includes('-galar')) frenchName += " de Galar";
            if (data.name.includes('-hisui')) frenchName += " de Hisui";
            if (data.name.includes('-paldea')) frenchName += " de Paldea";

            const index = state.pokedex.findIndex(p => p.instanceId == oldPoke.instanceId);
            if (index > -1) {
                state.pokedex[index] = {
                    ...oldPoke,
                    id: data.id,
                    speciesId: speciesData.id,
                    name: frenchName,
                    sprite: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
                    nextEvoLevel: null,
                    fetchingEvo: false,
                    hasEvolved: true
                };

                // Special Quest: 3 evolutions in 2 mins
                if (!state.recentEvoTimestamps) state.recentEvoTimestamps = [];
                state.recentEvoTimestamps.push(Date.now());
                state.recentEvoTimestamps = state.recentEvoTimestamps.filter(t => Date.now() - t < 120000);
                state.recentEvoCount = state.recentEvoTimestamps.length;

                // Special Quest: Ningale level 20 with 100 balls
                if (oldPoke.name.includes('Ningale') || oldPoke.name.includes('Nincada')) {
                    const totalBalls = Object.values(state.inventory.balls).reduce((a, b) => a + b, 0);
                    if (oldPoke.level >= 20 && totalBalls >= 100) {
                        state.ningaleEvolvedWithBalls = true;
                    }
                }

                state.discovery[data.id] = { name: frenchName, sprite: state.pokedex[index].sprite, caught: true };

                vscode.postMessage({ type: 'showInfo', value: `Évolution en ${frenchName} !` });
                state.missions.evolutions++;
                state.stats.evolved++;
                state.lastEvoTimestamp = Date.now();
                saveState();
                renderPokedex();
                updateUI();
            }
        } catch (e) {
            console.error("Evolution failed", e);
        }
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

    const MISSIONS = [
        // --- PIERRES ELEMENTAIRES ---
        // Feu
        { id: 'm_fire_1', reqType: 'type', type: 'fire', target: 5, item: 'fire-stone', label: 'Brasier Ardent I', desc: 'Capturer 5 Pokémon Feu' },
        { id: 'm_fire_2', reqType: 'type', type: 'fire', target: 30, item: 'fire-stone', label: 'Brasier Ardent II', desc: 'Capturer 30 Pokémon Feu' },
        { id: 'm_fire_3', reqType: 'type', type: 'fire', target: 100, item: 'fire-stone', label: 'Chasse Incendiaire', desc: 'Capturer 100 Pokémon Feu' },

        // Eau
        { id: 'm_water_1', reqType: 'type', type: 'water', target: 5, item: 'water-stone', label: 'Source Océane I', desc: 'Capturer 5 Pokémon Eau' },
        { id: 'm_water_2', reqType: 'type', type: 'water', target: 30, item: 'water-stone', label: 'Source Océane II', desc: 'Capturer 30 Pokémon Eau' },
        { id: 'm_water_3', reqType: 'custom', check: () => (Date.now() - (state.lastCaptureTimestamp || 0)) >= 3600000, progress: () => Math.floor((Date.now() - (state.lastCaptureTimestamp || 0)) / 60000), target: 60, item: 'water-stone', label: 'Calme Plat', desc: '1h sans capture' },

        // Plante
        { id: 'm_leaf_1', reqType: 'type', type: 'grass', target: 5, item: 'leaf-stone', label: 'Floraison Sylvestre I', desc: 'Capturer 5 Pokémon Plante' },
        { id: 'm_leaf_2', reqType: 'type', type: 'grass', target: 30, item: 'leaf-stone', label: 'Floraison Sylvestre II', desc: 'Capturer 30 Pokémon Plante' },
        { id: 'm_leaf_3', reqType: 'custom', check: () => (state.pokedex || []).filter(p => p && (p.types || []).includes('grass') && (p.level || 1) >= 15).length >= 50, progress: () => (state.pokedex || []).filter(p => p && (p.types || []).includes('grass') && (p.level || 1) >= 15).length, target: 50, item: 'leaf-stone', label: 'Croissance Lente', desc: '50 Pokémon Plante Nv.15' },

        // Foudre
        { id: 'm_bolt_1', reqType: 'type', type: 'electric', target: 5, item: 'thunder-stone', label: 'Éclair Volt I', desc: 'Capturer 5 Pokémon Électrik' },
        { id: 'm_bolt_2', reqType: 'stat', statKey: 'totalItemsBought', target: 1000, item: 'thunder-stone', label: 'Client Régulier', desc: 'Acheter 1000 objets' },
        { id: 'm_bolt_3', reqType: 'stat', statKey: 'totalItemsBought', target: 5000, item: 'thunder-stone', label: 'Client Fidèle', desc: 'Acheter 5000 objets' },

        // Glace
        { id: 'm_ice_1', reqType: 'type', type: 'ice', target: 5, item: 'ice-stone', label: 'Givre Éternel I', desc: 'Capturer 5 Pokémon Glace' },
        { id: 'm_ice_2', reqType: 'type', type: 'ice', target: 30, item: 'ice-stone', label: 'Givre Éternel II', desc: 'Capturer 30 Pokémon Glace' },
        { id: 'm_ice_3', reqType: 'custom', check: () => (Date.now() - (state.lastEvoTimestamp || 0)) >= 86400000, progress: () => Math.floor((Date.now() - (state.lastEvoTimestamp || 0)) / 3600000), target: 24, item: 'ice-stone', label: 'Hibernation', desc: '24h sans évolution' },

        // --- PIERRES SPECIALES ---
        // Lune
        { id: 'm_moon_1', reqType: 'type', type: 'normal', target: 10, item: 'moon-stone', label: 'Force Tranquille I', desc: 'Capturer 10 Pokémon Normal' },
        { id: 'm_moon_2', reqType: 'custom', check: () => (state.coins || 0) >= 5000, progress: () => state.coins || 0, target: 5000, item: 'moon-stone', label: 'Épargne Lunaire', desc: 'Accumuler 5000 pièces' },
        { id: 'm_moon_3', reqType: 'custom', check: () => (state.coins || 0) >= 14400, progress: () => state.coins || 0, target: 14400, item: 'moon-stone', label: 'Épargne Nocturne', desc: 'Accumuler 14 400 pièces' },

        // Soleil
        { id: 'm_sun_1', reqType: 'type', type: 'psychic', target: 10, item: 'sun-stone', label: 'Esprit Supérieur I', desc: 'Capturer 10 Pokémon Psy' },
        { id: 'm_sun_2', reqType: 'custom', check: () => (state.middayCaptures || 0) >= 10, progress: () => state.middayCaptures || 0, target: 10, item: 'sun-stone', label: 'Petit Midi', desc: '10 Pokémon entre 10h et 14h' },
        { id: 'm_sun_3', reqType: 'custom', check: () => (state.middayCaptures || 0) >= 50, progress: () => state.middayCaptures || 0, target: 50, item: 'sun-stone', label: 'Plein Midi', desc: '50 Pokémon entre 10h et 14h' },

        // Éclat
        { id: 'm_shiny_1', reqType: 'type', type: 'fairy', target: 10, item: 'shiny-stone', label: 'Éclat Féerique I', desc: 'Capturer 10 Pokémon Fée' },
        { id: 'm_shiny_2', reqType: 'custom', check: () => (state.pokedex || []).some(p => p && (p.level || 1) >= 30), progress: () => (state.pokedex || []).reduce((max, p) => Math.max(max, p ? (p.level || 1) : 0), 0), target: 30, item: 'shiny-stone', label: 'Mentor Apprenti', desc: 'Un Pokémon au Niveau 30' },
        { id: 'm_shiny_3', reqType: 'custom', check: () => (state.pokedex || []).some(p => p && (p.level || 1) >= 60), progress: () => (state.pokedex || []).reduce((max, p) => Math.max(max, p ? (p.level || 1) : 0), 0), target: 60, item: 'shiny-stone', label: 'Mentor Passif', desc: 'Un Pokémon au Niveau 60' },

        // Nuit
        { id: 'm_dusk_1', reqType: 'type', type: 'poison', target: 10, item: 'dusk-stone', label: 'Venin Mortel I', desc: 'Capturer 10 Pokémon Poison' },
        { id: 'm_dusk_2', reqType: 'custom', check: () => { const h = new Date().getHours(); return h >= 19 || h < 7; }, progress: () => new Date().getHours(), target: 1, item: 'dusk-stone', label: 'Veilleur', desc: 'Se connecter la nuit (19h-7h)' },
        { id: 'm_dusk_3', reqType: 'custom', check: () => { const h = new Date().getHours(); return h >= 0 && h < 4; }, progress: () => new Date().getHours(), target: 4, item: 'dusk-stone', label: 'Insomnie', desc: 'Se connecter entre 00h et 04h' },

        // Aube
        { id: 'm_dawn_1', reqType: 'type', type: 'fighting', target: 10, item: 'dawn-stone', label: 'Aura de Combat I', desc: 'Capturer 10 Pokémon Combat' },
        { id: 'm_dawn_2', reqType: 'custom', check: () => { const h = new Date().getHours(); return h >= 5 && h < 10; }, progress: () => new Date().getHours(), target: 1, item: 'dawn-stone', label: 'Lève-tôt', desc: 'Se connecter le matin (5h-10h)' },
        { id: 'm_dawn_3', reqType: 'custom', check: () => state.dawnCaptureAchieved, progress: () => state.dawnCaptureAchieved ? 1 : 0, target: 1, item: 'dawn-stone', label: 'Premier Levé', desc: 'Capturer entre 5h et 5h10' },

        // --- OBJETS SPECIFIQUES ---
        // Câble Link
        { id: 'm_link_1', reqType: 'stat', statKey: 'evolved', target: 5, item: 'linking-cord', label: 'Échange Standard I', desc: '5 évolutions totales' },
        { id: 'm_link_2', reqType: 'custom', check: () => (state.pokedex || []).filter(p => p && p.hasEvolved).length >= 50, progress: () => (state.pokedex || []).filter(p => p && p.hasEvolved).length, target: 50, item: 'linking-cord', label: 'Réseau Local I', desc: '50 Pokémon ayant évolué' },
        { id: 'm_link_3', reqType: 'custom', check: () => (state.pokedex || []).filter(p => p && p.hasEvolved).length >= 100, progress: () => (state.pokedex || []).filter(p => p && p.hasEvolved).length, target: 100, item: 'linking-cord', label: 'Réseau Local II', desc: '100 Pokémon ayant évolué' },

        // Peau Métal
        { id: 'm_metal_1', reqType: 'type', type: 'steel', target: 5, item: 'metal-coat', label: 'Blindage Métal I', desc: 'Capturer 5 Pokémon Acier' },
        { id: 'm_metal_2', reqType: 'type', type: 'steel', target: 15, item: 'metal-coat', label: 'Magnétisme', desc: '15 Pokémon Acier' },
        { id: 'm_metal_3', reqType: 'custom', check: () => (state.pokedex || []).filter(p => p && (p.types || []).includes('steel') && (p.level || 1) >= 40).length >= 4, progress: () => (state.pokedex || []).filter(p => p && (p.types || []).includes('steel') && (p.level || 1) >= 40).length, target: 4, item: 'metal-coat', label: 'Maître de l\'Évolution', desc: '4 Pokémon Acier Nv.40' },

        // Roche Royale
        { id: 'm_king_1', reqType: 'stat', statKey: 'totalCoins', target: 10000, item: 'kings-rock', label: 'Petit Capital', desc: '10 000 pièces cumulées' },
        { id: 'm_king_2', reqType: 'stat', statKey: 'totalCoins', target: 100000, item: 'kings-rock', label: 'Fortune Royale', desc: '100 000 pièces cumulées' },
        { id: 'm_king_3', reqType: 'stat', statKey: 'totalCoins', target: 1000000, item: 'kings-rock', label: 'Investissement Majeur', desc: '1 000 000 pièces cumulées' },

        // Écaille Draco
        { id: 'm_draco_1', reqType: 'type', type: 'dragon', target: 1, item: 'dragon-scale', label: 'Chasseur de Légendes', desc: 'Capturer un Dragon' },
        { id: 'm_draco_2', reqType: 'type', type: 'dragon', target: 5, item: 'dragon-scale', label: 'Dresseur de Dragons', desc: 'Capturer 5 Dragons' },
        { id: 'm_draco_3', reqType: 'custom', check: () => (state.pokedex || []).some(p => p && (p.types || []).includes('dragon') && (p.level || 1) >= 50), progress: () => (state.pokedex || []).filter(p => p && (p.types || []).includes('dragon')).reduce((max, p) => Math.max(max, p ? (p.level || 1) : 0), 0), target: 50, item: 'dragon-scale', label: 'Maître Dragon', desc: 'Un Dragon au Niveau 50' },

        // Pommes (Verpom)
        { id: 'm_apple_1', reqType: 'stat', statKey: 'liberated', target: 5, item: 'sweet-apple', label: 'Petit Ménage', desc: 'Libérer 5 Pokémon' },
        { id: 'm_apple_2', reqType: 'stat', statKey: 'liberated', target: 40, item: 'Provision de Secours', desc: 'Libérer 40 Pokémon' },
        { id: 'm_apple_3', reqType: 'custom', check: () => state.soldLevel50, progress: () => state.soldLevel50 ? 1 : 0, target: 1, item: 'tart-apple', label: 'Sacrifice Ultime', desc: 'Libérer un Pokémon Nv.50' },

        // Améliorator / CD Douteux
        { id: 'm_up_1', reqType: 'custom', check: () => (Date.now() - (state.sessionStartTime || Date.now())) >= 3600000, progress: () => Math.floor((Date.now() - (state.sessionStartTime || Date.now())) / 3600000), target: 1, item: 'upgrade', label: 'Longue Session', desc: '1h de jeu consécutive' },
        { id: 'm_up_2', reqType: 'custom', check: () => (Date.now() - (state.sessionStartTime || Date.now())) >= 18000000, progress: () => Math.floor((Date.now() - (state.sessionStartTime || Date.now())) / 3600000), target: 5, item: 'upgrade', label: 'Session Marathon', desc: '5h de jeu consécutive' },
        { id: 'm_up_3', reqType: 'custom', check: () => state.boughtAbove10000, progress: () => state.boughtAbove10000 ? 1 : 0, target: 1, item: 'dubious-disc', label: 'Dépense Douteuse', desc: 'Acheter un objet avec > 10 000 pièces' },

        // Protecteur / Tissu Fauche
        { id: 'm_prot_1', reqType: 'stat', statKey: 'totalBallsBought', target: 100, item: 'protector', label: 'Petit Stock', desc: 'Acheter 100 Poké Balls' },
        { id: 'm_prot_2', reqType: 'stat', statKey: 'totalBallsBought', target: 1000, item: 'protector', label: 'Stock de Munitions', desc: 'Acheter 1000 Poké Balls' },
        { id: 'm_prot_3', reqType: 'type', type: 'ghost', target: 50, item: 'reaper-cloth', label: 'Hante-Moi', desc: 'Capturer 50 Pokémon Spectre' },

        // Électriseur / Magmariseur
        { id: 'm_elec_1', reqType: 'custom', check: () => (state.pokedex || []).reduce((s, p) => s + (p ? (p.level || 0) : 0), 0) >= 100, progress: () => (state.pokedex || []).reduce((s, p) => s + (p ? (p.level || 0) : 0), 0), target: 100, item: 'electirizer', label: 'Échauffement', desc: '100 niveaux cumulés' },
        { id: 'm_elec_2', reqType: 'custom', check: () => (state.pokedex || []).reduce((s, p) => s + (p ? (p.level || 0) : 0), 0) >= 1000, progress: () => (state.pokedex || []).reduce((s, p) => s + (p ? (p.level || 0) : 0), 0), target: 1000, item: 'electirizer', label: 'Énergie Cumulée', desc: '1000 niveaux cumulés' },
        { id: 'm_magma_1', reqType: 'type', type: 'fire', target: 50, item: 'magmarizer', label: 'Cœur de Vulcain', desc: 'Capturer 50 Pokémon Feu' },

        // Bel'Écaille
        { id: 'm_beauty_1', reqType: 'type', type: 'water', target: 10, item: 'prism-scale', label: 'Lagon Bleu I', desc: '10 Pokémon Eau' },
        { id: 'm_beauty_2', reqType: 'type', type: 'water', target: 50, item: 'prism-scale', label: 'Grand Large', desc: '50 Pokémon Eau' },
        { id: 'm_beauty_3', reqType: 'custom', check: () => (state.pokedex || []).some(p => p && p.isShiny), progress: () => (state.pokedex || []).some(p => p && p.isShiny) ? 1 : 0, target: 1, item: 'prism-scale', label: 'Beauté Rare', desc: 'Avoir un Pokémon Shiny ✨' },

        // Griffe / Croc Rasoir
        { id: 'm_dark_1', reqType: 'type', type: 'dark', target: 10, item: 'razor-claw', label: 'Ombres Mouvantes I', desc: '10 Pokémon Ténèbres' },
        { id: 'm_dark_2', reqType: 'type', type: 'dark', target: 50, item: 'razor-claw', label: 'Maître des Ténèbres', desc: '50 Pokémon Ténèbres' },
        { id: 'm_dark_3', reqType: 'custom', check: () => (state.pokedex || []).some(p => p && (p.level || 1) >= 50 && (p.types || []).includes('dark')), progress: () => (state.pokedex || []).filter(p => p && (p.types || []).includes('dark')).reduce((max, p) => Math.max(max, p ? (p.level || 1) : 0), 0), target: 50, item: 'razor-fang', label: 'Predateur Nocturne', desc: 'Un Pokémon Ténèbres Nv.50' },

        // Pot Thé / Bol Thé
        { id: 'm_tea_1', reqType: 'stat', statKey: 'totalClicks', target: 100, item: 'cracked-pot', label: 'Curiosité', desc: 'Cliquer 100 fois' },
        { id: 'm_tea_2', reqType: 'stat', statKey: 'totalClicks', target: 999, item: 'gimmighoul-coin', label: 'Obsession du Clic', desc: 'Cliquer 999 fois' },
        { id: 'm_tea_3', reqType: 'custom', check: () => state.ningaleEvolvedWithBalls, progress: () => state.ningaleEvolvedWithBalls ? 1 : 0, target: 1, item: 'masterpiece-teacup', label: 'Coquille Vide', desc: 'Évoluer Ningale Nv.20 avec 100 balls' },

        // Armures (Charbambin)
        { id: 'm_arm_1', reqType: 'stat', statKey: 'captures', target: 50, item: 'auspicious-armor', label: 'Petit Voyageur', desc: '50 Pokémon capturés' },
        { id: 'm_arm_2', reqType: 'stat', statKey: 'captures', target: 400, item: 'auspicious-armor', label: 'Grand Voyageur', desc: '400 Pokémon capturés' },
        { id: 'm_arm_3', reqType: 'custom', check: () => (state.pokedex || []).some(p => p && (p.name || '').includes('Charbambin') && (p.level || 1) >= 30), progress: () => (state.pokedex || []).find(p => p && (p.name || '').includes('Charbambin'))?.level || 0, target: 30, item: 'malicious-armor', label: 'Âme Guerrière', desc: 'Un Charbambin Nv.30' },

        // Autres (Obsidienne, Tourbe, etc.)
        { id: 'm_geo_1', reqType: 'type', type: 'rock', target: 50, item: 'black-augurite', label: 'Petit Géologue', desc: '50 Pokémon Roche' },
        { id: 'm_geo_2', reqType: 'type', type: 'ground', target: 50, item: 'black-augurite', label: 'Mineur', desc: '50 Pokémon Sol' },
        { id: 'm_geo_3', reqType: 'custom', check: () => ((state.missions.typeProgress['rock'] || 0) + (state.missions.typeProgress['ground'] || 0)) >= 200, progress: () => (state.missions.typeProgress['rock'] || 0) + (state.missions.typeProgress['ground'] || 0), target: 200, item: 'black-augurite', label: 'Géologue', desc: '200 Pokémon Roche ou Sol' }
    ];


    function renderMissions() {
        const container = document.getElementById('missions-list');
        container.innerHTML = '<h2>Missions d\'Entraîneur</h2>';

        if (!state.missions.typeProgress) state.missions.typeProgress = {};
        if (!state.missions.claimed) state.missions.claimed = [];

        const missionSeries = {};
        MISSIONS.forEach(m => {
            const seriesId = m.id.replace(/[0-9]+$/, ''); // Group m1, m2 to "m"
            if (!missionSeries[seriesId]) missionSeries[seriesId] = [];
            missionSeries[seriesId].push(m);
        });

        Object.keys(missionSeries).forEach(seriesId => {
            const series = missionSeries[seriesId];
            const nextMission = series.find(m => !state.missions.claimed.includes(m.id));

            if (nextMission) {
                let current = 0;
                if (nextMission.reqType === 'type') {
                    current = state.missions.typeProgress[nextMission.type] || 0;
                } else if (nextMission.reqType === 'stat') {
                    current = state.stats[nextMission.statKey] || 0;
                } else if (nextMission.reqType === 'custom') {
                    current = nextMission.progress ? nextMission.progress() : (nextMission.check() ? nextMission.target : 0);
                }

                const progress = Math.min(100, (current / nextMission.target) * 100);
                const stoneFr = stoneTranslations[nextMission.item] || nextMission.item.replace('-', ' ');

                const card = document.createElement('div');
                card.className = `mission-card`;
                card.innerHTML = `
                    <h3>${nextMission.label}</h3>
                    <p>${nextMission.desc} : ${current}/${nextMission.target}</p>
                    <div class="progress-bar"><div style="width: ${progress}%"></div></div>
                    <div class="reward">Cadeau: ${stoneFr}</div>
                    <button class="claim-btn" ${nextMission.check ? (nextMission.check() ? '' : 'disabled') : (current >= nextMission.target ? '' : 'disabled')} onclick="claimMission('${nextMission.id}', '${nextMission.item}', '${nextMission.reqType}')">
                        Réclamer
                    </button>
                `;
                container.appendChild(card);
            }
        });
    }

    window.claimMission = (missionId, itemReward, reqType) => {
        const mission = MISSIONS.find(m => m.id === missionId);
        if (!mission) return;

        let isReady = false;
        if (reqType === 'type') isReady = (state.missions.typeProgress[mission.type] || 0) >= mission.target;
        if (reqType === 'stat') isReady = (state.stats[mission.statKey] || 0) >= mission.target;
        if (reqType === 'custom') isReady = mission.check();

        if (isReady) {
            state.missions.claimed.push(missionId);
            if (!state.inventory.stones) state.inventory.stones = {};
            state.inventory.stones[itemReward] = (state.inventory.stones[itemReward] || 0) + 1;

            const frName = stoneTranslations[itemReward] || itemReward;

            vscode.postMessage({ type: 'showInfo', value: `Mission "${mission.label}" accomplie ! Vous obtenez : ${frName}` });
            saveState();
            renderMissions();
            updateUI();
        }
    };


    function saveState() {
        state.lastUpdate = Date.now();
        vscode.postMessage({ type: 'saveState', value: state });
    }

})();