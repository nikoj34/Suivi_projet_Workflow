# Documentation complète — Suivi des Travaux DITAM

**Audit technique et fonctionnel 360°**  
*Référence pour tout développeur ou utilisateur avancé.*

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Cartographie des fonctionnalités (Le "Quoi fait Quoi")](#2-cartographie-des-fonctionnalités-le-quoi-fait-quoi)
3. [Logique d'affichage et conditions (Le "Quand c'est masqué")](#3-logique-daffichage-et-conditions-le-quand-cest-masqué)
4. [Nettoyage — Code mort et liens rompus](#4-nettoyage--code-mort-et-liens-rompus)
5. [Flux de données et stockage](#5-flux-de-données-et-stockage)
6. [Sécurité et accès](#6-sécurité-et-accès)
7. [Annexes — Fichiers et dépendances](#7-annexes--fichiers-et-dépendances)

---

## 1. Vue d'ensemble du projet

- **Nom** : `cirad-travaux-manager` (DITAM Travaux Manager)
- **Stack** : React 18, Vite 5, Tailwind CSS, Firebase (Auth + Firestore), Recharts, xlsx (SheetJS)
- **Point d'entrée** : `main.jsx` → initialise Firebase, enveloppe l’app dans `AppErrorBoundary`, rend `<App />`.
- **Structure** : `src/components/` (composants UI), `src/lib/` (storage, firebase, utils, constants, exportUtils).

---

## 2. Cartographie des fonctionnalités (Le "Quoi fait Quoi")

### 2.1 Modules principaux et rôles

| Module | Fichier | Rôle | Entrée des données | Sortie des données |
|--------|---------|------|--------------------|--------------------|
| **Dashboard** | `Dashboard.jsx` | Vue d’ensemble : KPIs (projets actifs, budget, engagé, retards), donut par phase, jauge engagement, barres d’avancement Gantt par projet, échéances 30 j, projets en retard, avancement tâches. Filtre optionnel par agent (manager). | `projects`, `config` (depuis App) ; filtre `selectedAgentId`. | Clic sur une barre / échéance → `onEditTask(proj, 'planning')` ; export Word/PDF via `genAllProjectsRecap` + `exportWordBlob` / `exportPdfHtml`. |
| **Suivi des tâches (Board)** | `BoardView.jsx`, `TableView.jsx`, `CalendarView.jsx`, `BoardGanttView.jsx` | Kanban global, Tableau, Calendrier, Gantt des tâches. Données = tâches de tous les projets actifs (hors archivées selon `isTaskArchived`). | `projects` (filtrés en `taskProjects` dans App), `config`, `onSilentSave`, `onEditProject`. | Drag-and-drop statut Kanban / Table → `onSilentSave` ; création tâche → même ; clic détail → `ItemDetailPanel` ; export Gantt (BoardGanttView utilise GanttChart avec `onExportXlsx`/`onDownloadTemplate` à `undefined`). |
| **Suivi projets (Liste)** | `ProjectList.jsx` | Liste des opérations (actives ou archivées). Cartes avec budget, engagé, délai, couleurs/icônes personnalisables. Glisser-déposer pour réordonner (actif uniquement en mode non-archives). | `projects` = `operationsListProjects` (App) pour liste ; `listOverride` pour Archives par mois. | `onEdit`, `onDelete`, `onArchive`, `onRestore`, `onDuplicate`, `onSilentSave` (couleur/icône), `onReorderProjects`. |
| **Planning (dans projet)** | `GanttChart.jsx` (dans `ProjectForm`) | Gantt par projet : tâches planning (timelineTasks) avec planStart/planEnd, actualStart/actualEnd, progression. Zoom Jour/Semaine/Mois/Trimestre/Année. | `tasks` (timelineTasks du projet), `projectTitle`. | Clic tâche → `onTaskClick` ; Export Excel / PDF / Template / Import selon props (dans ProjectForm les callbacks sont branchés). |
| **Charge de travail** | `WorkloadView.jsx` | Vue "Ma charge" : graphique barres (charge hebdo en heures), KPIs (tâches en cours, retard, plus chargé, non assignées), vues "Par opération" et "Par responsable" avec drag-and-drop de tâches entre responsables. | `projects` = `myProjects` (App), `workTimeConfig`, `config`. | `onSilentSave` (réassignation, etc.), `onEditProject`. |
| **Vue Manager** | `ManagerView.jsx` | Agrège la charge par agent (liste `managerAgentIds`). Affiche soit "Par agent" (un bloc WorkloadView par agent), soit "Tous ensemble" (un seul WorkloadView sur tous les projets des agents). | `projects` = `listAndManagerProjects`, `managerAgentIds`, `managerAgentLabels`, `workTimeConfig`, `config`. | `onSilentSave`, `onEditProject`. |
| **Centre de Validation** | `ValidationView.jsx` | Liste des tâches en attente de validation manager : `status === 'À valider'` et `validation.status === 'pending_manager'`, et (projet.ownerId ou tâche.validation.requestedBy) dans `managerAgentIds`. | `projects` (complets), `managerAgentIds`, `managerAgentLabels`. | Clic ligne → `onOpenTask(project, task)` → ouvre `ItemDetailPanel` (détail depuis Validation). |
| **Mon Workflow** | `WorkflowView.jsx` | Vue agent : tâches dont `validation.requestedBy === currentUserUid`. Sections : Action requise (retours manager non lus), En attente, Archives par mois. | `projects` = `displayedProjects`, `currentUserUid`. | Clic → `onOpenTask` → `ItemDetailPanel` (contexte Workflow). |
| **Archives** | `ArchivesView.jsx` | Projets archivés et tâches terminées, groupés par année/mois. Utilise `ProjectList` avec `listOverride` + `isArchive`. | `projects` (filtrés côté App en `operationsListProjects` pour la liste "Suivi projets", mais Archives reçoit les mêmes puis filtre `status === 'archived'`). | `onEdit`, `onDelete`, `onArchive`, `onRestore`, `onSilentSave` (suppression tâche archivée). |
| **Contacts** | `GlobalContacts.jsx` | Carnet d’adresses global (config.contacts). | `config`, `projects` (affichage). | `onSave(config)` → sauvegarde config. |
| **Paramètres** | `SettingsModal.jsx` | Logo, tags de tâches (couleurs/icônes), liaison fichier, import/export JSON, sauvegardes IndexedDB, section Manager (agentIds pour Centre de Validation). | `config`, `fileLinked`, `fileName`, `onLinkFile`, `onUnlinkFile`, `cloudDb`, `cloudAuth`, `projects`. | `onSave(cfg)`, `db.import`, `backup.restore`/`backup.now`/`backup.download`, Firestore `managers/{uid}`. |
| **Détail d’une action** | `ItemDetailPanel.jsx` | Panneau modal : champs tâche (description, statut, priorité, assignee, échéance, tag, etc.), validation (demande / décision manager / marquer lu), archivage. | `projectId`, `taskId`, `projects`, `config`, `managerAgentIds`, `currentUid`, `managerAgentLabels`. | `onSave` / `onSilentSave` / `onDelete` / `onArchive` / `onEditFull`. |
| **Formulaire projet** | `ProjectForm.jsx` | Onglets : Identification, Budget & Lots, Planning (Gantt), Tâches, Dépenses, Intervenants, Risques, Journal. Export Word/PDF (fiche projet, synthèse, CR chantier, journal). Import/Export Excel (Gantt). | `project` (ou vide pour nouveau), `config`, `currentUid`, `managerAgentIds`, `managerAgentLabels`. | `onSave`, `onSilentSave`, `onCancel`. |
| **Recherche globale** | `SearchModal.jsx` | Recherche full-text (≥2 caractères) dans projets, tâches, journal, intervenants, timelineTasks, dépenses, risques, contacts config. | `projects`, `config`. | `onOpenProject(proj)` ou `onNav('contacts')`, `onClose`. |
| **Alertes tâches** | `TaskAlerts.jsx` | Tâches en retard ou échéance aujourd’hui → modal avec Terminer / Reporter / Effacer date. Notifications navigateur + beep. | `projects` = `displayedProjects`, `onSilentSave`. | `onSilentSave` (terminer, reporter, effacer date). |
| **Connexion / Démarrage** | `LoginScreen.jsx`, `StartupScreen.jsx` | Connexion email/mot de passe (Firebase) ou "Continuer sans connexion". Écran de démarrage si pas de cloud et localStorage vide : Ouvrir fichier JSON / Commencer sans fichier. | `config`, `db`, `backup` (pour logo depuis backup). | `onLocalAccess()`, chargement via `fs.open()` puis `onLoad()`. |

### 2.2 Fonctions cachées et raccourcis

- **Raccourci clavier**  
  - **Ctrl+K (ou Cmd+K)** : ouvre/ferme la recherche globale (`SearchModal`).  
  - **Escape** : ferme la recherche ; ferme `ItemDetailPanel`.

- **Menus / interactions spécifiques**  
  - **Clic sur une carte Kanban** : ouvre le panneau de détail de la tâche (`ItemDetailPanel`).  
  - **Clic sur une ligne TableView** : idem.  
  - **Double-clic** : aucun traitement spécifique identifié.  
  - **Clic droit** : aucun menu contextuel géré dans l’app.  
  - **Suivi projets** : glisser-déposer une carte pour réordonner (ordre persisté via `listOrder` et `onReorderProjects`).  
  - **Ma charge** : glisser-déposer une tâche vers un responsable pour réassignation.

- **Éléments conditionnels**  
  - **Bouton "Nouvelle tâche"** (Suivi des tâches) : ouvre une modale de création ; la liste "Projet" exclut les projets globaux (Tâches non affectées / Tâches générales) pour la création.  
  - **Filtre "Filtrer" (Kanban/Table)** : visible seulement si `taskFilterOptions.length > 0` (utilisateur manager avec agents). Options : Mes tâches, Vue équipe, ou un agent précis.  
  - **Centre de Validation / Vue Manager** : visibles seulement si `showManagerView` (utilisateur a un document `managers/{uid}` avec `agentIds` non vide).  
  - **Mon Workflow / Ma charge** : masqués dans la nav car `SHOW_WORKFLOW_AND_WORKLOAD = false` dans `Layout.jsx`.  
  - **Mon temps de travail** : masqué car `SHOW_WORK_TIME = false` dans `Layout.jsx`.  
  - **Bouton "Archiver" dans ItemDetailPanel** : masqué si `SHOW_ARCHIVE_BUTTON = false`.  
  - **Bloc "Demander la validation" dans ItemDetailPanel** : masqué si `SHOW_VALIDATION_REQUEST = false`.

---

## 3. Logique d'affichage et conditions (Le "Quand c'est masqué")

### 3.1 Visibilité des projets

- **`displayedProjects`** (utilisé Dashboard, SearchModal, Settings, Contacts, Validation, Workflow, Layout badges) :  
  - Si pas d’utilisateur : tous les projets.  
  - Sinon : projets sans `ownerId` OU dont `ownerId === user.uid` OU dont `ownerId` est dans `managerAgentIds`.  
  - Donc : anonyme = tout ; connecté = les siens + ceux de ses agents si manager.

- **`taskProjects`** (Kanban, Tableau, Calendrier, Gantt) :  
  - Si pas de manager : `displayedProjects`.  
  - Sinon : si filtre "Mes tâches" → `myProjects` ; "Vue équipe" → `displayedProjects` ; sinon projets dont `ownerId === boardTaskFilter` (un agent).

- **`operationsListProjects`** (Suivi des opérations) :  
  - Projets dont l’utilisateur est propriétaire (ou sans propriétaire), **en excluant** les projets "globaux" (titre contenant "Tâches non affectées" / "Tâches générales", ou `isGlobal` / `isGlobalOperation`).

- **`listAndManagerProjects`** : même logique que `displayedProjects` avec un marquage `isGlobal` sur les projets par titre.

- **Archives** : `ArchivesView` reçoit `operationsListProjects` puis affiche uniquement ceux avec `status === 'archived'` ; les tâches archivées sont celles avec `done` ou `status === 'Terminé'` et `taskCompletedAt(t)` défini.

### 3.2 Visibilité des tâches

- **Kanban / Table** : exclusion des tâches "archivées" par `isTaskArchived(t)` : terminées depuis au moins 3 jours (`daysBetween(taskCompletedAt(t), today()) >= 3`).
- **Gantt (Board)** : idem, seulement tâches avec `dueDate` et non archivées.
- **Calendrier** : tâches non terminées avec `dueDate` ; plus `timelineTasks` (planEnd, planStart) et `dateLivraisonPrev` du projet.

### 3.3 Indicateurs et boutons conditionnels

- **Indicateur de synchronisation** (Layout) :  
  - Vert "SYNC OK" ou "CLOUD" si `cloudStatus === 'online'`.  
  - Orange "SYNC..." si `cloudStatus === 'connecting'`.  
  - Rouge "LOCAL" si `cloudStatus === 'offline'`.  
  - Affiché uniquement en `md:` (caché sur mobile).

- **Bouton "Sauvegarder" / "Exporter JSON"** (Layout) : toujours affiché ; le **comportement** dépend de `fileLinked` (texte du bouton). **Attention** : dans `Layout.jsx`, `handleSaveExport` utilise `fs` et `db` **sans les importer** → erreur au clic (voir section 4).

- **Bandeau "projets sans propriétaire"** : affiché si utilisateur connecté (non anonyme) et au moins un projet sans `ownerId` ; bouton "Tout rattacher à mon compte" → `handleClaimUnclaimed`.

- **Modale "Mon temps de travail"** : affichée si `showWorkTimeModal` (déclenchée par `onOpenWorkTime` dans Layout, lui-même affiché seulement si `SHOW_WORK_TIME` est true ; actuellement false).

- **Boutons d’administration** (éditer, dupliquer, archiver, supprimer) dans `ProjectList` : visibles selon `isOwner` et `!isArchive` / `isArchive` ; suppression/archivage/restauration réservées au propriétaire.

---

## 4. Nettoyage — Code mort et liens rompus

### 4.1 Bug critique : Layout — `fs` et `db` non importés

- **Fichier** : `src/components/Layout.jsx`  
- **Lignes** : 104–105, dans `handleSaveExport` :
  - `if (fs.linked()) fs.write(); else db.export();`
- **Problème** : `fs` et `db` ne sont pas importés. Au clic sur "Sauvegarder" ou "Exporter JSON", **ReferenceError** en production.
- **Correction recommandée** : ajouter en tête de fichier :  
  `import { db, fs } from '../lib/storage';`

### 4.2 Lien rompu / comportement discutable : Tri "Projet" dans TableView

- **Fichier** : `src/components/TableView.jsx`  
- **Comportement** : Le bouton de tri de la colonne "Projet" appelle `handleSort('project')`, mais dans le `useMemo` qui trie `allTasks`, la branche `sortCol === 'project'` n’existe pas. Le tri retombe dans le `else` et trie par `description`. Donc le libellé "Projet" ne correspond pas au tri par nom de projet.

### 4.3 Champ de recherche probablement inutilisé : `p.access?.location`

- **Fichier** : `src/components/SearchModal.jsx`  
- **Ligne** : 15, `(p.access?.location?.toLowerCase?.()?.includes?.(ql))`  
- **Constat** : Aucun autre endroit du code ne définit ou n’utilise `project.access`. Les projets ont un champ `location` direct. Ce critère de recherche ne matchera jamais sauf si des données externes ont un objet `access.location`.

### 4.4 Fonctions / variables / constantes potentiellement inutilisées

- **`lib/constants.js`** :  
  - `WORKFLOW_MANAGERS` : tableau statique (placeholders UID) ; **jamais référencé** dans le code. Probable reliquat ou prévu pour affichage non implémenté.
- **`lib/utils.js`** :  
  - `getPriority` : utilisé (BoardView, TableView, etc.).  
  - `BLANK` : utilisé dans ProjectForm.  
  - Pas d’export manifestement mort identifié.
- **`Layout.jsx`** :  
  - `lateCount` est calculé mais **jamais affiché** (seuls `listCount` et `allTaskCount` sont passés en badges).

### 4.5 Fichiers orphelins

- Aucun fichier de l’arborescence `src/` (hors `src/.DS_Store`) n’est laissé sans référence : tous les composants sont importés depuis `App.jsx` ou par un autre composant déjà utilisé.  
- **`AmtInput.jsx`** : importé uniquement par `ProjectForm.jsx`.  
- **`TaskTagBadge.jsx`** : importé par BoardView, TableView, ItemDetailPanel, SettingsModal, ProjectForm.  
- **`GanttChart.jsx`** : utilisé par BoardGanttView et ProjectForm.  
- **`icons.jsx`** : utilisé partout ; exports nommés `KanbanIcon`, `WorkflowIcon`, `WorkloadIcon`, `ValidationIcon` utilisés dans Layout (même si les deux premiers sont derrière des flags false).

### 4.6 Résumé des corrections prioritaires

1. **Layout.jsx** : importer `db` et `fs` depuis `../lib/storage` et les utiliser dans `handleSaveExport`.  
2. **TableView.jsx** : ajouter le cas `sortCol === 'project'` en triant par `a._projTitle` / `b._projTitle` (ou `_projId`).  
3. Optionnel : supprimer ou documenter `p.access?.location` dans SearchModal et `WORKFLOW_MANAGERS` dans constants.

---

## 5. Flux de données et stockage

### 5.1 Stockage local

- **localStorage**  
  - **Clé projets** : `projectsKey(getCloudAuth)` → si utilisateur connecté `cirad_projects_<uid>`, sinon `cirad_projects`.  
  - **Config** : `cirad_config`.  
  - **Dernière sauvegarde** : `cirad_last_backup`.

- **IndexedDB**  
  - **Base `cirad_backups`** : object store `bk` ; clés du type `bk_YYYY-MM-DD`. Contient `{ date, projects, config, count, size }`. Conservation des **7 derniers jours** (`backup.MAX`), écrasement du jour si nouveau backup a plus de projets.  
  - **Base `cirad_fs`** : object store `handles` ; clé `fh` pour le File System Access handle (fichier JSON lié). Permet de rouvrir l’app sans re-sélection du fichier.

### 5.2 Cloud Firestore

- **Collections** :  
  - **`projects`** : un document par projet, id = `project.id`. Champs : tout le projet (y compris `ownerId`, `ownerEmail`, `updatedAt`).  
  - **`config`** : document `main` pour la config globale ; document `worktime_<uid>` pour le temps de travail par utilisateur.  
  - **`managers`** : document par `user.uid` ; champs `agentIds` (liste d’UID) et `agentLabels` (map UID → libellé).

- **Écriture** :  
  - **Projet** : `db.save(proj)` → normalisation des montants (`_toNum`), `withOwner()` si connecté, `updatedAt` mis à jour ; écriture Firestore `projects/<id>.set()` puis mise à jour localStorage puis `fs.write()` si fichier lié.  
  - **Config** : `db.saveCfg(c)` → localStorage + Firestore `config/main`.  
  - **Import** : `db.import(s)` → écrit projets et config en local et pousse les projets vers Firestore (avec `withOwner`).

### 5.3 Synchronisation et conflits

- **Abonnement** : `cloudDb.collection('projects').onSnapshot(...)` et `cloudDb.collection('config').doc('main').onSnapshot(...)` dans `App.jsx`.  
- **Merge côté client** :  
  - Pour chaque document reçu du cloud, on compare avec l’état courant en mémoire (`projectsRef.current`) et avec le localStorage.  
  - **Règle** : si une version locale (state ou localStorage) a un `updatedAt` **postérieur** à celui du cloud, on **conserve la version locale** pour ce document. Sinon on prend le cloud et on fusionne avec le local si un document local existe (`{ ...local, ...cp }` ou `cp` si plus récent).  
  - Les projets présents uniquement en local sont ajoutés au tableau fusionné puis tout est écrit dans localStorage et mis dans le state.  
- **Pas de merge de champs** : la résolution est par **document entier** (dernier `updatedAt` gagne pour ce document). Donc une modification concurrente sur le même projet peut écraser l’autre.

### 5.4 Fichier lié (File System Access API)

- **Liaison** : `fs.link()` → `showSaveFilePicker` → handle stocké dans IndexedDB et en mémoire (`_fh`).  
- **Sauvegarde** : `fs.write()` écrit `{ projects: db.all(), config: db.cfg(), savedAt, version: 2 }` dans le fichier. Appelée après chaque `db.save` si `fs.linked()`, et via un intervalle de 15 minutes.  
- **Ouverture** : `fs.open()` lit un JSON, remplit localStorage (projets + config + savedAt), et garde le handle pour les écritures suivantes.  
- **Restoration au chargement** : `fs.restore()` vérifie le handle en IndexedDB et les permissions ; si ok, `_fh` est rétabli (pas de relecture du fichier au démarrage).

---

## 6. Sécurité et accès

### 6.1 Utilisateurs

- **Identification** : Firebase Auth (`getCloudAuth()`).  
  - **Anonyme** : `user.isAnonymous === true` (mode local sans compte). En hébergement HTTPS sur `.web.app` / `.firebaseapp.com`, les utilisateurs anonymes sont déconnectés au chargement.  
  - **Connecté** : `user.uid`, `user.email` ; utilisés pour `projectsKey`, `withOwner`, et les vérifications propriétaire/manager.

- **Clé de données** : `projectsKey(getCloudAuth)` → les projets en localStorage sont **par utilisateur** quand il est connecté. Donc chaque compte voit sa propre liste en local ; Firestore contient tous les documents avec `ownerId` pour le filtrage côté client.

### 6.2 Règles côté client (qui peut modifier quoi)

- **Projet**  
  - **Sauvegarde (handleSave)** : refus si `data.ownerId && data.ownerId !== currentUid` → message "Vous ne pouvez modifier que les opérations dont vous êtes propriétaire."  
  - **Silent save (handleSilentSave)** : autorisé si **propriétaire** (`!p.ownerId || p.ownerId === currentUid`) **ou** **manager de l’agent** (`managerAgentIds.indexOf(p.ownerId) !== -1`). Sinon même message d’erreur.  
  - **Suppression (handleDelete)** : uniquement si propriétaire.  
  - **Archiver / Restaurer** : idem, propriétaire uniquement.  
  - **Dupliquer** : propriétaire uniquement.

- **Tâche**  
  - Modifications (statut, assignee, etc.) passent par `onSilentSave(projet)`. Donc les mêmes règles que pour le projet : propriétaire du projet ou manager de cet agent.  
  - **ItemDetailPanel** : `isReadOnly` si `proj.ownerId && proj.ownerId !== currentUid` et que l’utilisateur n’est pas manager pour cette tâche en validation. Une tâche "À valider" avec `pending_manager` est verrouillée pour tout le monde sauf un manager dont l’UID est dans `managerAgentIds` et qui est le "valideur" (requestedBy ou owner du projet dans la liste des agents).

- **Centre de Validation** : seuls les utilisateurs avec `managers/<uid>.agentIds` non vide voient l’entrée et peuvent valider (approuver / refuser / demander correction). Les tâches listées sont celles dont le projet ou le demandeur est dans `agentIds`.

- **Config** : `db.saveCfg` et Firestore `config/main` sont appelés sans vérification de rôle dans l’app ; **toute personne pouvant ouvrir Paramètres** peut modifier la config globale (y compris les tags, le logo). La config worktime est par utilisateur (`worktime_<uid>`).

### 6.3 Récapitulatif des droits (côté client)

| Action | Propriétaire projet | Manager (agentIds) | Autre |
|--------|---------------------|--------------------|-------|
| Modifier / supprimer / archiver / restaurer / dupliquer projet | Oui | Non (sauf silent save sur projet d’un de ses agents) | Non |
| Modifier tâche (silent save) | Oui | Oui (pour projets dont owner dans agentIds) | Non |
| Valider / refuser / demander correction (À valider) | Non (sauf si manager) | Oui (pour ses agents) | Non |
| Voir projet | Oui (si owner ou pas d’owner) | Oui (si owner dans agentIds) | Non |

**Note** : Il n’y a pas de règles Firestore décrites dans ce dépôt ; la sécurité réelle dépend des Règles de sécurité Firestore (lecture/écriture par `request.auth.uid` et champs `ownerId`). Ce document ne fait qu’auditer la logique **côté client**.

---

## 7. Annexes — Fichiers et dépendances

### 7.1 Arborescence des sources

```
src/
├── main.jsx
├── index.css
├── lib/
│   ├── constants.js
│   ├── exportUtils.js
│   ├── firebase.js
│   ├── storage.js
│   └── utils.js
└── components/
    ├── App.jsx
    ├── AppErrorBoundary.jsx
    ├── Layout.jsx
    ├── LoginScreen.jsx
    ├── StartupScreen.jsx
    ├── Dashboard.jsx
    ├── BoardView.jsx
    ├── TableView.jsx
    ├── CalendarView.jsx
    ├── BoardGanttView.jsx
    ├── GanttChart.jsx
    ├── WorkflowView.jsx
    ├── WorkloadView.jsx
    ├── ManagerView.jsx
    ├── ValidationView.jsx
    ├── ProjectList.jsx
    ├── ProjectForm.jsx
    ├── ArchivesView.jsx
    ├── ItemDetailPanel.jsx
    ├── SettingsModal.jsx
    ├── GlobalContacts.jsx
    ├── SearchModal.jsx
    ├── TaskAlerts.jsx
    ├── WorkTimeModal.jsx
    ├── TaskTagBadge.jsx
    ├── AmtInput.jsx
    └── icons.jsx
```

### 7.2 Dépendances externes (package.json)

- **firebase** ^10.10.0  
- **react**, **react-dom** ^18.3.1  
- **recharts** ^2.10.3  
- **xlsx** (SheetJS, via URL tgz)

### 7.3 Points d’attention pour la suite

- **Layout** : corriger l’import de `db` et `fs` pour le bouton Sauvegarder/Exporter.  
- **TableView** : tri "Projet" à aligner avec l’affichage (tri par projet).  
- **SearchModal** : clarifier ou supprimer la recherche sur `p.access?.location`.  
- **Constantes** : `WORKFLOW_MANAGERS` non utilisée.  
- **Flags** : `SHOW_WORKFLOW_AND_WORKLOAD`, `SHOW_WORK_TIME`, `SHOW_ARCHIVE_BUTTON`, `SHOW_VALIDATION_REQUEST`, `SHOW_MANAGER_IDENTITY_UID` cachent des fonctionnalités ; à documenter ou à rendre configurables (ex. via config ou env).  
- **Conflits** : stratégie "last write wins" par document ; pour un usage multi-utilisateurs fort, envisager une stratégie de merge ou de verrouillage.

---

*Document généré dans le cadre d’un audit technique et fonctionnel 360°. Aucune modification du code n’a été effectuée ; ce document sert de référence pour la compréhension et les évolutions.*
