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
    const evolutionRulesById = new Map(E.data.rules.map(rule => [String(rule.id), rule]));
    const oldMissionItems = new Set(Object.values(legacyRewards));
    const goal = (metric, target, label) => ({ metric, target, label });
    const unique = n => goal('unique', n, 'Espèces différentes obtenues');
    const types = n => goal('types', n, 'Types représentés dans le carnet');
    const evos = n => goal('evolutions', n, 'Évolutions réalisées');
    const evolved = n => goal('evolvedSpecies', n, 'Espèces obtenues par évolution');
    const evolutionAction = (action, n, label) => goal('evolutionAction:' + action, n, label);
    const methodVariety = n => goal('evolutionMethodDiversity', n, 'Méthodes d’évolution différentes utilisées');
    const variants = n => goal('variantSpecies', n, 'Espèces dont 2 variantes ont été obtenues');
    const regional = n => goal('regionalSpecies', n, 'Espèces régionales obtenues');
    const balls = n => goal('ballDiversity', n, 'Sortes de Poké Balls ayant réussi une capture');
    const trained = n => goal('trainedSpecies', n, 'Espèces élevées au niveau 8');
    const capType = (type, n, label) => goal('captureType:' + type, n, `Pokémon ${label} capturés`);
    const speciesType = (type, n, label) => goal('speciesType:' + type, n, `Espèces ${label} différentes obtenues`);
    const compatible = id => goal('compatible:' + id, 15, 'Niveau atteint par un Pokémon utilisant ces objets');
    const all = (...parts) => ({ mode: 'all', parts });
    const family = (id, label, category, rewards, objectives, flavor) => ({ id, label, category, items: rewards, objectives, flavor });
    const elements = [
        ['fire', 'Braises et étincelles', 'fire-stone', 'Feu'],
        ['water', 'Au fil de l’eau', 'water-stone', 'Eau'],
        ['grass', 'Le jardin du Safari', 'leaf-stone', 'Plante'],
        ['electric', 'Sous tension', 'thunder-stone', 'Électrik'],
        ['ice', 'L’appel du froid', 'ice-stone', 'Glace']
    ].map(([type, title, item, label]) => family('element-' + type, title, 'elements', [item], [
        all(capType(type, 8, label), compatible('element-' + type), unique(type === 'ice' ? 25 : 20)),
        all(speciesType(type, 10, label), evos(12), unique(45)),
        all(speciesType(type, 18, label), evolved(20), unique(90))
    ], `Fais une place aux Pokémon ${label} dans ton carnet.`));
    const families = [
        family('link', 'De nouveaux horizons', 'evolution', ['linking-cord'], [
            all(unique(15), compatible('link'), types(8), evolutionAction('trade', 2, 'Évolutions par échange simulé')),
            all(evos(12), types(12), unique(45), evolutionAction('trade', 6, 'Évolutions par échange simulé'), evolutionAction('partner', 2, 'Évolutions avec un partenaire requis')),
            all(evolved(20), unique(75), variants(6), evolutionAction('trade', 12, 'Évolutions par échange simulé'), methodVariety(3))
        ], 'Ouvre les évolutions qui demandent habituellement un échange.'),
        ...elements,
        family('celestial', 'Entre Lune et Soleil', 'exploration', ['moon-stone', 'sun-stone'], [
            all(types(10), compatible('celestial'), unique(20), evolutionAction('friendship', 2, 'Évolutions liées à l’amitié')),
            all(speciesType('fairy', 8, 'Fée'), evos(10), unique(45), evolutionAction('friendship', 5, 'Évolutions liées à l’amitié')),
            all(variants(6), unique(75), evolved(15), evolutionAction('friendship', 10, 'Évolutions liées à l’amitié'), methodVariety(3))
        ], 'Explore plusieurs familles de Pokémon, à ton rythme.'),
        family('radiance', 'Éclats de lumière', 'evolution', ['shiny-stone', 'dusk-stone', 'dawn-stone'], [
            all(evos(8), compatible('radiance'), unique(25), evolutionAction('stone', 3, 'Évolutions avec une pierre')),
            all(types(14), evos(15), unique(50), evolutionAction('stone', 8, 'Évolutions avec une pierre')),
            all(evolved(15), unique(90), variants(6), evolutionAction('stone', 15, 'Évolutions avec une pierre'), methodVariety(3))
        ], 'Les premières évolutions ouvrent de nouvelles possibilités.'),
        family('forge', 'À la forge', 'evolution', ['metal-coat', 'protector', 'metal-alloy'], [
            all(capType('steel', 10, 'Acier'), compatible('forge'), unique(25)), all(speciesType('steel', 8, 'Acier'), types(12), evos(10)), all(evolved(15), unique(90), trained(8))
        ], 'Construis une collection qui ne manque pas de caractère.'),
        family('royal', 'Une équipe de caractère', 'evolution', ['kings-rock', 'leaders-crest'], [
            all(types(10), compatible('royal'), unique(25)), all(goal('duplicateReleases', 12, 'Doublons libérés'), unique(45), evos(8)), all(evolved(20), unique(100), variants(6))
        ], 'Choisis tes compagnons, puis libère douze doublons au deuxième palier.'),
        family('energy', 'Énergies croisées', 'elements', ['electirizer', 'magmarizer'], [
            all(capType('electric', 10, 'Électrik'), compatible('energy'), unique(25)), all(speciesType('fire', 8, 'Feu'), types(12), evos(8)), all(evolved(15), unique(90), trained(8))
        ], 'Croise les découvertes Feu et Électrik.'),
        family('retro', 'Le laboratoire', 'exploration', ['upgrade', 'dubious-disc'], [
            all(types(10), compatible('retro'), unique(25)), all(balls(6), unique(45), evos(8)), all(variants(6), evolved(15), unique(90))
        ], 'Expérimente les Poké Balls et observe les différences.'),
        family('ocean', 'Trésors des profondeurs', 'exploration', ['prism-scale', 'deep-sea-tooth', 'deep-sea-scale'], [
            all(capType('water', 10, 'Eau'), compatible('ocean'), unique(25)), all(speciesType('water', 12, 'Eau'), unique(45), types(10)), all(speciesType('water', 20, 'Eau'), evolved(15), unique(90))
        ], 'Chaque rencontre aquatique enrichit l’expédition.'),
        family('fairy', 'Douceurs du Safari', 'elements', ['sachet', 'whipped-dream', 'strawberry-sweet'], [
            all(capType('fairy', 8, 'Fée'), compatible('fairy'), unique(20)), all(speciesType('fairy', 8, 'Fée'), types(12), evos(8)), all(variants(6), unique(75), evolved(15))
        ], 'Un détour chez les Fées, sans obligation de trouver un shiny.'),
        family('claws', 'Sur leurs traces', 'evolution', ['razor-claw', 'razor-fang'], [
            all(capType('dark', 10, 'Ténèbres'), compatible('claws'), unique(25)), all(speciesType('dark', 8, 'Ténèbres'), evos(12), types(12)), all(evolved(15), unique(90), variants(6))
        ], 'Suis les pistes des Pokémon les plus discrets.'),
        family('ghosts', 'Les mystères du Safari', 'elements', ['reaper-cloth', 'masque-maudit'], [
            all(capType('ghost', 10, 'Spectre'), compatible('ghosts'), unique(25)), all(speciesType('ghost', 8, 'Spectre'), evos(12), types(12)), all(evolved(20), unique(100), variants(6))
        ], 'Les mystères se découvrent aussi en plein jour.'),
        family('hisui', 'Sur les traces de Hisui', 'exploration', ['black-augurite', 'peat-block'], [
            all(capType('ground', 10, 'Sol'), compatible('hisui'), unique(25)), all(regional(4), speciesType('ground', 10, 'Sol'), types(12)), all(regional(8), unique(90), evolved(15))
        ], 'Rencontre des formes régionales et de vieux compagnons.'),
        family('galanoa', 'Souvenirs de Galar', 'exploration', ['galarica-cuff', 'galarica-wreath'], [
            all(capType('poison', 10, 'Poison'), compatible('galanoa'), unique(20)), all(speciesType('poison', 8, 'Poison'), speciesType('psychic', 8, 'Psy'), types(12)), all(regional(6), unique(90), evolved(15))
        ], 'Mène une petite étude des Pokémon Poison et Psy.'),
        family('orchard', 'Le verger', 'elements', ['sweet-apple', 'tart-apple', 'syrupy-apple'], [
            all(capType('grass', 8, 'Plante'), compatible('orchard'), unique(20)), all(speciesType('dragon', 5, 'Dragon'), variants(4), evos(8)), all(variants(8), unique(75), evolved(15))
        ], 'Trois pommes, trois chemins possibles pour Verpom.'),
        family('tea', 'L’heure du thé', 'exploration', ['cracked-pot', 'chipped-pot', 'unremarkable-teacup', 'masterpiece-teacup'], [
            all(capType('ghost', 8, 'Spectre'), compatible('tea'), unique(20)), all(speciesType('ghost', 8, 'Spectre'), variants(5), evos(8)), all(variants(8), unique(75), evolved(15))
        ], 'Repère les variantes sans avoir à sacrifier un compagnon.'),
        family('armor', 'Deux voies, une aventure', 'evolution', ['auspicious-armor', 'malicious-armor'], [
            all(capType('fire', 10, 'Feu'), compatible('armor'), unique(25)), all(speciesType('fire', 10, 'Feu'), evos(12), types(12)), all(trained(10), unique(90), evolved(15))
        ], 'Prépare les deux évolutions de Charbambin.'),
        family('teaching', 'Le carnet du mentor', 'evolution', ['ancient-manuscript', 'scroll-of-darkness', 'scroll-of-waters', 'dragon-scale'], [
            all(goal('maxLevel', 12, 'Niveau atteint par un compagnon'), compatible('teaching'), unique(20), evolutionAction('special', 2, 'Évolutions à condition spéciale')),
            all(trained(8), evos(12), types(12), evolutionAction('special', 6, 'Évolutions à condition spéciale'), methodVariety(3)),
            all(evolved(20), unique(90), goal('maxLevel', 25, 'Niveau atteint par un compagnon'), evolutionAction('special', 12, 'Évolutions à condition spéciale'), methodVariety(4))
        ], 'Les apprentissages ouvrent des évolutions particulières.'),
        family('travel', 'Carnet de voyage', 'exploration', ['alora-sand', 'galar-vapor', 'carte-de-voyage'], [
            all(types(10), compatible('travel'), unique(20)), all(regional(4), balls(6), evos(8)), all(regional(8), unique(90), evolved(15))
        ], 'Un même Pokémon, d’autres horizons.'),
        family('partners', 'Un duo inattendu', 'evolution', ['cable-croise'], [
            all(goal('exchangePair', 2, 'Carabing et Escargaume obtenus'), compatible('partners'), unique(25)), all(evos(12), unique(45), types(12)), all(evolved(20), unique(90), variants(6))
        ], 'Prépare leur rencontre ; leurs évolutions demandent les deux partenaires.'),
        family('field', 'Les outils du chercheur', 'evolution', ['oval-stone', 'rock-peak'], [
            all(goal('captures', 40, 'Captures réalisées'), compatible('field'), unique(20), evolutionAction('item', 3, 'Évolutions avec un objet spécial')),
            all(types(12), evos(12), unique(45), evolutionAction('item', 8, 'Évolutions avec un objet spécial'), evolutionAction('walk', 2, 'Évolutions après une promenade active')),
            all(trained(10), unique(75), evolved(15), evolutionAction('item', 15, 'Évolutions avec un objet spécial'), evolutionAction('walk', 5, 'Évolutions après une promenade active'), methodVariety(4))
        ], 'Des outils simples pour des évolutions moins ordinaires.'),
        family('coins', 'La chasse au trésor', 'exploration', ['gimmighoul-coin'], [
            all(unique(20), compatible('coins'), types(8)), all(unique(50), variants(5), evos(8)), all(unique(100), evolved(20), regional(6))
        ], 'Trois étapes pour réunir les 999 pièces de Mordudor.'),
        family('candies', 'Une réserve pour Meltan', 'exploration', ['pokego-candy'], [
            all(unique(25), compatible('candies'), types(10)), all(unique(55), balls(6), evos(10)), all(unique(110), evolved(25), variants(8))
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
        c.evolutionActions ||= {};
        c.evolutionMethods ||= [];
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
            evolutionMethodDiversity: c.evolutionMethods.length,
            maxLevel: Math.max(0, ...records.map(r => r.maxLevel)),
            duplicateReleases: c.duplicateReleases || 0,
            exchangePair: Number(Boolean(c.records[588])) + Number(Boolean(c.records[616]))
        };
        for (const [type, count] of Object.entries(state.missions?.typeProgress || {})) metrics['captureType:' + type] = count;
        for (const [action, count] of Object.entries(c.evolutionActions)) metrics['evolutionAction:' + action] = count;
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
    function recordEvolution(state, ruleId, option) {
        const rule = evolutionRulesById.get(String(ruleId)) || (option?.items ? {
            trigger: 'use-item', trigger_item_id: Object.keys(option.items)[0]
        } : null);
        if (!rule) return;
        const c = initialize(state);
        c.evolutionActions ||= {};
        c.evolutionMethods ||= [];
        let method;
        if (rule.minimum_happiness || rule.minimum_affection) method = 'friendship';
        else if (rule.trigger === 'trade') method = 'trade';
        else if (rule.trigger === 'use-item' && /-stone$/.test(rule.trigger_item_id || '')) method = 'stone';
        else if (rule.trigger === 'use-item' || rule.trigger_item_id) method = 'item';
        else if (rule.minimum_steps) method = 'walk';
        else if (rule.time_of_day || rule.gender_id || rule.region_id || rule.location_id || rule.near_special_rock ||
            rule.known_move_id || rule.known_move_type_id || rule.used_move_id || rule.party_species_id || rule.party_type_id ||
            rule.needs_overworld_rain || rule.turn_upside_down || rule.needs_multiplayer || rule.minimum_beauty ||
            rule.relative_physical_stats !== undefined || rule.nature_bitmask || rule.percentage_chance) method = 'special';
        else if (['level-up', 'in-battle-level-up'].includes(rule.trigger)) method = 'level';
        else method = 'special';
        const actions = new Set([method]);
        if (rule.trade_species_id || rule.party_species_id || rule.party_type_id) actions.add('partner');
        if (rule.minimum_steps) actions.add('walk');
        c.evolutionMethods = [...new Set([...c.evolutionMethods, method])].sort();
        for (const action of actions) c.evolutionActions[action] = (c.evolutionActions[action] || 0) + 1;
    }
    function recordRelease(state, p) {
        update(state);
        const sid = E.speciesIdOf(p);
        if (state.pokedex.filter(other => other && E.speciesIdOf(other) === sid).length > 1) state.challenges.duplicateReleases++;
    }
    window.POKEIDLE_CHALLENGES = { items, families, itemName, initialize, update, models, claim, shopStatus, recordEvolution, recordRelease };
})();
