import { SK, PRIORITIES, BOARD_COLS, TASK_TAG_STYLES } from './constants';

/** Évalue une expression arithmétique sûre (chiffres, +, -, *, /, parenthèses). Retourne un number ou null si invalide. */
export function evaluateAmountExpression(str) {
  if (str == null || typeof str !== 'string') return null;
  const s = str.trim().replace(/,/g, '.').replace(/\s/g, '');
  if (!s) return null;
  if (!/^[\d.\s+*/()\-]+$/.test(s)) return null;
  try {
    const n = new Function('return (' + s + ')')();
    return typeof n === 'number' && isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export const fmtAmt = (v) => v ? parseFloat(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €' : '—';
/** Montant avec 2 décimales et sigle € (partout sauf dashboard). */
export const fmtAmt2Dec = (v) => v != null && v !== '' ? parseFloat(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—';
export const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const today = () => new Date().toISOString().split('T')[0];

export const taskCompletedAt = (t) => t.completedAt || t.statusChangedAt || '';
export const isTaskArchived = (t) => {
  if (!t.done && t.status !== 'Terminé') return false;
  const d = taskCompletedAt(t);
  if (!d) return false;
  const dateStr = d.indexOf('T') >= 0 ? d.split('T')[0] : d;
  return daysBetween(dateStr, today()) >= 3;
};

export const projBudget = (p) => {
  const glob = parseFloat(p.budgetInitial) || 0;
  if (!p.budgetMode || p.budgetMode === 'par_lot') {
    const s = (p.lots || []).reduce((acc, l) => acc + (parseFloat(l.montant) || 0), 0);
    return s > 0 ? s : glob;
  }
  return glob;
};

export const addTaskLog = (task, action, detail) => {
  const hist = Array.isArray(task.history) ? [...task.history] : [];
  hist.push({ ts: new Date().toISOString(), action, detail: detail || '' });
  return { ...task, history: hist };
};

export function emailToDisplayName(str) {
  if (!str || typeof str !== 'string') return str;
  const s = str.trim();
  const at = s.indexOf('@');
  if (at === -1) return s;
  const local = s.slice(0, at);
  const parts = local.split('.');
  if (parts.length === 0) return s;
  let first = parts[0];
  first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const rest = parts.slice(1).map((p) => p.toUpperCase()).join(' ');
  return rest ? first + ' ' + rest : first;
}

/** Formate un nom d'agent : "Prénom NOMDEFAMILLE" (email → emailToDisplayName, sinon première lettre majuscule / NOM en majuscules). */
export function formatAgentDisplayName(str) {
  if (!str || typeof str !== 'string') return '';
  const s = str.trim();
  if (!s) return '';
  if (s.indexOf('@') !== -1) return emailToDisplayName(s);
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const rest = parts.slice(1).map((p) => p.toUpperCase()).join(' ');
  return rest ? first + ' ' + rest : first;
}

export function isGlobalOperation(p) {
  if (!p) return false;
  if (p.isGlobal === true) return true;
  if (p.isGlobalOperation === true) return true;
  if (p.id === 'global') return true;
  const t = (p.title || '').trim().toLowerCase();
  if (t.includes('tâches non affectées') || t.includes('taches non affectees')) return true;
  if (t.includes('tâches générales') || t.includes('taches generales')) return true;
  return false;
}

export const getPriority = (p) => PRIORITIES.find((x) => x.id === p) || PRIORITIES[0];

/** Retourne le style (couleur, bg, icon, label) pour un tag de tâche.
 * Utilise config.taskTagStyles si fourni, sinon TASK_TAG_STYLES. Correspondance insensible à la casse. */
export function getTaskTagStyle(tag, config) {
  if (!tag || typeof tag !== 'string') return null;
  const t = tag.trim();
  const tagStyles = config?.taskTagStyles || {};
  const keyConfig = Object.keys(tagStyles).find((k) => k.toLowerCase() === t.toLowerCase());
  if (keyConfig && tagStyles[keyConfig]) {
    const s = tagStyles[keyConfig];
    const color = s.color || '#4f46e5';
    const bg = s.bg || hexToRgba(color, 0.15);
    return { color, bg, icon: s.icon ?? '', label: s.label ?? tag };
  }
  const key = Object.keys(TASK_TAG_STYLES || {}).find((k) => k.toLowerCase() === t.toLowerCase());
  return key ? TASK_TAG_STYLES[key] : null;
}

function hexToRgba(hex, a) {
  if (!hex || hex.length < 7) return 'rgba(79,70,229,0.15)';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Définition visuelle (couleur, accent) pour une colonne de statut Kanban/Table. */
export function getColDef(status, done) {
  if (done || status === 'Terminé') return BOARD_COLS[BOARD_COLS.length - 1];
  const resolved = status === 'Validé' ? 'À faire' : status;
  return BOARD_COLS.find((c) => c.id === resolved) || BOARD_COLS[0];
}

export function BLANK() {
  return {
    id: Date.now().toString(),
    title: '',
    location: 'Lavalette',
    subLocation: '',
    typeTravaux: '',
    phaseActive: 'Études',
    budgetMode: 'par_lot',
    budgetInitial: '',
    lots: [],
    dateOS: today(),
    dateLivraisonPrev: '',
    avancementPhysique: '',
    intensity: 2,
    notes: '',
    chantierCR: '',
    expenses: [],
    tasks: [],
    intervenants: [],
    risques: [],
    journal: [],
    timelineTasks: [
      { id: '1', label: 'Études', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      { id: '2', label: "DCE / Appel d'offres", planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      { id: '3', label: 'Consultation / Attribution', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      { id: '4', label: 'Préparation chantier', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      { id: '5', label: 'Travaux', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      { id: '6', label: 'Réception', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      { id: '7', label: 'Levée de réserves', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

/** Clé localStorage des projets (par utilisateur si connecté). */
export function projectsKey(getCloudAuth) {
  const auth = getCloudAuth && getCloudAuth();
  if (auth && auth.currentUser) return 'cirad_projects_' + auth.currentUser.uid;
  return SK.PROJECTS;
}

/** Enrichit un projet avec ownerId/ownerEmail si connecté. */
export function withOwner(p, getCloudAuth) {
  const auth = getCloudAuth && getCloudAuth();
  if (!auth || !auth.currentUser) return p;
  if (p.ownerId) return p;
  return { ...p, ownerId: auth.currentUser.uid, ownerEmail: auth.currentUser.email || '' };
}
