# Rapport d'audit — Explosion du quota Firebase (React + Firestore)

**Contexte** : Application React + Vite. Quota Spark dépassé en quelques heures : **~52 000 lectures** et **~20 000 écritures** pour une base contenant une douzaine de documents.

**Périmètre analysé** : Tous les fichiers sources `src/**/*.{js,jsx}` (composants, contextes, hooks, `lib/firebase.js`, `lib/storage.js`).

---

## 1. Gravité critique (boucles / effets en cascade)

### 1.1 Boucle sauvegarde ↔ snapshot ↔ re-render (cause principale des 72k requêtes)

| Fichier | Lignes | Explication du bug |
|---------|--------|--------------------|
| **App.jsx** | 301 | `handleSilentSave` est défini dans le corps du composant et **n'est pas mémorisé** (`useCallback` absent). À chaque rendu d'`App`, une **nouvelle référence** de fonction est créée. |
| **ProjectForm.jsx** | 1235–1258 | Le `useEffect` d'auto-sauvegarde (délai 2 s puis `onSilentSave(payload)`) a pour dépendances **`[form, isNew, onSilentSave, readOnly]`**. Comme `onSilentSave` change à **chaque** rendu du parent, ce `useEffect` se réexécute à chaque rendu d'`App`. Il annule le timer précédent et en programme un nouveau (2 s). **Enchaînement typique** : (1) Timer 2 s → `onSilentSave` → `db.save()` → écriture Firestore. (2) Le listener `onSnapshot(projects)` reçoit la mise à jour → callback exécuté → `setProjects(merged)` (et éventuellement `setCloudStatus`, `setLastSyncSuccessAt`). (3) `App` re-render → nouvelle `handleSilentSave` → `ProjectForm` reçoit une nouvelle prop `onSilentSave` → le `useEffect` se relance → nouveau timer 2 s. (4) Après 2 s, nouvelle sauvegarde → nouvel événement snapshot → re-render → nouveau timer… **Résultat** : sauvegardes en chaîne toutes les ~2 secondes tant que l'écran d'édition (ProjectForm) est monté, d'où des milliers d'écritures et, à chaque snapshot, des lectures sur toute la collection `projects` + doc `config/main`. |

**Pourquoi ça explose le quota** : Chaque cycle = 1 write (au moins un projet) + 1 snapshot = N reads (N = nombre de documents dans la collection). En quelques heures, cela donne facilement 10k–20k writes et 50k+ reads.

---

### 1.2 Absence de nettoyage du listener `onAuthStateChanged`

| Fichier | Lignes | Explication du bug |
|---------|--------|--------------------|
| **App.jsx** | 118–134 | `cloudAuth.onAuthStateChanged((u) => setUser(u))` est appelé dans un `useEffect` dont les dépendances sont `[cloudAuth]`. La fonction retournée par `onAuthStateChanged` (désabonnement) **n'est jamais appelée** : le `return` du `useEffect` ne fait que `clearTimeout(timeoutId)` et `clearTimeout(fallback)`. En cas de démontage/remontage du composant ou de changement de `cloudAuth`, un **nouveau** listener est ajouté sans que l'ancien soit retiré. Risque de **multiples listeners** et de mises à jour d'état après démontage (fuite + comportement imprévisible). Ce n'est pas une boucle infinie de requêtes Firestore, mais une mauvaise gestion des abonnements. |

---

## 2. Avertissements (mauvaises pratiques / performance)

### 2.1 Écritures déclenchées à chaque changement de champ (TableView)

| Fichier | Lignes | Problème |
|---------|--------|----------|
| **TableView.jsx** | 99, 106, 168–169, 202–203, 235–236, 251–252 | La fonction `updateTask` appelle `onSilentSave(...)` (donc `db.save()` → Firestore) pour **chaque** `onChange` des champs inline : case à cocher (l.168), statut (l.202), priorité (l.215), responsable/assignee (l.235), date d'échéance (l.251). Une frappe dans « Responsable » ou un clic sur la date = **1 écriture**. Pas de debounce. En session active sur la vue Tableau, cela peut générer des dizaines ou centaines d'écritures supplémentaires et amplifier le nombre total de writes. |

### 2.2 Lecture Firestore dans un `useEffect` sans garde-fou (SettingsModal)

