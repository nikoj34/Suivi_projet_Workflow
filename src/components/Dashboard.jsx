import { useState } from 'react';
import { today, daysBetween, fmtAmt, fmtDate, projBudget } from '../lib/utils';
import { exportWordBlob, exportPdfHtml, genAllProjectsRecap } from '../lib/exportUtils';
import ic from './icons';

function Gauge({ pct, label, totalSpent, totalBudget }) {
  const clamped = Math.min(pct, 150);
  const sz = 170;
  const r = sz / 2 - 15;
  const circ = Math.PI * r;
  const fillLen = circ * (Math.min(clamped, 100) / 100);
  const col = clamped > 100 ? '#dd007e' : clamped > 75 ? '#f59e0b' : '#007A78';
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={sz} height={sz / 2 + 20} viewBox={`0 0 ${sz} ${sz / 2 + 20}`}>
        <path
          d={`M15,${sz / 2 + 5} A${r},${r} 0 0,1 ${sz - 15},${sz / 2 + 5}`}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d={`M15,${sz / 2 + 5} A${r},${r} 0 0,1 ${sz - 15},${sz / 2 + 5}`}
          fill="none"
          stroke={col}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${fillLen} ${circ}`}
        />
        <text x={sz / 2} y={sz / 2 - 5} textAnchor="middle" className="text-2xl font-black" fill="#1e293b">
          {Math.round(pct)}%
        </text>
        <text x={sz / 2} y={sz / 2 + 14} textAnchor="middle" className="text-[9px] font-bold" fill="#94a3b8">
          {label}
        </text>
      </svg>
      <div className="text-center">
        <p className="text-[10px] font-bold text-slate-500">
          {fmtAmt(totalSpent)} / {fmtAmt(totalBudget)}
        </p>
        {pct > 100 && (
          <p className="text-[9px] font-black text-[#dd007e] mt-0.5">
            ⚠ Dépassement +{Math.round(pct - 100)}%
          </p>
        )}
      </div>
    </div>
  );
}

function Donut({ data, colors, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <p className="text-slate-300 text-xs font-bold text-center py-8">Aucune donnée</p>
    );
  }
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="20" />
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = circ * pct;
          const gap = circ - dash;
          const o = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="20"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-o}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          );
        })}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="text-xl font-black" fill="#1e293b">
          {total}
        </text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="text-[9px] font-bold" fill="#94a3b8">
          projet{total > 1 ? 's' : ''}
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-[9px] font-bold text-slate-500">
              {d.name} ({d.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ title, value, sub, Icon, color, badge }) {
  return (
    <div className="glass p-5 flex flex-col justify-between h-36 hover:scale-[1.01] transition-transform">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${color}`}>
          <Icon s={18} />
        </div>
        {badge && (
          <span className="text-[8px] font-black px-2 py-0.5 rounded-full badge-amber">{badge}</span>
        )}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
          {title}
        </p>
        <p className="text-xl font-black text-slate-800 tracking-tighter">{value}</p>
        {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard({
  projects,
  config,
  onEditTask,
  onSilentSave,
  showAgentFilter,
  agentOptions,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const projectsToShow =
    showAgentFilter && selectedAgentId
      ? (projects || []).filter((p) => p.ownerId === selectedAgentId)
      : projects || [];
  const active = projectsToShow.filter((p) => p.status === 'active');
  const totalBudget = active.reduce((s, p) => s + projBudget(p), 0);
  const totalSpent = active.reduce(
    (s, p) => s + (p.expenses || []).reduce((es, e) => es + (parseFloat(e.amount) || 0), 0),
    0
  );
  const totalLots = active.reduce((s, p) => s + (p.lots || []).length, 0);
  const alerts = active.filter(
    (p) =>
      (p.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) > projBudget(p) &&
      projBudget(p) > 0
  ).length;
  const todayStr = today();
  const delayedProjects = active.filter((p) =>
    (p.timelineTasks || []).some(
      (t) => t.planEnd && t.planEnd < today() && !t.done && t.actualStart
    )
  );
  const phaseCounts = {};
  active.forEach((p) => {
    const ph = p.phaseActive || 'N/A';
    phaseCounts[ph] = (phaseCounts[ph] || 0) + 1;
  });
  const phaseData = Object.entries(phaseCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ['#007A78', '#acd300', '#3b82f6', '#dd007e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
  const totalTasks = active.reduce((s, p) => s + (p.tasks || []).length, 0);
  const doneTasks = active.reduce((s, p) => s + (p.tasks || []).filter((t) => t.done).length, 0);
  const upcomingDeadlines = [];
  active.forEach((p) => {
    (p.timelineTasks || []).forEach((t) => {
      if (
        t.planEnd &&
        t.planEnd >= todayStr &&
        daysBetween(todayStr, t.planEnd) <= 30 &&
        !t.done
      ) {
        upcomingDeadlines.push({
          project: p.title,
          proj: p,
          task: t.label,
          date: t.planEnd,
          days: daysBetween(todayStr, t.planEnd),
        });
      }
    });
  });
  upcomingDeadlines.sort((a, b) => a.days - b.days);
  const engagementRatio =
    totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 150) : 0;
  const ganttByProj = active
    .map((p) => {
      const vt = (p.timelineTasks || []).filter((t) => t.planStart && t.planEnd);
      if (vt.length === 0) return null;
      const minS = Math.min(...vt.map((t) => new Date(t.planStart).getTime()));
      const maxE = Math.max(...vt.map((t) => new Date(t.planEnd).getTime()));
      const nw = new Date(todayStr).getTime();
      let pct = 0;
      if (nw > maxE) pct = 100;
      else if (nw > minS && maxE > minS) pct = Math.round(((nw - minS) / (maxE - minS)) * 100);
      const isLate = vt.some((t) => t.planEnd < todayStr && !t.done);
      return {
        id: p.id,
        title: p.title,
        pct,
        isLate,
        start: new Date(minS).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        end: new Date(maxE).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      };
    })
    .filter(Boolean);

  return (
    <div className="space-y-6 fi">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Dashboard</h2>
          {showAgentFilter && agentOptions && agentOptions.length > 1 && (
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="inp py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white min-w-[180px] cursor-pointer"
            >
              {(agentOptions || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportWordBlob(
                genAllProjectsRecap(projectsToShow, config?.customLogo),
                'Synthese_Projets_' + today() + '.doc'
              )
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all"
          >
            <ic.FileText s={11} /> Synthèse Word
          </button>
          <button
            type="button"
            onClick={() =>
              exportPdfHtml(
                genAllProjectsRecap(projectsToShow, config?.customLogo),
                'Synthèse Projets'
              )
            }
            className="bg-slate-600 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all"
          >
            <ic.Dl s={11} /> Synthèse PDF
          </button>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          title="Projets actifs"
          value={active.length}
          Icon={ic.Fold}
          color="bg-[#007A78]"
          sub={`${projectsToShow.filter((p) => p.status === 'archived').length} archivé(s)`}
        />
        <Kpi
          title="Budget total"
          value={fmtAmt(totalBudget)}
          Icon={ic.Euro}
          color="bg-[#007A78]/80"
          sub={totalLots > 0 ? `${totalLots} lot${totalLots > 1 ? 's' : ''}` : ''}
        />
        <Kpi
          title="Total engagé"
          value={fmtAmt(totalSpent)}
          Icon={ic.Act}
          color="bg-[#dd007e]"
          sub={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% du budget` : ''}
          badge={totalSpent > totalBudget && totalBudget > 0 ? 'Dépassement' : null}
        />
        <Kpi
          title="Retards / alertes"
          value={`${delayedProjects.length} projet${delayedProjects.length > 1 ? 's' : ''}`}
          Icon={ic.Warn}
          color={delayedProjects.length > 0 ? 'bg-amber-500' : 'bg-slate-300'}
          sub={`${alerts} dépass. budgétaire${alerts > 1 ? 's' : ''}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass p-6 flex flex-col items-center justify-center" style={{ minHeight: 280 }}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 self-start">
            Répartition par phase
          </p>
          <Donut data={phaseData} colors={PIE_COLORS} />
        </div>
        <div className="glass p-6 flex flex-col items-center justify-center" style={{ minHeight: 280 }}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 self-start">
            Taux d'engagement global
          </p>
          <Gauge
            pct={engagementRatio}
            label="engagé / budget"
            totalSpent={totalSpent}
            totalBudget={totalBudget}
          />
        </div>
        <div className="glass p-6 flex flex-col" style={{ minHeight: 280 }}>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Avancement planning par projet
          </p>
          {ganttByProj.length === 0 ? (
            <p className="text-slate-300 text-xs font-bold text-center py-8 flex-1 flex items-center justify-center">
              Aucune donnée Gantt
            </p>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {ganttByProj.map((p) => {
                const col =
                  p.pct >= 100
                    ? p.isLate
                      ? 'bg-[#dd007e]'
                      : 'bg-[#007A78]'
                    : p.isLate
                      ? 'bg-amber-500'
                      : 'bg-blue-400';
                const projObj = active.find((x) => x.id === p.id);
                return (
                  <div
                    key={p.id}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => projObj && onEditTask && onEditTask(projObj, 'planning')}
                    title="Ouvrir l'opération"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-[55%]">
                        {p.title}
                      </span>
                      <span className="text-[8px] text-slate-400 font-bold">
                        {p.start} → {p.end}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden bg-slate-100">
                      <div
                        className={`h-full rounded-full ${col} transition-all`}
                        style={{ width: `${Math.min(p.pct, 100)}%` }}
                      />
                      {p.pct > 0 && p.pct < 100 && (
                        <div
                          className="absolute top-0 h-full w-0.5 bg-slate-800/40"
                          style={{ left: `${p.pct}%` }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span
                        className={`text-[8px] font-black ${p.isLate ? 'text-red-500' : 'text-slate-400'}`}
                      >
                        {p.pct >= 100 ? (p.isLate ? '⚠ Dépassé' : 'Terminé') : `${p.pct}%`}
                      </span>
                      {p.isLate && p.pct < 100 && (
                        <span className="text-[8px] font-black text-red-500">⚠ Retard</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass p-6">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Échéances dans les 30 prochains jours
          </p>
          {upcomingDeadlines.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-slate-300">
              <ic.Cal s={20} />
              <span className="text-xs font-bold">Aucune échéance imminente</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {upcomingDeadlines.slice(0, 8).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/40 border border-slate-100 gap-3 cursor-pointer hover:bg-white/70 transition-colors"
                  onClick={() => d.proj && onEditTask && onEditTask(d.proj, 'planning')}
                  title="Ouvrir l'opération"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-700 truncate">{d.project}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{d.task}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${
                        d.days <= 7 ? 'badge-red' : d.days <= 14 ? 'badge-amber' : 'badge-blue'
                      }`}
                    >
                      {d.days === 0 ? "Aujourd'hui" : `J-${d.days}`}
                    </span>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{fmtDate(d.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass p-6 space-y-5">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Projets en retard
            </p>
            {delayedProjects.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-slate-300">
                <ic.Ok s={18} c="text-[#007A78]" />
                <span className="text-xs font-bold text-[#007A78]">
                  Tous les projets sont dans les délais
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {delayedProjects.slice(0, 4).map((p) => {
                  const lateTask = (p.timelineTasks || []).filter(
                    (t) => t.planEnd && t.planEnd < todayStr && !t.done && t.actualStart
                  );
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50/50 border border-red-100 cursor-pointer hover:bg-red-50/80 transition-colors"
                      onClick={() => onEditTask && onEditTask(p, 'planning')}
                      title="Ouvrir l'opération"
                    >
                      <ic.Warn s={14} c="text-red-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-slate-700 truncate">{p.title}</p>
                        <p className="text-[9px] text-red-400 font-bold">
                          {lateTask.map((t) => t.label).join(', ')}
                        </p>
                      </div>
                      <span className="badge-red text-[8px] font-black px-2 py-0.5 rounded-full border flex-shrink-0">
                        {p.location}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Avancement des tâches
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#007A78] transition-all"
                  style={{
                    width: totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%',
                  }}
                />
              </div>
              <span className="text-xs font-black text-slate-700 flex-shrink-0">
                {doneTasks}/{totalTasks}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">
              {totalTasks > 0
                ? `${Math.round((doneTasks / totalTasks) * 100)}% des tâches complétées`
                : 'Aucune tâche enregistrée'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
