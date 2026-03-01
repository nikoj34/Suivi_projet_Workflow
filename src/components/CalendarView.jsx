import { useState } from 'react';
import { today } from '../lib/utils';

export default function CalendarView({ projects, onOpenProject }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const ref = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today();
  const monthName = ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const active = (projects || []).filter((p) => p.status === 'active');
  const eventsMap = {};
  const addEv = (d, ev) => {
    if (!eventsMap[d]) eventsMap[d] = [];
    eventsMap[d].push(ev);
  };

  active.forEach((p) => {
    (p.tasks || [])
      .filter((t) => !t.done && t.dueDate)
      .forEach((t) => {
        const dd = t.dueDate;
        if (dd.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
          addEv(parseInt(dd.split('-')[2], 10), {
            type: 'task',
            label: t.description,
            proj: p.title,
            projObj: p,
            urgent: t.urgent,
            late: dd < todayStr,
            color: t.urgent ? 'bg-red-500' : dd < todayStr ? 'bg-amber-500' : 'bg-blue-500',
          });
        }
      });
    (p.timelineTasks || []).forEach((t) => {
      if (t.planEnd && !t.done) {
        const dd = t.planEnd;
        if (dd.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
          addEv(parseInt(dd.split('-')[2], 10), {
            type: 'gantt',
            label: t.label,
            proj: p.title,
            projObj: p,
            late: dd < todayStr && t.actualStart && !t.done,
            color: dd < todayStr && t.actualStart ? 'bg-red-400' : 'bg-emerald-500',
          });
        }
      }
      if (t.planStart) {
        const ds = t.planStart;
        if (ds.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
          addEv(parseInt(ds.split('-')[2], 10), {
            type: 'start',
            label: '▸ ' + t.label,
            proj: p.title,
            projObj: p,
            color: 'bg-slate-400',
          });
        }
      }
    });
    if (p.dateLivraisonPrev) {
      const dl = p.dateLivraisonPrev;
      if (dl.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
        addEv(parseInt(dl.split('-')[2], 10), {
          type: 'livraison',
          label: '🏁 Livraison',
          proj: p.title,
          projObj: p,
          color: 'bg-[#007A78]',
        });
      }
    }
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayDay = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;
  const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-6 fi">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Calendrier</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="p-2 rounded-lg bg-white/50 hover:bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition-all"
          >
            <span className="text-xs font-black">◀</span>
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-black text-slate-700 capitalize hover:bg-slate-50 transition-all min-w-[180px] text-center"
          >
            {monthName}
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className="p-2 rounded-lg bg-white/50 hover:bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition-all"
          >
            <span className="text-xs font-black">▶</span>
          </button>
        </div>
      </div>

      <div className="glass p-4 overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden">
          {jours.map((j) => (
            <div
              key={j}
              className="bg-slate-50 py-2 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest"
            >
              {j}
            </div>
          ))}
          {cells.map((d, i) => {
            const evs = d ? eventsMap[d] || [] : [];
            const isToday = d === todayDay;
            const isWeekend = i % 7 >= 5;
            return (
              <div
                key={i}
                style={{ minHeight: '90px' }}
                className={`bg-white p-1 ${!d ? 'bg-slate-50/50' : ''} ${isWeekend && d ? 'bg-amber-50/30' : ''} ${isToday ? 'ring-2 ring-[#007A78] ring-inset' : ''}`}
              >
                {d && (
                  <div className="flex justify-between items-center mb-0.5">
                    <span
                      className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#007A78] text-white' : 'text-slate-500'}`}
                    >
                      {d}
                    </span>
                    {evs.length > 3 && (
                      <span className="text-[7px] text-slate-400 font-bold">+{evs.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((ev, ei) => (
                    <div
                      key={ei}
                      className={`${ev.color || ''} text-white text-[7px] font-bold px-1 py-0.5 rounded truncate leading-tight cursor-pointer hover:opacity-90 transition-opacity`}
                      title={ev.projObj && onOpenProject ? `Ouvrir l'opération — ${ev.proj}: ${ev.label}` : `${ev.proj}: ${ev.label}`}
                      onClick={() => ev.projObj && onOpenProject && onOpenProject(ev.projObj)}
                    >
                      {ev.type === 'task' ? '📋' : '📅'} {ev.label}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[8px] font-bold text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />
          Tâche
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" />
          Urgent/Retard
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
          Échéance planning
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-slate-400 inline-block" />
          Début phase
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-[#007A78] inline-block" />
          Livraison
        </span>
      </div>
    </div>
  );
}
