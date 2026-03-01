# Tester la connexion — Suivi Travaux

Guide minimal pour vous connecter et vérifier que l’app et le cloud fonctionnent.

---

## Étape 1 : L’app est-elle en ligne ?

- Ouvrez dans le navigateur : **https://cirad-suivi-projets.web.app**

**Si vous voyez « Site Not Found »**  
→ L’app n’est pas encore déployée. Passez à l’étape 1b.

**Si vous voyez l’écran de connexion** (champs E-mail et Mot de passe)  
→ Passez directement à l’**Étape 2**.

### Étape 1b : Déployer l’app (une seule fois)

1. Ouvrez un **terminal** (Terminal sur Mac, ou PowerShell/CMD sur Windows).
2. Allez dans le dossier du projet :
   ```bash
   cd /Users/maison/Documents/NJ/1-LOGICIELS/Suivi_travaux
   ```
3. Lancez le déploiement :
   ```bash
   firebase deploy
   ```
4. Quand c’est terminé, rouvrez **https://cirad-suivi-projets.web.app** : l’écran de connexion doit s’afficher.

---

## Étape 2 : Se connecter

Sur l’écran de connexion :

1. **E-mail** : utilisez un des comptes déjà créés dans Firebase, par exemple :
   - `nicolas.jamet@cirad.fr`
   - ou `nikojamet@gmail.com`
2. **Mot de passe** : celui que vous avez défini pour ce compte (dans Firebase Console → Authentication → Utilisateurs).

Si vous n’avez plus le mot de passe, vous pouvez en définir un nouveau dans la console Firebase (Authentication → Utilisateurs → clic sur l’utilisateur → Réinitialiser le mot de passe ou modifier).

3. Cliquez sur le bouton de **connexion**.

---

## Étape 3 : Vérifier que ça fonctionne

Une fois connecté, vous devez voir :

- L’interface de l’app (tableau de bord, menu à gauche, etc.).
- Un **badge vert « CLOUD »** à côté du logo (en haut) : cela confirme que Firestore est connecté et que les données sont synchronisées.

Si le badge reste « LOCAL » ou « hors ligne », vérifiez que les règles Firestore ont bien été publiées (Firestore Database → Règles → Publier) avec le contenu du fichier `firestore.rules`.

---

## En résumé

| Étape | Action |
|-------|--------|
| 1 | Ouvrir https://cirad-suivi-projets.web.app (ou déployer avec `firebase deploy` si « Site Not Found »). |
| 2 | Se connecter avec un e-mail + mot de passe existant dans Firebase (Authentication → Utilisateurs). |
| 3 | Vérifier le badge **CLOUD** vert = tout fonctionne. |

Pour ajouter un autre utilisateur : **Firebase Console** → **Authentication** → **Utilisateurs** → **Ajouter un utilisateur** (e-mail + mot de passe).
