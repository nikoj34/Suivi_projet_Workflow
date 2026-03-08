export const SK = {
  PROJECTS: 'cirad_projects',
  CONFIG: 'cirad_config',
  BACKUP: 'cirad_last_backup',
};

export const DEFAULT_WORKTIME = {
  hoursPerDay: 7.5,
  workDays: { mon: true, tue: true, wed: true, thu: true, fri: true },
  workHours: { mon: 7.5, tue: 7.5, wed: 7.5, thu: 7.5, fri: 7.5 },
};

export const ESTIMATED_DURATION_OPTIONS = [
  { value: 0, label: 'Non estimé' },
  { value: 0.25, label: 'S - Rapide (< 15 min)' },
  { value: 1, label: 'M - Standard (~ 1h)' },
  { value: 3.75, label: 'L - Demi-journée (~ 3h45)' },
  { value: 7.5, label: 'XL - Journée complète (~ 7h30)' },
];

export const INTENSITY_OPTIONS = [
  { value: 0, label: 'Veille / Attente' },
  { value: 2, label: 'Suivi léger' },
  { value: 7, label: 'Suivi Actif' },
  { value: 14, label: 'Critique' },
];

export const DEF_CFG = {
  defaultEmail: 'nicolas.jamet@cirad.fr',
  customLogo: null,
  taskTags: ['Bloqué', 'URGENT', 'Autocad', 'Chantier', 'CCTP', 'Administratif', 'Réunion'],
  /** Styles par tag (saisis dans Paramètres) : { [tagLabel]: { color: '#hex', icon: 'forbid'|'warn'|emoji } } */
  taskTagStyles: {},
  contacts: [],
};

/** Styles des tags de tâches (couleur, fond, icône). Correspondance insensible à la casse. */
export const TASK_TAG_STYLES = {
  'Bloqué': { color: '#b91c1c', bg: '#fef2f2', icon: 'forbid', label: 'Bloqué' },
  'URGENT': { color: '#6d28d9', bg: '#f5f3ff', icon: 'warn', label: 'URGENT' },
};

/** Palette de couleurs proposée pour les tags (paramètres). */
export const TASK_TAG_COLOR_PALETTE = [
  { id: '#b91c1c', label: 'Rouge' },
  { id: '#dc2626', label: 'Rouge vif' },
  { id: '#ea580c', label: 'Orange' },
  { id: '#f59e0b', label: 'Ambre' },
  { id: '#eab308', label: 'Jaune' },
  { id: '#22c55e', label: 'Vert' },
  { id: '#15803d', label: 'Vert foncé' },
  { id: '#0ea5e9', label: 'Bleu clair' },
  { id: '#3b82f6', label: 'Bleu' },
  { id: '#6366f1', label: 'Indigo' },
  { id: '#6d28d9', label: 'Violet' },
  { id: '#8b5cf6', label: 'Violet clair' },
  { id: '#ec4899', label: 'Rose' },
  { id: '#64748b', label: 'Ardoise' },
  { id: '#007A78', label: 'Teal' },
];

/** Options d’icône / emoji pour les tags. Labels courts et uniformes (emoji ou —). */
export const TASK_TAG_ICON_OPTIONS = [
  { id: '', label: '—' },
  { id: 'forbid', label: '🚫' },
  { id: 'warn', label: '⚠️' },
  { id: 'build', label: '🏗' },
  { id: 'gantt', label: '📊' },
  { id: 'cal', label: '📅' },
  { id: 'filetext', label: '📄' },
  { id: 'clip', label: '📋' },
  { id: 'pin', label: '📍' },
  { id: 'usr', label: '👤' },
  { id: 'book', label: '📕' },
  { id: 'ok', label: '✅' },
  { id: '🚫', label: '🚫' },
  { id: '⚠️', label: '⚠️' },
  { id: '🏗️', label: '🏗️' },
  { id: '📐', label: '📐' },
  { id: '📅', label: '📅' },
  { id: '📋', label: '📋' },
  { id: '👷', label: '👷' },
  { id: '🚧', label: '🚧' },
  { id: '📦', label: '📦' },
  { id: '🔧', label: '🔧' },
  { id: '📄', label: '📄' },
  { id: '🏢', label: '🏢' },
  { id: '✅', label: '✅' },
  { id: '⏳', label: '⏳' },
  { id: '🔥', label: '🔥' },
];

