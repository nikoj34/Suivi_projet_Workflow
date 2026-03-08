import { useState } from 'react';
import { fmtDate, fmtAmt2Dec } from '../lib/utils';
import ic from './icons';

export default function SearchModal({ projects, onClose, onOpenProject, config, onNav }) {
  const [q, setQ] = useState('');
  const active = projects || [];

  const results = [];
  if (q.length >= 2) {
    const ql = q.toLowerCase();
    active.forEach((p) => {
      if (
        (p.title || '').toLowerCase().includes(ql) ||
        (p.typeTravaux || '').toLowerCase().includes(ql)
      ) {
        results.push({
          type: 'projet',
          proj: p,
          text: p.title,
          sub: `${p.location || ''} — ${p.phaseActive || ''}`,
        });
      }
      (p.tasks || []).forEach((t) => {
        if (
          (t.description || '').toLowerCase().includes(ql) ||
          (t.assignee || '').toLowerCase().includes(ql) ||
          (t.tag || '').toLowerCase().includes(ql)
        ) {
          results.push({
            type: 'tâche',
            proj: p,
            text: t.description,
            sub: `${p.title} — ${t.status || 'À faire'}${t.assignee ? ' — ' + t.assignee : ''}`,
            done: t.done,
          });
        }
      });
      (p.journal || []).forEach((j) => {
        if (
          (j.text || '').toLowerCase().includes(ql) ||
          (j.tag || '').toLowerCase().includes(ql)
        ) {
          results.push({
            type: 'journal',
            proj: p,
            text: (j.text || '').substring(0, 120) + (j.text?.length > 120 ? '…' : ''),
            sub: `${p.title} — ${fmtDate(j.date)} — ${j.tag || ''}`,
          });
        }
      });
      (p.intervenants || []).forEach((i) => {
        if (
          (i.nom || '').toLowerCase().includes(ql) ||
          (i.email || '').toLowerCase().includes(ql) ||
          (i.role || '').toLowerCase().includes(ql)
        ) {
          results.push({
            type: 'contact',
            proj: p,
            text: `${i.nom || '?'} (${i.role || '?'})`,
            sub: `${p.title}${i.email ? ' — ' + i.email : ''}${i.tel ? ' — ' + i.tel : ''}`,
          });
        }
      });
      (p.timelineTasks || []).forEach((t) => {
        if ((t.label || '').toLowerCase().includes(ql)) {
          results.push({
            type: 'planning',
            proj: p,
            text: t.label,
            sub: `${p.title} — ${t.planStart ? fmtDate(t.planStart) : '?'} → ${t.planEnd ? fmtDate(t.planEnd) : '?'}${t.done ? ' ✅' : ''}`,
          });
        }
      });
      (p.expenses || []).forEach((e) => {
        if ((e.description || '').toLowerCase().includes(ql)) {
          results.push({
            type: 'engagement',
            proj: p,
            text: e.description,
            sub: `${p.title} — ${fmtDate(e.date)} — ${fmtAmt2Dec(parseFloat(e.amount) || 0)}`,
          });
        }
      });
      (p.risques || []).forEach((r) => {
        if ((r.description || '').toLowerCase().includes(ql)) {
          results.push({
            type: 'risque',
            proj: p,
            text: r.description,
            sub: `${p.title} — ${r.niveau || ''}`,
          });
        }
      });
    });
    (config?.contacts || []).forEach((c) => {
      if (
        (c.entreprise || '').toLowerCase().includes(ql) ||
        (c.nom || '').toLowerCase().includes(ql) ||
        (c.email || '').toLowerCase().includes(ql) ||
        (c.role || '').toLowerCase().includes(ql)
      ) {
        results.push({
          type: 'carnet',
          proj: null,
          text: `${c.entreprise || ''} — ${c.nom || ''}`,
          sub: `${c.role || '—'} · ${c.email || ''} · ${c.tel || ''}`,
        });
      }
    });
  }

  const typeIcons = {
    projet: '🏗️',
    tâche: '📋',
    journal: '📖',
    contact: '👤',
    planning: '📅',
    engagement: '💶',
    risque: '⚠️',
    carnet: '📇',
  };
  const typeCls = {
    projet: 'bg-teal-100 text-teal-700',
    tâche: 'bg-blue-100 text-blue-700',
    journal: 'bg-purple-100 text-purple-700',
    contact: 'bg-amber-100 text-amber-700',
    planning: 'bg-cyan-100 text-cyan-700',
    engagement: 'bg-pink-100 text-pink-700',
    risque: 'bg-red-100 text-red-700',
    carnet: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <ic.Srch s={20} c="text-slate-300" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans tous les projets…"
            className="flex-1 text-sm font-bold text-slate-700 outline-none bg-transparent placeholder:text-slate-300"
          />
          <kbd className="text-[8px] text-slate-300 border border-slate-200 rounded px-1.5 py-0.5 font-bold">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.length < 2 && (
            <p className="text-center text-xs text-slate-400 py-8 font-bold">
              Tapez au moins 2 caractères…
            </p>
          )}
          {q.length >= 2 && results.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-8 font-bold">
              Aucun résultat pour « {q} »
            </p>
          )}
          {results.slice(0, 30).map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (r.proj) {
                  onOpenProject(r.proj);
                } else if (onNav) {
                  onNav('contacts');
                }
                onClose();
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all flex items-start gap-3 group"
            >
              <span
                className={`text-[8px] font-black px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${typeCls[r.type] || 'bg-slate-100 text-slate-600'}`}
              >
                {typeIcons[r.type] || '📄'} {r.type}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-bold text-slate-700 truncate group-hover:text-[#007A78] transition-colors ${r.done ? 'line-through opacity-50' : ''}`}
                >
                  {r.text}
                </p>
                <p className="text-[9px] text-slate-400 truncate">{r.sub}</p>
              </div>
            </button>
          ))}
          {results.length > 30 && (
            <p className="text-center text-[9px] text-slate-400 py-2 font-bold">
              … et {results.length - 30} autres résultats
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
