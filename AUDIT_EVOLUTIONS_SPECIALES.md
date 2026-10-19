# Évolutions spéciales : fonctionnement réel de PokeIdle

Audit du 19 octobre 2026, sur le moteur livré avec PokeIdle Codex 1.3.0 / extension 1.0.3.

> Rapport historique : depuis Codex 1.3.1 / extension 1.0.4, Charmilly n’a plus
> de variantes. Un sucre quelconque permet son évolution sans condition d’heure.
> Les variantes des autres espèces sont regroupées sous une seule fiche et ne
> comptent qu’une fois dans le Pokédex. Voir les règles actuelles dans EVOLUTIONS.md.
>
> Depuis Codex 1.3.2 / extension 1.0.5, tous les délais de progression utilisent
> le temps de jeu actif. Les remarques historiques ci-dessous sur le temps écoulé
> app fermée ne décrivent donc plus le fonctionnement actuel.
>
> Depuis Codex 1.4.0 / extension 1.1.0, les anciens défis et prix de boutique ont
> été remplacés par les parcours décrits dans DEFIS.md. Les blocages de déblocage
> et la majoration de prix ×5 relevés dans cet audit ne sont plus en vigueur.

## Résultat

Les cas du PDF fourni ont une correspondance dans le catalogue et le moteur actuels.
Cela ne signifie pas que leurs conditions reproduisent exactement les jeux Pokémon :
plusieurs conditions sont volontairement remplacées par un objet ou du temps écoulé.

La vérification a combiné la lecture des quatre pages du PDF, l’inspection du code et
l’exécution du calcul des évolutions sur des individus fictifs. Le parcours a couvert
175 formes de départ (y compris les variantes et formes normales de comparaison) et
atteint 272 formes d’arrivée distinctes avec les prérequis nécessaires. Aucun choix
présent dans l’échantillon initial n’est resté inaccessible dans ces simulations.
Ce n’est pas une vérification des téléchargements d’images, des clics dans chaque éditeur
ou de l’enregistrement d’une évolution de bout en bout. Aucune sauvegarde réelle n’a été chargée ou modifiée.

**Point à corriger dans mon explication précédente :** Magnéton, Tarinor et Chrysapile
utilisent une **Pierre Foudre**, et non la Boussole Magnétique. Évoli et Crabagarre
utilisent eux aussi les pierres précisées ci-dessous, pas l’Éclat de Roche.

## Conventions communes

- Toutes les évolutions sont **manuelles**, depuis la collection. La condition doit être remplie au clic.
- « Niveau 20 » signifie **niveau 20 ou supérieur** ; il n’est pas nécessaire de gagner un niveau supplémentaire.
- Tout objet cité dans les tableaux est **consommé**, y compris les objets normalement tenus lors d’un échange.
- Les quantités sont de **1 objet** sauf indication contraire.
- Jour : **7 h–19 h** ; nuit : **19 h–7 h** ; crépuscule : **18 h–19 h**. Il s’agit de l’heure locale du PC.
- Les délais partent de la **date de capture**, comptent aussi lorsque l’app est fermée et ne sont pas remis à zéro à chaque évolution.
- Une condition de niveau, de genre, d’heure ou de partenaire reste nécessaire même si l’objet est disponible.
- Dans les tableaux, **conservé** signifie que les conditions indiquées dans le PDF sont contrôlées ; **adapté** décrit un remplacement propre au jeu idle.

## 1. Niveau, environnement et caractéristiques

### Jour et nuit

| Évolution | Condition réelle dans l’app | Bilan |
| --- | --- | --- |
| Rattata d’Alola → Rattatac d’Alola | Niveau 20 + nuit | Conservé |
| Osselait → Ossatueur d’Alola | Niveau 28 + nuit + Sable d’Alola | Région adaptée par un objet ; Ossatueur normal reste un autre choix au niveau 28 |
| Linéon de Galar → Ixon | Niveau 35 + nuit | Conservé ; Linéon normal n’a pas cette branche |
| Ptyranidur → Rexillius | Niveau 39 + jour | Conservé |
| Amagara → Dragmara | Niveau 39 + nuit | Conservé |
| Manglouton → Argouste | Niveau 20 + jour | Conservé |
| Rocabot standard → Lougaroc Diurne | Niveau 25 + jour | Conservé |
| Rocabot standard → Lougaroc Nocturne | Niveau 25 + nuit | Conservé |
| Rocabot Tempo Perso → Lougaroc Crépusculaire | Niveau 25 + crépuscule | Présent en complément du PDF ; demande cette forme de Rocabot |
| Mimantis → Floramantis | Niveau 34 + jour | Conservé |
| Toutombe → Tomberro | Niveau 30 + nuit | Conservé |

