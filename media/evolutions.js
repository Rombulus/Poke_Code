/* Ordinary evolution rules. Conditions unavailable in an idle game are explicit
 * item/time adaptations, shared by the preview and the actual transaction. */
(() => {
    'use strict';
    const data = window.POKEIDLE_EVOLUTION_DATA;
    const bySpecies = new Map();
    const formsBySpecies = new Map();
    for (const form of Object.values(data.forms)) {
        if (!formsBySpecies.has(form.speciesId)) formsBySpecies.set(form.speciesId, []);
        formsBySpecies.get(form.speciesId).push(form);
    }
    const sweets = ['strawberry-sweet', 'love-sweet', 'berry-sweet', 'clover-sweet', 'flower-sweet', 'star-sweet', 'ribbon-sweet'];
    for (const rule of data.rules) {
        if (!bySpecies.has(rule.from)) bySpecies.set(rule.from, []);
        bySpecies.get(rule.from).push(rule);
    }
    const itemAliases = { 'up-grade': 'upgrade' }; // Preserve existing inventories.
    const regionItems = { 7: 'alora-sand', 8: 'galar-vapor', 9: 'carte-de-voyage' };
    const customNames = {
        'upgrade': 'Améliorator', 'alora-sand': "Sable d’Alola", 'galar-vapor': 'Vapeur de Galar',
        'carte-de-voyage': 'Carte de Voyage', 'ancient-manuscript': 'Manuscrit Ancien',
        'boussole-magnetique': 'Boussole Magnétique', 'cable-croise': 'Câble Croisé',
        'masque-maudit': 'Masque Maudit', 'pokego-candy': 'Bonbon Pokémon GO',
        'rock-peak': 'Éclat de Roche'
    };
    const itemName = id => window.POKEIDLE_CHALLENGES?.items.find(item => item.id === id)?.name ||
        customNames[id] || data.itemNames[id === 'upgrade' ? 'up-grade' : id] || id;
    function seed(p) {
        let value = 2166136261;
        for (const char of String(p.evolutionSeed ?? p.instanceId ?? p.captureTimestamp ?? p.id)) {
            value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
        }
        return value;
    }
    function formOf(p) {
        if (data.forms[p.formId]?.pokemonId === p.id) return data.forms[p.formId];
        const legacy = Object.values(data.forms).find(f => f.pokemonId === p.id &&
            ((f.label && p.name === f.label) || (f.formName && p.name?.toLowerCase().includes(`(${f.formName})`))));
        return legacy || data.forms[data.defaultForms[p.id]] || data.forms[p.id];
    }
    function targetLabel(form) {
        if (form.speciesId === 869) return data.species[869].label;
        if (form.label) return form.label;
        let label = data.species[form.speciesId].label;
        const region = { alola: "d’Alola", galar: 'de Galar', hisui: 'de Hisui', paldea: 'de Paldea' };
        const regional = Object.keys(region).find(key => form.formName?.includes(key));
        if (regional) label += ' ' + region[regional];
        else if (form.formName) label += ` (${form.formName})`;
        return label;
    }
    function speciesIdOf(p) {
        return formOf(p)?.speciesId || (data.species[p.speciesId] ? Number(p.speciesId) : null) ||
            (data.species[p.id] ? Number(p.id) : null);
    }
    const speciesLabel = p => data.species[speciesIdOf(p)]?.label || p.name || 'Pokémon';
    function variantLabel(p) {
        const form = formOf(p);
        if (!form || form.speciesId === 869) return '';
        const label = targetLabel(form);
        const base = data.species[form.speciesId].label;
        return label.startsWith(base) ? label.slice(base.length).trim() : (form.formName || '');
    }
    const typeOrDeviceFormSpecies = new Set([386, 479, 493, 649, 741, 773]);
    function formsForSpecies(speciesId) {
        const forms = speciesId === 869 ? [data.forms[869]] : (formsBySpecies.get(speciesId) || []);
        return forms.filter(form => {
            const formName = String(form.formName || '').toLowerCase();
            const baseFormId = data.defaultForms[speciesId] || speciesId;
            // Dominant (Totem) forms are special boss variants, not wild appearances.
            if (formName.includes('totem')) return false;
            if ([1007, 1008].includes(speciesId)) {
                return formName === (speciesId === 1007 ? 'apex-build' : 'ultimate-mode');
            }

            // Keep visual, regional, costume and partner variants. Exclude
            // forms that only switch elemental type/device, plus special legendary
            // battle/fusion forms that are not independent wild appearances.
            if (typeOrDeviceFormSpecies.has(speciesId) && form.id !== baseFormId) return false;

            const species = data.species[speciesId];
            const regional = /(?:alola|galar|hisui|paldea)/.test(formName);
            if ((species?.isLegendary || species?.isMythical) && form.id !== baseFormId && !regional) return false;
            return true;
        });
    }
    function choices(p, state, now = Date.now()) {
        const source = formOf(p);
        if (!source) return [];
        if (source.speciesId === 868) {
            // Charmilly has one appearance and one destination. Existing sweets
            // all remain usable; their type no longer selects a cosmetic form.
            const sugar = sweets.find(id => (state.inventory.stones?.[id] || 0) > 0);
            return [{ key: '869', target: data.forms[869], label: data.species[869].label,
                requirements: [{ label: 'Un objet en Sucre (Fraise, Cœur, Baie, Trèfle, Fleur, Étoile ou Ruban)', met: Boolean(sugar) }],
                items: { [sugar || sweets[0]]: 1 }, acceptedItems: sweets,
                adaptations: ['Un sucre suffit. Charmilly possède une seule apparence dans PokeIdle.'], ready: Boolean(sugar) }];
        }
        const rules = bySpecies.get(source.speciesId) || [];
        const result = new Map();
        const hour = new Date(now).getHours();
        const activeTime = Number.isFinite(state.activeTimeMs) ? state.activeTimeMs : 0;
        const capturedAt = Number.isFinite(p.capturedAtActiveMs) ? p.capturedAtActiveMs : activeTime;
        const age = Math.max(0, (activeTime - capturedAt) / 1000);
        const isRegional = /(?:alola|galar|hisui|paldea)/.test(source.formName);
        for (const r of rules) {
            if (r.trigger === 'shed') continue; // Shedinja is a bonus alongside Ninjask.
            if (r.required_pokemon_form_id && r.required_pokemon_form_id !== source.id) continue;
            if (!r.required_pokemon_form_id && isRegional) continue;
            // Hidden personality rolls are stable across clicks, reloads and PCs.
            if (r.nature_bitmask && !(r.nature_bitmask & (1 << (seed(p) % 25)))) continue;
            if (r.percentage_chance && r.condition_expression?.startsWith('EC 100')) {
                const rare = seed(p) % 100 === 0;
                if ((r.percentage_chance === 1) !== rare) continue;
            }
            if ([266, 268].includes(r.to) && (r.to === 266) !== ((seed(p) >>> 16) % 10 < 5)) continue;
            const target = data.forms[r.evolved_pokemon_form_id || r.to];
            if (!target) continue;
            const requirements = [];
            const items = {};
            const adaptations = [];
            const require = (label, met) => requirements.push({ label, met: Boolean(met) });
            const item = (id, count = 1, why = '') => {
                id = itemAliases[id] || id;
                items[id] = Math.max(items[id] || 0, count);
                if (why) adaptations.push(why);
            };
            const level = r.minimum_level || 1;
            if (level > 1) require(`Niveau ${level}`, (p.level || 1) >= level);
            if (r.gender_id) require(r.gender_id === 1 ? 'Femelle' : 'Mâle', p.gender === (r.gender_id === 1 ? 'female' : 'male'));
            if (r.time_of_day === 'day') require('Jour (7 h–19 h)', hour >= 7 && hour < 19);
            if (r.time_of_day === 'night') require('Nuit (19 h–7 h)', hour >= 19 || hour < 7);
            if (r.time_of_day === 'dusk') require('Crépuscule (18 h–19 h)', hour === 18);
            if (r.minimum_happiness || r.minimum_affection) require('Amitié : 30 min de jeu actif depuis la capture', age >= 1800);
            if (r.trigger_item_id) item(r.trigger_item_id);
            if (r.held_item_id) item(r.held_item_id);
            if (r.trigger === 'trade' && !r.held_item_id) item(r.trade_species_id ? 'cable-croise' : 'linking-cord');
            if (r.trigger === 'trade') adaptations.push('L’objet remplace l’échange entre joueurs.');
            if (r.region_id) item(regionItems[r.region_id] || 'carte-de-voyage', 1, 'L’objet de voyage remplace la région requise.');
            if (r.location_id || r.near_special_rock) {
                item([462, 476, 738].includes(r.to) ? 'thunder-stone' : r.to === 867 ? 'masque-maudit' : 'rock-peak', 1,
                    'L’objet remplace le lieu d’évolution.');
            }
            if (r.known_move_id || r.known_move_type_id || r.used_move_id) item('ancient-manuscript', 1,
                'Le Manuscrit Ancien remplace l’apprentissage ou l’utilisation de la capacité.');
            if (r.minimum_steps) {
                require(`Promenade : ${Math.floor(r.minimum_steps / 60)} min ${r.minimum_steps % 60} s de jeu actif`, age >= r.minimum_steps);
                adaptations.push('Une seconde de jeu actif depuis la capture remplace un pas.');
            }
            if (r.party_species_id) {
                require(`${data.species[r.party_species_id].label} dans la collection`, state.pokedex.some(partner =>
                    partner.instanceId !== p.instanceId && (partner.speciesId || formOf(partner)?.speciesId) === r.party_species_id));
            }
            if (r.trade_species_id) require(`${data.species[r.trade_species_id].label} dans la collection`, state.pokedex.some(partner =>
                (partner.speciesId || formOf(partner)?.speciesId) === r.trade_species_id));
            if (r.party_type_id) {
                const type = { 17: 'dark' }[r.party_type_id];
                require('Un autre Pokémon Ténèbres dans la collection', type && state.pokedex.some(partner =>
                    partner.instanceId !== p.instanceId && partner.types?.includes(type)));
            }
            if (r.needs_overworld_rain) item('water-stone', 1, 'La Pierre Eau remplace la pluie.');
            if (r.turn_upside_down) item('rock-peak', 1, 'L’Éclat de Roche remplace le retournement de la console.');
            if (r.needs_multiplayer) item('linking-cord', 1, 'Le Câble Link remplace la session multijoueur.');
            if (r.minimum_beauty) item('prism-scale', 1, 'La Bel’Écaille remplace la beauté.');
            if (r.relative_physical_stats !== undefined) adaptations.push('Entraînement idle : choisis librement cette branche Attaque/Défense/Équilibre.');
            if (r.nature_bitmask) adaptations.push('La nature est déterminée par une valeur stable propre à ce Pokémon.');
            if (r.percentage_chance) adaptations.push('La variante est déterminée à la capture et reste identique sur tous les appareils.');
            if (r.time_of_day === 'full-moon') adaptations.push('Le Bloc de Tourbe suffit dans le jeu idle, sans attendre la pleine lune.');
            if (r.trigger === 'spin') adaptations.push('Le choix de la crème remplace la rotation ; le sucre et l’heure restent requis.');
            if (r.trigger === 'three-critical-hits') item('ancient-manuscript', 1, 'Le Manuscrit Ancien remplace les trois coups critiques.');
            if (['take-damage', 'recoil-damage'].includes(r.trigger)) item('masque-maudit', 1, 'Le Masque Maudit remplace les dégâts à subir.');
            if (r.trigger === 'three-defeated-bisharp') item('leaders-crest', 1, 'L’Emblème du Général remplace les trois combats.');
            if (r.trigger === 'gimmighoul-coins') item('gimmighoul-coin', 999);
            if (r.trigger === 'meltan-candies') item('pokego-candy', 400, '400 Bonbons Pokémon GO remplacent les bonbons de Pokémon GO.');
            if (r.trigger === 'in-battle-level-up') adaptations.push('Le niveau suffit dans le jeu idle, sans combat.');
            if (r.trigger === 'tower-of-darkness') item('scroll-of-darkness');
            if (r.trigger === 'tower-of-waters') item('scroll-of-waters');
            for (const [id, count] of Object.entries(items)) {
                const owned = state.inventory.stones?.[id] || 0;
                require(`${itemName(id)} ×${count} (${owned} possédé${owned > 1 ? 's' : ''})`, owned >= count);
            }
            // Unknown future triggers must never silently produce a free evolution.
            if (!['level-up', 'trade', 'use-item', 'spin', 'three-critical-hits', 'take-damage', 'recoil-damage',
                'three-defeated-bisharp', 'gimmighoul-coins', 'meltan-candies', 'in-battle-level-up',
                'tower-of-darkness', 'tower-of-waters', 'agile-style-move', 'strong-style-move', 'use-move'].includes(r.trigger)) {
                require('Méthode d’évolution non prise en charge', false);
            }
            const option = { key: String(target.id), ruleId: r.id, target, label: targetLabel(target), requirements,
                items, adaptations: [...new Set(adaptations)], ready: requirements.every(req => req.met) };
            const previous = result.get(option.key);
            // Retain a valid alternative, or the method with fewer unmet conditions.
            if (!previous || requirements.filter(q => !q.met).length < previous.requirements.filter(q => !q.met).length) result.set(option.key, option);
        }
        return [...result.values()];
    }
    function syncPokemon(p) {
        let source = formOf(p);
        if (!source) return;
        if (source.speciesId === 869) {
            const wasVariant = source.id !== 869 || p.name !== data.species[869].label;
            source = data.forms[869];
            p.id = source.pokemonId;
            p.name = data.species[869].label;
            if (wasVariant) p.sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.isShiny ? 'shiny/' : ''}869.png`;
        }
        p.speciesId = source.speciesId;
        p.formId = source.id;
        const genderRate = data.species[source.speciesId]?.genderRate;
        if (genderRate === 0) p.gender = 'male';
        if (genderRate === 8) p.gender = 'female';
        if (genderRate === -1) p.gender = 'genderless';
    }
    window.POKEIDLE_EVOLUTIONS = { choices, formOf, targetLabel, syncPokemon, itemName, data,
        speciesIdOf, speciesLabel, variantLabel, formsForSpecies };
})();
