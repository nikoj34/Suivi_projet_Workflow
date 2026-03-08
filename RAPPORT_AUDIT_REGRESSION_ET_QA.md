# Rapport d'audit fonctionnel et de régression — Post‑correctifs Firebase

**Contexte** : Correctifs appliqués (useCallback sur handleSilentSave / handleSave, useRef dans ProjectForm, optimistic update + projectsRef dans App) pour stopper la boucle Firebase. Régression signalée : déplacement des tâches (Kanban, TableView, changement de statut) ne fonctionne plus correctement.

---

## MISSION 1 — Diagnostic de la régression « déplacement des tâches »

### 1.1 Chaîne d’exécution analysée

- **BoardView** : au drop, `moveTask()` construit `updProj` (projet avec `tasks` mis à jour) et appelle `onSilentSave(updProj)`.
- **TableView** : `updateTask()` / `deleteTask()` construisent le projet mis à jour et appellent `onSilentSave(...)`.
- **App.jsx** : `handleSilentSave` (useCallback) reçoit ce projet, merge avec `current = projects.find(...)`, construit `withOwnerProjToSave` avec `updatedAt`, fait un **optimistic update** (`setProjects` + `setEditing`), puis `db.save(withOwnerProjToSave)`.
- **Listener onSnapshot** : à chaque snapshot Firestore, on fusionne avec `currentInState = projectsRef.current` et on préfère la version dont `updatedAt` est le plus récent pour ne pas écraser une mise à jour locale.

### 1.2 Cause racine identifiée : mise à jour de `projectsRef` en retard

- `projectsRef` est mis à jour **uniquement** dans un `useEffect` qui dépend de `projects` :
  ```js
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  ```
- Lors d’un déplacement de tâche :
  1. `handleSilentSave(updProj)` appelle `setProjects(nextList)` (optimistic update) puis `db.save(...)`.
  2. `setProjects` est asynchrone : React ne met pas à jour `projects` tout de suite.
  3. Le **ref n’est mis à jour qu’après le prochain rendu**, dans le `useEffect` déclenché par le changement de `projects`.
  4. Si le **listener onSnapshot** se déclenche entre-temps (écriture Firestore → snapshot rapide, éventuellement depuis le cache), le callback lit `currentInState = projectsRef.current` qui contient encore **l’ancienne** liste.
  5. La condition « garder la version state si plus récente » utilise donc un state périmé : `inState.updatedAt` est l’ancien, le snapshot peut être considéré comme « plus récent » ou la fusion produit des données obsolètes, et `setProjects(merged)` **écrase** l’optimistic update.
  6. Résultat : la tâche semble revenir à sa place (données du snapshot ou fusion incorrecte).

Aucune stale closure sur la **référence** de `handleSilentSave` ou sur les données envoyées (le merge `current` + `p` dans handleSilentSave est correct). Le problème est uniquement le **timing** de `projectsRef` par rapport au snapshot.

### 1.3 Solution recommandée (à appliquer dans App.jsx)

Mettre à jour **synchroniquement** `projectsRef` au moment de l’optimistic update dans `handleSilentSave`, **avant** d’appeler `db.save`, pour que le prochain passage dans le callback du snapshot voie déjà la nouvelle liste :

- Soit calculer la prochaine liste dans `handleSilentSave`, affecter `projectsRef.current = nextList`, puis appeler `setProjects(nextList)` (ou `setProjects(() => nextList)` si besoin).
- Soit, dans le callback fonctionnel de `setProjects`, après avoir calculé `list`, faire `projectsRef.current = list` avant de `return list`.

Exemple (option 1) :

```javascript
// Dans handleSilentSave, après construction de withOwnerProjToSave :
const nextList = (projectsRef.current || []).slice();
const idx = nextList.findIndex((x) => x.id === withOwnerProjToSave.id);
if (idx >= 0) nextList[idx] = withOwnerProjToSave;
else nextList.push(withOwnerProjToSave);
projectsRef.current = nextList;  // ← mise à jour synchrone du ref
setProjects(nextList);
setEditing((prev) => ...);
const promise = db.save(withOwnerProjToSave);
// ...
```

