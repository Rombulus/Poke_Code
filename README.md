# 🐾 PokeIdle 🎮

> Un jeu Pokémon **"Idle"** dans la barre latérale VS Code ou le panneau navigateur de Codex Desktop.

![Version](https://img.shields.io/badge/Version-0.9.0-blue?style=for-the-badge)
![Pokémon](https://img.shields.io/badge/Pokémon-Génération_1-red?style=for-the-badge)

---

## ✨ Fonctionnalités épiques

- **🐘 Safari Interactif** : Les Pokémon apparaissent dans les hautes herbes (avec animations !).
- **📈 Progression Passive** : Tes Pokémon gagnent de l'XP et évoluent même quand tu ne regardes pas.
- **📜 Missions d'Entraîneur** : Complète des quêtes thématiques (Brasier Ardent, Source Océane...) pour gagner des pierres d'évolution rares.
- 🛒 **Boutique Complète** : Achète différentes balls (Super Ball, Hyper Ball, Sombre Ball...) pour capturer les Pokémon les plus rares.
- ☁️ **Sauvegarde Synchronisée** : Ta progression est désormais liée à ton compte VS Code (via Settings Sync). Tes Pokémon te suivent partout !

---

## 🚀 Guide d'Installation (pour tes amis)

Tu veux y jouer ? C'est super simple, suis le guide :

1.  **Prérequis** : Installe [VS Code](https://code.visualstudio.com/) et [Node.js](https://nodejs.org/).
2.  **Téléchargement** : Récupère le dossier `Poke_Code`.
3.  **Installation** : 
    - Ouvre le dossier dans VS Code.
    - Ouvre le terminal (`Ctrl + `) et tape : `npm install`.
4.  **Lancement** :
    - Double-clique sur le fichier `deploy.bat` (sur Windows).
5.  **Restart** : Relance complètement VS Code. **L'icône Pokeball apparaîtra sur la droite !**

---

## 🧩 Jouer dans Codex Desktop

### Sauvegarde commune avec GitHub

Ouvre **[SAUVEGARDE.md](SAUVEGARDE.md)** pour la configuration et le transfert entre PC. Sous Windows, **Sauvegarde-PokeIdle.cmd** propose un menu de connexion, synchronisation, Push et Pull. Les paramètres du jeu proposent les mêmes actions.

Les versions mises à jour partagent `%USERPROFILE%\.pokeidle\storage.json` sur Windows (`~/.pokeidle/storage.json` ailleurs). La première ouverture reprend la sauvegarde Codex existante, ou l'ancien fichier VS Code si aucun fichier Codex n'est disponible. Les anciennes sauvegardes sont conservées. GitHub CLI doit être connecté sur chaque PC et les mêmes dépôt et branche doivent être configurés. Pour cette partie : `Rombulus/Poke_Code`, branche `pokeidle-save` (publique).

PokeIdle peut aussi s'ouvrir dans un panneau navigateur de Codex Desktop :

1. Dans le terminal du projet, lance `npm run codex`.
2. Ouvre `http://127.0.0.1:4173` dans le panneau navigateur de Codex.
3. La progression est sauvegardée dans le stockage local du navigateur Codex. Au premier lancement, le jeu importe automatiquement le fichier `.poke-idle-save.json` de VS Code s'il existe.

Le serveur reste actif pendant la partie. Arrête-le avec `Ctrl+C`. Pour transférer la sauvegarde entre VS Code et Codex, utilise **Paramètres → Exporter JSON / Importer JSON**.

### Icône PokeIdle dans la barre latérale de Codex

Le dépôt inclut un plugin local PokeIdle avec une app de barre latérale. Lance `node scripts/install-codex.cjs` depuis ce dépôt : le script installe le plugin et enregistre son serveur MCP sur le chemin stable du projet. Le lanceur continue ainsi à fonctionner lorsque Codex remplace les dossiers de cache du plugin. Conserve le dossier du projet à cet emplacement, ou relance le script après l'avoir déplacé.

Le panneau du plugin embarque directement le jeu : il n'ouvre aucune page locale dans un iframe. Aucun serveur HTTP, hook à valider ou terminal séparé à lancer n'est nécessaire pour ce panneau. Codex initialise le plugin automatiquement et le jeu démarre à l'ouverture de son icône ou de son panneau.

La progression du panneau est enregistrée dans le dossier utilisateur `.pokeidle`, avec une copie précédente et une protection contre l'écrasement par une autre fenêtre. Les fichiers historiques dans le dossier du projet `.pokeidle` restent conservés comme sauvegardes de migration.

Pour jouer à côté d'une conversation de développement, ouvre le panneau de droite de cette conversation, puis son bouton **+ → PokeIdle**. Sous Windows, **Ctrl+Shift+B** fait défiler les dispositions jusqu'à la vue partagée. Le panneau est associé à la conversation ; le plugin ne dispose pas d'un mode overlay flottant global.

L'icône Pokéball est déclarée sur l'outil MCP et sur le serveur, en plus du logo du plugin : Codex utilise ces métadonnées pour son bouton de navigation.

Après l'installation ou une modification du lanceur, utilise **Fichier → Quitter**, puis relance Codex pour renouveler sa session technique de lancement. Fermer seulement la fenêtre peut laisser son moteur en arrière-plan. Le panneau accepte aussi les adresses de ressources des anciennes versions pour les onglets déjà ouverts. L'ancien mode navigateur (`npm run codex`) reste disponible ; son stockage navigateur et le fichier historique VS Code ne sont pas supprimés.

---

## 🕹️ Comment jouer ?

1.  **Safari** : Attends qu'un Pokémon apparaisse dans les hautes herbes (🌾).
2.  **Capture** : Utilise tes Poké Balls pour tenter de l'attraper. Attention au taux de réussite !
3.  **Pokédex** : Surveille tes Pokémon. Ils gagnent de l'XP toutes les 3 secondes.
4.  **Évolution** : Dans le Pokédex, clique sur les conditions d’évolution, puis choisis la destination. Les évolutions restent manuelles. Voir [les règles et adaptations idle](EVOLUTIONS.md).
5.  **Défis** : Les parcours de trois paliers offrent des objets, débloquent leur achat et réduisent leurs prix. Voir [la liste des défis](DEFIS.md).
6.  **Boutique** : Utilise tes PokéDollars (gagnés pendant le jeu actif) pour racheter les objets débloqués.

---

## 💡 Idées pour le Futur

- [ ] ⛈️ **Météo Dynamique** : Influence sur les types de spawns.
- [ ] 🍓 **Système de Baies** : Bonus de capture et de croissance.
- [ ] 🗺️ **Biomes déblocables** : Explore la Grotte Céleste ou les Îles Écume.
- [ ] 🏆 **Tableau des Trophées** : Affiche tes plus belles prises.

---

## 🆘 Dépannage

Si `npm install` affiche une erreur rouge :
> Lance cette commande dans ton PowerShell :
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

## 📝 Crédits
Développé avec ❤️ par **hugo**.
Propulsé par [PokeAPI](https://pokeapi.co/).
