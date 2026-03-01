# Rapport technique — État de la migration CIRAD Travaux

*Document destiné à l’analyse externe. Généré à partir de l’état actuel du dépôt.*

---

## 1. Architecture des fichiers

### 1.1 `src/components/`

| Fichier | Rôle |
|---------|------|
| **App.jsx** | Point d’entrée React : état global, routing des vues, synchronisation Firestore, gestion Auth et rôles Agent/Manager. |
| **AppErrorBoundary.jsx** | Périmètre d’erreur React pour afficher un fallback en cas d’exception dans l’arbre de composants. |
| **ArchivesView.jsx** | Vue listant les projets archivés avec restauration, édition et suppression. |
| **BoardView.jsx** | Vue Kanban des tâches (colonnes de statut), création de tâche, détail via ItemDetailPanel. |
| **CalendarView.jsx** | Affichage des tâches (et éventuellement timeline) en vue calendrier. |
| **Dashboard.jsx** | Tableau de bord : KPIs, répartition par phase, jauge budget, Gantt, échéances et retards. |
| **GlobalContacts.jsx** | Gestion du carnet d’adresses global (config.contacts) avec recherche et édition. |
| **icons.jsx** | Export d’icônes SVG (ic.Dash, ic.Plus, ic.Tr, etc.) et icônes de navigation (KanbanIcon, WorkflowIcon, etc.). |
| **ItemDetailPanel.jsx** | Panneau détail d’une tâche : édition, demande de validation, décision manager (Approuver/Rejeter), marquage lu. |
| **Layout.jsx** | Enveloppe de l’interface : sidebar, navigation, statut cloud, sauvegarde, déconnexion. |
| **LoginScreen.jsx** | Écran de connexion (email/mot de passe Firebase et accès local anonyme selon l’hébergement). |
| **ManagerView.jsx** | Vue Manager : charge par agent ou « tous ensemble », basée sur WorkloadView. |
| **ProjectForm.jsx** | Formulaire complet d’édition/création d’un projet (onglets infos, tâches, lots, planning, etc.). |
| **ProjectList.jsx** | Liste des opérations (Suivi Opérations) avec filtres, actions d’édition, archivage, duplication. |
| **SearchModal.jsx** | Modale de recherche globale (projets, tâches, journal, contacts, etc.) ouverte par Ctrl+K / Cmd+K. |
| **SettingsModal.jsx** | Paramètres : sauvegarde PC, logo, export/import, tags, backup, section Manager (tableau des agents UID). |
| **StartupScreen.jsx** | Écran de démarrage : chargement d’un fichier JSON ou démarrage à vide. |
| **TableView.jsx** | Vue tableau des tâches avec filtres et détail via ItemDetailPanel. |
| **TaskAlerts.jsx** | Bandeau des alertes (tâches en retard / échéance aujourd’hui) avec Terminer, Reporter, Masquer. |
| **ValidationView.jsx** | Centre de validation : liste des tâches en attente de validation (pending_manager) pour les projets dont l’owner est dans managerAgentIds. |
| **WorkflowView.jsx** | Mon Workflow : tâches dont validation.requestedBy === currentUserUid, sections Action requise / En attente / Archives. |
| **WorkloadView.jsx** | Ma charge : répartition du temps par projet, utilisation workTimeConfig. |
| **WorkTimeModal.jsx** | Modale de configuration du temps de travail (heures/jour, jours travaillés). |
| **GanttChart.jsx** | Composant d’affichage Gantt (utilisé dans le Dashboard ou ailleurs). |

### 1.2 `src/lib/`

| Fichier | Rôle |
|---------|------|
| **constants.js** | Constantes partagées : clés localStorage (SK), DEF_CFG, BOARD_COLS, PRIORITIES, DEFAULT_WORKTIME, etc. |
| **firebase.js** | Initialisation Firebase (Compat), exposition de getCloudDb() et getCloudAuth(). |
| **storage.js** | Couche persistance : db (localStorage + écriture Firestore), backup (IndexedDB cirad_backups), fs (File System Access API pour fichier JSON lié). |
| **utils.js** | Utilitaires : fmtDate, fmtAmt, today, addTaskLog, emailToDisplayName, isGlobalOperation, projBudget, getColDef, etc. |
| **exportUtils.js** | Export Word (Blob), export PDF (fenêtre print), génération HTML de synthèse (genAllProjectsRecap, genCoverPage, etc.). |

