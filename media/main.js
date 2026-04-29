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
        spawnTimer: 180 // 3 minutes en secondes
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
        pokeSearch: document.getElementById('poke-search')
    };

    let currentPokemon = null;
    let selectedBall = 'pokeball';

    // Initialisation
    vscode.postMessage({ type: 'getState' });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'loadState') {
            state = message.value;
            // Migrer l'ancien état vers le nouveau système
            if (!state.inventory.balls) {
                state.inventory = { balls: { pokeball: 20 }, stones: {} };
            }
            if (state.spawnTimer === undefined || isNaN(state.spawnTimer)) {
                state.spawnTimer = 180;
            }
            if (!state.missions.typeProgress) {
                state.missions.typeProgress = {};
            }

            // Migration : Ajouter des IDs et Niveaux aux Pokémon qui n'en ont pas
            state.pokedex.forEach(p => {
                if (!p.instanceId) p.instanceId = Date.now() + Math.random();
                if (!p.level) p.level = 5;
                if (p.xp === undefined) p.xp = 0;
            });

            // Traduction automatique des noms existants (si en anglais/minuscules)
            translateExistingPokedex();

            updateUI();
            renderShop();
            startGameLoop();
        }
    });

    async function translateExistingPokedex() {
        for (let p of state.pokedex) {
            // Si le nom est en minuscule et sans espace, c'est probablement un nom anglais de l'API
            if (p.name === p.name.toLowerCase() && !p.name.includes(' ')) {
                try {
                    const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}/`);
                    const data = await res.json();
                    const fr = data.names.find(n => n.language.name === 'fr')?.name;
                    if (fr) {
                        p.name = fr;
                        renderPokedex();
                        saveState();
                    }
                } catch (e) { }
            }
        }
    }

    // Gestion des Onglets
    UI.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            UI.tabs.forEach(b => b.classList.remove('active'));
            UI.tabContents.forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.remove('hidden');

            if (tabId === 'pokedex-tab') renderPokedex();
            if (tabId === 'shop-tab') renderShop();
            if (tabId === 'missions-tab') renderMissions();
        });
    });

    // Gestion de l'inventaire
    UI.itemSlots.forEach(slot => {
        slot.addEventListener('click', () => {
            UI.itemSlots.forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            selectedBall = slot.dataset.ball;
        });
    });

    function updateUI() {
        UI.coinCount.innerText = state.coins;
        UI.pokedexCount.innerText = state.pokedex.length;
        UI.playerLevel.innerText = state.level;

        const xpToNext = Math.floor(Math.pow(state.level, 1.8) * 150);
        const progress = Math.min(100, (state.xp / xpToNext) * 100);
        UI.xpProgress.style.width = `${progress}%`;

        renderBallInventory();
        renderMissions();

        // Easter Egg Debug : 5 clics sur le header donne 2000 pièces
        let debugClicks = 0;
        document.querySelector('header').onclick = () => {
            debugClicks++;
            if (debugClicks >= 5) {
                state.coins += 2000;
                debugClicks = 0;
                vscode.postMessage({ type: 'showInfo', value: "DEBUG: +2000 pièces ajoutées !" });
                updateUI();
                saveState();
            }
        };
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
        // Boucle principale (toutes les secondes)
        setInterval(() => {
            // 1. Gestion du Spawn (Aléatoire entre 30s et 3min)
            if (!currentPokemon) {
                state.spawnTimer--;
                if (state.spawnTimer <= 0) {
                    spawnPokemon();
                    // Nouveau délai aléatoire : 30s (30) à 3min (180)
                    state.spawnTimer = Math.floor(Math.random() * (180 - 30 + 1)) + 30;
                }
            }

            // 2. XP Passive et Argent Passif
            if (new Date().getSeconds() % 3 === 0) {
                gainPassiveXP();
            }
            // Argent passif toutes les 2 minutes
            if (new Date().getTime() % 120000 < 1000) {
                state.coins += 10;
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
            timerEl.innerText = `Prochain Pokémon dans : ${mins}:${secs.toString().padStart(2, '0')}`;
        } else if (timerEl) {
            timerEl.innerText = "Un Pokémon est apparu !";
        }
    }

    function gainPassiveXP() {
        let leveledUp = false;
        state.pokedex.forEach(p => {
            // Gain de 1 XP toutes les 3 secondes
            p.xp = (p.xp || 0) + 1;
            const xpToNext = calculatePokeXPToNext(p.level || 1);
            if (p.xp >= xpToNext) {
                p.level = (p.level || 1) + 1;
                p.xp = 0;
                leveledUp = true;
                checkAutoEvolution(p);
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
                <div class="loader">Un Pokémon approche discrètement...</div>
            </div>
        `;
        vscode.postMessage({ type: 'updateStatus', active: true });

        try {
            let data = null;
            let speciesData = null;
            let found = false;

            while (!found) {
                // On peut maintenant piocher dans toute la liste (1025)
                const id = Math.floor(Math.random() * 1025) + 1;
                const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
                speciesData = await speciesRes.json();

                // Logique de rareté basée sur le capture_rate (255 = très commun, 3 = légendaire)
                const capRate = speciesData.capture_rate;
                let rarity = "Commun";
                let chance = 1;

                if (capRate <= 3) { rarity = "Légendaire"; chance = 0.01; }
                else if (capRate <= 45) { rarity = "Épique"; chance = 0.1; }
                else if (capRate <= 100) { rarity = "Rare"; chance = 0.3; }
                else if (capRate <= 150) { rarity = "Peu Commun"; chance = 0.6; }

                // Condition de niveau : certains Pokémon ne spawnent qu'à partir d'un certain niveau joueur
                const minLevelRequired = rarity === "Légendaire" ? 50 : (rarity === "Épique" ? 20 : 1);

                if (state.level >= minLevelRequired && Math.random() < chance) {
                    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
                    data = await response.json();
                    found = true;

                    const frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || data.name;

                    currentPokemon = {
                        id: data.id,
                        name: frenchName,
                        rarity: rarity,
                        captureRate: capRate,
                        sprite: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
                        types: data.types.map(t => t.type.name),
                        isShiny: Math.random() < (1 / 512),
                        baseExperience: data.base_experience || 50,
                        level: Math.max(1, Math.floor(state.level * 0.8) + Math.floor(Math.random() * 5))
                    };
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
                    ${currentPokemon.isShiny ? '✨ ' : ''}${currentPokemon.name} <span class="lvl">Nv.${currentPokemon.level}</span>
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
        const difficulty = Math.min(0.35, (currentPokemon.baseExperience / 800));
        const catchSuccess = Math.random() < Math.max(0.1, ball.rate - difficulty);

        state.inventory.balls[selectedBall]--;
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
        const newPoke = {
            ...currentPokemon,
            instanceId: Date.now() + Math.random(),
            xp: 0,
            date: new Date().toLocaleDateString()
        };

        state.pokedex.push(newPoke);
        state.coins += 5;
        state.xp += Math.floor(currentPokemon.baseExperience / 5);
        state.missions.captures++;

        currentPokemon.types.forEach(t => {
            state.missions.typeProgress[t] = (state.missions.typeProgress[t] || 0) + 1;
        });

        checkLevelUp();
        currentPokemon = null;
        state.spawnTimer = 180;
        UI.spawnArea.innerHTML = '<div class="loader" id="spawn-timer-display">Recherche...</div>';
        vscode.postMessage({ type: 'updateStatus', active: false });
        saveState();
        updateUI();
    }

    function checkLevelUp() {
        const xpToNext = Math.floor(Math.pow(state.level, 1.8) * 150);
        if (state.xp >= xpToNext) {
            state.xp -= xpToNext;
            state.level++;
            vscode.postMessage({ type: 'showInfo', value: `NIVEAU SUPÉRIEUR ! Passage au niveau ${state.level}.` });
        }
    }

    function renderShop() {
        UI.shopList.innerHTML = '';
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
    }

    window.buyItem = (id, price) => {
        if (state.coins >= price) {
            state.coins -= price;
            state.inventory.balls[id] = (state.inventory.balls[id] || 0) + 1;
            updateUI();
            saveState();
        } else {
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pièces !" });
        }
    };

    window.claimMission = (id, stone) => {
        if (!state.missions.claimed) state.missions.claimed = [];
        state.missions.claimed.push(id);

        // Gains
        state.coins += 50;
        state.inventory.stones[stone] = (state.inventory.stones[stone] || 0) + 1;

        vscode.postMessage({ type: 'showInfo', value: `Mission accomplie ! +50 🪙 et 1x ${stone.replace('-', ' ')}` });
        saveState();
        updateUI();
    };

    function renderPokedex() {
        if (!UI.pokedexList) return;
        UI.pokedexList.innerHTML = '';
        const search = (UI.pokeSearch?.value || '').toLowerCase();

        // Sécurité : s'assurer que pokedex est un tableau
        if (!Array.isArray(state.pokedex)) state.pokedex = [];

        const filtered = state.pokedex.filter(p => p && p.name && p.name.toLowerCase().includes(search));
        const sorted = filtered.sort((a, b) => (a.id || 0) - (b.id || 0));

        sorted.forEach(p => {
            if (!p) return;
            const item = document.createElement('div');
            item.className = `pokedex-item ${p.isShiny ? 'shiny-border' : ''}`;
            const evoInfo = calculateEvoTime(p);

            const xpToNext = calculatePokeXPToNext(p.level || 1);
            const xpProgress = Math.min(100, (p.xp / xpToNext) * 100);
            const minsLeft = Math.ceil(((xpToNext - p.xp) * 3) / 60);

            item.innerHTML = `
                <div class="poke-info">
                    <img src="${p.sprite || ''}">
                    <span class="p-name">${p.name || 'Inconnu'} ${p.isShiny ? '✨' : ''}</span>
                    <span class="p-lvl">Nv.${p.level || '?'}</span>
                    <div class="p-xp-bar"><div style="width: ${xpProgress}%"></div></div>
                    <div class="p-xp-info">Prog: ${minsLeft} min</div>
                    <div class="evo-timer">${evoInfo}</div>
                </div>
                <div class="poke-actions">
                    <button class="sell-btn" onclick="sellPokemon(${p.instanceId})">Vendre (20$)</button>
                </div>
            `;
            UI.pokedexList.appendChild(item);
        });
    }

    function calculateEvoTime(p) {
        if (!p.nextEvoLevel) {
            fetchNextEvoLevel(p);
            return "Analyse...";
        }
        if (p.nextEvoLevel === "MAX") return "Stade Final";
        if (typeof p.nextEvoLevel === "string") return p.nextEvoLevel;
        return p.level >= p.nextEvoLevel ? "Évolution prête !" : `Nv. requis : ${p.nextEvoLevel}`;
    }

    async function fetchNextEvoLevel(p) {
        if (p.fetchingEvo) return;
        p.fetchingEvo = true;
        try {
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}/`);
            const speciesData = await speciesRes.json();
            const evoRes = await fetch(speciesData.evolution_chain.url);
            const evoData = await evoRes.json();

            const englishName = speciesData.name;
            const evoDetails = findEvoDetails(evoData.chain, englishName);
            if (evoDetails && evoDetails.length > 0) {
                const detail = evoDetails[0];
                if (detail.trigger.name === "level-up") {
                    p.nextEvoLevel = detail.min_level || (p.level + 1);
                } else {
                    p.nextEvoLevel = `Item requis`;
                }
            } else {
                p.nextEvoLevel = "MAX";
            }
            renderPokedex();
        } catch (e) { p.nextEvoLevel = "Erreur"; }
        p.fetchingEvo = false;
    }

    window.sellPokemon = (instanceId) => {
        const index = state.pokedex.findIndex(p => p.instanceId === instanceId);
        if (index > -1) {
            state.coins += 20;
            state.pokedex.splice(index, 1);
            saveState();
            updateUI();
            renderPokedex();
        }
    };

    async function checkAutoEvolution(pokemon) {
        try {
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}/`);
            const speciesData = await speciesRes.json();
            const evoRes = await fetch(speciesData.evolution_chain.url);
            const evoData = await evoRes.json();

            const englishName = speciesData.name;
            const evoDetails = findEvoDetails(evoData.chain, englishName);
            if (evoDetails && evoDetails.length > 0) {
                const detail = evoDetails[0];
                if (detail.trigger.name === "level-up" && detail.min_level <= pokemon.level) {
                    evolvePokemon(pokemon, detail.species_name);
                }
            }
        } catch (e) { }
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

    window.tryEvolve = async (id) => {
        const p = state.pokedex.find(poke => poke.id === id);
        if (!p) return;
        const stoneNeeded = getStoneForType(p.types[0]);
        if (state.inventory.stones[stoneNeeded] > 0) {
            state.inventory.stones[stoneNeeded]--;
            // Logique simplifié pour cet exemple
            const next = await fetchNextEvolution(p.id, p.name);
            if (next) evolvePokemon(p, next);
        } else {
            vscode.postMessage({ type: 'showInfo', value: `Besoin d'une Pierre ${stoneNeeded.toUpperCase()}` });
        }
    };

    async function fetchNextEvolution(id, name) {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
        const data = await res.json();
        const chainRes = await fetch(data.evolution_chain.url);
        const chainData = await chainRes.json();
        const evo = findNextEvolution(chainData.chain, name);
        return evo;
    }

    function findNextEvolution(chain, currentName) {
        if (chain.species.name === currentName) return chain.evolves_to[0] ? chain.evolves_to[0].species.name : null;
        for (let next of chain.evolves_to) {
            const res = findNextEvolution(next, currentName);
            if (res) return res;
        }
        return null;
    }

    async function evolvePokemon(oldPoke, newName) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${newName}`);
        const data = await response.json();
        const speciesRes = await fetch(data.species.url);
        const speciesData = await speciesRes.json();
        const frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || data.name;

        const index = state.pokedex.findIndex(p => p.instanceId === oldPoke.instanceId);
        state.pokedex[index] = { ...oldPoke, id: data.id, name: frenchName, sprite: data.sprites.other['official-artwork'].front_default };

        vscode.postMessage({ type: 'showInfo', value: `Évolution en ${frenchName} !` });
        state.missions.evolutions++;
        saveState();
        renderPokedex();
        updateUI();
    }

    function getStoneForType(type) {
        const map = { fire: 'fire-stone', water: 'water-stone', grass: 'leaf-stone', electric: 'thunder-stone', ice: 'ice-stone', normal: 'moon-stone', psychic: 'sun-stone', poison: 'dusk-stone', fairy: 'shiny-stone', steel: 'metal-coat', rock: 'module_mag', dark: 'lentille_inv', dragon: 'dragon-scale', ghost: 'reaper-cloth' };
        return map[type] || 'moon-stone';
    }

    const MISSIONS = [
        { id: 'm1', type: 'fire', stone: 'fire-stone', target: 5, label: 'Brasier Ardent I' },
        { id: 'm2', type: 'fire', stone: 'fire-stone', target: 15, label: 'Brasier Ardent II' },
        { id: 'm3', type: 'water', stone: 'water-stone', target: 5, label: 'Source Océane I' },
        { id: 'm4', type: 'water', stone: 'water-stone', target: 15, label: 'Source Océane II' },
        { id: 'm5', type: 'grass', stone: 'leaf-stone', target: 5, label: 'Floraison Sylvestre I' },
        { id: 'm6', type: 'grass', stone: 'leaf-stone', target: 15, label: 'Floraison Sylvestre II' },
        { id: 'm7', type: 'electric', stone: 'thunder-stone', target: 5, label: 'Éclair Volt' },
        { id: 'm8', type: 'ice', stone: 'ice-stone', target: 5, label: 'Givre Éternel' },
        { id: 'm9', type: 'normal', stone: 'moon-stone', target: 10, label: 'Force Tranquille' },
        { id: 'm10', type: 'psychic', stone: 'sun-stone', target: 10, label: 'Esprit Supérieur' },
        { id: 'm11', type: 'poison', stone: 'dusk-stone', target: 10, label: 'Venin Mortel' },
        { id: 'm12', type: 'fairy', stone: 'shiny-stone', target: 10, label: 'Éclat Féerique' },
        { id: 'm13', type: 'fighting', stone: 'lien_amitie', target: 10, label: 'Aura de Combat' },
        { id: 'm14', type: 'steel', stone: 'metal-coat', target: 5, label: 'Blindage Métal' },
        { id: 'm15', type: 'rock', stone: 'module_mag', target: 8, label: 'Cœur de Roche' },
        { id: 'm16', type: 'dark', stone: 'lentille_inv', target: 8, label: 'Ombre Obscure' },
        { id: 'm17', type: 'dragon', stone: 'dragon-scale', target: 5, label: 'Souffle du Dragon' },
        { id: 'm18', type: 'ghost', stone: 'reaper-cloth', target: 5, label: 'Hantise Spectrale' }
    ];

    function renderMissions() {
        const container = document.getElementById('missions-list');
        container.innerHTML = '<h2>Missions d\'Entraîneur</h2>';

        if (!state.missions.typeProgress) state.missions.typeProgress = {};
        if (!state.missions.claimed) state.missions.claimed = [];

        const typeMissions = {};
        MISSIONS.forEach(m => {
            if (!typeMissions[m.type]) typeMissions[m.type] = [];
            typeMissions[m.type].push(m);
        });

        const typeTranslations = { fire: 'FEU', water: 'EAU', grass: 'PLANTE', electric: 'ÉLECTRIK', ice: 'GLACE', normal: 'NORMAL', psychic: 'PSY', poison: 'POISON', fairy: 'FÉE', fighting: 'COMBAT', steel: 'ACIER', rock: 'ROCHE', dark: 'TÉNÈBRES', dragon: 'DRAGON', ghost: 'SPECTRE' };
        const stoneTranslations = { 'fire-stone': 'Pierre Feu', 'water-stone': 'Pierre Eau', 'leaf-stone': 'Pierre Plante', 'thunder-stone': 'Pierre Foudre', 'ice-stone': 'Pierre Glace', 'moon-stone': 'Pierre Lune', 'sun-stone': 'Pierre Soleil', 'dusk-stone': 'Pierre Nuit', 'shiny-stone': 'Pierre Éclat', 'lien_amitie': 'Lien d\'Amitié', 'metal-coat': 'Peau Métal', 'module_mag': 'Module Mag.', 'lentille_inv': 'Lentille Inv.', 'dragon-scale': 'Écaille Draco', 'reaper-cloth': 'Tissu Faucheur' };

        Object.keys(typeMissions).forEach(type => {
            const series = typeMissions[type];
            const nextMission = series.find(m => !state.missions.claimed.includes(m.id));

            if (nextMission) {
                const current = state.missions.typeProgress[nextMission.type] || 0;
                const progress = Math.min(100, (current / nextMission.target) * 100);
                const typeFr = typeTranslations[nextMission.type] || nextMission.type.toUpperCase();
                const stoneFr = stoneTranslations[nextMission.stone] || nextMission.stone.replace('-', ' ');

                const card = document.createElement('div');
                card.className = `mission-card`;
                card.innerHTML = `
                    <h3>${nextMission.label}</h3>
                    <p>Captures ${typeFr}: ${current}/${nextMission.target}</p>
                    <div class="progress-bar"><div style="width: ${progress}%"></div></div>
                    <div class="reward">Cadeau: ${stoneFr}</div>
                    <button class="claim-btn" ${current >= nextMission.target ? '' : 'disabled'} onclick="claimMission('${nextMission.id}', '${nextMission.stone}', ${nextMission.target})">
                        Réclamer
                    </button>
                `;
                container.appendChild(card);
            }
        });
    }

    function saveState() {
        vscode.postMessage({ type: 'saveState', value: state });
    }

})();