### Météo, genre, statistiques et variantes

| Évolution | Condition réelle dans l’app | Bilan |
| --- | --- | --- |
| Colimucus → Muplodocus | Niveau 50 + Pierre Eau | La pierre remplace la pluie ; aucun contrôle du brouillard |
| Colimucus de Hisui → Muplodocus de Hisui | Niveau 50 + Pierre Eau | Même adaptation ; la forme de Hisui est conservée |
| Cheniti femelle → Cheniselle | Niveau 20 + femelle | Cape Plante, Sable ou Déchet conservée |
| Cheniti mâle → Papilord | Niveau 20 + mâle | Conservé ; pas de comparaison de statistiques |
| Apitrini → Apireine | Niveau 21 + femelle | Les mâles ne peuvent pas valider cette évolution |
| Tritox → Malamandre | Niveau 33 + femelle | Les mâles ne peuvent pas valider cette évolution |
| Debugant → Kicklee / Tygnon / Kapoera | Niveau 20 ; choix libre entre les trois | Adapté : l’Attaque et la Défense ne sont pas comparées |
| Chenipotte → Armulys / Blindalys | Niveau 7 ; une seule branche déterminée par un calcul stable propre à l’individu | Adapté : le principe de variante cachée est conservé, pas la valeur interne des jeux d’origine |
| Cosmovum → Solgaleo / Lunala | Niveau 53 ; choix libre entre les deux | Adapté : aucune version de jeu n’est imposée |

Une branche interdite par le genre peut rester affichée dans le panneau, mais son bouton est désactivé.

## 2. Capacités connues ou utilisées

**Adaptation commune : 1 Manuscrit Ancien remplace la capacité demandée**, son apprentissage,
ses utilisations et son style éventuel. Ces cas n’exigent pas d’attendre le niveau
d’apprentissage de la capacité et ne comptent pas vingt utilisations.

| Pokémon de départ | Destination réelle | Dans l’app |
| --- | --- | --- |
| Qwilfish de Hisui | Qwilpik | Manuscrit Ancien ; Qwilfish normal n’a pas cette branche |
| Mime Jr. | M. Mime | Manuscrit Ancien |
| Mime Jr. | M. Mime de Galar | Manuscrit Ancien + Vapeur de Galar |
| Manzaï | Simularbre | Manuscrit Ancien |
| Yanma | Yanmega | Manuscrit Ancien |
| Saquedeneu | Bouldeneu | Manuscrit Ancien |
| Cochignon | Mammochon | Manuscrit Ancien |
| Capumain | Capidextre | Manuscrit Ancien |
| Excelangue | Coudlangue | Manuscrit Ancien |
| Candine | Sucreine | Manuscrit Ancien |
| Vémini | Mandrillon | Manuscrit Ancien |
| Poulpaf | Krakos | Manuscrit Ancien |
| Girafarig | Farigiraf | Manuscrit Ancien |
| Insolourdo | Deusolourdo Double ou Triple | Manuscrit Ancien ; la variante est déterminée par l’individu, pas choisie au clic |
| Pomdramour | Pomdorochi | Manuscrit Ancien |
| Colossinge | Courrousinge | Manuscrit Ancien ; pas de compteur de Poing de Colère |
| Cerfrousse | Cerbyllin | Manuscrit Ancien ; pas de compteur de Sprint Bouclier |

Les deux méthodes de Qwilfish citées dans le PDF (capacité connue / vingt utilisations
en style Puissant) aboutissent à la même adaptation. Le catalogue utilise sa méthode
canonique actuelle, sans cumuler toutes les anciennes méthodes.

## 3. Lieux, amitié et fonctions de jeu

### Lieux spécifiques

| Pokémon | Destination | Dans l’app |
| --- | --- | --- |
| Magnéton | Magnézone | Pierre Foudre |
| Tarinor | Tarinorme | Pierre Foudre |
| Chrysapile | Lucanon | Pierre Foudre |
| Évoli | Phyllali | Pierre Plante |
| Évoli | Givrali | Pierre Glace |
| Crabagarre | Crabominable | Pierre Glace |