---

## 2. Gestion de l’état global (App.jsx)

### 2.1 Variables d’état (useState)

| État | Rôle |
|------|------|
| `view` | Vue courante : dashboard, board, list, edit, workflow, validation, managerView, workload, archives, contacts, config, new. |
| `boardSubView` | Sous-vue du board : kanban, table, calendar. |
| `boardTaskFilter` | Filtre tâches (uniquement si manager) : mine, all, ou UID d’un agent. |
| `projects` | Liste en mémoire de tous les projets (source : localStorage + Firestore). |
| `config` | Configuration applicative (logo, tags, contacts, etc.). |
| `editing` | Projet actuellement en édition (ou null). |
| `editTab` | Onglet présélectionné dans ProjectForm (ex. 'tasks'). |
| `lastBackup` | Date/heure de la dernière sauvegarde (affichage Layout). |
| `fileLinked` | Fichier JSON lié via File System Access (oui/non). |
| `fileName` | Nom du fichier lié. |
| `showSearch` | Affichage de la modale SearchModal. |
| `showStartup` | Affichage de l’écran de démarrage (fichier vide ou non chargé). |
| `cloudStatus` | 'connecting' | 'online' | 'offline'. |
| `user` | Utilisateur Firebase (ou null, ou undefined pendant le chargement). |
| `managerAgentIds` | Liste des UID des agents gérés par le manager (Firestore managers/{uid}). |
| `managerAgentLabels` | Libellés optionnels pour l’affichage des agents. |
| `workTimeConfig` | Configuration temps de travail (heures/jour, jours). |
| `showWorkTimeModal` | Affichage de WorkTimeModal. |
| `detailTaskFromValidation` | { project, task } pour le panneau détail ouvert depuis le Centre de validation. |
| `detailTaskFromWorkflow` | { project, task } pour le panneau détail ouvert depuis Mon Workflow. |
| `openNewTaskModal` | Ouverture de la modale « Nouvelle tâche » dans BoardView. |

### 2.2 Ref

- **lastSavedProjectRef** : Garde temporairement le dernier projet sauvegardé (handleSilentSave) pour éviter qu’un snapshot Firestore ne l’écrase dans les 10 secondes suivant l’écriture.

### 2.3 Handlers principaux

| Handler | Rôle |
|---------|------|
| `handleLoaded` | Après chargement d’un fichier au démarrage : ferme Startup, refresh projects/config/FS. |
| `handleFresh` | Démarrage à vide : ferme Startup. |
| `handleSave` | Sauvegarde projet (db.save), refresh, sortie de l’édition, vue list. |
| `handleSilentSave` | Sauvegarde sans changer de vue : withOwner si connecté, db.save, mise à jour de `projects` en mémoire, positionnement de lastSavedProjectRef. |
| `handleDelete` | Suppression d’un projet (confirmation, db.del, refresh). |
| `handleArchive` / `handleRestore` | Archivage ou restauration d’un projet. |
| `handleNav` | Changement de vue (et sous-vue board si table/calendar). |
| `handleLinkFile` / `handleUnlinkFile` | Liaison / déliaison du fichier JSON (fs). |
| `handleEditProject` | Ouvre un projet en édition (setEditing, setView('edit')). |
| `handleDuplicate` | Duplique un projet puis l’ouvre en édition. |
| `handleClaimUnclaimed` | Rattache tous les projets sans ownerId au compte courant (cloud). |

### 2.4 Valeurs dérivées (avant rendu)

- **currentUid** : user.uid ou 'local'.
- **myProjects** : projets sans owner ou dont ownerId === currentUid.
- **displayedProjects** : projets visibles pour l’utilisateur (anon / sans owner / owner === uid / ou owner dans managerAgentIds).
- **validationPendingCount** : nombre de tâches en pending_manager sur les projets dont l’owner est dans managerAgentIds.
- **workflowBadgeCount** : tâches avec validation.requestedBy === currentUid et (returned_for_info ou (approved/rejected et readByAgent === false)).
- **taskProjects** : si pas manager → displayedProjects ; si manager → selon boardTaskFilter (myProjects, displayedProjects, ou filtre par ownerId).
- **taskFilterOptions** : construit uniquement si managerAgentIds.length > 0 (sinon []), options Mes tâches, Vue équipe, puis un option par agent.
- **agentOptions** : idem pour le filtre du Dashboard (Vue globale + agents).

