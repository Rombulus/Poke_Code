/* Permanent, activity-based challenges. No wall-clock or waiting objectives. */
(() => {
    'use strict';
    const E = window.POKEIDLE_EVOLUTIONS;
    /* POKEIDLE_ITEMS_START */
    const items = [
    {
        "id": "linking-cord",
        "name": "Câble Link",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "fire-stone",
        "name": "Pierre Feu",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "water-stone",
        "name": "Pierre Eau",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "thunder-stone",
        "name": "Pierre Foudre",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "leaf-stone",
        "name": "Pierre Plante",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "moon-stone",
        "name": "Pierre Lune",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "sun-stone",
        "name": "Pierre Soleil",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "ice-stone",
        "name": "Pierre Glace",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "dusk-stone",
        "name": "Pierre Nuit",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "shiny-stone",
        "name": "Pierre Éclat",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "dawn-stone",
        "name": "Pierre Aube",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "oval-stone",
        "name": "Pierre Ovale",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "metal-coat",
        "name": "Peau Métal",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "kings-rock",
        "name": "Roche Royale",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "dragon-scale",
        "name": "Écaille Draco",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "upgrade",
        "name": "Améliorator",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "dubious-disc",
        "name": "CD Douteux",
        "price": 2000,
        "packSize": 1
    },
    {
        "id": "protector",
        "name": "Protecteur",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "reaper-cloth",
        "name": "Tissu Fauche",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "electirizer",
        "name": "Électriseur",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "magmarizer",
        "name": "Magmariseur",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "razor-claw",
        "name": "Griffe Rasoir",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "razor-fang",
        "name": "Croc Rasoir",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "sweet-apple",
        "name": "Pomme Sucrée",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "tart-apple",
        "name": "Pomme Acide",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "syrupy-apple",
        "name": "Pomme Nectar",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "cracked-pot",
        "name": "Théière Fêlée",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "chipped-pot",
        "name": "Théière Ébréchée",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "malicious-armor",
        "name": "Armure Rancune",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "auspicious-armor",
        "name": "Armure Fortune",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "black-augurite",
        "name": "Obsidienne",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "peat-block",
        "name": "Bloc de Tourbe",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "galarica-cuff",
        "name": "Bracelet Galanoa",
        "price": 1000,
        "packSize": 1
    },
    {
        "id": "galarica-wreath",
        "name": "Couronne Galanoa",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "unremarkable-teacup",
        "name": "Bol Médiocre",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "masterpiece-teacup",
        "name": "Bol Exceptionnel",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "metal-alloy",
        "name": "Métal Composite",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "sachet",
        "name": "Sachet Senteur",
        "price": 1000,
        "packSize": 1
    },
    {
        "id": "whipped-dream",
        "name": "Chantibonbon",
        "price": 1000,
        "packSize": 1
    },
    {
        "id": "deep-sea-tooth",
        "name": "Dent Océan",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "deep-sea-scale",
        "name": "Écaille Océan",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "leaders-crest",
        "name": "Emblème du Général",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "strawberry-sweet",
        "name": "Objet en Sucre",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "gimmighoul-coin",
        "name": "Pièce Mordudor",
        "price": 2,
        "packSize": 50
    },
    {
        "id": "alora-sand",
        "name": "Sable d'Alola",
        "price": 1000,
        "packSize": 1
    },
    {
        "id": "rock-peak",
        "name": "Éclat de Roche",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "galar-vapor",
        "name": "Vapeur de Galar",
        "price": 1000,
        "packSize": 1
    },
    {
        "id": "ancient-manuscript",
        "name": "Manuscrit Ancien",
        "price": 500,
        "packSize": 1
    },
    {
        "id": "cable-croise",
        "name": "Câble Croisé",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "masque-maudit",
        "name": "Masque Maudit",
        "price": 1500,
        "packSize": 1
    },
    {
        "id": "carte-de-voyage",
        "name": "Carte de Voyage",
        "price": 800,
        "packSize": 1
    },
    {
        "id": "pokego-candy",
        "name": "Bonbon Pokémon GO",
        "price": 5,
        "packSize": 25
    },
    {
        "id": "scroll-of-darkness",
        "name": "Manuscrit des Ténèbres",
        "price": 2000,
        "packSize": 1
    },
    {
        "id": "scroll-of-waters",
        "name": "Manuscrit des Eaux",
        "price": 2000,
        "packSize": 1
    },
    {
        "id": "prism-scale",
        "name": "Bel’Écaille",
        "price": 1500,
        "packSize": 1
    }
];
    /* POKEIDLE_ITEMS_END */
    /* POKEIDLE_LEGACY_START */
    const legacyRewards = {
    "m_fire": "fire-stone",
    "m_water": "water-stone",
    "m_bolt": "thunder-stone",
    "m_leaf": "leaf-stone",
    "m_ice": "ice-stone",
    "m_moon": "moon-stone",
    "m_sun": "sun-stone",
    "m_shiny": "shiny-stone",
    "m_dusk": "dusk-stone",
    "m_dawn": "dawn-stone",
    "m_link": "linking-cord",
    "m_apple_sell": "sweet-apple",
    "m_tea_sell": "cracked-pot",
    "m_galanoa_tox": "galarica-cuff",
    "m_traveler": "auspicious-armor",
    "m_ursaring": "peat-block",
    "m_geo": "black-augurite",
    "m_steel_mast": "metal-alloy",
    "m_metal": "metal-coat",
    "m_king": "kings-rock",
    "m_draco_1": "dragon-scale",
    "m_draco_2": "dragon-scale",
    "m_draco_3": "dragon-scale",
    "m_apple_1": "sweet-apple",
    "m_draco": "dragon-scale",
    "m_session": "upgrade",
    "m_balls_bought": "protector",
    "m_levels": "electirizer",
    "m_reaper": "reaper-cloth",
    "m_water_50": "prism-scale",
    "m_fairy_15": "sachet",
    "m_ascetisme": "deep-sea-tooth",
    "m_click_999": "gimmighoul-coin",
    "m_frenzy": "strawberry-sweet",
    "m_kubfu": "ancient-manuscript",
    "m_safari": "pokego-candy",
    "m_galanoa_cuff": "galarica-cuff",
    "m_galanoa_wreath": "galarica-wreath",
    "m_pom_alloy": "syrupy-apple",
    "m_no_catch_2h": "tart-apple",
    "m_coins_50k": "chipped-pot",
    "m_memory_past": "ancient-manuscript",
    "m_mag_pole": "boussole-magnetique",
    "m_time_erosion": "rock-peak",
    "m_armor_duel": "cable-croise",
    "m_endurance": "masque-maudit",
    "m_empty_shell": "sweet-apple",
    "m_explorer": "carte-de-voyage"
};
    /* POKEIDLE_LEGACY_END */
    const itemMap = new Map(items.map(item => [item.id, item]));
    const oldMissionItems = new Set(Object.values(legacyRewards));
    const goal = (metric, target, label) => ({ metric, target, label });
    const unique = n => goal('unique', n, 'Espèces différentes obtenues');
    const types = n => goal('types', n, 'Types représentés dans le carnet');
    const evos = n => goal('evolutions', n, 'Évolutions réalisées');
    const evolved = n => goal('evolvedSpecies', n, 'Espèces obtenues par évolution');
    const variants = n => goal('variantSpecies', n, 'Espèces dont 2 variantes ont été obtenues');
    const regional = n => goal('regionalSpecies', n, 'Espèces régionales obtenues');
    const balls = n => goal('ballDiversity', n, 'Sortes de Poké Balls ayant réussi une capture');
    const trained = n => goal('trainedSpecies', n, 'Espèces élevées au niveau 8');
    const capType = (type, n, label) => goal('captureType:' + type, n, `Pokémon ${label} capturés`);
    const speciesType = (type, n, label) => goal('speciesType:' + type, n, `Espèces ${label} différentes obtenues`);
    const compatible = id => goal('compatible:' + id, 5, 'Niveau atteint par un Pokémon utilisant ces objets');
    const all = (...parts) => ({ mode: 'all', parts });
    const family = (id, label, category, rewards, objectives, flavor) => ({ id, label, category, items: rewards, objectives, flavor });
    const elements = [
        ['fire', 'Braises et étincelles', 'fire-stone', 'Feu'],
        ['water', 'Au fil de l’eau', 'water-stone', 'Eau'],
        ['grass', 'Le jardin du Safari', 'leaf-stone', 'Plante'],
        ['electric', 'Sous tension', 'thunder-stone', 'Électrik'],
        ['ice', 'L’appel du froid', 'ice-stone', 'Glace']
    ].map(([type, title, item, label]) => family('element-' + type, title, 'elements', [item], [
        all(capType(type, 2, label), compatible('element-' + type), unique(type === 'ice' ? 8 : 6)),
        all(speciesType(type, 3, label), evos(3)),
        all(speciesType(type, 5, label), evolved(8))
    ], `Fais une place aux Pokémon ${label} dans ton carnet.`));
    const families = [
        family('link', 'De nouveaux horizons', 'evolution', ['linking-cord'], [
            all(unique(3), compatible('link')), all(evos(3), types(6)), all(evolved(8), unique(25))
        ], 'Ouvre les évolutions qui demandent habituellement un échange.'),
        ...elements,
        family('celestial', 'Entre Lune et Soleil', 'exploration', ['moon-stone', 'sun-stone'], [
            all(types(4), compatible('celestial'), unique(8)), all(speciesType('fairy', 3, 'Fée'), evos(4)), all(variants(2), unique(25))
        ], 'Explore plusieurs familles de Pokémon, à ton rythme.'),
        family('radiance', 'Éclats de lumière', 'evolution', ['shiny-stone', 'dusk-stone', 'dawn-stone'], [
            all(evos(1), compatible('radiance'), unique(10)), all(types(8), evos(4)), all(evolved(6), unique(30))
        ], 'Les premières évolutions ouvrent de nouvelles possibilités.'),
        family('forge', 'À la forge', 'evolution', ['metal-coat', 'protector', 'metal-alloy'], [
            all(capType('steel', 2, 'Acier'), compatible('forge'), unique(10)), all(speciesType('steel', 3, 'Acier'), types(8)), all(evolved(6), unique(30))
        ], 'Construis une collection qui ne manque pas de caractère.'),
        family('royal', 'Une équipe de caractère', 'evolution', ['kings-rock', 'leaders-crest'], [
            all(types(5), compatible('royal'), unique(10)), all(goal('duplicateReleases', 3, 'Doublons libérés'), unique(16)), all(evolved(8), unique(30))
        ], 'Choisis tes compagnons, puis libère trois doublons au deuxième palier.'),
        family('energy', 'Énergies croisées', 'elements', ['electirizer', 'magmarizer'], [
            all(capType('electric', 2, 'Électrik'), compatible('energy'), unique(10)), all(speciesType('fire', 3, 'Feu'), types(8)), all(evolved(6), unique(30))
        ], 'Croise les découvertes Feu et Électrik.'),
        family('retro', 'Le laboratoire', 'exploration', ['upgrade', 'dubious-disc'], [
            all(types(5), compatible('retro'), unique(10)), all(balls(3), unique(18)), all(variants(3), evolved(8))
        ], 'Expérimente les Poké Balls et observe les différences.'),
        family('ocean', 'Trésors des profondeurs', 'exploration', ['prism-scale', 'deep-sea-tooth', 'deep-sea-scale'], [
            all(capType('water', 3, 'Eau'), compatible('ocean'), unique(8)), all(speciesType('water', 4, 'Eau'), unique(18)), all(speciesType('water', 7, 'Eau'), evolved(8))
        ], 'Chaque rencontre aquatique enrichit l’expédition.'),
        family('fairy', 'Douceurs du Safari', 'elements', ['sachet', 'whipped-dream', 'strawberry-sweet'], [
            all(capType('fairy', 1, 'Fée'), compatible('fairy'), unique(6)), all(speciesType('fairy', 3, 'Fée'), types(8)), all(variants(2), unique(25))
        ], 'Un détour chez les Fées, sans obligation de trouver un shiny.'),
        family('claws', 'Sur leurs traces', 'evolution', ['razor-claw', 'razor-fang'], [
            all(capType('dark', 2, 'Ténèbres'), compatible('claws'), unique(10)), all(speciesType('dark', 3, 'Ténèbres'), evos(4)), all(evolved(6), unique(30))
        ], 'Suis les pistes des Pokémon les plus discrets.'),
        family('ghosts', 'Les mystères du Safari', 'elements', ['reaper-cloth', 'masque-maudit'], [
            all(capType('ghost', 2, 'Spectre'), compatible('ghosts'), unique(10)), all(speciesType('ghost', 3, 'Spectre'), evos(5)), all(evolved(8), unique(30))
        ], 'Les mystères se découvrent aussi en plein jour.'),
        family('hisui', 'Sur les traces de Hisui', 'exploration', ['black-augurite', 'peat-block'], [
            all(capType('ground', 3, 'Sol'), compatible('hisui'), unique(10)), all(regional(2), speciesType('ground', 4, 'Sol')), all(regional(4), unique(30))
        ], 'Rencontre des formes régionales et de vieux compagnons.'),
        family('galanoa', 'Souvenirs de Galar', 'exploration', ['galarica-cuff', 'galarica-wreath'], [
            all(capType('poison', 2, 'Poison'), compatible('galanoa'), unique(8)), all(speciesType('poison', 3, 'Poison'), speciesType('psychic', 3, 'Psy')), all(regional(3), unique(30))
        ], 'Mène une petite étude des Pokémon Poison et Psy.'),
        family('orchard', 'Le verger', 'elements', ['sweet-apple', 'tart-apple', 'syrupy-apple'], [
            all(capType('grass', 2, 'Plante'), compatible('orchard'), unique(6)), all(speciesType('dragon', 2, 'Dragon'), variants(1)), all(variants(3), unique(25))
        ], 'Trois pommes, trois chemins possibles pour Verpom.'),
        family('tea', 'L’heure du thé', 'exploration', ['cracked-pot', 'chipped-pot', 'unremarkable-teacup', 'masterpiece-teacup'], [
            all(capType('ghost', 2, 'Spectre'), compatible('tea'), unique(8)), all(speciesType('ghost', 3, 'Spectre'), variants(2)), all(variants(3), unique(25))
        ], 'Repère les variantes sans avoir à sacrifier un compagnon.'),
        family('armor', 'Deux voies, une aventure', 'evolution', ['auspicious-armor', 'malicious-armor'], [
            all(capType('fire', 3, 'Feu'), compatible('armor'), unique(10)), all(speciesType('fire', 4, 'Feu'), evos(4)), all(trained(2), unique(30))
        ], 'Prépare les deux évolutions de Charbambin.'),
        family('teaching', 'Le carnet du mentor', 'evolution', ['ancient-manuscript', 'scroll-of-darkness', 'scroll-of-waters', 'dragon-scale'], [
            all(goal('maxLevel', 6, 'Niveau atteint par un compagnon'), compatible('teaching'), unique(6)), all(trained(3), evos(4)), all(evolved(8), unique(30))
        ], 'Les apprentissages ouvrent des évolutions particulières.'),
        family('travel', 'Carnet de voyage', 'exploration', ['alora-sand', 'galar-vapor', 'carte-de-voyage'], [
            all(types(5), compatible('travel'), unique(8)), all(regional(2), balls(3)), all(regional(4), unique(30))
        ], 'Un même Pokémon, d’autres horizons.'),
        family('partners', 'Un duo inattendu', 'evolution', ['cable-croise'], [
            all(goal('exchangePair', 2, 'Carabing et Escargaume obtenus'), compatible('partners'), unique(12)), all(evos(4), unique(18)), all(evolved(8), unique(30))
        ], 'Prépare leur rencontre ; leurs évolutions demandent les deux partenaires.'),
        family('field', 'Les outils du chercheur', 'evolution', ['oval-stone', 'rock-peak'], [
            all(goal('captures', 5, 'Captures réalisées'), compatible('field'), unique(8)), all(types(8), evos(4)), all(trained(3), unique(25))
        ], 'Des outils simples pour des évolutions moins ordinaires.'),
        family('coins', 'La chasse au trésor', 'exploration', ['gimmighoul-coin'], [
            all(unique(8), compatible('coins')), all(unique(18), variants(2)), all(unique(35), evolved(8))
        ], 'Trois étapes pour réunir les 999 pièces de Mordudor.'),
        family('candies', 'Une réserve pour Meltan', 'exploration', ['pokego-candy'], [
            all(unique(10), compatible('candies')), all(unique(25), balls(3)), all(unique(40), evolved(10))
        ], 'Les récompenses fournissent les 400 bonbons au fil de l’aventure.')
    ];
    const familyByItem = new Map();
    for (const f of families) for (const item of f.items) familyByItem.set(item, f.id);
    const union = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
    const itemName = id => itemMap.get(id)?.name || E.itemName(id);
    function initialize(state) {
        if (state.challenges?.version === 1) return state.challenges;
        const c = state.challenges = { version: 1, claimed: [], unlocked: {}, records: {}, balls: [], compatibleLevels: {}, duplicateReleases: 0 };
        const counts = {};
        for (const id of new Set(state.missions?.claimed || [])) {
            const item = legacyRewards[id]; if (item) counts[item] = (counts[item] || 0) + 1;
        }
        for (const [id, n] of Object.entries(counts)) c.unlocked[id] = Math.min(3, n);
        for (const [id, n] of Object.entries(state.inventory?.stones || {})) if (n > 0 && itemMap.has(id)) c.unlocked[id] ||= 1;
        for (const p of state.pokedex || []) {
            if (!p) continue;
            for (const option of E.choices(p, state)) for (const id of [...Object.keys(option.items), ...(option.acceptedItems || [])]) {
                if (itemMap.has(id) && !oldMissionItems.has(id)) c.unlocked[id] ||= 1;
            }
        }
        return c;
    }
    function update(state) {
        const c = initialize(state);
        function record(sid) {
            return c.records[sid] ||= { types: [], forms: [], genders: [], maxLevel: 0, evolved: false };
        }
        for (const [sid, entry] of Object.entries(state.discovery || {})) {
            if (!entry.caught || !E.data.species[sid]) continue;
            const r = record(sid);
            r.forms = union(r.forms, (entry.variants || []).filter(v => v.caught && Number.isFinite(v.formId)).map(v => v.formId));
        }
        for (const p of state.pokedex || []) {
            if (!p) continue;
            const sid = E.speciesIdOf(p); if (!sid) continue;
            const r = record(sid);
            r.types = union(r.types, p.types);
            r.forms = union(r.forms, [E.formOf(p)?.id || p.formId || p.id]);
            if (p.gender && p.gender !== 'genderless') r.genders = union(r.genders, [p.gender]);
            r.maxLevel = Math.max(r.maxLevel, p.level || 1);
            r.evolved ||= Boolean(p.hasEvolved);
            if (p.captureBall) c.balls = union(c.balls, [p.captureBall]);
            for (const option of E.choices(p, state)) {
                if (option.requirements.some(req => ['Mâle', 'Femelle'].includes(req.label) && !req.met)) continue;
                for (const id of [...Object.keys(option.items), ...(option.acceptedItems || [])]) {
                    const familyId = familyByItem.get(id);
                    if (familyId) c.compatibleLevels[familyId] = Math.max(c.compatibleLevels[familyId] || 0, p.level || 1);
                }
            }
        }
        const records = Object.values(c.records);
        const representedTypes = new Set(records.flatMap(r => r.types));
        const regionalSpecies = records.filter(r => r.forms.some(id => /alola|galar|hisui|paldea/.test(E.data.forms[id]?.formName || ''))).length;
        const metrics = {
            unique: records.length, types: representedTypes.size,
            captures: Math.max(state.stats?.captures || 0, state.missions?.captures || 0),
            evolutions: Math.max(state.stats?.evolved || 0, state.missions?.evolutions || 0),
            evolvedSpecies: records.filter(r => r.evolved).length,
            variantSpecies: records.filter(r => r.forms.length >= 2).length,
            regionalSpecies, ballDiversity: c.balls.length,
            trainedSpecies: records.filter(r => r.maxLevel >= 8).length,
            maxLevel: Math.max(0, ...records.map(r => r.maxLevel)),
            duplicateReleases: c.duplicateReleases || 0,
            exchangePair: Number(Boolean(c.records[588])) + Number(Boolean(c.records[616]))
        };
        for (const [type, count] of Object.entries(state.missions?.typeProgress || {})) metrics['captureType:' + type] = count;
        for (const type of representedTypes) metrics['speciesType:' + type] = records.filter(r => r.types.includes(type)).length;
        for (const [id, level] of Object.entries(c.compatibleLevels)) metrics['compatible:' + id] = level;
        return metrics;
    }
    function progress(objective, metrics) {
        const parts = objective.parts.map(p => ({ ...p, current: Math.max(0, metrics[p.metric] || 0) }));
        const ready = objective.mode === 'all' ? parts.every(p => p.current >= p.target) : parts.some(p => p.current >= p.target);
        const ratios = parts.map(p => Math.min(1, p.current / p.target));
        return { parts, ready, ratio: objective.mode === 'all' ? ratios.reduce((a, b) => a + b, 0) / ratios.length : Math.max(...ratios) };
    }
    function rewardFor(f, stage) {
        const quantity = f.id === 'coins' ? [250, 350, 399][stage - 1] : f.id === 'candies' ? [100, 150, 150][stage - 1] : stage;
        return { items: f.items.map(id => ({ id, quantity })), coins: [40, 80, 140][stage - 1], tier: stage };
    }
    function models(state) {
        const metrics = update(state), c = state.challenges;
        return families.map((f, order) => {
            const stageIndex = f.objectives.findIndex((_, i) => !c.claimed.includes(`challenge:${f.id}:${i + 1}`));
            const complete = stageIndex < 0;
            const stage = complete ? 3 : stageIndex + 1;
            return { ...f, order, stage, complete, key: `challenge:${f.id}:${stage}`,
                progress: progress(f.objectives[stage - 1], metrics), reward: rewardFor(f, stage),
                needed: (metrics['compatible:' + f.id] || 0) > 0 };
        });
    }
    function shopStatus(state, id) {
        const item = itemMap.get(id); if (!item) return null;
        const tier = initialize(state).unlocked[id] || 0;
        return { ...item, tier, unlocked: tier > 0, multiplier: [1, 1, .8, .6][Math.min(3, tier)],
            family: families.find(f => f.id === familyByItem.get(id))?.label || '' };
    }
    function claim(state, key) {
        const model = models(state).find(m => m.key === key && !m.complete);
        const c = state.challenges;
        if (!model || c.claimed.includes(key) || !model.progress.ready) return null;
        c.claimed.push(key);
        state.inventory.stones ||= {};
        for (const reward of model.reward.items) {
            state.inventory.stones[reward.id] = (state.inventory.stones[reward.id] || 0) + reward.quantity;
            c.unlocked[reward.id] = Math.max(c.unlocked[reward.id] || 0, model.stage);
        }
        state.coins = (state.coins || 0) + model.reward.coins;
        state.stats ||= {};
        state.stats.totalCoins = (state.stats.totalCoins || 0) + model.reward.coins;
        return model;
    }
    function recordRelease(state, p) {
        update(state);
        const sid = E.speciesIdOf(p);
        if (state.pokedex.filter(other => other && E.speciesIdOf(other) === sid).length > 1) state.challenges.duplicateReleases++;
    }
    window.POKEIDLE_CHALLENGES = { items, families, itemName, initialize, update, models, claim, shopStatus, recordRelease };
})();
