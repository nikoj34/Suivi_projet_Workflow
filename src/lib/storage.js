import { getCloudDb, getCloudAuth } from './firebase';
import { SK, DEF_CFG } from './constants';
import { projectsKey, withOwner, evaluateAmountExpression } from './utils';

function _projectsKey() {
  return projectsKey(getCloudAuth);
}

function _withOwner(p) {
  return withOwner(p, getCloudAuth);
}

// --- IndexedDB backups
const bkdb = {
  _db: null,
  open: () =>
    new Promise((res, rej) => {
      if (bkdb._db) return res(bkdb._db);
      const r = indexedDB.open('cirad_backups', 1);
      r.onupgradeneeded = (e) => e.target.result.createObjectStore('bk');
      r.onsuccess = (e) => {
        bkdb._db = e.target.result;
        res(bkdb._db);
      };
      r.onerror = rej;
    }),
  op: (mode) => bkdb.open().then((d) => d.transaction('bk', mode).objectStore('bk')),
  get: async (k) => {
    try {
      const s = await bkdb.op('readonly');
      return new Promise((res, rej) => {
        const r = s.get(k);
        r.onsuccess = (e) => res(e.target.result);
        r.onerror = rej;
      });
    } catch (e) {
      return null;
    }
  },
  set: async (k, v) => {
    try {
      const s = await bkdb.op('readwrite');
      return new Promise((res, rej) => {
        const r = s.put(v, k);
        r.onsuccess = () => res();
        r.onerror = rej;
      });
    } catch (e) {}
  },
  del: async (k) => {
    try {
      const s = await bkdb.op('readwrite');
      return new Promise((res, rej) => {
        const r = s.delete(k);
        r.onsuccess = () => res();
        r.onerror = rej;
      });
    } catch (e) {}
  },
  keys: async () => {
    try {
      const s = await bkdb.op('readonly');
      return new Promise((res, rej) => {
        const r = s.getAllKeys();
        r.onsuccess = (e) => res(e.target.result);
        r.onerror = rej;
      });
    } catch (e) {
      return [];
    }
  },
};

// --- File system handle storage
const idb = {
  _db: null,
  open: () =>
    new Promise((res, rej) => {
      if (idb._db) return res(idb._db);
      const r = indexedDB.open('cirad_fs', 1);
      r.onupgradeneeded = (e) => e.target.result.createObjectStore('handles');
      r.onsuccess = (e) => {
        idb._db = e.target.result;
        res(idb._db);
      };
      r.onerror = rej;
    }),
  get: async (k) => {
    try {
      const d = await idb.open();
      return new Promise((res, rej) => {
        const r = d.transaction('handles', 'readonly').objectStore('handles').get(k);
        r.onsuccess = (e) => res(e.target.result);
        r.onerror = rej;
      });
    } catch (e) {
      return null;
    }
  },
  set: async (k, v) => {
    try {
      const d = await idb.open();
      return new Promise((res, rej) => {
        const r = d.transaction('handles', 'readwrite').objectStore('handles').put(v, k);
        r.onsuccess = () => res();
        r.onerror = rej;
      });
    } catch (e) {}
  },
  del: async (k) => {
    try {
      const d = await idb.open();
      return new Promise((res, rej) => {
        const r = d.transaction('handles', 'readwrite').objectStore('handles').delete(k);
        r.onsuccess = () => res();
        r.onerror = rej;
      });
    } catch (e) {}
  },
};

let _fh = null;
let _onFSChange = null;