Ainsi, dès qu’un snapshot est traité après un drop, `projectsRef.current` contient déjà la version optimiste avec le nouveau `updatedAt`, et la logique « garder inState si plus récent » préserve bien le déplacement.

---

## MISSION 2 — Audit fonctionnel global (autres interactions)

- **handleSave (sauvegarde formulaire)** : useCallback avec `[currentUid, refresh]`. Pas de dépendance à `projects` pour l’écriture ; `refresh()` relit `db.all()` et met à jour la liste. Pas de risque de stale closure sur la liste pour cette action.
- **handleDelete / handleArchive / handleRestore** : utilisent `projects.find(...)` et ne sont pas mémorisés ; ils voient toujours le dernier `projects`. Aucun impact des correctifs.
- **Création de projet (handleSave ou nouveau + handleSilentSave)** : même logique que déplacement ; si la régression ref est corrigée, cela reste cohérent.
- **Réordonnancement (handleReorderProjects)** : utilise `projects` en closure et `Promise.all(db.save(...))` puis `setProjects` ; pas de ref utilisé ici. Pas de régression identifiée.
- **Paramètres / tags (SettingsModal, addTag, setTagStyle)** : appellent `onSave(config)` ou `db.saveCfg` ; pas de `handleSilentSave` ni de `projectsRef`. Aucun impact.
- **ProjectForm (auto-save, visibility, unmount)** : utilise `onSilentSaveRef.current`, donc toujours la dernière référence ; pas de régression liée aux correctifs.
- **TableView (champ assignee debounced)** : appelle `onSilentSave` comme pour le reste ; même cause et même correction que le déplacement (ref mis à jour à l’optimistic update).

**Autres bugs silencieux potentiels** (hors correctifs) :

- Aucun autre bug évident lié aux useCallback/useRef n’a été repéré. Le seul point bloquant identifié pour le déplacement des tâches est la mise à jour tardive de `projectsRef` par rapport au snapshot.

---

## MISSION 3 — Workflow de test (QA Plan) — Checklist

Utiliser cette checklist pour un test manuel après correction du bug `projectsRef`.

### Connexion et démarrage

- [ ] Connexion (email/mot de passe) : succès et redirection.
- [ ] Accès local sans compte : bouton « Continuer sans connexion » (si affiché) et chargement des données.
- [ ] Déconnexion : retour à l’écran de connexion.

### Projets (Suivi des opérations / Liste)

- [ ] Affichage de la liste des projets/opérations.
- [ ] Création d’un nouveau projet : formulaire, sauvegarde, apparition dans la liste.
- [ ] Ouverture d’un projet existant (édition) : formulaire pré-rempli, onglets (Général, Planning, Tâches, etc.).
- [ ] Modification générale (titre, dates, etc.) et sauvegarde : données mises à jour et persistées.
- [ ] Suppression d’un projet : confirmation, disparition de la liste.
- [ ] Archivage : projet passe en archivé et disparaît de la liste active.
- [ ] Restauration depuis les archives : projet réapparaît en actif.
- [ ] Duplication : nouveau projet créé avec tâches copiées, pas d’écrasement de l’original.
- [ ] Réordonnancement (si disponible) : glisser-déposer l’ordre des projets, sauvegarde et rechargement.

### Tâches — Vue Kanban (Suivi des tâches / BoardView)

- [ ] Affichage des colonnes (À faire, En cours, À valider, Terminé, etc.) et des cartes.
- [ ] Glisser-déposer une tâche d’une colonne à une autre : la carte reste dans la nouvelle colonne après relâchement.
- [ ] Glisser-déposer vers « À valider » : la tâche reste bien en « À valider ».
- [ ] Glisser-déposer depuis « À valider » vers une autre colonne : la tâche se déplace et reste en place.
- [ ] Rafraîchissement ou reconnexion : les déplacements restent persistés (pas de retour en arrière).
- [ ] Création d’une nouvelle tâche (bouton + modal) : tâche créée et visible dans la colonne choisie.
- [ ] Clic sur une tâche : ouverture du panneau détail (ItemDetailPanel).
- [ ] Modification dans le panneau détail puis sauvegarde : changements visibles sur la carte et après rechargement.