---

## 3. Fonctionnement du workflow (Demande de validation → Approuvée/Rejetée)

### 3.1 Modèle de données « validation » sur une tâche

Une tâche peut avoir un objet `validation` avec notamment :

- `status` : 'pending_manager' | 'returned_for_info' | 'approved' | 'rejected' | 'archived'
- `requestedBy` : UID de l’agent demandeur
- `requestedAt` : date/heure
- `previousStatus` : statut avant demande (pour annuler ou rejeter)
- `decidedAt`, `comment` : décision manager
- `readByAgent` : boolean (false tant que l’agent n’a pas « lu » la décision)
- `history` : tableau d’entrées { date, actorName, action, comment }

### 3.2 Parcours dans le code

1. **Demande de validation (Agent)**  
   - **Fichier** : `ItemDetailPanel.jsx`  
   - **Fonction** : `handleRequestValidation`  
   - **Action** : Met la tâche en `status: 'À valider'`, pose `validation: { status: 'pending_manager', requestedBy: uid, requestedAt, previousStatus, requestMessage }`, appelle `onSave(updated)`.  
   - **Remontée** : `onSave` vient de App (handleSilentSave via les callbacks du panneau détail). Donc sauvegarde locale + Firestore via `db.save` dans `storage.js`.

2. **Affichage des tâches en attente (Manager)**  
   - **Fichier** : `ValidationView.jsx`  
   - **Logique** : Pour chaque projet dont `ownerId` est dans `managerAgentIds`, collecte les tâches avec `status === 'À valider'` et `validation.status === 'pending_manager'`.  
   - **Entrée** : Vue « Centre de Validation » dans le menu (visible si `showManagerView`).

3. **Ouverture de la tâche par le manager**  
   - **Fichier** : `App.jsx`  
   - **Rendu** : `detailTaskFromValidation` → `ItemDetailPanel` avec `managerAgentIds` (du manager).  
   - **Fichier** : `ItemDetailPanel.jsx`  
   - **Variable** : `isManagerForThisTask = ids.length > 0 && proj.ownerId dans ids && tâche À valider && pending_manager`.  
   - Si vrai, affichage de l’encart « Décision Manager » (commentaire, boutons Approuver / À corriger).

4. **Décision : Approuver**  
   - **Fichier** : `ItemDetailPanel.jsx`  
   - **Fonction** : `handleManagerApprove`  
   - **Action** : Tâche mise à `status: 'Terminé'`, `done: true`, `completedAt`, `validation.status = 'approved'`, `validation.readByAgent = false`, mise à jour de `validation.history`. Puis `onSave(updated)`.

5. **Décision : Rejeter (À corriger)**  
   - **Fichier** : `ItemDetailPanel.jsx`  
   - **Fonction** : `handleManagerReject`  
   - **Action** : Tâche remise à `validation.previousStatus`, `validation.status = 'rejected'`, `validation.readByAgent = false`, `decidedAt`, `comment`, history. Puis `onSave(updated)`.

6. **Côté Agent : notification et « action requise »**  
   - **Fichier** : `WorkflowView.jsx`  
   - **Logique** : Filtre les tâches avec `validation.requestedBy === currentUserUid`. « Action requise » = `returned_for_info` ou (approved/rejected et `readByAgent === false`).  
   - **Badge** : `workflowBadgeCount` dans App utilise la même règle.

7. **Marquage « lu » par l’agent**  
   - **Fichier** : `ItemDetailPanel.jsx`  
   - **useEffect** : Si `validation.readByAgent === false` et `onSilentSave` présent, appelle `onSilentSave` avec `validation.readByAgent: true`.  
   - **Effet** : La tâche sort de « Action requise » et le badge diminue.

**Fichiers impliqués** : `App.jsx` (état detailTaskFromValidation, callbacks onSave/onSilentSave), `ItemDetailPanel.jsx` (toute la logique validation), `ValidationView.jsx` (liste des tâches à valider), `WorkflowView.jsx` (liste côté agent), `lib/utils.js` (addTaskLog), `lib/storage.js` (db.save → localStorage + Firestore).

