# Retrouver ma partie PokeIdle sur mes PC

## Première configuration

1. Installe Node.js et GitHub CLI (`gh`) sur le PC.
2. Double-clique sur **Sauvegarde-PokeIdle.cmd** dans ce dossier.
3. Choisis **1 — Première configuration GitHub**.
4. Connecte ton compte GitHub dans le navigateur si demandé.
5. Indique le dépôt **Rombulus/Poke_Code** et la branche **pokeidle-save**.
6. Confirme que tu acceptes la visibilité publique de cette branche.

L'outil crée la branche si elle n'existe pas, puis synchronise la partie. Il modifie uniquement `poke-idle-save.json` sur cette branche. GitHub conserve un commit par envoi. La branche de développement n'est pas modifiée. Aucun jeton n'est enregistré dans le code ou dans la partie ; la connexion est gérée par GitHub CLI.

Le dépôt du projet est public : la sauvegarde sur cette branche est publique également, comme autorisé lors de la configuration. Tu peux alternativement utiliser un dépôt privé dédié.

Sur les autres PC, refais ces étapes avec **le même compte, le même dépôt et la même branche**. Une partie distante est chargée telle quelle si aucune partie locale différente n'existe. Si deux parties différentes existent, elles sont conservées et un choix est demandé.

## Au quotidien

Dans **Paramètres → Sauvegarde GitHub** :

- **Synchroniser maintenant** : récupère ou envoie les changements suivant la dernière version commune.
- **Push · envoyer ma partie** : envoie la partie locale si cela n'écrase pas une nouvelle version distante.
- **Pull · récupérer ma partie** : récupère la partie distante si cela n'écrase pas des changements locaux non envoyés.
- **Configurer le dépôt et la branche** : raccorde ce PC à la destination indiquée (après connexion GitHub CLI).

Le jeu synchronise au chargement et toutes les minutes tant que le panneau est visible. Les envois ne créent un commit que si la partie a changé. Le calcul des gains est brièvement suspendu pendant une synchronisation dans le panneau.

**Avant de changer de PC : clique sur Synchroniser et attends « Synchronisé avec GitHub ».** Une fermeture brutale peut laisser des changements uniquement sur le PC. Ils restent enregistrés localement.

## Avec un terminal

```sh
npm run save -- login
npm run save -- setup Rombulus/Poke_Code --branch pokeidle-save --allow-public
npm run save -- sync
npm run save -- push
npm run save -- pull
npm run save -- status
npm run save -- export
```

Ferme les panneaux de jeu avant de lancer un Pull ou une résolution de conflit depuis le terminal. Les panneaux ouverts sur une ancienne version seront empêchés de réenregistrer cette version : rouvre-les pour charger la partie actuelle.

## En cas de conflit

Le jeu ne fusionne jamais automatiquement les pièces, Pokémon ou objets. Les deux parties sont copiées dans le dossier local `conflicts`.

Dans les paramètres, choisis **Garder la partie de ce PC** ou **Reprendre la partie GitHub**, puis confirme. Le menu Windows propose aussi ces choix. Dans le terminal :

```sh
npm run save -- keep-local
npm run save -- keep-github
```

Ces commandes demandent de taper `OUI`. Rejouer hors connexion sur deux PC crée deux branches de progression : il faut choisir laquelle continuer.

## Emplacement des fichiers

Tous les outils mis à jour utilisent le même dossier utilisateur :

- Windows : `%USERPROFILE%\.pokeidle\`
- macOS / Linux : `~/.pokeidle/`

`storage.json` contient la partie et sa révision locale, `storage.previous.json` la copie précédente, `github.json` le dépôt et la branche, et `github-checkpoint.json` la dernière version commune. Le JSON envoyé sur GitHub contient uniquement la partie, sans les paramètres locaux.

Au premier lancement, la sauvegarde Codex du projet `.pokeidle/storage.json` est copiée vers ce dossier s'il est encore vide ; à défaut, l'ancien fichier utilisateur `.poke-idle-save.json` est repris. Les originaux restent présents. Une sauvegarde utilisateur déjà existante n'est jamais remplacée par la migration.

## Installation dans les éditeurs

- Codex : sur un nouveau PC, copie ce dossier puis double-clique sur **Installer-PokeIdle-Codex.cmd**. Ce lanceur enregistre le chemin de ce PC et installe le plugin local. La commande `codex` doit être disponible. Pour une mise à jour sur ce PC, `codex plugin add pokeidle-codex@pokeidle-local` suffit. Ferme et rouvre le panneau ; si l'ancien panneau persiste, quitte entièrement Codex et relance-le.
- VS Code et éditeurs compatibles avec ses extensions : dans Extensions, choisis **Installer à partir d'un VSIX**, puis sélectionne `artifacts/pokeidle-1.0.2.vsix`. Recharge l'éditeur. L'ancienne version 0.9.0 continue d'utiliser son ancien système ; elle ne doit pas tourner en parallèle.
- Navigateur local : lance `npm run codex`, puis ouvre `http://127.0.0.1:4173`.

L'installation d'une extension dans un éditeur donné reste à vérifier dans cet éditeur. Le menu Windows fonctionne indépendamment de l'éditeur.
