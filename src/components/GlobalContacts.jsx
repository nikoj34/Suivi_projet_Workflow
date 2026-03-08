import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ROLES_INTERV } from '../lib/constants';
import ic from './icons';

export default function GlobalContacts({ config, onSave, projects }) {
  const [cfg, setCfg] = useState(config);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  useEffect(() => setCfg(config), [config]);
  const contacts = cfg.contacts || [];
  const save = (nc) => {
    const u = { ...cfg, contacts: nc };
    setCfg(u);
    onSave(u);
  };
  const updC = (id, patch) => save(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const delC = (id) => {
    save(contacts.filter((c) => c.id !== id));
    setEditingId((prev) => (prev === id ? null : prev));
  };
  const fl = filter.toLowerCase();
  const filtered = fl
    ? contacts.filter(
        (c) =>
          (c.entreprise || '').toLowerCase().includes(fl) ||
          (c.nom || '').toLowerCase().includes(fl) ||
          (c.role || '').toLowerCase().includes(fl) ||
          (c.lot || '').toLowerCase().includes(fl)
      )
    : contacts;
  const entreprises = [...new Set(contacts.map((c) => c.entreprise).filter(Boolean))].sort();
  const editingContact = editingId ? contacts.find((c) => c.id === editingId) : null;

  return (
    <div className="space-y-6 fi">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            Carnet de contacts
          </h2>
          <p className="text-[9px] text-slate-400 font-bold mt-1">
            {contacts.length} contact{contacts.length > 1 ? 's' : ''} · {entreprises.length}{' '}
            entreprise{entreprises.length > 1 ? 's' : ''} · Utilisez{' '}
            <span className="text-indigo-500 font-black">#NomEntreprise</span> dans le journal,
            tâches ou CR
          </p>
        </div>
        <button
          onClick={() => {
            const id = Date.now().toString();
            save([...contacts, { id, role: '', lot: '', entreprise: '', nom: '', email: '', tel: '', notes: '' }]);
            setEditingId(id);
          }}
          className="bg-[#007A78] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-[#006664] transition-all"
        >
          <ic.Plus s={13} /> Ajouter un contact
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <ic.Srch s={14} c="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer par nom, entreprise, rôle, lot…"
            className="inp pl-9 py-2 text-xs w-full"
          />
        </div>
      </div>
      {entreprises.length > 0 && (
        <div className="glass p-4">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Tags entreprises disponibles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entreprises.map((e) => (
              <span
                key={e}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[9px] font-black"
              >
                🏢 #{e.replace(/\s+/g, '')}
                <span className="text-indigo-400 font-normal ml-1">
                  {contacts.filter((c) => c.entreprise === e).length} pers.
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Liste des contacts en étiquettes (même style que Suivi projets / Intervenants) */}
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
          {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
          {fl ? ` pour "${filter}"` : ''}
        </p>
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8 font-bold bg-white/30 rounded-xl border border-dashed border-slate-200">
            Aucun contact{fl ? ` pour "${filter}"` : ''}. Ajoutez votre premier contact !
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-col gap-0 w-[260px] min-w-[260px]">
                <div
                  className={`group flex items-center gap-2 rounded-xl border-2 transition-all min-h-[72px] ${
                    editingId === c.id
                      ? 'bg-white border-[#007A78] shadow-md ring-2 ring-[#007A78]/20'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 py-2 pl-3 pr-1">
                    {c.role ? (
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-[#007A78]/10 text-[#007A78] shrink-0">
                        {c.role}
                      </span>
                    ) : (
                      <span className="text-[8px] text-slate-400 px-2 py-0.5 shrink-0">Rôle</span>
                    )}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="text-[11px] font-bold text-slate-800 block truncate">{c.nom || 'Sans nom'}</span>
                      {c.entreprise && <span className="text-[9px] text-slate-500 block truncate">🏢 {c.entreprise}</span>}
                      {c.lot && <span className="text-[8px] text-slate-500 block truncate">Lot : {c.lot}</span>}
                      {(c.email || c.tel) && (
                        <span className="text-[8px] text-slate-400 block truncate">{[c.email, c.tel].filter(Boolean).join(' · ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 pr-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(c.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#007A78] hover:bg-slate-100 transition-colors"
                      title="Modifier"
                    >
                      <ic.Ed s={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => delC(c.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <ic.Tr s={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fenêtre popup création / modification contact (même que Suivi projets / Intervenants) */}
      {editingId && editingContact && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setEditingId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingContact.nom || editingContact.entreprise ? 'Modifier le contact' : 'Nouveau contact'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Rôle</label>
                <select
                  value={editingContact.role || ''}
                  onChange={(e) => updC(editingId, { role: e.target.value })}
                  className="inp w-full py-2.5 text-sm font-medium"
                >
                  <option value="">— Rôle —</option>
                  {ROLES_INTERV.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Lot</label>
                <input
                  type="text"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.lot || ''}
                  onChange={(e) => updC(editingId, { lot: e.target.value })}
                  placeholder="Lot"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Entreprise</label>
                <input
                  type="text"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.entreprise || ''}
                  onChange={(e) => updC(editingId, { entreprise: e.target.value })}
                  placeholder="Entreprise"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nom</label>
                <input
                  type="text"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.nom || ''}
                  onChange={(e) => updC(editingId, { nom: e.target.value })}
                  placeholder="Nom"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
                <input
                  type="email"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.email || ''}
                  onChange={(e) => updC(editingId, { email: e.target.value })}
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Téléphone</label>
                <input
                  type="tel"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.tel || ''}
                  onChange={(e) => updC(editingId, { tel: e.target.value })}
                  placeholder="Tél"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Notes (optionnel)</label>
                <textarea
                  className="inp w-full py-2.5 text-sm min-h-[80px] resize-none"
                  value={editingContact.notes || ''}
                  onChange={(e) => updC(editingId, { notes: e.target.value })}
                  placeholder="Notes…"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