---

## 4. Logique Agent / Manager

### 4.1 Détermination du rôle

- **Source** : Firestore `managers/{user.uid}` (écoute en temps réel dans App.jsx, `useEffect` avec `onSnapshot`).  
- **Manager** : document existant et `agentIds` tableau non vide → `managerAgentIds.length > 0`.  
- **Agent** : pas de document ou `agentIds` vide → `managerAgentIds = []`.  
- Aucun autre rôle (ex. directeur) n’est dérivé de cette collection.

### 4.2 Restrictions d’affichage

- **displayedProjects** : Utilisateur anon ou sans owner → tous les projets ; sinon projets sans owner, ou dont `ownerId === user.uid`, ou dont `ownerId` est dans `managerAgentIds`. Les projets des autres agents (hors liste) ne sont pas visibles.
- **Filtre Kanban/Tableau/Calendrier** : Le bloc « Filtrer : » (Mes tâches / Vue équipe / par agent) n’est affiché que si `taskFilterOptions.length > 0`, donc uniquement pour un manager. Pour un agent, `taskFilterOptions` est vide et `taskProjects = displayedProjects` (pas de sélecteur).
- **Vue Manager** : Affichée dans le menu seulement si `showManagerView` (= managerAgentIds.length > 0).
- **Centre de Validation** : Idem, réservé aux managers. ValidationView ne liste que les tâches des projets dont l’owner est dans `managerAgentIds`.
- **Dashboard** : Filtre par agent (showAgentFilter, agentOptions) uniquement si manager.
- **ItemDetailPanel** : Encart « Décision Manager » (Approuver / À corriger) uniquement si `isManagerForThisTask` (projet owner dans managerAgentIds et tâche en pending_manager). Sinon la tâche peut être verrouillée (isLocked) pour l’agent tant que la décision n’est pas prise.

### 4.3 Opérations globales

- **isGlobalOperation(p)** (utils.js) : vrai si `p.isGlobalOperation === true`, ou titre « Tâches générales » / « Taches generales », ou `p.id === 'global'`.
- **Masquage** : Suivi Opérations (ProjectList), Ma charge (WorkloadView), Vue Manager (ManagerView) et Centre de Validation reçoivent des listes filtrées avec `displayedProjects.filter(p => !isGlobalOperation(p))` (ou myProjects pour Ma charge).
- **Kanban / Calendrier** : Reçoivent `taskProjects` sans filtre isGlobalOperation, donc les projets globaux restent visibles pour les tâches « non affectées ».

---

## 5. Persistance (IndexedDB / Firestore)

### 5.1 Stockage local (storage.js)

- **Projets** : Clé localStorage dérivée de l’utilisateur (`projectsKey(getCloudAuth)`). Lecture via `db.all()`, écriture via `db.save(p)` qui met à jour le tableau en mémoire dans localStorage et envoie le document à Firestore `projects/{p.id}` si cloudDb est disponible.
- **Config** : `localStorage` (SK.CONFIG). `db.saveCfg(c)` met à jour localStorage et Firestore `config/main` si cloud.
- **Backups** : IndexedDB base `cirad_backups`, object store `bk`. Sauvegardes automatiques (backup.auto) et manuelles (backup.now), conservation 7 jours (backup.prune). Restauration via backup.restore(key) qui réécrit projects et config dans localStorage (pas de sync Firestore automatique au restore).
- **Fichier lié** : File System Access API. Handles stockés en IndexedDB (`cirad_fs`, store `handles`). `fs.write()` écrit le JSON (projects + config) dans le fichier ; `fs.link()` / `fs.open()` pour lier ou ouvrir un fichier. Auto-save toutes les 15 minutes si fichier lié.

### 5.2 Synchronisation Firestore (App.jsx + storage.js)

