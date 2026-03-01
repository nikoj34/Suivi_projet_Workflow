# Suivi Travaux — Installation une fois, puis toujours en mode cloud

## Principe (comme un logiciel classique)

1. **Une seule fois** : vous déployez l’application sur Firebase Hosting (gratuit). C’est l’« installation ».
2. **Ensuite** : vous et vos collègues ouvrez l’app dans le navigateur (ou un raccourci bureau vers l’URL). **Aucun terminal, aucun lanceur.** Toujours en **mode cloud** (synchronisation Firestore).

---

## Installation unique (à faire une fois par la personne qui gère le projet)

### Prérequis
- Un compte Google (celui utilisé pour Firebase).
- Node.js installé sur la machine (pour la commande de déploiement).  
  Téléchargement : https://nodejs.org (version LTS). Une fois installé, plus besoin d’y toucher.

### Étapes

1. **Ouvrir un terminal** dans le dossier du projet (celui qui contient `cirad_travaux1.html` et `firebase.json`).

2. **Installer l’outil Firebase** (une seule fois sur cette machine) :
   ```bash
   npm install -g firebase-tools
   ```

3. **Se connecter à Firebase** :
   ```bash
   firebase login
   ```
   Une page web s’ouvre pour vous connecter avec votre compte Google.

4. **Déployer l’application** :
   ```bash
   firebase deploy
   ```

5. À la fin, Firebase affiche l’URL de l’app, par exemple :
   ```text
   Hosting URL: https://cirad-suivi-projets.web.app
   ```

Cette URL est celle de votre application. **Inutile de refaire ces étapes** sauf si vous modifiez le projet et voulez mettre à jour la version en ligne.

---

## Utilisation au quotidien (vous et vos collègues)

**Mac et PC (Windows) : même chose.** L’app est une application web : on ouvre l’URL dans un navigateur (Chrome, Edge, Firefox). Aucune différence entre iMac et PC.

- **Ouvrir l’application** : dans le navigateur, aller sur **https://cirad-suivi-projets.web.app** (ou l’URL indiquée après `firebase deploy`).
- **Raccourci bureau** : créer un raccourci vers cette URL (glisser-déposer l’icône de l’onglet sur le bureau, ou « Créer un raccourci » / « Épingler » dans le menu du navigateur).
- **Favoris** : ajouter la page aux favoris (Ctrl+D sur PC, Cmd+D sur Mac).

Aucun terminal, aucun lanceur. On ouvre l’URL (ou le raccourci) → écran de **connexion** (e-mail + mot de passe) → puis l’app en mode cloud.

**Connexion par identifiant obligatoire** : toute personne doit se connecter avec un e-mail et un mot de passe. Pas d’accès sans identifiant.

**Bases séparées** : chaque utilisateur ne voit et ne modifie que **ses propres projets**. Un **manager** peut en plus voir les projets des membres de son équipe : dans l’app, **Paramètres** → section **Manager** → coller les UID des agents (un par ligne) → **Enregistrer la liste**. Chaque agent peut copier son UID dans Paramètres (section Manager) pour le communiquer à son manager.

---

## Ajouter des utilisateurs (Firebase Console)

Pour donner l’accès à un collègue :

1. Allez sur https://console.firebase.google.com → projet **cirad-suivi-projets**.
2. **Authentication** → **Utilisateurs** → **Ajouter un utilisateur**.
3. Saisissez l’e-mail et un mot de passe temporaire → l’utilisateur pourra se connecter à l’app et changer son mot de passe si vous le souhaitez.

Pensez à **publier les règles Firestore** (Firestore Database → Règles → coller le contenu de `firestore.rules` → Publier).

---

## Résumé

| Qui          | Quand              | Action |
|-------------|--------------------|--------|
| Vous (admin)| Une fois            | `npm install -g firebase-tools`, `firebase login`, `firebase deploy` dans le dossier du projet. |
| Tout le monde | Chaque fois qu’il utilise l’app | Ouvrir **https://cirad-suivi-projets.web.app** (ou le raccourci / favori). |

Coût : **0 €** (Firebase Hosting gratuit pour un usage raisonnable).