| Fichier | Lignes | Problème |
|---------|--------|----------|
| **SettingsModal.jsx** | 169–186 | `useEffect` qui appelle `cloudDb.collection('managers').doc(cloudAuth.currentUser.uid).get()` avec les dépendances `[cloudDb, cloudAuth]`. À chaque ouverture du modal Paramètres, une lecture est faite. Si `cloudDb` ou `cloudAuth` changeaient de référence (ce n'est pas le cas actuellement dans `firebase.js`), l'effet se relancerait à chaque rendu. Bonne pratique : s'assurer que les refs sont stables et/ou ajouter une condition (ex. uniquement quand le modal est visible) pour éviter des `.get()` inutiles. |

### 2.3 Lecture `.get()` worktime à chaque changement `[user, cloudDb]` (App.jsx)

| Fichier | Lignes | Problème |
|---------|--------|----------|
| **App.jsx** | 75–89 | `cloudDb.collection('config').doc('worktime_' + user.uid).get()` est exécuté dans un `useEffect` avec `[user, cloudDb]`. À chaque fois que `user` ou `cloudDb` change (connexion, reconnexion), une lecture est faite. Comportement correct en soi, mais en cas de reconnexions fréquentes ou de refs instables, cela pourrait multiplier les lectures. Actuellement `getCloudDb()` retourne une ref stable, donc impact limité. |

### 2.4 Écritures dans le callback du listener `onSnapshot(projects)` (App.jsx)

| Fichier | Lignes | Problème |
|---------|--------|----------|
| **App.jsx** | 199–200 | Dans le callback de `cloudDb.collection('projects').onSnapshot(...)`, lorsque `snapshot.empty && localProjs.length > 0 && !isCloudMode`, le code fait un `forEach` avec `cloudDb.collection('projects').doc(p.id).set(...)` et `cloudDb.collection('config').doc('main').set(...)`. Ces écritures **dans** le listener peuvent, dans des conditions particulières (ex. première synchro, réseau instable), interagir avec le même listener et contribuer à des cycles snapshot → write → snapshot. La condition `!isCloudMode` limite le cas (en mode cloud on n'entre pas dans ce bloc), mais la logique reste fragile et peu lisible. |

### 2.5 Dépendances d'effet avec objet dérivé (ItemDetailPanel)

| Fichier | Lignes | Problème |
|---------|--------|----------|
| **ItemDetailPanel.jsx** | 21–23 | `useEffect(..., [projectId, taskId, taskFromSource?.id, taskFromSource?.status, taskFromSource?.validation?.status])`. `taskFromSource` est dérivé de `projects` et `projectId`/`taskId`. Si le parent passe un nouvel objet `projects` à chaque rendu (référence différente), les propriétés de `taskFromSource` peuvent changer d'identité et faire relancer l'effet plus souvent que nécessaire. Pas d'appel Firestore direct ici, mais risque de re-syncs et re-renders inutiles. |

### 2.6 Auto-sauvegarde et cleanup au démontage (ProjectForm.jsx)

| Fichier | Lignes | Problème |
|---------|--------|----------|
| **ProjectForm.jsx** | 1275–1284 | Le `useEffect` qui retourne une fonction de cleanup appelle `onSilentSave(payload)` au **démontage** du composant. Combiné à la dépendance `[onSilentSave, readOnly]`, si le parent se re-render souvent et que React remonte/démonte le formulaire (ou que la ref de `onSilentSave` change), le cleanup peut s'exécuter souvent et déclencher des sauvegardes supplémentaires. Cela renforce l'importance de stabiliser `onSilentSave` (useCallback côté App). |

---

## 3. Listeners Firestore (onSnapshot) — synthèse

| Fichier | Collection/Doc | Cleanup (unsubscribe) |
|---------|----------------|------------------------|
| **App.jsx** | `projects` (l.180) | Oui (l.262 : `unsubProjects()`) |
| **App.jsx** | `config/main` (l.237) | Oui (l.263 : `unsubConfig()`) |
| **App.jsx** | `managers/{user.uid}` (l.99) | Oui (l.113–115 : `unsub()`) |

Les trois `onSnapshot` retournent bien une fonction de désabonnement et sont nettoyés dans le `return` du `useEffect`. En revanche, la **réexécution** du gros `useEffect` (l.155–264) à cause de `[user, cloudDb]` désabonne et réabonne les listeners. Si `user` ou `cloudDb` changeaient souvent (refs instables), on aurait des réabonnements en rafale et donc des rafales de lectures. Dans l'état actuel (`getCloudDb()` / `getCloudAuth()` stables), le problème dominant reste la boucle liée à **ProjectForm + handleSilentSave non mémorisé**.

---

## 4. Bilan : cause probable des ~72 000 requêtes

- **Cause principale** : La **boucle sauvegarde ↔ snapshot ↔ re-render** :
  1. **ProjectForm** dépend de `onSilentSave` dans son `useEffect` d'auto-save (2 s).
  2. **App** ne mémorise pas `handleSilentSave` → nouvelle ref à chaque rendu.
  3. Chaque snapshot Firestore (`projects` / `config`) met à jour le state (`setProjects`, etc.) → re-render d'`App` → nouvelle `handleSilentSave` → réexécution de l'effet dans ProjectForm → nouveau timer 2 s.
  4. Toutes les ~2 s : sauvegarde → write Firestore → snapshot → re-render → nouveau timer → sauvegarde…

- **Conséquences** :
  - **Écritures** : ordre de grandeur de **plusieurs milliers à ~20k** en quelques heures (une sauvegarde toutes les 2 s quand l'écran d'édition est affiché).
  - **Lectures** : à chaque snapshot, lecture de toute la collection `projects` + doc `config/main` (+ éventuellement `managers/{uid}`). En chaîne avec les writes, cela explique facilement **~52k reads**.

- **Facteurs aggravants** :
  - TableView : **une écriture par changement de champ** (assignee, date, statut, priorité, case à cocher) sans debounce.
  - Pas de nettoyage de `onAuthStateChanged` dans App (fuite de listener, pas de boucle Firestore directe).

**Verdict** : L'explosion du quota est principalement due à la **combinaison** (1) **référence instable de `handleSilentSave`** dans App et (2) **utilisation de cette référence dans les dépendances du `useEffect` d'auto-sauvegarde** dans ProjectForm, entraînant une boucle écriture → snapshot → re-render → nouvel effet → écriture. Les bonnes pratiques (debounce des saves en tableau, cleanup de `onAuthStateChanged`, stabilité des refs passées aux enfants) permettraient de réduire encore les requêtes et les risques de régression.