- **Lecture** : En mode cloud (utilisateur connecté non anon), `cloudDb.collection('projects').onSnapshot` remplace ou fusionne la liste `projects` dans le state React. En cas de fusion, le `lastSavedProjectRef` permet de garder la version locale récemment sauvegardée pendant ~10 s pour éviter un écrasement par une version stale.
- **Écriture** : Chaque `db.save(p)` et `db.saveCfg(c)` envoie aussi au Firestore (collection `projects` ou `config`). `db.del(id)` supprime le document Firestore.
- **Managers** : Lecture seule par `managers/{user.uid}.onSnapshot` dans App ; écriture depuis SettingsModal (sauvegarde de la liste des agentIds).
- **Worktime** : Lecture `config/worktime_{user.uid}` au chargement ; écriture depuis WorkTimeModal.

### 5.3 Conflits et offline

- Aucune gestion explicite de conflits (pas de version, pas de merge avancé). Le dernier écrit (local ou snapshot) l’emporte.
- En offline, les écritures Firestore échouent silencieusement (try/catch) ; localStorage et état React restent cohérents. Au retour en ligne, onSnapshot renvoie l’état serveur.

---

## 6. Points de vigilance

### 6.1 Complexité et fragilité

1. **Merge des projets dans onSnapshot (App.jsx)**  
   La logique qui fusionne `cloudProjects` avec `prev` et qui pousse les projets locaux non présents dans le snapshot peut faire apparaître des projets « fantômes » ou des doublons si les IDs ne correspondent pas exactement (ex. clés différentes selon l’utilisateur). À documenter et à tester (multi-onglets, reconnexion).

2. **lastSavedProjectRef et fenêtre 10 s**  
   Si une sauvegarde prend plus de 10 s à remonter via onSnapshot, la version locale peut être écrasée. Adapter la fenêtre ou envisager un marquage de « version en attente » côté serveur.

3. **ItemDetailPanel : useEffect readByAgent**  
   Le `useEffect` qui met `readByAgent: true` au montage dépend de `t.id` ; en cas de réutilisation du même composant pour une autre tâche, les dépendances peuvent provoquer des appels inutiles ou des races. Vérifier que la clé du panneau (ex. task.id + project.id) force bien un remontage quand on change de tâche.

4. **Callbacks onSave / onSilentSave du panneau détail (App.jsx)**  
   Les fermetures qui mettent à jour `detailTaskFromValidation` / `detailTaskFromWorkflow` recréent des objets project/task à chaque fois. Si le projet est aussi mis à jour ailleurs (ex. autre onSnapshot), il peut y avoir désynchronisation entre l’état du panneau et la liste des projets. Une source de vérité (ex. toujours lire le projet depuis `projects` par id) réduirait les risques.

5. **taskProjects et boardTaskFilter**  
   Pour un manager, si `boardTaskFilter` contient un UID qui n’est plus dans `managerAgentIds` (donnée stale), la liste peut rester vide ou incohérente. Un reset de `boardTaskFilter` quand `managerAgentIds` change pourrait être ajouté.

6. **db.save et double écriture**  
   `db.save` écrit dans localStorage puis appelle Firestore. En cas d’erreur Firestore après écriture locale, l’état local et le cloud divergent. Un retry ou une file d’écriture Firestore pourrait être envisagé.

7. **TaskAlerts : setAlerts(prev => prev.length > 0 ? prev : newAlerts)**  
   En cas de nouveau retard, les alertes ne sont mises à jour que si la liste était vide ; sinon l’affichage peut rester figé. Revoir la logique pour toujours refléter les alertes actuelles à partir de `projects`.

8. **Fichiers volumineux (ProjectForm, BoardView)**  
   ProjectForm et BoardView contiennent beaucoup de logique et de JSX. Les extraire en sous-composants ou hooks (ex. logique validation, logique tâches) améliorerait la maintenabilité et les tests.

9. **Règles Firestore**  
   Le rapport ne voit pas les règles Firestore. Il faut s’assurer qu’elles restreignent la lecture/écriture des `projects` et `managers` selon l’UID (et les agentIds pour les managers) pour ne pas exposer des données à d’autres utilisateurs.

10. **storage.js : _projectsKey() et utilisateur**  
    La clé des projets en localStorage dépend de getCloudAuth(). Si l’utilisateur change (déconnexion/connexion) sans rechargement, la clé peut ne plus correspondre. Vérifier que le rechargement ou la réinitialisation des données est bien gérée à la déconnexion.

---

*Fin du rapport.*