Les anciennes conditions de champ magnétique, Pierre Mousse, Pierre Gelée et
Mont Lanakila du PDF ne sont donc pas exécutées. La Boussole Magnétique existe
encore dans la boutique et les missions, mais n’est pas requise par ces branches.

### Amitié

| Pokémon et destination | Dans l’app |
| --- | --- |
| Pichu → Pikachu ; Mélo → Mélofée ; Toudoudou → Rondoudou | 30 min depuis la capture |
| Nosferalto → Nostenfer ; Leveinard → Leuphorie ; Goinfrex → Ronflex | 30 min depuis la capture |
| Togepi → Togetic ; Azurill → Marill ; Laporeille → Lockpin | 30 min depuis la capture |
| Chovsourir → Rhinolove ; Couverdure → Manternel | 30 min depuis la capture |
| Miaouss d’Alola → Persian d’Alola ; Type:0 → Silvallié | 30 min depuis la capture |
| Évoli → Mentali | 30 min depuis la capture + jour |
| Évoli → Noctali | 30 min depuis la capture + nuit |
| Évoli → Nymphali | 30 min depuis la capture + Manuscrit Ancien, qui remplace la capacité Fée |
| Rozbouton → Rosélia ; Riolu → Lucario | 30 min depuis la capture + jour |
| Korillon → Éoko ; Frissonille → Beldeneige | 30 min depuis la capture + nuit |

Il n’y a pas de jauge d’amitié ni d’actions de soin à accumuler. L’app conserve
la distinction jour/nuit lorsqu’elle existe dans ces règles.

### Marche et autres fonctions

| Pokémon | Destination | Dans l’app |
| --- | --- | --- |
| Pohmotte | Pohmarmotte | 1 000 secondes depuis la capture, soit **16 min 40 s** |
| Virovent | Virevorreur | Même délai |
| Léboulérou | Bérasca | Même délai |
| Sepiatop | Sepiatroce | Niveau 30 + Éclat de Roche ; pas de retournement de console |
| Dofin | Superdofin | Niveau 38 + Câble Link ; pas de connexion multijoueur |
| Compagnol | Famignol | Niveau 25 ; pas de combat nécessaire. Famille de Trois/Quatre déterminée par l’individu |
| Babimanta | Démanta | Posséder un Rémoraid dans la collection ; pas besoin d’une équipe active ni de le consommer |

Le libellé de promenade affiche « 17 min » par arrondi, alors que le seuil réel
est bien de 1 000 secondes. Ce délai ne mesure ni les clics, ni les frappes clavier,
ni le temps passé effectivement dans l’application.

## 4. Utilisation directe d’objets

### Pierres

Les branches suivantes demandent une pierre, consommée à la validation. Les
cas avec condition supplémentaire sont explicitement indiqués.

| Pierre | Évolutions présentes dans l’app |
| --- | --- |
| Feu | Goupix → Feunard ; Caninos → Arcanin (forme normale ou Hisui conservée) ; Évoli → Pyroli ; Flamajou → Flamoutan ; Pimito → Scovilain |
| Eau | Têtarte → Tartard ; Kokiyas → Crustabri ; Stari → Staross ; Évoli → Aquali ; Lombre → Ludicolo ; Flotajou → Flotoutan |
| Foudre | Pikachu → Raichu ; Évoli → Voltali ; Magnéton → Magnézone ; Tarinor → Tarinorme ; Chrysapile → Lucanon ; Lampéroie → Ohmassacre ; Têtampoule → Ampibidou |
| Plante | Ortide → Rafflesia ; Boustiflor → Empiflor ; Noeunoeuf → Noadkoko ; Évoli → Phyllali ; Pifeuil → Tengalice ; Feuillajou → Feuiloutan |
| Glace | Sabelette d’Alola → Sablaireau d’Alola ; Goupix d’Alola → Feunard d’Alola ; Évoli → Givrali ; Darumarond de Galar → Darumacho de Galar ; Crabagarre → Crabominable ; Piétacé → Balbalèze |
| Lune | Nidorina → Nidoqueen ; Nidorino → Nidoking ; Mélofée → Mélodelfe ; Rondoudou → Grodoudou ; Skitty → Delcatty ; Munna → Mushana |
| Soleil | Ortide → Joliflor ; Tournegrin → Héliatronc ; Doudouvet → Farfaduvet ; Chlorobule → Fragilady ; Galvaran → Iguolta |
| Éclat | Togetic → Togekiss ; Rosélia → Roserade ; Chinchidou → Pashmilla ; Floette → Florges, avec couleur conservée pour les formes ordinaires du catalogue |
| Nuit | Cornèbre → Corboss ; Feuforêve → Magirêve ; Mélancolux → Lugulabre ; Dimoclès → Exagide |
| Aube | Kirlia **mâle** → Gallame ; Stalgamin **femelle** → Momartik |

