# Évolutions classiques

Dans **Pokédex → Ma Collection**, cliquer sur **Voir les conditions** ou
**Évolution prête !**, puis choisir la destination. Les embranchements ne sont
plus sélectionnés automatiquement. Le bouton **Actualiser les conditions**
actualise l’heure, l’inventaire et les conditions pendant que le panneau est ouvert.

Le catalogue embarqué provient des CSV publics de
[PokéAPI](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv) :
641 règles canoniques pour 484 espèces évoluées, avec les formes régionales,
les variantes de genre, etc. Charmilly est réduit à une seule apparence dans le jeu. Les Méga-Évolutions,
Gigamax et formes temporaires de combat sont exclues du catalogue.
Les formes de déplacement de Koraidon et Miraidon ne sont pas proposées comme
rencontres ; leur forme canonique reste possible. Les tenues de Pikachu, Pichu
Troizépi, Évoli Partenaire et autres variantes d’apparence restent des variantes
possibles d’une seule espèce. Les formes Dominant (Totem) sont exclues des rencontres.
Les formes qui ne font que changer le
type ou l’équipement élémentaire (Deoxys, Motisma, Arceus, Genesect, Plumeline,
Silvallié) et les formes spéciales non régionales des légendaires, comme les
fusions de Kyurem ou les formes Originelles de Dialga et Palkia, sont retirées du
tirage. La Boussole
Magnétique n’est plus requise : Magnéton, Tarinor et Chrysapile utilisent une
Pierre Foudre à la place de leur évolution par lieu.

## Conditions dans le jeu idle

Les niveaux, objets, quantités, genres et partenaires dans la collection sont
vérifiés. Jour : 7 h–19 h ; nuit : 19 h–7 h ; crépuscule : 18 h–19 h,
selon l’heure locale de la machine.

Les mécanismes absents du jeu ont des équivalents explicitement indiqués dans
le panneau ; ils ne reproduisent pas exactement les jeux Pokémon :

| Condition d’origine | Adaptation idle |
| --- | --- |
| Amitié / affection | 30 min de jeu actif depuis la capture |
| Capacité apprise ou utilisée, coups critiques | Manuscrit Ancien |
| Échange | Objet tenu requis, ou Câble Link ; Câble Croisé avec le partenaire pour Carabing/Escargaume |
| Région / lieu | Objet de voyage, Sable d’Alola, Vapeur de Galar ou objet de lieu indiqué |
| Pluie | Pierre Eau |
| Dégâts / recul | Masque Maudit |
| Trois combats de Scalproie | Emblème du Général |
| Multijoueur | Câble Link |
| Console retournée | Éclat de Roche |
| Marche | Une seconde de jeu actif depuis la capture par pas requis |
| Beauté | Bel’Écaille |
| Pleine lune | Bloc de Tourbe seul |
| Rotation de Crèmy | Un sucre quelconque ; une seule apparence de Charmilly, sans condition d’heure |
| Statistiques de Debugant | Choix libre de la branche d’entraînement |

Mordudor demande 999 pièces de Mordudor ; Meltan, 400 Bonbons Pokémon GO.
Munja est ajouté avec Ninjask si une Poké Ball standard est disponible ; celle-ci
est consommée. Les variantes rares et la nature de Toxizap sont déterminées
par une valeur stable de l’individu, conservée avec la sauvegarde entre machines.

Les objets se débloquent via les parcours de l’onglet **Défis**. Le premier palier
offre un exemplaire et ouvre l’achat ; les deux suivants donnent des exemplaires
supplémentaires et des remises de 20 %, puis 40 %. Les objectifs proposent plusieurs
voies, dont l’élevage d’un Pokémon compatible ou la progression de la collection.
Les anciens déblocages identifiables sont conservés. Voir **DEFIS.md** pour la liste.

## Temps de jeu actif

L’amitié, la marche, les missions de durée, l’XP, les pièces passives et le délai
entre apparitions utilisent une horloge sauvegardée de jeu actif. Aucun temps
n’est ajouté à la réouverture du jeu ou au réveil du PC. Les longues interruptions
du moteur (plus de 5 secondes entre deux ticks), les synchronisations et les
pages fermées/suspendues ne sont pas rattrapées. Les fractions déjà acquises
pour le prochain gain d’XP ou de pièces sont conservées à la fermeture.

Il faut un panneau PokeIdle chargé dont le moteur continue de fonctionner ;
ouvrir uniquement l’éditeur sans charger le jeu ne suffit pas. Le contexte du
panneau est conservé lorsqu’il est masqué dans les éditeurs compatibles VS Code,
mais un panneau suspendu par l’hôte reste en pause. Les onglets Safari/Pokédex/
Boutique ne changent pas le fonctionnement de l’horloge. Le total est affiché
dans les paramètres. Jour/nuit reste basé sur l’heure locale réelle du PC.

Au premier chargement d’une ancienne sauvegarde, les compteurs de durée sont
initialisés à zéro : les anciens horodatages ne permettent pas de mesurer le
temps réellement joué. Aucun Pokémon, niveau, XP, objet, pièce ou récompense
déjà réclamée n’est retiré. Les compteurs sont ensuite sauvegardés et transférés
avec la partie ; ils reprennent à leur valeur enregistrée sur une autre machine.
« Session Marathon » demande cinq heures de jeu actif cumulées entre les sessions.

## Données et sauvegardes

Chaque espèce compte une seule fois dans le Pokédex, les découvertes et le filtre
des doublons. Une forme est tirée au hasard après le tirage de l’espèce au Safari
(exemples : les 28 formes de Zarbi ou les 3 capes de Cheniti), puis conservée dans
la sauvegarde. Le nombre de formes n’augmente pas la probabilité de rencontrer l’espèce.
Les exemplaires d’une même espèce sont regroupés sous une seule fiche dépliable ;
chaque individu garde son niveau, son XP et sa propre évolution. Les variantes
déjà observées sont indiquées sur l’unique case nationale de l’espèce.

La rareté des rencontres progresse avec le niveau du joueur et plafonne au niveau
50 : au maximum, les légendaires et fabuleux réunis représentent 1 % des apparitions,
les pseudo-légendaires 2 %, les espèces au taux de capture PokeAPI inférieur ou égal
à 45 représentent 4 %, et celles au taux de 46 à 100 représentent 3 %. Ces groupes
sont disjoints et leur fréquence augmente progressivement depuis zéro au niveau 1.
Le taux de capture PokeAPI sert de proxy de rareté ; ce n’est pas un taux de rencontre
commun à tous les jeux Pokémon.

Crèmy propose une seule destination, Charmilly. Les sept objets en Sucre restent
utilisables, à raison d’un sucre consommé par évolution. Les Charmilly déjà capturés
prennent l’apparence standard, sans supprimer d’individu ni modifier son niveau ou son XP.

`media/evolution-data.js` est généré par `python scripts/build-evolutions.py`.
La date et les empreintes SHA-256 des CSV sont incluses dans le fichier.
`media/evolutions.js` calcule à la fois l’aperçu et les conditions réellement
appliquées ; les données d’apparence du Pokémon cible sont chargées depuis
PokéAPI au moment de l’évolution et mises en cache pendant la session.

Les téléchargements précèdent la consommation des objets. La partie, la présence
de l’individu et les conditions sont vérifiées à nouveau après le téléchargement.
L’identifiant individuel, le niveau, l’XP, la date de capture et le statut shiny
sont conservés. Les anciens individus reçoivent leur identifiant de forme au
chargement ; aucune réinitialisation de partie n’est nécessaire.
