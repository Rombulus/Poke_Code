(function () {
    const vscode = acquireVsCodeApi();

    let state = {
        pokedex: [],
        inventory: {
            pokeballs: 10,
            superballs: 0,
            hyperballs: 0,
            stones: {}
        },
        coins: 50,
        xp: 0,
        level: 1,
        missions: {
            captures: 0,
            evolutions: 0
        }
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
    let selectedBall = 'pokeballs';

    // Initialisation
    vscode.postMessage({ type: 'getState' });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'loadState') {
            state = message.value;
            // Migrer l'ancien état si nécessaire
            if (!state.inventory) {
                state.inventory = { pokeballs: 10, superballs: 0, hyperballs: 0, stones: {} };
                state.xp = 0;
                state.level = 1;
                state.missions = { captures: 0, evolutions: 0 };
            }
            updateUI();
            renderShop();
            startGameLoop();
        }
    });

    // Gestion des Onglets
    UI.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            UI.tabs.forEach(b => b.classList.remove('active'));
            UI.tabContents.forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');

            if (tabId === 'pokedex') renderPokedex();
            if (tabId === 'shop') renderShop();
            if (tabId === 'missions') renderMissions();
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
        // Affichage des Points Prestige
        const ppDisplay = document.getElementById('pp-count') || createPPDisplay();
        ppDisplay.innerText = state.specialPoints || 0;

        UI.pokedexCount.innerText = state.pokedex.length;
        UI.playerLevel.innerText = state.level;
        
        // Courbe d'XP exponentielle pour le long terme
        const xpToNext = Math.floor(Math.pow(state.level, 1.8) * 150);
        const progress = Math.min(100, (state.xp / xpToNext) * 100);
        UI.xpProgress.style.width = `${progress}%`;

        document.getElementById('count-pokeballs').innerText = state.inventory.pokeballs;
        document.getElementById('count-superballs').innerText = state.inventory.superballs;
        document.getElementById('count-hyperballs').innerText = state.inventory.hyperballs;
        
        renderMissions();
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
        // Un check toutes les 30 secondes pour ralentir le rythme
        setInterval(() => {
            if (!currentPokemon) {
                // Taux de spawn de base plus bas
                const baseRate = 0.2; 
                const levelBonus = Math.min(0.2, state.level * 0.005);
                if (Math.random() < (baseRate + levelBonus)) {
                    spawnPokemon();
                }
            }
        }, 30000);
    }

    async function spawnPokemon() {
        UI.spawnArea.innerHTML = '<div class="loader">Un Pokémon approche discrètement...</div>';
        vscode.postMessage({ type: 'updateStatus', active: true });

        try {
            let attempts = 0;
            let data = null;
            let speciesData = null;

            // Tentative de trouver un Pokémon "capturable" (Base ou Sauvage standard)
            while (attempts < 5) {
                const id = Math.floor(Math.random() * 1025) + 1;
                const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
                speciesData = await speciesRes.json();

                // On exclut les Pokémon qui sont des évolutions complexes ou mythiques
                // (On laisse les bébés et les formes de base)
                const isSpecialEvo = speciesData.evolves_from_species !== null; 
                const isLegendary = speciesData.is_legendary || speciesData.is_mythical;

                if (!isSpecialEvo || (attempts > 3)) { // Après 3 essais on est moins strict
                    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
                    data = await response.json();
                    break;
                }
                attempts++;
            }

            // Sprites de haute qualité pour toutes les générations (Gen 1-9)
            const sprite = data.sprites.other['official-artwork'].front_default || 
                           data.sprites.other['home'].front_default ||
                           data.sprites.front_default;

            const isShiny = Math.random() < (1 / 512);
            
            currentPokemon = {
                id: data.id,
                name: data.name,
                sprite: isShiny ? (data.sprites.other['official-artwork'].front_shiny || data.sprites.front_shiny || sprite) : sprite,
                types: data.types.map(t => t.type.name),
                isShiny: isShiny,
                baseExperience: data.base_experience || 50
            };

            renderPokemon();
        } catch (error) {
            UI.spawnArea.innerHTML = '<div class="loader">Zone calme...</div>';
            currentPokemon = null;
            vscode.postMessage({ type: 'updateStatus', active: false });
        }
    }

    function renderPokemon() {
        UI.spawnArea.innerHTML = `
            <div class="pokemon-card ${currentPokemon.isShiny ? 'shiny-glow' : ''}" id="active-pokemon">
                <img src="${currentPokemon.sprite}" class="pokemon-sprite">
                <div class="pokemon-name">
                    ${currentPokemon.isShiny ? '✨ ' : ''}${currentPokemon.name}
                </div>
                <div class="capture-hint">Utilisez vos Balls avec parcimonie...</div>
            </div>
        `;

        document.getElementById('active-pokemon').addEventListener('click', catchPokemon);
    }

    function catchPokemon() {
        if (!currentPokemon) return;
        if (state.inventory[selectedBall] <= 0) {
            vscode.postMessage({ type: 'showInfo', value: "Plus de Balls ! Attendez que vos pièces s'accumulent." });
            return;
        }

        // Taux de capture plus difficiles
        // Les Pokémon avec beaucoup d'XP de base sont plus durs à attraper
        const difficulty = Math.min(0.4, (currentPokemon.baseExperience / 600));
        const ballChances = { 
            pokeballs: 0.3 - difficulty, 
            superballs: 0.5 - difficulty, 
            hyperballs: 0.8 - (difficulty / 2) 
        };
        
        const catchSuccess = Math.random() < Math.max(0.05, ballChances[selectedBall]);

        state.inventory[selectedBall]--;
        const pokemonEl = document.getElementById('active-pokemon');

        if (catchSuccess) {
            pokemonEl.classList.add('catch-anim');
            setTimeout(() => {
                finalizeCapture();
            }, 500);
        } else {
            pokemonEl.classList.add('shake-anim');
            // 20% de chance qu'il s'enfuie après un échec
            if (Math.random() < 0.2) {
                vscode.postMessage({ type: 'showInfo', value: `${currentPokemon.name} s'est enfui dans les hautes herbes !` });
                setTimeout(() => {
                    currentPokemon = null;
                    UI.spawnArea.innerHTML = '<div class="loader">Recherche de Pokémon...</div>';
                    vscode.postMessage({ type: 'updateStatus', active: false });
                    saveState();
                    updateUI();
                }, 500);
            }
        }
    }

    function finalizeCapture() {
        const exists = state.pokedex.find(p => p.id === currentPokemon.id && p.isShiny === currentPokemon.isShiny);
        
        if (!exists) {
            state.pokedex.push({
                ...currentPokemon,
                date: new Date().toLocaleDateString(),
                catchCount: 1
            });
            vscode.postMessage({ type: 'showInfo', value: `Merveilleux ! ${currentPokemon.name} a été ajouté au Pokédex.` });
        } else {
            exists.catchCount = (exists.catchCount || 1) + 1;
            state.coins += 10; // Réduit pour le long terme
            vscode.postMessage({ type: 'showInfo', value: `Vous avez déjà ce Pokémon. Recyclé pour 10 pièces.` });
        }

        // Gains réduits pour forcer la patience
        state.coins += 2;
        state.xp += Math.floor(currentPokemon.baseExperience / 5);
        state.missions.captures++;
        
        checkLevelUp();
        currentPokemon = null;
        UI.spawnArea.innerHTML = '<div class="loader">Recherche de Pokémon...</div>';
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
            state.coins += 50; 
        }
    }

    // Boutique (Prix augmentés)
    const SHOP_ITEMS = [
        { id: 'pokeballs', name: 'Poké Ball', price: 20, icon: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png' },
        { id: 'superballs', name: 'Super Ball', price: 100, icon: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png' },
        { id: 'hyperballs', name: 'Hyper Ball', price: 400, icon: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png' }
    ];

    function renderShop() {
        UI.shopList.innerHTML = '';
        SHOP_ITEMS.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.innerHTML = `
                <img src="${item.icon}">
                <div class="item-info">
                    <span>${item.name}</span>
                    <span class="price">${item.price} <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" class="mini-icon"></span>
                </div>
                <button onclick="buyItem('${item.id}', ${item.price})">Acheter</button>
            `;
            UI.shopList.appendChild(card);
        });
    }

    window.buyItem = (id, price) => {
        if (state.coins >= price) {
            state.coins -= price;
            state.inventory[id]++;
            updateUI();
            saveState();
        } else {
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pièces !" });
        }
    };

    // Pokédex & Évolutions
    function renderPokedex() {
        UI.pokedexList.innerHTML = '';
        const search = UI.pokeSearch.value.toLowerCase();
        
        const filtered = state.pokedex.filter(p => p.name.toLowerCase().includes(search));
        const sorted = filtered.sort((a, b) => a.id - b.id);

        sorted.forEach(p => {
            const item = document.createElement('div');
            item.className = `pokedex-item ${p.isShiny ? 'shiny-border' : ''}`;
            item.innerHTML = `
                <img src="${p.sprite}">
                <span class="p-name">${p.name}</span>
                <span class="p-id">#${p.id}</span>
                <button class="evolve-btn" onclick="tryEvolve(${p.id})">Évoluer</button>
            `;
            UI.pokedexList.appendChild(item);
        });
    }

    UI.pokeSearch.addEventListener('input', renderPokedex);

    window.tryEvolve = async (id) => {
        const p = state.pokedex.find(poke => poke.id === id);
        if (!p) return;

        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
            const data = await response.json();
            const evoResponse = await fetch(data.evolution_chain.url);
            const evoData = await evoResponse.json();

            // Logique simplifiée : trouver le prochain dans la chaine
            const nextEvo = findNextEvolution(evoData.chain, p.name);
            
            if (nextEvo) {
                // Vérifier si on a la pierre nécessaire (déterminée par le type ou milestone)
                const stoneNeeded = getStoneForType(p.types[0]);
                if (state.inventory.stones[stoneNeeded] > 0) {
                    state.inventory.stones[stoneNeeded]--;
                    evolvePokemon(p, nextEvo);
                } else {
                    vscode.postMessage({ type: 'showInfo', value: `Il vous faut une Pierre ${stoneNeeded.toUpperCase()} ! (Missions)` });
                }
            } else {
                vscode.postMessage({ type: 'showInfo', value: `${p.name} est déjà au stade final !` });
            }
        } catch (e) {
            console.error(e);
        }
    };

    function findNextEvolution(chain, currentName) {
        if (chain.species.name === currentName) {
            return chain.evolves_to[0] ? chain.evolves_to[0].species.name : null;
        }
        for (let next of chain.evolves_to) {
            const res = findNextEvolution(next, currentName);
            if (res) return res;
        }
        return null;
    }

    async function evolvePokemon(oldPoke, newName) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${newName}`);
        const data = await response.json();
        
        const index = state.pokedex.findIndex(p => p.id === oldPoke.id);
        state.pokedex[index] = {
            id: data.id,
            name: data.name,
            sprite: oldPoke.isShiny ? data.sprites.front_shiny : data.sprites.front_default,
            types: data.types.map(t => t.type.name),
            isShiny: oldPoke.isShiny,
            date: new Date().toLocaleDateString()
        };
        
        vscode.postMessage({ type: 'showInfo', value: `Quoi ? Votre Pokémon évolue en ${newName} !` });
        state.missions.evolutions++;
        saveState();
        renderPokedex();
        updateUI();
    }

    function getStoneForType(type) {
        const map = { fire: 'feu', water: 'eau', grass: 'plante', electric: 'foudre', ice: 'glace' };
        return map[type] || 'lune';
    }

    // Missions spécifiques par type
    const MISSION_TYPES = [
        { type: 'fire', stone: 'feu', target: 15, label: 'Brasier' },
        { type: 'water', stone: 'eau', target: 15, label: 'Aquatique' },
        { type: 'grass', stone: 'plante', target: 15, label: 'Nature' },
        { type: 'electric', stone: 'foudre', target: 15, label: 'Voltage' },
        { type: 'ice', stone: 'glace', target: 10, label: 'Glacial' },
        { type: 'psychic', stone: 'lune', target: 10, label: 'Psychique' }
    ];

    function renderMissions() {
        const container = document.getElementById('missions-list');
        container.innerHTML = '<h2>Missions de Type</h2>';
        
        if (!state.missions.typeProgress) state.missions.typeProgress = {};

        MISSION_TYPES.forEach(m => {
            const current = state.missions.typeProgress[m.type] || 0;
            const progress = Math.min(100, (current / m.target) * 100);
            
            const card = document.createElement('div');
            card.className = 'mission-card';
            card.innerHTML = `
                <h3>Expert ${m.label}</h3>
                <p>Capturez ${m.target} Pokémon de type ${m.type.toUpperCase()}.</p>
                <div class="progress-bar"><div style="width: ${progress}%"></div></div>
                <div class="reward">Récompense: 1x Pierre ${m.stone.toUpperCase()}</div>
                <button class="claim-btn" ${current >= m.target ? '' : 'disabled'} onclick="claimTypeMission('${m.type}', '${m.stone}', ${m.target})">
                    Réclamer
                </button>
            `;
            container.appendChild(card);
        });
    }

    window.claimTypeMission = (type, stone, target) => {
        if (state.missions.typeProgress[type] >= target) {
            state.missions.typeProgress[type] -= target;
            if (!state.inventory.stones[stone]) state.inventory.stones[stone] = 0;
            state.inventory.stones[stone]++;
            vscode.postMessage({ type: 'showInfo', value: `Obtenu : 1x Pierre ${stone.toUpperCase()} !` });
            saveState();
            updateUI();
        }
    };

    // Mise à jour du progrès dans finalizeCapture
    function finalizeCapture() {
        const exists = state.pokedex.find(p => p.id === currentPokemon.id && p.isShiny === currentPokemon.isShiny);
        
        if (!exists) {
            state.pokedex.push({
                ...currentPokemon,
                date: new Date().toLocaleDateString(),
                catchCount: 1
            });
            vscode.postMessage({ type: 'showInfo', value: `Merveilleux ! ${currentPokemon.name} a été ajouté au Pokédex.` });
        } else {
            exists.catchCount = (exists.catchCount || 1) + 1;
            // Conversion automatique des doublons en Points Prestige (PP)
            if (!state.specialPoints) state.specialPoints = 0;
            state.specialPoints += 1;
            vscode.postMessage({ type: 'showInfo', value: `${currentPokemon.name} est un doublon. +1 Point Prestige !` });
        }

        // Progrès des missions par type
        if (!state.missions.typeProgress) state.missions.typeProgress = {};
        currentPokemon.types.forEach(t => {
            state.missions.typeProgress[t] = (state.missions.typeProgress[t] || 0) + 1;
        });

        state.coins += 2;
        state.xp += Math.floor(currentPokemon.baseExperience / 5);
        state.missions.captures++;
        
        checkLevelUp();
        currentPokemon = null;
        UI.spawnArea.innerHTML = '<div class="loader">Recherche de Pokémon...</div>';
        vscode.postMessage({ type: 'updateStatus', active: false });
        saveState();
        updateUI();
    }
    function saveState() {
        vscode.postMessage({ type: 'saveState', value: state });
    }

})();