Les versions régionales de Raichu, Noadkoko et Fragilady demandent en plus leur
objet de région : voir la section 7. Les formes normales de Goupix, Sabelette et
Darumarond ne peuvent pas emprunter la branche réservée à leur forme régionale.
« Piment » et « Eelektrik » du PDF sont rapprochés ici des entrées Pimito et Lampéroie du catalogue.

### Objets de forme et de région

| Pokémon | Destination | Objet et autres conditions |
| --- | --- | --- |
| Verpom | Pomdrapi | Pomme Acide / Acidulée |
| Verpom | Dratatin | Pomme Sucrée |
| Verpom | Pomdramour | Pomme Nectar |
| Théffroi Contrefaçon | Polthégeist Contrefaçon | Théière Fêlée |
| Théffroi Authentique | Polthégeist Authentique | Théière Ébréchée |
| Poltchageist Imitation | Théffroyable Médiocre | Bol Médiocre |
| Poltchageist Onéreux | Théffroyable Exceptionnel | Bol Exceptionnel |
| Ramoloss de Galar | Flagadoss de Galar | Bracelet Galanoa |
| Ramoloss de Galar | Roigada de Galar | Couronne Galanoa |
| Charbambin | Carmadura | Armure Fortune |
| Charbambin | Malvalame | Armure Rancune |
| Ursaring | Ursaking | Bloc de Tourbe ; aucune pleine lune vérifiée |
| Insécateur | Hachécateur | Obsidienne |
| Duralugon | Pondralugon | Métal Composite |
| Pomdramour | Pomdorochi | Manuscrit Ancien ; pas de pomme |

**Écart avec le PDF :** il associe « Pomme en Alliage » à Pomdramour.
Dans l’app, `syrupy-apple` est la **Pomme Nectar**, utilisée par **Verpom pour
devenir Pomdramour**. L’étape suivante utilise le Manuscrit Ancien pour remplacer
Cri Draconique. Le Métal Composite concerne Duralugon.

## 5. Échanges

### Échange simple → 1 Câble Link consommé

| Pokémon de départ | Destination |
| --- | --- |
| Kadabra | Alakazam |
| Machopeur | Mackogneur |
| Gravalanch, normal ou Alola | Grolem de la même région |
| Spectrum | Ectoplasma |
| Géolithe | Gigalithe |
| Ouvrifier | Bétochef |
| Brocélôme | Desséliande |
| Pitrouille | Banshitrouye, avec la taille conservée |

Aucun autre joueur, réseau ou second éditeur n’est nécessaire.

### Échange avec objet → l’objet seul est consommé

Il ne faut **pas ajouter un Câble Link** aux objets suivants.

| Pokémon | Destination | Objet consommé |
| --- | --- | --- |
| Onix | Steelix | Peau Métal |
| Insécateur | Cizayox | Peau Métal |
| Têtarte | Tarpaud | Roche Royale |
| Ramoloss normal | Roigada | Roche Royale |
| Hypocéan | Hyporoi | Écaille Draco |
| Porygon | Porygon2 | Améliorator |
| Porygon2 | Porygon-Z | CD Douteux |
| Rhinoféros | Rhinastoc | Protecteur |
| Élektek | Élekable | Électriseur |
| Magmar | Maganon | Magmariseur |
| Téraclope | Noctunoir | Tissu Fauche |
| Barpau | Milobellus | Bel’Écaille ; pas de jauge de beauté |
| Fluvetin | Cocotine | Sachet Senteur |
| Sucroquin | Cupcanaille | Chantibonbon |
| Coquiperl | Serpang | Dent Océan |
| Coquiperl | Rosabyss | Écaille Océan |

### Échange spécifique

| Pokémon | Destination | Dans l’app |
| --- | --- | --- |
| Carabing | Lançargot | Câble Croisé + posséder un Escargaume |
| Escargaume | Limaspeed | Câble Croisé + posséder un Carabing |

