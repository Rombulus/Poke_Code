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
        discovery: {} // ID -> { name, sprite }
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
                    }
                });
            } else {
                state.pokedex = [];
            }

            translateExistingPokedex();
            syncDiscovery();
            updateUI();
            renderShop();
            startGameLoop();
        }
    });

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

            // Gestion de la recherche dans le Pok├®dex
            if (UI.pokeSearch) {
                UI.pokeSearch.addEventListener('input', () => {
                    try {
                        renderPokedex();
                    } catch (err) { }
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
        'sun-stone': 'Pierre Soleil', 'dusk-stone': 'Pierre Nuit', 'shiny-stone': 'Pierre Eclat',
        'dawn-stone': 'Pierre Aube', 'kings-rock': 'Roche Royale', 'metal-coat': 'Peau Metal',
        'protector': 'Protecteur', 'reaper-cloth': 'Tissu Faucheur', 'dragon-scale': 'Ecaille Draco',
        'prism-scale': 'Bel Ecaille', 'razor-claw': 'Griffe Rasoir', 'razor-fang': 'Croc Rasoir',
        'black-augurite': 'Obsidienne', 'linking-cord': 'Cable Link', 'soothe-bell': 'Grelot Zen',
        'upgrade': 'Ameliorateur', 'dubious-disc': 'CD Douteux', 'electirizer': 'Electriseur',
        'magmarizer': 'Magmariseur', 'peat-block': 'Bloc de Tourbe', 'galarica-cuff': 'Bracelet Galarica',
        'galarica-wreath': 'Couronne Galarica', 'sweet-apple': 'Pomme Sucree', 'tart-apple': 'Pomme Acidulee',
        'chipped-pot': 'Theiere Ebrechee', 'cracked-pot': 'Theiere Felee', 'auspicious-armor': 'Armure Auspicieuse',
        'malicious-armor': 'Armure Malveillante', 'scroll-of-darkness': 'Rouleau des Tenebres',
        'scroll-of-waters': 'Rouleau des Eaux', 'gimmighoul-coin': 'Piece de Mordudor'
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
        { id: 'pokeball', name: 'Pok├® Ball', rate: 0.4, price: 20, img: 'poke-ball' },
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

        // Mise ├á jour visuelle si on est sur l'onglet pokedex
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

                // 1. Choisir une vari├®t├® (Normal, Alola, Galar, etc.)
                // On exclut les Megas/Gmax pour l'instant pour garder les ├®volutions classiques
                const validVarieties = speciesData.varieties.filter(v => !v.pokemon.name.includes('-mega') && !v.pokemon.name.includes('-gmax'));
                const variety = validVarieties[Math.floor(Math.random() * validVarieties.length)];
                
                const response = await fetch(variety.pokemon.url);
                data = await response.json();

                // 2. Choisir une forme esth├®tique (Vivaldaim, Meteno, etc.)
                let sprite = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
                let formName = "";

                if (data.forms.length > 1) {
                    const formIndex = Math.floor(Math.random() * data.forms.length);
                    const formRes = await fetch(data.forms[formIndex].url);
                    const formData = await formRes.json();
                    sprite = formData.sprites.front_default; // Les formes n'ont pas toujours d'official-artwork
                    if (formData.form_name) formName = ` (${formData.form_name})`;
                }

                // Logique de raret├®
                const capRate = speciesData.capture_rate;
                let rarity = "Commun";
                let chance = 1;

                if (capRate <= 3) { rarity = "L├®gendaire"; chance = 0.01; }
                else if (capRate <= 45) { rarity = "├ëpique"; chance = 0.1; }
                else if (capRate <= 100) { rarity = "Rare"; chance = 0.3; }
                else if (capRate <= 150) { rarity = "Peu Commun"; chance = 0.6; }

                const minLevelRequired = rarity === "L├®gendaire" ? 50 : (rarity === "├ëpique" ? 20 : 1);

                if (state.level >= minLevelRequired && Math.random() < chance) {
                    found = true;

                    let frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || speciesData.name;
                    
                    // G├®rer le nom des formes r├®gionales
                    if (variety.pokemon.name.includes('-alola')) frenchName += " d'Alola";
                    if (variety.pokemon.name.includes('-galar')) frenchName += " de Galar";
                    if (variety.pokemon.name.includes('-hisui')) frenchName += " de Hisui";
                    if (variety.pokemon.name.includes('-paldea')) frenchName += " de Paldea";

                    currentPokemon = {
                        id: data.id, // ID du Pok├®mon sp├®cifique (ex: Raichu d'Alola)
                        speciesId: speciesData.id,
                        name: frenchName + formName,
                        rarity: rarity,
                        captureRate: capRate,
                        sprite: sprite,
                        types: data.types.map(t => t.type.name),
                        isShiny: Math.random() < (1 / 512),
                        baseExperience: data.base_experience || 50,
                        level: Math.max(1, Math.floor(state.level * 0.8) + Math.floor(Math.random() * 5))
                    };

                    // Ajout aux d├®couvertes en tant que "Rencontr├®"
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
            state.spawnTimer = 10; // R├®essaie vite en cas d'erreur API
            vscode.postMessage({ type: 'updateStatus', active: false });
        }
    }

    function renderPokemon() {
        UI.spawnArea.innerHTML = `
            <div class="pokemon-card ${currentPokemon.isShiny ? 'shiny-glow' : ''}" id="active-pokemon">
                <div class="rarity-tag ${currentPokemon.rarity.toLowerCase()}">${currentPokemon.rarity}</div>
                <img src="${currentPokemon.sprite}" class="pokemon-sprite">
                <div class="pokemon-name">
                    ${currentPokemon.isShiny ? 'Ô£¿ ' : ''}${currentPokemon.name} <span class="lvl">Nv.${currentPokemon.level}</span>
                </div>
                <div class="capture-hint">Cliquez pour capturer !</div>
            </div>
        `;

        document.getElementById('active-pokemon').addEventListener('click', catchPokemon);
    }

    function catchPokemon() {
        if (!currentPokemon) return;
        if ((state.inventory.balls[selectedBall] || 0) <= 0) {
            vscode.postMessage({ type: 'showInfo', value: "Plus de Balls ! Attendez que vos pi├¿ces s'accumulent." });
            return;
        }

        const ball = BALL_TYPES.find(b => b.id === selectedBall);
        
        // --- D├®cr├®mentation imm├®diate ---
        state.inventory.balls[selectedBall]--;
        updateUI();
        saveState();

        // --- Animation de Lancer ---
        const ballImg = document.createElement('img');
        ballImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${ball.img}.png`;
        ballImg.className = 'thrown-ball throw-arc';
        
        // Positionner la ball par rapport au Pok├®mon
        const pokeEl = document.getElementById('active-pokemon');
        const rect = pokeEl.getBoundingClientRect();
        ballImg.style.left = `${rect.left + rect.width / 2 - 15}px`;
        ballImg.style.top = `${rect.top + rect.height / 2 - 15}px`;
        
        document.body.appendChild(ballImg);

        // Retirer la ball et d├®clencher la capture apr├¿s l'animation
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
            // currentPokemon.captureRate varie de 3 (L├®gendaire) ├á 255 (tr├¿s commun)
            let chance = currentPokemon.captureRate / 255.0;
            
            // On ajoute un bonus fixe selon la puissance de la Pok├®ball
            // ball.rate est de 0.4 pour la Pok├®ball standard, donc (0.4 - 0.4) = +0%
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

            // V├®rifier si le joueur est ├á court de TOUTES les balls
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

        // Mise ├á jour de la liste des d├®couvertes (Pok├®dex permanent)
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
        UI.shopList.innerHTML = '';
        BALL_TYPES.forEach(item => {
            const owned = state.inventory.balls[item.id] || 0;
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.img}.png">
                <div class="item-info">
                    <span>${item.name}</span>
                    <span class="owned">Poss├®d├® : ${owned}</span>
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
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pi├¿ces !" });
        }
    };

    window.claimMission = (id, stone) => {
        if (!state.missions.claimed) state.missions.claimed = [];
        state.missions.claimed.push(id);

        // Gains
        state.coins += 50;
        state.inventory.stones[stone] = (state.inventory.stones[stone] || 0) + 1;

        vscode.postMessage({ type: 'showInfo', value: `Mission accomplie ! +50 ­ƒ¬Ö et 1x ${stone.replace('-', ' ')}` });
        saveState();
        updateUI();
    };

    function renderPokedex() {
        if (!UI.pokedexList) return;
        UI.pokedexList.innerHTML = '';
        
        const discoveries = Object.values(state.discovery || {});
        const encounteredCount = discoveries.length;
        const capturedCount = discoveries.filter(d => d.caught).length;

        // Affichage du progr├¿s global
        const statsHeader = document.createElement('div');
        statsHeader.className = 'pokedex-header-stats';
        statsHeader.innerHTML = `
            <div class="stats-row">
                <div class="discovery-count">National : <span>${capturedCount}</span> / 1025</div>
                <div class="current-count">Rencontr├®s : <span>${encounteredCount}</span></div>
            </div>
            <div class="pokedex-mode-toggle">
                <button id="btn-view-collection" class="mini-btn ${UI.pokedexMode === 'national' ? '' : 'active'}">Ma Collection</button>
                <button id="btn-view-national" class="mini-btn ${UI.pokedexMode === 'national' ? 'active' : ''}">Pok├®dex National</button>
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

        // S├®curit├® : s'assurer que pokedex est un tableau
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
            
            // On utilise les icones de la Gen VIII pour le look "PC"
            const iconUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${p.id}.png`;

            item.innerHTML = `
                <div class="tooltip">
                    <span class="tooltip-title">${p.isShiny ? '✨ ' : ''}${p.name}</span>
                    <div class="tooltip-row"><span class="tooltip-label">Nv.</span><span>${p.level}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Rarete</span><span>${p.rarity}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Capture le</span><span>${p.date || 'Inconnue'}</span></div>
                </div>
                <div class="poke-info">
                    <img src="${iconUrl}" onerror="this.src='${p.sprite}'">
                    <span class="p-name">${p.name || 'Inconnu'} ${p.isShiny ? '✨' : ''}</span>
                    <span class="p-lvl">Nv.${p.level || '?'}</span>
                    <div class="p-xp-bar"><div style="width: ${xpProgress}%"></div></div>
                    <div class="evo-timer">${evoInfo}</div>
                </div>
                <div class="poke-actions">
                    <button class="sell-btn" onclick="sellPokemon(${p.instanceId})">Liberer (40$)</button>
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
        if (!p.nextEvoLevel) {
            fetchNextEvoLevel(p);
            return "Analyse...";
        }
        if (p.nextEvoLevel === "MAX") return "Stade Final";
        if (typeof p.nextEvoLevel === "string") return p.nextEvoLevel;
        return p.level >= p.nextEvoLevel ? "├ëvolution pr├¬te !" : `Nv. requis : ${p.nextEvoLevel}`;
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
            state.coins += 40;
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
            // Logique simplifi├® pour cet exemple
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

        // Ajout ├á la d├®couverte permanente
        state.discovery[data.id] = {
            name: frenchName,
            sprite: data.sprites.other['official-artwork'].front_default,
            caught: true
        };

        vscode.postMessage({ type: 'showInfo', value: `├ëvolution en ${frenchName} !` });
        state.missions.evolutions++;
        saveState();
        renderPokedex();
        updateUI();
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
        { id: 'm1', type: 'fire', stone: 'fire-stone', target: 5, label: 'Brasier Ardent I' },
        { id: 'm2', type: 'water', stone: 'water-stone', target: 5, label: 'Source Oceane I' },
        { id: 'm3', type: 'grass', stone: 'leaf-stone', target: 5, label: 'Floraison Sylvestre I' },
        { id: 'm4', type: 'electric', stone: 'thunder-stone', target: 5, label: 'Eclair Volt' },
        { id: 'm5', type: 'ice', stone: 'ice-stone', target: 5, label: 'Givre Eternel' },
        { id: 'm6', type: 'normal', stone: 'moon-stone', target: 10, label: 'Force Tranquille' },
        { id: 'm7', type: 'psychic', stone: 'sun-stone', target: 10, label: 'Esprit Superieur' },
        { id: 'm8', type: 'poison', stone: 'dusk-stone', target: 10, label: 'Venin Mortel' },
        { id: 'm9', type: 'fairy', stone: 'shiny-stone', target: 10, label: 'Eclat Feerique' },
        { id: 'm10', type: 'fighting', stone: 'kings-rock', target: 10, label: 'Aura de Combat' },
        { id: 'm11', type: 'steel', stone: 'metal-coat', target: 5, label: 'Blindage Metal' },
        { id: 'm12', type: 'rock', stone: 'protector', target: 8, label: 'Coeur de Roche' },
        { id: 'm13', type: 'ground', stone: 'razor-fang', target: 8, label: 'Terres Arides' },
        { id: 'm14', type: 'bug', stone: 'razor-claw', target: 8, label: 'Essaim Vorace' },
        { id: 'm15', type: 'dragon', stone: 'dragon-scale', target: 5, label: 'Souffle du Dragon' },
        { id: 'm16', type: 'ghost', stone: 'reaper-cloth', target: 5, label: 'Hantise Spectrale' },
        { id: 'm17', type: 'flying', stone: 'prism-scale', target: 8, label: 'Ciel Azur' },
        { id: 'm18', type: 'dark', stone: 'black-augurite', target: 5, label: 'Ombre Obscure' }
    ];

    function renderMissions() {
        const container = document.getElementById('missions-list');
        container.innerHTML = '<h2>Missions d\'Entraineur</h2>';

        if (!state.missions.typeProgress) state.missions.typeProgress = {};
        if (!state.missions.claimed) state.missions.claimed = [];

        const typeMissions = {};
        MISSIONS.forEach(m => {
            if (!typeMissions[m.type]) typeMissions[m.type] = [];
            typeMissions[m.type].push(m);
        });

        const typeTranslations = { fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Electrique', ice: 'Glace', normal: 'Normal', psychic: 'Psy', poison: 'Poison', fairy: 'Fee', fighting: 'Combat', steel: 'Acier', rock: 'Roche', dark: 'Tenebres', dragon: 'Dragon', ghost: 'Spectre', ground: 'Sol', bug: 'Insecte', flying: 'Vol' };
        const stoneTranslations = { 'fire-stone': 'Pierre Feu', 'water-stone': 'Pierre Eau', 'leaf-stone': 'Pierre Plante', 'thunder-stone': 'Pierre Foudre', 'ice-stone': 'Pierre Glace', 'moon-stone': 'Pierre Lune', 'sun-stone': 'Pierre Soleil', 'dusk-stone': 'Pierre Nuit', 'shiny-stone': 'Pierre Eclat', 'dawn-stone': 'Pierre Aube', 'kings-rock': 'Roche Royale', 'metal-coat': 'Peau Metal', 'protector': 'Protecteur', 'reaper-cloth': 'Tissu Faucheur', 'dragon-scale': 'Ecaille Draco', 'prism-scale': "Bel'Ecaille", 'razor-claw': 'Griffe Rasoir', 'razor-fang': 'Croc Rasoir', 'black-augurite': 'Obsidienne' };

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
                    <p>Capturer des Pokemon de type ${typeFr} : ${current}/${nextMission.target}</p>
                    <div class="progress-bar"><div style="width: ${progress}%"></div></div>
                    <div class="reward">Cadeau: ${stoneFr}</div>
                    <button class="claim-btn" ${current >= nextMission.target ? '' : 'disabled'} onclick="claimMission('${nextMission.id}', '${nextMission.stone}', ${nextMission.target})">
                        Reclamer
                    </button>
                `;
                container.appendChild(card);
            }
        });
    }

    function saveState() {
        state.lastUpdate = Date.now();
        vscode.postMessage({ type: 'saveState', value: state });
    }

})();