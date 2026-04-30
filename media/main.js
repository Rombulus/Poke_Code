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
        spriteCache: {} // ItemName -> SpriteURL
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
    
    const stoneTranslations = { 
        'fire-stone': 'Pierre Feu', 'water-stone': 'Pierre Eau', 'leaf-stone': 'Pierre Plante', 
        'thunder-stone': 'Pierre Foudre', 'ice-stone': 'Pierre Glace', 'moon-stone': 'Pierre Lune', 
        'sun-stone': 'Pierre Soleil', 'dusk-stone': 'Pierre Nuit', 'shiny-stone': 'Pierre Éclat', 
        'dawn-stone': 'Pierre Aube', 'kings-rock': 'Roche Royale', 'metal-coat': 'Peau Métal', 
        'protector': 'Protecteur', 'reaper-cloth': 'Tissu Faucheur', 'dragon-scale': 'Écaille Draco', 
        'prism-scale': "Bel'Écaille", 'razor-claw': 'Griffe Rasoir', 'razor-fang': 'Croc Rasoir', 
        'black-augurite': 'Obsidienne', 'linking-cord': 'Câble Link', 'soothe-bell': 'Grelot Zen',
        'upgrade': 'Améliorateur', 'dubious-disc': 'CD Douteux', 'electirizer': 'Électriseur',
        'magmarizer': 'Magmariseur', 'peat-block': 'Bloc de Tourbe', 'galarica-cuff': 'Bracelet Galarica',
        'galarica-wreath': 'Couronne Galarica', 'sweet-apple': 'Pomme Sucrée', 'tart-apple': 'Pomme Acidulée',
        'chipped-pot': 'Théière Ébréchée', 'cracked-pot': 'Théière Fêlée', 'auspicious-armor': 'Armure Auspicieuse',
        'malicious-armor': 'Armure Malveillante', 'scroll-of-darkness': 'Rouleau des Ténèbres',
        'scroll-of-waters': 'Rouleau des Eaux', 'gimmighoul-coin': 'Pièce de Mordudor'
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

            // Migrations de données
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
                    state.discovery[id] = { name: "Pokémon Découvert", sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` };
                });
            }

            // Migration : Ajouter des IDs et Niveaux aux Pokémon qui n'en ont pas
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
        
        // S'assurer que tout ce qui est dans le pokedex (collection) est marqué comme capturé
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

            // Gestion de la recherche dans le Pokédex
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
                        vscode.postMessage({ type: 'showInfo', value: "DEBUG: +2000 pièces ajoutées !" });
                        updateUI();
                        saveState();
                    }
                };
            }
        } catch (err) {
            console.error("updateUI error:", err);
        }
        updateTimeCycle();
    }

    function updateTimeCycle() {
        const hour = new Date().getHours();
        const body = document.body;
        body.classList.remove('day', 'night', 'sunset');
        
        if (hour >= 6 && hour < 17) {
            body.classList.add('day');
            state.timeOfDay = 'day';
        } else if (hour >= 17 && hour < 19) {
            body.classList.add('sunset');
            state.timeOfDay = 'day'; // Sunset counts as day for some evos
        } else {
            body.classList.add('night');
            state.timeOfDay = 'night';
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
        UI.itemSlots.forEach(slot => {
            const ball = slot.dataset.ball;
            const count = state.inventory.balls[ball] || 0;
            slot.querySelector('span').innerText = count;
            slot.classList.toggle('active', selectedBall === ball);
            
            // Fix contrast and visibility
            const img = slot.querySelector('img');
            if (img) {
                img.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
            }
        });
    }

    function renderStoneInventory() {
        const container = document.getElementById('stone-inventory');
        container.innerHTML = '';
        Object.entries(state.inventory.stones).forEach(([stone, count]) => {
            if (count > 0) {
                const slot = document.createElement('div');
                slot.className = 'item-slot';
                slot.title = stoneTranslations[stone] || stone;
                slot.innerHTML = `
                    <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${stone}.png" 
                         onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystery-egg.png'">
                    <span>${count}</span>
                `;
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
            
            updateTimeCycle();

            // 2. XP Passive et Argent Passif
            if (new Date().getSeconds() % 3 === 0) {
                gainPassiveXP();
            }
            // Argent passif toutes les minutes
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

                if (state.level >= minLevelRequired && Math.random() < chance) {
                    found = true;

                    let frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || speciesData.name;
                    
                    // Gérer le nom des formes régionales
                    if (variety.pokemon.name.includes('-alola')) frenchName += " d'Alola";
                    if (variety.pokemon.name.includes('-galar')) frenchName += " de Galar";
                    if (variety.pokemon.name.includes('-hisui')) frenchName += " de Hisui";
                    if (variety.pokemon.name.includes('-paldea')) frenchName += " de Paldea";

                    currentPokemon = {
                        id: data.id, // ID du Pokémon spécifique (ex: Raichu d'Alola)
                        speciesId: speciesData.id,
                        name: frenchName + formName,
                        rarity: rarity,
                        captureRate: capRate,
                        sprite: sprite,
                        types: data.types.map(t => t.type.name),
                        isShiny: Math.random() < (1 / 512),
                        gender: Math.random() < 0.5 ? 1 : 2, // 1: female, 2: male
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
                        // ou alors on le fait si on veut que ça s'affiche direct
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
        const newPoke = {
            ...currentPokemon,
            instanceId: Date.now() + Math.random(),
            xp: 0,
            date: new Date().toLocaleDateString()
        };

        state.pokedex.push(newPoke);
        state.coins += 5; // Gain de capture
        state.xp += Math.floor(currentPokemon.baseExperience / 5);
        state.missions.captures++;

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
            renderShop();
            saveState();
        } else {
            vscode.postMessage({ type: 'showInfo', value: "Pas assez de pièces !" });
        }
    };

    window.claimMission = (id, rewardType, rewardId, rewardQty) => {
        if (!state.missions.claimed) state.missions.claimed = [];
        state.missions.claimed.push(id);

        // Gains
        if (rewardType === 'coins') {
            state.coins += rewardQty;
            vscode.postMessage({ type: 'showInfo', value: `Mission accomplie ! +${rewardQty} 🪙` });
        } else if (rewardType === 'stone') {
            state.inventory.stones[rewardId] = (state.inventory.stones[rewardId] || 0) + rewardQty;
            const name = stoneTranslations[rewardId] || rewardId.replace('-', ' ');
            vscode.postMessage({ type: 'showInfo', value: `Mission accomplie ! +${rewardQty}x ${name}` });
        }

        saveState();
        updateUI();
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
                    <div class="tooltip-row"><span class="tooltip-label">Rareté</span><span>${p.rarity}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">Capturé le</span><span>${p.date || 'Inconnue'}</span></div>
                </div>
                <div class="poke-info">
                    <img src="${iconUrl}" onerror="this.src='${p.sprite}'">
                    <span class="p-name">${p.name || 'Inconnu'} ${p.isShiny ? '✨' : ''}</span>
                    <span class="p-lvl">Nv.${p.level || '?'}</span>
                    <div class="p-xp-bar"><div style="width: ${xpProgress}%"></div></div>
                    <div class="evo-timer">${evoInfo}</div>
                </div>
                <div class="poke-actions">
                    ${(p.evolutions || []).map(evo => {
                        if (evo.item) {
                            return `<button class="evo-btn" onclick="tryEvolve(${p.instanceId}, '${evo.species}')">Évoluer (${stoneTranslations[evo.item] || evo.item})</button>`;
                        }
                        return '';
                    }).join('')}
                    <button class="sell-btn" onclick="sellPokemon(${p.instanceId})">Libérer (40$)</button>
                </div>
            `;
            UI.pokedexList.appendChild(item);
        });
    }

    function renderBallInventory() {
        const container = document.getElementById('ball-inventory');
        if (!container) return;
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

    async function getItemSprite(name) {
        if (state.spriteCache && state.spriteCache[name]) return state.spriteCache[name];
        
        // Liste de corrections pour les noms d'objets problématiques dans les sprites GitHub
        const corrections = {
            'linking-cord': 'link-cable',
            'chipped-pot': 'chipped-pot',
            'cracked-pot': 'cracked-pot',
            'sweet-apple': 'sweet-apple',
            'tart-apple': 'tart-apple',
            'auspicious-armor': 'auspicious-armor',
            'malicious-armor': 'malicious-armor',
            'gimmighoul-coin': 'gimmighoul-coin'
        };

        const spriteName = corrections[name] || name;
        const directUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${spriteName}.png`;
        
        try {
            // Pour les objets récents, on essaie de demander à l'API le sprite "officiel"
            if (['sweet-apple', 'tart-apple', 'auspicious-armor', 'malicious-armor', 'gimmighoul-coin', 'scroll-of-darkness', 'scroll-of-waters'].includes(name)) {
                const res = await fetch(`https://pokeapi.co/api/v2/item/${name}`);
                if (res.ok) {
                    const data = await res.json();
                    const sprite = data.sprites.default;
                    if (sprite) {
                        if (!state.spriteCache) state.spriteCache = {};
                        state.spriteCache[name] = sprite;
                        return sprite;
                    }
                }
            }
        } catch (e) {}
        
        return directUrl;
    }

    async function renderStoneInventory() {
        const container = document.getElementById('stone-inventory');
        if (!container) return;
        container.innerHTML = '';
        
        const entries = Object.entries(state.inventory.stones);
        for (const [stone, count] of entries) {
            if (count > 0) {
                const slot = document.createElement('div');
                slot.className = 'item-slot';
                slot.title = stoneTranslations[stone] || stone;
                
                const spriteUrl = await getItemSprite(stone);
                
                slot.innerHTML = `
                    <img src="${spriteUrl}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystery-egg.png'">
                    <span>${count}</span>
                `;
                container.appendChild(slot);
            }
        }
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
        if (!p.evolutions) {
            fetchNextEvoLevel(p);
            return "Analyse...";
        }
        if (p.evolutions.length === 0) return "Stade Final";
        
        const next = p.evolutions[0];
        if (next.item) return `Objet requis`;
        if (typeof next.level === "number") {
            return p.level >= next.level ? "Évolution prête !" : `Nv. requis : ${next.level}`;
        }
        return "Prêt !";
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
            
            p.evolutions = [];
            if (evoDetails && evoDetails.length > 0) {
                evoDetails.forEach(detail => {
                    const trigger = detail.trigger.name;
                    let evo = { species: detail.species_name, trigger: trigger };
                    
                    if (trigger === "level-up") {
                        evo.level = detail.min_level || (p.level + 1);
                        if (detail.min_happiness || detail.min_affection || detail.min_beauty) evo.item = 'soothe-bell';
                        if (detail.held_item) evo.item = detail.held_item.name;
                        if (detail.time_of_day) evo.time = detail.time_of_day;
                        if (detail.gender) evo.gender = detail.gender; // 1: female, 2: male
                        if (detail.known_move || detail.location) evo.level = Math.max(evo.level, p.level + 2);
                    } else if (trigger === "use-item") {
                        evo.item = detail.item.name;
                    } else if (trigger === "trade") {
                        evo.item = detail.held_item ? detail.held_item.name : 'linking-cord';
                    }
                    p.evolutions.push(evo);
                });
            }
            renderPokedex();
        } catch (e) { 
            console.error("Evo fetch error:", e);
        }
        p.fetchingEvo = false;
    }

    window.sellPokemon = (instanceId) => {
        const index = state.pokedex.findIndex(p => p.instanceId === instanceId);
        if (index > -1) {
            state.coins += 40; // Prix de vente
            if (!state.released) state.released = [];
            state.released.push(instanceId);
            state.pokedex.splice(index, 1);
            
            // Tracking mission
            state.missions.released = (state.missions.released || 0) + 1;
            
            saveState();
            updateUI();
            renderPokedex();
        }
    };

    async function checkAutoEvolution(pokemon) {
        try {
            if (!pokemon.evolutions) return;
            
            for (let evo of pokemon.evolutions) {
                if (evo.trigger === "level-up" && !evo.item) {
                    let conditionsMet = pokemon.level >= evo.level;
                    
                    if (evo.time) {
                        conditionsMet = conditionsMet && (state.timeOfDay === evo.time);
                    }
                    if (evo.gender) {
                        conditionsMet = conditionsMet && (pokemon.gender === evo.gender);
                    }
                    
                    if (conditionsMet) {
                        evolvePokemon(pokemon, evo.species);
                        break;
                    }
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

    window.tryEvolve = async (instanceId, targetSpecies) => {
        const p = state.pokedex.find(poke => poke.instanceId === instanceId);
        if (!p) return;

        const evo = p.evolutions.find(e => e.species === targetSpecies);
        if (!evo || !evo.item) return;

        const itemNeeded = evo.item;
        
        if (state.inventory.stones[itemNeeded] > 0) {
            state.inventory.stones[itemNeeded]--;
            const itemName = stoneTranslations[itemNeeded] || itemNeeded.replace('-', ' ');
            vscode.postMessage({ type: 'showInfo', value: `Évolution en ${targetSpecies.toUpperCase()} avec ${itemName}...` });
            evolvePokemon(p, targetSpecies);
        } else {
            const translatedItem = stoneTranslations[itemNeeded] || itemNeeded.replace('-', ' ');
            vscode.postMessage({ type: 'showInfo', value: `Il vous manque : 1x ${translatedItem.toUpperCase()}` });
        }
    };

    async function fetchNextEvolution(id) {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
        const data = await res.json();
        const englishName = data.name;
        const chainRes = await fetch(data.evolution_chain.url);
        const chainData = await chainRes.json();
        const evo = findNextEvolution(chainData.chain, englishName);
        return evo;
    }

    function findNextEvolution(chain, currentName) {
        if (chain.species.name === currentName) {
            // Si plusieurs évolutions (ex: Évoli), on en prend une au hasard ou la première
            if (chain.evolves_to.length > 0) {
                const choice = Math.floor(Math.random() * chain.evolves_to.length);
                return chain.evolves_to[choice].species.name;
            }
            return null;
        }
        for (let next of chain.evolves_to) {
            const res = findNextEvolution(next, currentName);
            if (res) return res;
        }
        return null;
    }

    async function evolvePokemon(oldPoke, newName) {
        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${newName}`);
            const data = await response.json();
            const speciesRes = await fetch(data.species.url);
            const speciesData = await speciesRes.json();
            const frenchName = speciesData.names.find(n => n.language.name === 'fr')?.name || data.name;

            const index = state.pokedex.findIndex(p => p.instanceId === oldPoke.instanceId);
            if (index === -1) return;

            // On réinitialise les infos d'évolution pour le nouveau stade
            state.pokedex[index] = { 
                ...oldPoke, 
                id: data.id, 
                name: frenchName, 
                sprite: data.sprites.other['official-artwork'].front_default,
                types: data.types.map(t => t.type.name),
                evolutions: null
            };

            // Ajout à la découverte permanente
            state.discovery[data.id] = {
                name: frenchName,
                sprite: data.sprites.other['official-artwork'].front_default,
                caught: true
            };

            vscode.postMessage({ type: 'evoNotify', value: frenchName });
            state.missions.evolutions++;
            saveState();
            renderPokedex();
            updateUI();
        } catch (e) {
            console.error("Evolution apply error:", e);
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
        // Type Missions
        { id: 'm1', type: 'capture-type', subType: 'fire', rewardType: 'stone', rewardId: 'fire-stone', target: 10, label: 'Brasier Ardent' },
        { id: 'm2', type: 'capture-type', subType: 'water', rewardType: 'stone', rewardId: 'water-stone', target: 10, label: 'Source Océane' },
        { id: 'm3', type: 'capture-type', subType: 'grass', rewardType: 'stone', rewardId: 'leaf-stone', target: 10, label: 'Floraison Sylvestre' },
        { id: 'm4', type: 'capture-type', subType: 'electric', rewardType: 'stone', rewardId: 'thunder-stone', target: 10, label: 'Éclair Volt' },
        { id: 'm5', type: 'capture-type', subType: 'ice', rewardType: 'stone', rewardId: 'ice-stone', target: 10, label: 'Givre Éternel' },
        { id: 'm6', type: 'capture-type', subType: 'normal', rewardType: 'stone', rewardId: 'moon-stone', target: 15, label: 'Force Tranquille' },
        { id: 'm7', type: 'capture-type', subType: 'psychic', rewardType: 'stone', rewardId: 'sun-stone', target: 15, label: 'Esprit Supérieur' },
        { id: 'm8', type: 'capture-type', subType: 'poison', rewardType: 'stone', rewardId: 'dusk-stone', target: 15, label: 'Venin Mortel' },
        { id: 'm9', type: 'capture-type', subType: 'fairy', rewardType: 'stone', rewardId: 'shiny-stone', target: 15, label: 'Éclat Féerique' },
        { id: 'm10', type: 'capture-type', subType: 'fighting', rewardType: 'stone', rewardId: 'kings-rock', target: 15, label: 'Aura de Combat' },
        { id: 'm11', type: 'capture-type', subType: 'steel', rewardType: 'stone', rewardId: 'metal-coat', target: 10, label: 'Blindage Métal' },
        { id: 'm12', type: 'capture-type', subType: 'rock', rewardType: 'stone', rewardId: 'protector', target: 12, label: 'Cœur de Roche' },
        { id: 'm13', type: 'capture-type', subType: 'ground', rewardType: 'stone', rewardId: 'razor-fang', target: 12, label: 'Terres Arides' },
        { id: 'm14', type: 'capture-type', subType: 'bug', rewardType: 'stone', rewardId: 'razor-claw', target: 12, label: 'Essaim Vorace' },
        { id: 'm15', type: 'capture-type', subType: 'dragon', rewardType: 'stone', rewardId: 'dragon-scale', target: 8, label: 'Souffle du Dragon' },
        { id: 'm16', type: 'capture-type', subType: 'ghost', rewardType: 'stone', rewardId: 'reaper-cloth', target: 8, label: 'Hantise Spectrale' },
        { id: 'm17', type: 'capture-type', subType: 'flying', rewardType: 'stone', rewardId: 'prism-scale', target: 12, label: 'Ciel Azur' },
        { id: 'm18', type: 'capture-type', subType: 'dark', rewardType: 'stone', rewardId: 'black-augurite', target: 10, label: 'Ombre Obscure' },
        
        // Diverse Missions
        { id: 'm19', type: 'evolutions', rewardType: 'stone', rewardId: 'link-cable', target: 5, label: 'Le Maître de la Mutation' },
        { id: 'm20', type: 'player-level', rewardType: 'stone', rewardId: 'soothe-bell', target: 5, label: 'Ascension' },
        { id: 'm21', type: 'discovery', rewardType: 'stone', rewardId: 'upgrade', target: 20, label: 'Explorateur Débutant' },
        { id: 'm22', type: 'coins-earned', rewardType: 'stone', rewardId: 'dawn-stone', target: 1000, label: 'Fortune en Marche' },
        { id: 'm23', type: 'total-captures', rewardType: 'stone', rewardId: 'electirizer', target: 50, label: 'Grand Chasseur' },
        { id: 'm24', type: 'evolutions', rewardType: 'stone', rewardId: 'magmarizer', target: 15, label: 'Généticien Pokémon' },
        { id: 'm25', type: 'discovery', rewardType: 'stone', rewardId: 'dubious-disc', target: 50, label: 'Naturaliste chevronné' },
        { id: 'm26', type: 'release', rewardType: 'coins', rewardQty: 500, target: 10, label: 'Liberté !' },
        
        // Gen 8/9 Items Missions
        { id: 'm27', type: 'discovery', rewardType: 'stone', rewardId: 'sweet-apple', target: 60, label: 'Verger Sucré' },
        { id: 'm28', type: 'discovery', rewardType: 'stone', rewardId: 'tart-apple', target: 70, label: 'Verger Acidulé' },
        { id: 'm29', type: 'evolutions', rewardType: 'stone', rewardId: 'chipped-pot', target: 20, label: 'Heure du Thé Antique' },
        { id: 'm30', type: 'evolutions', rewardType: 'stone', rewardId: 'cracked-pot', target: 25, label: 'Heure du Thé Fragile' },
        { id: 'm31', type: 'total-captures', rewardType: 'stone', rewardId: 'auspicious-armor', target: 100, label: 'Armure d\'Éclat' },
        { id: 'm32', type: 'total-captures', rewardType: 'stone', rewardId: 'malicious-armor', target: 120, label: 'Armure d\'Ombre' },
        { id: 'm33', type: 'discovery', rewardType: 'stone', rewardId: 'scroll-of-darkness', target: 150, label: 'Manuscrit Interdit' },
        { id: 'm34', type: 'discovery', rewardType: 'stone', rewardId: 'scroll-of-waters', target: 180, label: 'Manuscrit de l\'Onde' },
        { id: 'm35', type: 'coins-earned', rewardType: 'stone', rewardId: 'gimmighoul-coin', target: 5000, label: 'Collectionneur Avare' }
    ];

    function renderMissions() {
        const container = document.getElementById('missions-list');
        container.innerHTML = '<h2>Missions d\'Entraîneur</h2>';

        if (!state.missions.typeProgress) state.missions.typeProgress = {};
        if (!state.missions.claimed) state.missions.claimed = [];
        if (state.missions.released === undefined) state.missions.released = 0;

        MISSIONS.forEach(mission => {
            if (state.missions.claimed.includes(mission.id)) return;

            let current = 0;
            let description = "";

            switch (mission.type) {
                case 'capture-type':
                    current = state.missions.typeProgress[mission.subType] || 0;
                    const typeFr = { fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Électrik', ice: 'Glace', normal: 'Normal', psychic: 'Psy', poison: 'Poison', fairy: 'Fée', fighting: 'Combat', steel: 'Acier', rock: 'Roche', dark: 'Ténèbres', dragon: 'Dragon', ghost: 'Spectre', ground: 'Sol', bug: 'Insecte', flying: 'Vol' }[mission.subType] || mission.subType;
                    description = `Capturer des Pokémon de type ${typeFr}`;
                    break;
                case 'evolutions':
                    current = state.missions.evolutions || 0;
                    description = `Faire évoluer des Pokémon`;
                    break;
                case 'player-level':
                    current = state.level || 1;
                    description = `Atteindre le niveau de joueur`;
                    break;
                case 'discovery':
                    current = Object.keys(state.discovery || {}).length;
                    description = `Découvrir de nouvelles espèces`;
                    break;
                case 'coins-earned':
                    current = state.coins || 0; // On simplifie avec le solde actuel
                    description = `Accumuler des pièces`;
                    break;
                case 'total-captures':
                    current = state.missions.captures || 0;
                    description = `Capturer des Pokémon au total`;
                    break;
                case 'release':
                    current = state.missions.released || 0;
                    description = `Libérer des Pokémon`;
                    break;
            }

            const progress = Math.min(100, (current / mission.target) * 100);
            const rewardName = mission.rewardType === 'coins' ? `${mission.rewardQty} 🪙` : (stoneTranslations[mission.rewardId] || mission.rewardId);

            const card = document.createElement('div');
            card.className = `mission-card`;
            card.innerHTML = `
                <h3>${mission.label}</h3>
                <p>${description} : ${current}/${mission.target}</p>
                <div class="progress-bar"><div style="width: ${progress}%"></div></div>
                <div class="reward">Cadeau: ${rewardName}</div>
                <button class="claim-btn" ${current >= mission.target ? '' : 'disabled'} 
                    onclick="claimMission('${mission.id}', '${mission.rewardType}', '${mission.rewardId}', ${mission.rewardQty || 1})">
                    Réclamer
                </button>
            `;
            container.appendChild(card);
        });
    }

    function saveState() {
        state.lastUpdate = Date.now();
        vscode.postMessage({ type: 'saveState', value: state });
    }

})();