export const BOARD_COLS = [
  { id: 'En réserve / Idées', label: 'En réserve / Idées', color: '#8b5cf6', bg: '#f5f3ff', accent: 'rgba(139,92,246,0.12)', dot: '#8b5cf6' },
  { id: 'À faire', label: 'À faire', color: '#64748b', bg: '#f8fafc', accent: 'rgba(100,116,139,0.12)', dot: '#94a3b8' },
  { id: 'En cours', label: 'En cours', color: '#3b82f6', bg: '#eff6ff', accent: 'rgba(59,130,246,0.12)', dot: '#3b82f6' },
  { id: 'En attente', label: 'En attente', color: '#f59e0b', bg: '#fffbeb', accent: 'rgba(245,158,11,0.12)', dot: '#f59e0b' },
  { id: 'À valider', label: 'À valider', color: '#6366f1', bg: '#eef2ff', accent: 'rgba(99,102,241,0.12)', dot: '#6366f1' },
  { id: 'À retravailler', label: 'À retravailler', color: '#dc2626', bg: '#fef2f2', accent: 'rgba(220,38,38,0.12)', dot: '#dc2626' },
  { id: 'Refusé', label: 'Refusé', color: '#374151', bg: '#f3f4f6', accent: 'rgba(55,65,81,0.15)', dot: '#4b5563' },
  { id: 'Terminé', label: 'Terminé', color: '#15803d', bg: '#f0fdf4', accent: 'rgba(21,128,61,0.12)', dot: '#15803d' },
];

export const PRIORITIES = [
  { id: '', label: '—', color: '#cbd5e1', bg: '#f8fafc' },
  { id: 'Faible', label: 'Faible', color: '#64748b', bg: '#f1f5f9' },
  { id: 'Normale', label: 'Normale', color: '#3b82f6', bg: '#dbeafe' },
  { id: 'Élevée', label: 'Élevée', color: '#f59e0b', bg: '#fef3c7' },
  { id: 'Critique', label: 'Critique', color: '#ef4444', bg: '#fee2e2' },
];

export const LOCATIONS = ['Lavalette', 'Baillarguet', 'Parc Scientifique', 'Parc Technologique'];
export const PHASES = ['Études', 'DCE', 'Consultation', 'Attribution marché', 'Préparation chantier', 'Travaux en cours', 'Réception', 'Levée de réserves', 'Clôture', 'Achevé'];
export const RISK_NIVEAUX = ['Faible', 'Moyen', 'Élevé', 'Critique'];
export const RISK_STATUTS = ['Identifié', 'En cours de traitement', 'Traité', 'Accepté'];
export const JOURNAL_TAGS = ['Réunion de chantier', 'Visite', 'Problème', 'Décision', 'Réception', 'Observation', 'Information'];
export const LOT_COLORS = ['#007A78', '#3b82f6', '#f59e0b', '#dd007e', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export const WORKTIME_DAY_LABELS = [
  { key: 'mon', label: 'Lundi' },
  { key: 'tue', label: 'Mardi' },
  { key: 'wed', label: 'Mercredi' },
  { key: 'thu', label: 'Jeudi' },
  { key: 'fri', label: 'Vendredi' },
];

export const SUB_MAP = {
  'Lavalette': ['Bâtiment 1', 'Bâtiment 2', 'Bâtiment 3', 'Bâtiment 3bis', 'Bâtiment 4', 'Bâtiment 4-restaurant', 'Bâtiment 5', 'Bâtiment 6', 'Bâtiment 7', 'Bâtiment 8', 'Bâtiment 9', 'Bâtiment 10', 'Loge', 'Serre 1', 'Serre 2', 'Serre 3', 'Serre 4', 'Serre 5', 'Serre 6', 'Serre 7', 'Serre 8', 'Serre 9', 'Serre 10', 'Serre 11', 'Serre 12', 'Serre 13', 'Serre 14', 'Serre 15', 'Serre 16', 'Serre 17', 'Serre 18'].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  'Baillarguet': ['Bâtiment A', 'Bâtiment B', 'Bâtiment C', 'Bâtiment D', 'Bâtiment E', 'Bâtiment F', 'Bâtiment G', 'Bâtiment H', 'Bâtiment J', 'Bâtiment Jbis', 'Bâtiment K', 'Infirmerie', 'Labo P3', 'Locaux technique', 'Loge', 'Restaurant', 'Serre K1', 'Serre K2'].sort(),
  'Parc Scientifique': ['PS1', 'PS2'],
  'Parc Technologique': ['Bâtiment 15', 'Bâtiment 16', 'Bâtiment 17'],
};

export const TYPES_TRAVAUX = ['Gros œuvre', 'Second œuvre', 'VRD', 'Électricité', 'Plomberie / CVC', 'Menuiserie', 'Peinture / Revêtements', 'Toiture / Étanchéité', 'Espaces verts', 'Démolition', 'Réhabilitation', 'Réseaux', 'Sécurité incendie', 'Autre'];
/** Options pour le champ "Type de projet" (Suivi opération / Général). */
export const TYPES_PROJET = ['Travaux', 'Marchés', 'Études', 'Maintenance', 'Consultation', 'Autre'];
export const TASK_CATS = ['Administrative', 'Technique', 'Contrôle', 'Réunion', 'Livraison', 'Autre'];
export const ROLES_INTERV = ['Maître d\'ouvrage', 'Maître d\'œuvre', 'Bureau de contrôle', 'CSPS', 'Entreprise GO', 'Entreprise lots', 'Géomètre', 'Architecte', 'Bureau d\'études', 'Assureur', 'Autre'];
