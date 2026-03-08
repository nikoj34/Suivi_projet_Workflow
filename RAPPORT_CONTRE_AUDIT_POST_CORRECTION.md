# Rapport de contre-audit — Post-correction Firebase

**Date** : Vérification après correctifs (useCallback App.jsx, useRef ProjectForm.jsx, cleanup onAuthStateChanged).

---

## 1. Validation des corrections critiques — Boucle infinie neutralisée

### 1.1 Chaîne « écriture → snapshot → re-render → timer → écriture »

**Vérification technique :**

| Étape de la boucle | Avant (bug) | Après (corrigé) |
|--------------------|-------------|------------------|
| Référence de `handleSilentSave` | Nouvelle à chaque rendu d'App | **Stable** : `useCallback(..., [projects, currentUid, managerAgentIds, user])` (App.jsx 301-332). La référence ne change que si une de ces dépendances change. |
| Réexécution de l’effet auto-save (ProjectForm) | Déclenchée à chaque rendu parent car `onSilentSave` dans les deps | **Ne dépend plus de la ref** : effet avec `[form, isNew, readOnly]` (l.1237-1262). L’appel à Firestore passe par `onSilentSaveRef.current`, mis à jour à chaque rendu mais **non listé en dépendance**. |
| Snapshot → setState dans App | Déclenchait re-render → nouvelle handleSilentSave → nouvel effet | Re-render n’entraîne **plus** de nouvelle référence de `handleSilentSave` (sauf changement de projects/currentUid/managerAgentIds/user). L’effet auto-save dans ProjectForm **ne se relance pas** car `onSilentSave` n’est plus dans ses deps. |

**Conclusion :** La boucle est **définitivement neutralisée**. Le timer 2 s ne se réarme plus à chaque snapshot ; il ne se réarme que lorsque `form`, `isNew` ou `readOnly` changent (comportement attendu pour l’auto-save).

### 1.2 Nettoyage de `onAuthStateChanged`

**Vérification (App.jsx 118-135) :**

- Si `!cloudAuth` : seul un `setTimeout` est utilisé ; le cleanup retourne `clearTimeout(timeoutId)`.
- Si `cloudAuth` existe : `const unsubscribe = cloudAuth.onAuthStateChanged((u) => setUser(u))` puis dans le return `unsubscribe()` et `clearTimeout(fallback)`.

**Conclusion :** Aucune fuite de listener. Le désabonnement est bien exécuté au démontage ou au changement de `cloudAuth`.

---

## 2. TableView.jsx — Écritures sans debounce (recommandation)

**Constat :** La fonction `updateTask` (l.86-99) appelle `onSilentSave(...)` à **chaque** `onChange` pour :

- Case à cocher (l.168-169) : 1 write par clic — **acceptable**.
- Select statut (l.202) : 1 write par changement — **acceptable**.
- Select priorité (l.215) : 1 write par changement — **acceptable**.
- **Champ texte Responsable/assignee (l.235)** : `onChange={(e) => updateTask(task, { assignee: e.target.value })}` → **1 write par frappe**.
- **Champ date échéance (l.251)** : `onChange={(e) => updateTask(task, { dueDate: e.target.value })}` → 1 write par changement de date — souvent 1 seul par action, **acceptable**.

Le seul point vraiment intensif est le **champ assignee** : une saisie de 10 caractères = 10 écritures Firestore. Ce n’est pas une boucle infinie, mais une **mauvaise pratique** qui peut générer des centaines de writes en session active.

**Recommandation (sans modifier le code ici) :** Ajouter un **debounce** (ex. 800 ms) sur les champs qui appellent `updateTask` avec une valeur texte (assignee) : soit un state local + `useEffect` avec timer qui appelle `updateTask` après délai, soit une fonction `updateTaskDebounced` mémorisée avec un ref de timer. Les selects et la checkbox peuvent rester en écriture immédiate.

---

## 3. Scan de sécurité — Autres composants

| Composant | useEffect + Firebase | Verdict |
|-----------|----------------------|---------|
| **App.jsx** | worktime `.get()` (l.77-89) : deps `[user, cloudDb]` — 1 lecture au changement user/cloudDb. | Contrôlé. |
| **App.jsx** | managers onSnapshot (l.91-117) : cleanup `unsub()`. | OK. |
| **App.jsx** | projects + config onSnapshot (l.154-262) : cleanup `unsubProjects`, `unsubConfig`. | OK. |
| **SettingsModal.jsx** | `.get()` managers (l.169-187) : deps `[cloudDb, cloudAuth]`. Exécuté au montage (ouverture Paramètres). Pas de boucle. | Contrôlé. |
| **Dashboard.jsx** | Aucun appel Firebase dans un useEffect. | OK. |
| **GlobalContacts.jsx** | useEffect uniquement `setCfg(config)` — pas de Firebase. | OK. |
| **LoginScreen.jsx** | useEffect avec `backup.list()` (IndexedDB), pas Firestore. | OK. |
| **BoardView, WorkloadView, etc.** | Pas de useEffect qui lance des requêtes Firestore ; ils utilisent `onSilentSave` en réaction à des événements utilisateur. | OK. |

Aucun autre `useEffect` ne déclenche de requêtes Firestore non contrôlées ou en boucle.

---

## 4. Synthèse

| Point | Statut |
|-------|--------|
| Boucle infinie (section 1.1 du rapport initial) | **Neutralisée** : useCallback sur handleSilentSave + pattern useRef dans ProjectForm. |
| Fuite onAuthStateChanged (section 1.2) | **Corrigée** : unsubscribe retourné et appelé dans le cleanup. |
| TableView — écritures à chaque frappe | **Recommandation** : ajouter un debounce sur le champ assignee (et éventuellement tout champ texte inline). Pas de modification effectuée ici. |
| Autres composants — Firebase dans useEffect | **Aucun bug critique** : seuls App et SettingsModal font des appels Firestore dans des effets, avec des dépendances stables et/ou cleanup correct. |

**Correctif principal : validé.** Aucune modification de code supplémentaire n’a été appliquée ; seule une évolution possible sur TableView (debounce) est recommandée.