### Tâches — Vue Tableau (TableView)

- [ ] Affichage des lignes (projet, tâche, statut, priorité, responsable, échéance, etc.).
- [ ] Changement de statut (select) : mise à jour immédiate et persistance.
- [ ] Changement de priorité (select) : idem.
- [ ] Case à cocher « Terminé » : tâche marquée terminée et persistance.
- [ ] Champ Responsable (assignee) : saisie, debounce ~800 ms, puis une seule sauvegarde et persistance.
- [ ] Champ Date d’échéance : changement et persistance.
- [ ] Suppression d’une tâche (bouton) : confirmation, disparition de la ligne.
- [ ] Ouverture du détail (clic ligne) : panneau détail, modifications et sauvegarde cohérentes.

### Tâches — Onglet Tâches d’un projet (ProjectForm / Kanban projet)

- [ ] Ouverture d’un projet → onglet Tâches : colonnes et cartes affichées.
- [ ] Glisser-déposer entre colonnes : déplacement persistant (y compris vers « À valider »).
- [ ] Création / modification / suppression de tâches dans cet onglet : cohérence avec la liste et les vues globales.

### Paramètres et configuration

- [ ] Ouverture Paramètres (ou Config) : formulaire affiché.
- [ ] Modification du logo : enregistrement et affichage mis à jour.
- [ ] Export JSON : fichier téléchargé, contenu lisible.
- [ ] Import JSON : chargement et remplacement des données (avec avertissement si attendu).
- [ ] Ajout / modification / suppression de tags (catégories de tâches) : sauvegarde et affichage sur les cartes/lignes.
- [ ] Sauvegardes automatiques (historique local) : création, liste, restauration (si applicable).

### Synchro et indicateurs (si mode cloud)

- [ ] Indicateur de statut cloud (vert / orange / rouge) cohérent avec la connexion.
- [ ] Après une sauvegarde (déplacement, édition) : pas d’explosion de requêtes (vérifier console / réseau si besoin).
- [ ] Pas de retour en arrière des déplacements après un court délai (snapshot ne doit pas écraser l’optimistic update une fois le correctif ref appliqué).

### Recherche et navigation

- [ ] Raccourci Ctrl/Cmd+K (ou bouton) : ouverture de la recherche.
- [ ] Recherche par texte : résultats pertinents, ouverture d’un projet depuis les résultats.
- [ ] Navigation entre vues (Dashboard, Board, Table, Liste, Archives, etc.) : pas d’erreur, données cohérentes.

### Autres

- [ ] Centres de vue spécifiques (Validation, Workflow, Charge, etc.) : affichage et actions principales sans erreur.
- [ ] Temps de travail (modal si utilisée) : sauvegarde et rechargement des préférences.
- [ ] Contacts / interlocuteurs (si utilisés) : ajout et affichage.

---

## Synthèse

| Élément | Verdict |
|--------|--------|
| **Cause de la régression « déplacement des tâches »** | Mise à jour de `projectsRef` uniquement dans un `useEffect(..., [projects])`, donc en retard par rapport au callback du snapshot qui peut écraser l’optimistic update. |
| **Solution** | Mettre à jour `projectsRef.current` de façon synchrone au moment de l’optimistic update dans `handleSilentSave` (avant ou dans le même flux que `setProjects`). |
| **Stale closure sur handleSilentSave** | Non : le merge avec `p` (données envoyées par BoardView/TableView) est correct ; la référence est stable grâce au useCallback. |
| **Autres régressions détectées** | Aucune autre régression identifiée liée aux correctifs useCallback/useRef. |
| **Checklist QA** | Liste ci‑dessus à valider manuellement après application du correctif sur `projectsRef`. |
