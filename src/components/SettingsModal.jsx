import { useState, useEffect, useRef } from 'react';
import { db, backup } from '../lib/storage';
import { emailToDisplayName } from '../lib/utils';
import ic from './icons';
import TaskTagBadge from './TaskTagBadge';
import { TASK_TAG_ICON_OPTIONS } from '../lib/constants';

/** Mettre à true pour réafficher la section Manager / Identité / UID dans Paramètres. */
const SHOW_MANAGER_IDENTITY_UID = false;

function BackupPanel() {
  const [bks, setBks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const load = async () => {
    setLoading(true);
    setBks(await backup.list());
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const handleRestore = async (bk) => {
    const dateStr = new Date(bk.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (
      !window.confirm(
        `Restaurer la sauvegarde du ${dateStr} ?\n${bk.count} projet(s) seront rechargés.\nL'état actuel sera remplacé.`
      )
    )
      return;
    const ok = await backup.restore(bk.key);
    if (ok) {
      setMsg('✅ Restauré ! Rechargement…');
      setTimeout(() => window.location.reload(), 900);
    }
  };
  const handleNow = async () => {
    const ok = await backup.now();
    if (ok) {
      setMsg('✅ Sauvegarde créée !');
      await load();
      setTimeout(() => setMsg(''), 3000);
    }
  };
  return (
    <div className="glass p-6 space-y-4" style={{ gridColumn: '1/-1' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            🕐 Historique des sauvegardes automatiques
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Une sauvegarde est créée automatiquement à chaque ouverture · Conservation des{' '}
            {backup.MAX} derniers jours
          </p>
        </div>
        <button
          onClick={handleNow}
          className="bg-[#007A78] text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-[#006664] transition-colors"
        >
          <ic.Sv s={12} /> Sauvegarder maintenant
        </button>
      </div>
      {msg && (
        <p className="text-[10px] font-black text-[#007A78] bg-teal-50 px-3 py-2 rounded-lg">
          {msg}
        </p>
      )}
      {loading ? (
        <p className="text-[10px] text-slate-400 italic">Chargement…</p>
      ) : bks.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-[11px] font-bold">Aucune sauvegarde pour l'instant</p>
          <p className="text-[10px] mt-1">L'app créera une sauvegarde à la prochaine ouverture</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bks.map((bk, i) => (
            <div
              key={bk.key}
              className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-3 border border-slate-100 hover:border-slate-200 transition-colors flex-wrap gap-2"
            >
              <div>
                <p className="text-[11px] font-black text-slate-700 flex items-center gap-2">
                  {i === 0 ? (
                    <span className="w-2 h-2 rounded-full bg-[#007A78] inline-block" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />
                  )}
                  {new Date(bk.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {i === 0 && (
                    <span className="text-[8px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-black uppercase">
                      La plus récente
                    </span>
                  )}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 pl-4">
                  {bk.count} projet{bk.count > 1 ? 's' : ''} · {bk.size} KB ·{' '}
                  {new Date(bk.date).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => backup.download(bk)}
                  className="border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-slate-50 transition-colors"
                >
                  ⬇ Export
                </button>
                <button
                  onClick={() => handleRestore(bk)}
                  className="border border-amber-200 text-amber-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-amber-50 transition-colors"
                >
                  ↩ Restaurer
                </button>
              </div>
            </div>
          ))}
          <p className="text-[9px] text-slate-300 pt-1">
            Les {backup.MAX} dernières sauvegardes quotidiennes sont conservées dans votre
            navigateur.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SettingsModal({
  config,
  onSave,
  fileLinked,
  fileName,
  onLinkFile,
  onUnlinkFile,
  cloudDb,
  cloudAuth,
  projects = [],
}) {
  const logoRef = useRef(null);
  const importRef = useRef(null);
  const [cfg, setCfg] = useState({ ...config });
  const [agentIdsArray, setAgentIdsArray] = useState([]);
  const [newUidInput, setNewUidInput] = useState('');
  const [managerSaved, setManagerSaved] = useState(false);
  const [tagsSectionOpen, setTagsSectionOpen] = useState(false);

  function getAgentDisplayName(uid) {
    const proj = (projects || []).find((p) => p.ownerId === uid);
    const raw = (proj?.ownerEmail || '').trim() || '';
    if (raw && raw.indexOf('@') !== -1) return emailToDisplayName(raw);
    if (raw) return raw;
    return uid.length > 16 ? uid.slice(0, 12) + '…' : uid;
  }

  useEffect(() => {
    setCfg((c) => ({ ...c, ...config }));
  }, [config]);

  useEffect(() => {
    if (!cloudDb || !cloudAuth?.currentUser || cloudAuth.currentUser.isAnonymous) return;
    cloudDb
      .collection('managers')
      .doc(cloudAuth.currentUser.uid)
      .get()
      .then((doc) => {
        if (doc.exists && doc.data().agentIds && Array.isArray(doc.data().agentIds)) {
          setAgentIdsArray(doc.data().agentIds);
        } else {
          setAgentIdsArray([]);
        }
      })
      .catch(() => setAgentIdsArray([]));
  }, [cloudDb, cloudAuth]);

  const handleLogo = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const nc = { ...cfg, customLogo: ev.target.result };
      setCfg(nc);
      onSave(nc);
    };
    r.readAsDataURL(f);
  };
  const handleImport = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        db.import(ev.target.result);
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        alert('Fichier invalide');
      }
    };
    r.readAsText(f);
  };
  const saveManager = () => {
    if (!cloudDb || !cloudAuth?.currentUser) return;
    cloudDb.collection('managers').doc(cloudAuth.currentUser.uid).set({ agentIds: agentIdsArray });
    setManagerSaved(true);
    setTimeout(() => setManagerSaved(false), 2000);
  };
  const removeAgent = (uid) => {
    if (!window.confirm('Supprimer cet agent de la liste ?')) return;
    setAgentIdsArray((prev) => prev.filter((id) => id !== uid));
  };
  const addAgent = () => {
    const uid = newUidInput.trim();
    if (!uid) return;
    if (agentIdsArray.indexOf(uid) !== -1) return;
    setAgentIdsArray((prev) => [...prev, uid]);
    setNewUidInput('');
  };
  const copyUid = () => {
    if (!cloudAuth?.currentUser) return;
    try {
      navigator.clipboard.writeText(cloudAuth.currentUser.uid);
      alert('UID copié dans le presse-papier.');
    } catch (e) {
      prompt('Copiez votre UID :', cloudAuth.currentUser.uid);
    }
  };
  const showManager =
    typeof cloudDb !== 'undefined' && cloudDb && cloudAuth?.currentUser && !cloudAuth.currentUser.isAnonymous;

  const addTag = () => {
    const inp = document.getElementById('add-tag-inp');
    const v = inp?.value?.trim();
    if (v) {
      const nt = [...(cfg.taskTags || []), v];
      setCfg({ ...cfg, taskTags: nt });
      onSave({ ...cfg, taskTags: nt });
      if (inp) inp.value = '';
    }
  };

  const getTagStyle = (tag) => cfg.taskTagStyles?.[tag] || {};
  const setTagStyle = (tag, patch) => {
    const next = { ...(cfg.taskTagStyles || {}), [tag]: { ...getTagStyle(tag), ...patch } };
    const nc = { ...cfg, taskTagStyles: next };
    setCfg(nc);
    onSave(nc);
  };
  const removeTag = (index) => {
    const tag = (cfg.taskTags || [])[index];
    const nt = (cfg.taskTags || []).filter((_, i) => i !== index);
    const nextStyles = { ...(cfg.taskTagStyles || {}) };
    if (tag && nextStyles[tag]) delete nextStyles[tag];
    const nc = { ...cfg, taskTags: nt, taskTagStyles: nextStyles };
    setCfg(nc);
    onSave(nc);
  };

  return (
    <div className="space-y-6 fi">
      <h2 className="text-xl font-black text-slate-800 uppercase">Paramètres</h2>
      <div
        className={`glass p-6 border-2 ${fileLinked ? 'border-[#007A78]/30' : 'border-amber-200'}`}
      >
        <div className="flex justify-between">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full inline-block ${fileLinked ? 'bg-[#007A78]' : 'bg-amber-400'}`}
              />
              <span className={fileLinked ? 'text-[#007A78]' : 'text-amber-600'}>
                Sauvegarde PC
              </span>
            </p>
            {fileLinked ? (
              <p className="text-sm font-black text-slate-700">📄 {fileName}</p>
            ) : (
              <p className="text-xs text-slate-600">Données uniquement dans le navigateur.</p>
            )}
          </div>
          <div className="flex flex-col gap-2 min-w-[170px]">
            {!fileLinked ? (
              <button
                type="button"
                onClick={onLinkFile}
                className="bg-[#007A78] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <ic.Sv s={14} /> Lier fichier
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onLinkFile}
                  className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50"
                >
                  Changer
                </button>
                <button
                  type="button"
                  onClick={onUnlinkFile}
                  className="border border-red-100 text-red-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-50"
                >
                  Délier
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="glass p-4 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo</p>
          <div
            className="w-full max-w-[120px] aspect-square bg-white/50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={() => logoRef.current?.click()}
          >
            {cfg.customLogo ? (
              <img src={cfg.customLogo} className="max-h-full max-w-full object-contain p-1" alt="Logo" />
            ) : (
              <ic.Img s={20} />
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleLogo}
          />
        </div>
        <div className="glass p-6 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Données</p>
          <button
            onClick={() => db.export()}
            className="w-full bg-slate-900 text-white p-3.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
          >
            <ic.Dl s={15} /> Exporter JSON
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="w-full border-2 border-slate-200 p-3.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
          >
            <ic.Up s={15} /> Importer
          </button>
          <input
            ref={importRef}
            type="file"
            className="hidden"
            accept=".json"
            onChange={handleImport}
          />
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                if (window.confirm('Reset ?')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase text-red-400 border border-red-100 hover:bg-red-50"
            >
              Reset App
            </button>
          </div>
        </div>
        <div className="glass p-6 space-y-4">
          <button
            type="button"
            onClick={() => setTagsSectionOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 text-left"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Catégories de Tâches (Tags)
            </p>
            <span className="text-[9px] text-slate-400">
              {(cfg.taskTags || []).length} tag{(cfg.taskTags || []).length > 1 ? 's' : ''}
            </span>
            <span
              className={`transition-transform text-slate-400 ${tagsSectionOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              ▼
            </span>
          </button>
          {tagsSectionOpen && (
            <>
              <p className="text-[9px] text-slate-500 -mt-2">
                Couleur et icône pour chaque tag. Affichés sur les cartes et listes.
              </p>
              <div className="space-y-2">
                {(cfg.taskTags || []).map((tag, i) => {
                  const style = getTagStyle(tag);
                  const color = style.color || '#64748b';
                  const icon = style.icon ?? '';
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/60 border border-slate-100"
                    >
                      <TaskTagBadge tag={tag} config={cfg} size="md" />
                      <span className="text-[10px] font-bold text-slate-600 w-24 truncate" title={tag}>
                        {tag}
                      </span>
                      <label className="flex items-center gap-1 shrink-0">
                        <span className="text-[8px] font-black text-slate-400 uppercase sr-only">Couleur</span>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setTagStyle(tag, { color: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-200 shrink-0"
                          title="Couleur"
                        />
                      </label>
                      <select
                        value={icon}
                        onChange={(e) => setTagStyle(tag, { icon: e.target.value })}
                        className="inp py-1 px-0.5 text-[10px] w-11 min-w-11 max-w-11 h-7 text-center shrink-0"
                        title="Icône"
                      >
                        {TASK_TAG_ICON_OPTIONS.map((opt) => (
                          <option key={opt.id || 'none'} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTag(i)}
                        className="ml-auto p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        title="Supprimer le tag"
                      >
                        <ic.Tr s={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center pt-1">
                <input
                  id="add-tag-inp"
                  className="inp py-1.5 text-xs flex-1"
                  placeholder="Nouveau tag..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <button
                  id="btn-add-tag"
                  onClick={addTag}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg transition-colors shrink-0"
                >
                  <ic.Plus s={14} />
                </button>
              </div>
            </>
          )}
        </div>
        <BackupPanel />
        {SHOW_MANAGER_IDENTITY_UID && showManager && (
          <div className="glass p-6 space-y-4" style={{ gridColumn: '1 / -1' }}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Manager — voir les projets de son équipe
            </p>
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500">
                Votre UID (à communiquer à votre manager pour qu'il puisse voir vos projets) :
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-[9px] bg-slate-100 px-2 py-1.5 rounded truncate font-mono"
                  title={cloudAuth.currentUser.uid}
                >
                  {cloudAuth.currentUser.uid}
                </code>
                <button
                  type="button"
                  onClick={copyUid}
                  className="px-3 py-1.5 bg-slate-600 text-white text-[9px] font-bold rounded-lg"
                >
                  Copier
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[9px] font-bold text-slate-500">
                En tant que manager : agents dont vous voyez les projets
              </p>
              <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Identité
                      </th>
                      <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        ID technique
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentIdsArray.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400 italic text-sm">
                          Aucun agent rattaché
                        </td>
                      </tr>
                    ) : (
                      agentIdsArray.map((uid) => (
                        <tr
                          key={uid}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="text-sm font-bold text-slate-900">
                              {getAgentDisplayName(uid)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <code className="text-[10px] font-mono text-slate-400 block truncate max-w-[200px]" title={uid}>
                              {uid}
                            </code>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => removeAgent(uid)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Supprimer"
                            >
                              <ic.Tr s={16} c="text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={newUidInput}
                  onChange={(e) => setNewUidInput(e.target.value)}
                  placeholder="Coller un UID pour ajouter un agent…"
                  className="inp py-2 px-3 text-xs font-mono flex-1 min-w-[200px] border border-slate-200 rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAgent())}
                />
                <button
                  type="button"
                  onClick={addAgent}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase rounded-xl"
                >
                  Ajouter
                </button>
              </div>
              <button
                type="button"
                onClick={saveManager}
                className="px-4 py-2 bg-[#007A78] text-white text-[10px] font-black uppercase rounded-xl hover:bg-[#006664] transition-colors"
              >
                {managerSaved ? 'Enregistré ✓' : 'Enregistrer la liste'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