function _toNum(v) {
  const s = String(v ?? '').trim().replace(/,/g, '.');
  const ex = evaluateAmountExpression(s);
  if (ex !== null) return ex;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export const db = {
  all: () => {
    try {
      return JSON.parse(localStorage.getItem(_projectsKey()) || '[]');
    } catch (e3) {
      return [];
    }
  },
  save: (p) => {
    if (!p || !p.id) return Promise.reject(new Error('Projet invalide'));
    const normLots = (p.lots || []).map((l) => ({
      ...l,
      montant: _toNum(l.montant),
      pourcentage: _toNum(l.pourcentage),
    }));
    const n = {
      ...p,
      budgetInitial: _toNum(p.budgetInitial),
      lots: normLots,
      expenses: (p.expenses || []).map((e) => ({ ...e, amount: _toNum(e.amount) })),
    };
    const nCloud = _withOwner(n);
    nCloud.updatedAt = new Date().toISOString();
    const cloudDb = getCloudDb();
    const writeLocal = () => {
      const a = db.all();
      const i = a.findIndex((x) => x.id === nCloud.id);
      if (i >= 0) a[i] = nCloud;
      else a.push(nCloud);
      localStorage.setItem(_projectsKey(), JSON.stringify(a));
      localStorage.setItem(SK.BACKUP, new Date().toISOString());
      // fs.write() est appelé et attendu après writeLocal pour garantir la persistance fichier
    };
    const flushFile = () => (fs.linked() ? fs.write() : Promise.resolve());
    if (cloudDb) {
      return cloudDb
        .collection('projects')
        .doc(nCloud.id)
        .set(JSON.parse(JSON.stringify(nCloud)))
        .then(() => {
          writeLocal();
          return flushFile();
        })
        .catch((e) => {
          console.error('Firebase save error:', e);
          writeLocal();
          return flushFile().then(() => Promise.reject(e));
        });
    }
    writeLocal();
    return flushFile();
  },
  del: (id) => {
    const cloudDb = getCloudDb();
    if (cloudDb) {
      try {
        cloudDb.collection('projects').doc(id).delete();
      } catch (e) {}
    }
    localStorage.setItem(_projectsKey(), JSON.stringify(db.all().filter((p) => p.id !== id)));
    fs.write();
  },
  cfg: () => {
    try {
      return { ...DEF_CFG, ...JSON.parse(localStorage.getItem(SK.CONFIG) || '{}') };
    } catch (e4) {
      return DEF_CFG;
    }
  },
  saveCfg: (c) => {
    const cloudDb = getCloudDb();
    if (cloudDb) {
      try {
        cloudDb.collection('config').doc('main').set(c);
      } catch (e) {}
    }
    localStorage.setItem(SK.CONFIG, JSON.stringify(c));
    fs.write();
  },
  export: () => {
    const b = new Blob(
      [JSON.stringify({ projects: db.all(), config: db.cfg(), exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `DITAM_Travaux_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    localStorage.setItem(SK.BACKUP, new Date().toISOString());
  },
  import: (s) => {
    const d = JSON.parse(s);
    if (d.projects) {
      localStorage.setItem(_projectsKey(), JSON.stringify(d.projects));
      const cloudDb = getCloudDb();
      if (cloudDb) {
        try {
          d.projects.forEach((p) => cloudDb.collection('projects').doc(p.id).set(_withOwner(p)));
        } catch (e) {}
      }
    }
    if (d.config) {
      localStorage.setItem(SK.CONFIG, JSON.stringify(d.config));
      const cloudDb = getCloudDb();
      if (cloudDb) {
        try {
          cloudDb.collection('config').doc('main').set(d.config);
        } catch (e) {}
      }
    }
  },
};

export const backup = {
  MAX: 7,
  todayKey: () => 'bk_' + new Date().toISOString().split('T')[0],
  auto: async () => {
    try {
      const projects = db.all();
      if (projects.length === 0) return;
      const key = backup.todayKey();
      const existing = await bkdb.get(key);
      if (!existing || projects.length >= existing.count) {
        await bkdb.set(key, {
          date: new Date().toISOString(),
          projects,
          config: db.cfg(),
          count: projects.length,
          size: Math.round(JSON.stringify(projects).length / 1024),
        });
      }
      await backup.prune();
    } catch (e) {
      console.warn('Auto-backup:', e);
    }
  },
  now: async () => {
    const projects = db.all();
    if (projects.length === 0) return false;
    await bkdb.set(backup.todayKey(), {
      date: new Date().toISOString(),
      projects,
      config: db.cfg(),
      count: projects.length,
      size: Math.round(JSON.stringify(projects).length / 1024),
    });
    await backup.prune();
    return true;
  },
  prune: async () => {
    const keys = (await bkdb.keys()).sort().reverse();
    for (let i = backup.MAX; i < keys.length; i++) await bkdb.del(keys[i]);
  },
  list: async () => {
    const keys = (await bkdb.keys()).sort().reverse();
    const items = [];
    for (const k of keys) {
      const v = await bkdb.get(k);
      if (v) items.push({ key: k, ...v });
    }
    return items;
  },
  restore: async (key) => {
    const snap = await bkdb.get(key);
    if (!snap) return false;
    localStorage.setItem(_projectsKey(), JSON.stringify(snap.projects));
    if (snap.config) localStorage.setItem(SK.CONFIG, JSON.stringify(snap.config));
    return true;
  },
  download: (snap) => {
    const b = new Blob(
      [JSON.stringify({ projects: snap.projects, config: snap.config, restoredFrom: snap.date }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `DITAM_Backup_${snap.date.split('T')[0]}.json`;
    a.click();
  },
};

export const fs = {
  ok: () => 'showSaveFilePicker' in window,
  payload: () =>
    JSON.stringify(
      { projects: db.all(), config: db.cfg(), savedAt: new Date().toISOString(), version: 2 },
      null,
      2
    ),
  write: async () => {
    if (!_fh) return false;
    try {
      const w = await _fh.createWritable();
      await w.write(fs.payload());
      await w.close();
      localStorage.setItem(SK.BACKUP, new Date().toISOString());
      if (_onFSChange) _onFSChange();
      return true;
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        _fh = null;
        await idb.del('fh');
        if (_onFSChange) _onFSChange();
      }
      return false;
    }
  },
  open: async () => {
    if (!fs.ok()) return false;
    try {
      const [h] = await window.showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        multiple: false,
        startIn: 'desktop',
      });
      const file = await h.getFile();
      const txt = await file.text();
      const d = JSON.parse(txt);
      if (d.projects) localStorage.setItem(_projectsKey(), JSON.stringify(d.projects));
      if (d.config) localStorage.setItem(SK.CONFIG, JSON.stringify(d.config));
      if (d.savedAt) localStorage.setItem(SK.BACKUP, d.savedAt);
      _fh = h;
      await idb.set('fh', h);
      if (_onFSChange) _onFSChange();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return false;
    }
  },
  link: async () => {
    if (!fs.ok()) {
      alert('Utilisez Chrome ou Edge 86+.');
      return false;
    }
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: 'DITAM_Travaux.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      _fh = h;
      await idb.set('fh', h);
      await fs.write();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return false;
    }
  },
  unlink: async () => {
    _fh = null;
    await idb.del('fh');
    if (_onFSChange) _onFSChange();
  },
  restore: async () => {
    try {
      const h = await idb.get('fh');
      if (!h) return false;
      const p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') {
        _fh = h;
        return true;
      }
      if (p === 'prompt') {
        _fh = h;
        return 'prompt';
      }
      return false;
    } catch (e2) {
      return false;
    }
  },
  name: () => (_fh ? _fh.name : null),
  linked: () => !!_fh,
  setOnChange: (cb) => {
    _onFSChange = cb;
  },
};
