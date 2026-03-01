import { useState, useEffect } from 'react';
import { ROLES_INTERV } from '../lib/constants';
import ic from './icons';

export default function GlobalContacts({ config, onSave, projects }) {
  const [cfg, setCfg] = useState(config);
  const [filter, setFilter] = useState('');
  useEffect(() => setCfg(config), [config]);
  const contacts = cfg.contacts || [];
  const save = (nc) => {
    const u = { ...cfg, contacts: nc };
    setCfg(u);
    onSave(u);
  };
  const addContact = () =>
    save([
      ...contacts,
      {
        id: Date.now().toString(),
        entreprise: '',
        nom: '',
        role: '',
        email: '',
        tel: '',
        notes: '',
      },
    ]);
  const updC = (id, patch) => save(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const delC = (id) => save(contacts.filter((c) => c.id !== id));
  const fl = filter.toLowerCase();
  const filtered = fl
    ? contacts.filter(
        (c) =>
          (c.entreprise || '').toLowerCase().includes(fl) ||
          (c.nom || '').toLowerCase().includes(fl) ||
          (c.role || '').toLowerCase().includes(fl)
      )
    : contacts;
  const entreprises = [...new Set(contacts.map((c) => c.entreprise).filter(Boolean))].sort();

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
          onClick={addContact}
          className="bg-[#007A78] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-[#006664] transition-all"
        >
          <ic.Plus s={13} /> Ajouter
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <ic.Srch s={14} c="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer par nom, entreprise, rôle…"
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
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-8 font-bold bg-white/30 rounded-xl border border-dashed border-slate-200">
            Aucun contact{fl ? ` pour "${filter}"` : ''}. Ajoutez votre premier contact !
          </p>
        )}
        {filtered.map((c) => (
          <div
            key={c.id}
            className="glass p-4 space-y-3 hover:shadow-sm transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                  {(c.entreprise || c.nom || '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <input
                    value={c.entreprise || ''}
                    onChange={(e) => updC(c.id, { entreprise: e.target.value })}
                    className="text-sm font-black text-slate-800 bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-[#007A78] transition-colors w-44"
                    placeholder="Entreprise *"
                  />
                  <span className="text-[8px] text-indigo-400 font-bold ml-2">
                    {c.entreprise ? '#' + c.entreprise.replace(/\s+/g, '') : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => delC(c.id)}
                className="text-slate-300 hover:text-red-400 transition-colors p-1"
              >
                <ic.Tr s={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                className="inp text-xs py-1.5"
                value={c.nom || ''}
                onChange={(e) => updC(c.id, { nom: e.target.value })}
                placeholder="Nom / Contact"
              />
              <select
                value={c.role || ''}
                onChange={(e) => updC(c.id, { role: e.target.value })}
                className="inp text-xs py-1.5"
              >
                <option value="">— Rôle —</option>
                {ROLES_INTERV.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                className="inp text-xs py-1.5"
                value={c.email || ''}
                onChange={(e) => updC(c.id, { email: e.target.value })}
                placeholder="Email"
                type="email"
              />
              <input
                className="inp text-xs py-1.5"
                value={c.tel || ''}
                onChange={(e) => updC(c.id, { tel: e.target.value })}
                placeholder="Tél"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