Le partenaire n’est ni consommé ni évolué simultanément. Pour obtenir les deux
destinations à partir d’un seul exemplaire de chaque, il faut donc prévoir un
doublon ou recapturer le partenaire après la première évolution.

## 6. Cas uniques

| Pokémon | Destination | Gestion exacte dans l’app |
| --- | --- | --- |
| Canarticho de Galar | Palarticho | Manuscrit Ancien ; les trois coups critiques ne sont pas simulés |
| Tutafeh de Galar | Tutétékri | **Un seul Masque Maudit** remplace à la fois les dégâts et l’arche ; pas deux objets |
| Bargantua Blanc | Paragruel | Masque Maudit ; le genre détermine la forme mâle/femelle ; pas de compteur de 294 PV |
| Scalproie | Scalpereur | Emblème du Général ; pas de combats à remporter |
| Mordudor | Gromago | **999 pièces de Mordudor**, consommées ; ce sont les objets, pas la monnaie générale |
| Crèmy | Charmilly | Choix parmi **63 variantes** ; 1 sucre de la bonne sorte et l’heure requise ; pas de rotation |
| Wushours | Shifours Poing Final / Mille Poings | Rouleau des Ténèbres / de l’Eau ; pas de tour à visiter ni de niveau 70 requis par l’évolution |
| Meltan | Melmetal | **400 Bonbons Pokémon GO**, consommés ; aucune connexion à Pokémon GO |
| Ningale | Ninjask + éventuel Munja | Niveau 20 ; Ninjask est l’évolution principale. Si une **Poké Ball standard** est disponible, elle est consommée et Munja est ajouté |

Pour Munja, la collection n’a pas de limite de places : aucun contrôle de place
libre dans une équipe n’est nécessaire. Sans Poké Ball standard, Ningale peut
quand même devenir Ninjask. Le seuil de **100 Balls** visible dans une mission
est une condition de récompense de mission, pas une condition d’évolution.

### Détail de Charmilly

Chaque crème ci-dessous se combine avec chacun des sept sucres : Fraise, Baie,
Cœur, Trèfle, Fleur, Étoile et Ruban. Cela donne 9 × 7 = 63 destinations.

| Crème | Heure réelle requise |
| --- | --- |
| Lait Vanille, Lait Ruby, Mélange Ruby, Mélange Caramel | Jour |
| Lait Matcha, Lait Menthe, Lait Citron, Lait Salé | Nuit |
| Mélange Tricolore | Crépuscule |

La durée et le sens de rotation sont remplacés par le choix explicite de la crème.

## 7. Évolutions déterminées par la région

Il n’y a pas de carte de régions à explorer : l’objet ci-dessous simule le voyage.
Les branches normales restent proposées séparément lorsqu’elles existent.

| Départ → forme régionale | Conditions réelles dans l’app |
| --- | --- |
| Pikachu → Raichu d’Alola | Pierre Foudre + Sable d’Alola |
| Noeunoeuf → Noadkoko d’Alola | Pierre Plante + Sable d’Alola |
| Osselait → Ossatueur d’Alola | Niveau 28 + nuit + Sable d’Alola |
| Smogo → Smogogo de Galar | Niveau 35 + Vapeur de Galar |
| Mime Jr. → M. Mime de Galar | Manuscrit Ancien + Vapeur de Galar |
| Feurisson → Typhlosion de Hisui | Niveau 36 + Carte de Voyage |
| Mateloutre → Clamiral de Hisui | Niveau 36 + Carte de Voyage |
| Efflèche → Archéduc de Hisui | Niveau 36 + Carte de Voyage (la branche normale demande 34) |
| Chlorobule → Fragilady de Hisui | Pierre Soleil + Carte de Voyage |
| Furaiglon → Gueriaigle de Hisui | Niveau 54 + Carte de Voyage |
| Mucuscule → Colimucus de Hisui | Niveau 40 + Carte de Voyage |
| Grelaçon → Séracrawl de Hisui | Niveau 37 + Carte de Voyage |

Le voyage s’applique à l’étape indiquée : il faut Feurisson, Mateloutre ou Efflèche
pour l’évolution finale du starter. Colimucus de Hisui devient ensuite Muplodocus
de Hisui au niveau 50 avec une Pierre Eau, sans seconde Carte de Voyage.

## 8. Autres cas déjà gérés, non détaillés dans le PDF

Le PDF ne couvre pas tous les cas particuliers du catalogue. Les suivants sont
également présents dans l’app ; ils ont été examinés en complément du parcours principal.

| Pokémon | Destination | Conditions réelles dans l’app |
| --- | --- | --- |
| Pandespiègle | Pandarbare | Niveau 32 + un autre Pokémon Ténèbres dans la collection |
| Toxizap | Salarsen Aigu ou Grave | Niveau 30 ; forme déterminée par une nature calculée à partir d’une valeur stable de l’individu |
| Ptiravi | Leveinard | Pierre Ovale + jour |
| Farfuret normal | Dimoret | Griffe Rasoir + nuit |
| Farfuret de Hisui | Farfurex | Griffe Rasoir + jour |

## 9. Limites et points à améliorer

1. **Les adaptations sont parfois très permissives.** Un Manuscrit Ancien peut
   permettre l’évolution dès un très faible niveau ; le moteur n’impose pas le
   niveau d’apprentissage de la capacité. Debugant et Cosmovum laissent un choix libre.
2. **La progression n’est pas toujours équilibrée.** Le Câble Link reste lié à
   la mission de 100 espèces évoluées par niveau ; la Pierre Foudre à 5 000 objets
   achetés ; la Carte de Voyage à 20 000 Poké Balls achetées. Ce sont des obstacles
   de déblocage importants, même si les règles d’évolution elles-mêmes fonctionnent.
3. **La Boussole Magnétique et certaines anciennes descriptions ne correspondent
   plus aux méthodes retenues.** Les branches de Magnéton/Tarinor/Chrysapile
   demandent une Pierre Foudre. L’ancien objet n’est pas utilisé pour ces cas.
4. **Les noms d’objets ne sont pas totalement harmonisés.** Le moteur peut afficher
   « Fil de Liaison » alors que la boutique dit « Câble Link », « Pomme Acidulée »
   au lieu de « Pomme Acide », ou « Rouleau » au lieu de « Manuscrit » pour Wushours.
   Les identifiants d’inventaire sont communs : il s’agit des mêmes objets.
5. **Le temps n’est pas du temps actif.** Une pause hors de l’app compte pour
   l’amitié et la promenade. L’horloge et le fuseau local peuvent modifier les
   possibilités jour/nuit d’un PC à l’autre.
6. **Les variantes cachées sont propres à PokeIdle.** Chenipotte, Famignol et
   Deusolourdo utilisent un calcul stable à partir de l’identifiant individuel.
   Recliquer ou transférer la sauvegarde ne change pas le résultat ; ce calcul ne
   prétend pas reproduire une valeur importée des jeux Pokémon.
7. **Le catalogue ne prouve pas à lui seul une transaction complète.** Les données
   d’apparence sont encore chargées depuis PokéAPI au moment de l’évolution.
   Une connexion est nécessaire si elles ne sont pas en cache pendant la session.

### Obtention des objets

Si un objet a une mission, il faut en réclamer la récompense pour le débloquer
en boutique. S’il n’a aucune mission, il devient achetable avec un Pokémon de
la collection dont une option d’évolution le demande. Ce dernier déblocage
ne dispense pas des conditions restantes de l’évolution. Le premier prix est
généralement cinq fois le prix de base défini pour l’objet.

**Conclusion :** les méthodes du PDF sont présentes, mais beaucoup sont des
équivalents idle, avec des différences de difficulté. Les priorités d’amélioration
sont l’équilibrage des déblocages, la cohérence des noms/descriptions et la définition
du temps actif souhaité pour l’amitié et la marche.

## Sources de l’audit

- [PDF fourni](</C:/Users/Hugo Degusseau/Desktop/Poke_Code/Liste Exhaustive des Évolutions Spéciales Pokémon V2.pdf>) : quatre pages, six catégories.
- [Moteur des conditions](</C:/Users/Hugo Degusseau/Desktop/Poke_Code/media/evolutions.js:45>) : calcul réel des options et adaptations.
- [Catalogue embarqué](</C:/Users/Hugo Degusseau/Desktop/Poke_Code/media/evolution-data.js>) : espèces, formes, objets et règles retenues.
- [Interface, transaction et missions](</C:/Users/Hugo Degusseau/Desktop/Poke_Code/media/main.js:1261>) : évolution manuelle, consommation et cas de Munja ; missions et boutique dans le même fichier.

Ce rapport décrit le comportement actuel. Il ne modifie pas les règles de l’application.
