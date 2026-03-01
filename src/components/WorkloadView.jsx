import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DEFAULT_WORKTIME } from '../lib/constants';
import { today, daysBetween, fmtDate, addTaskLog, getColDef } from '../lib/utils';
import ItemDetailPanel from './ItemDetailPanel';

function KpiMini({ title, value, sub, colorCls }) {
  return (
    <div className={`glass p-4 border-l-4 flex flex-col justify-center ${colorCls}`}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-black text-slate-800 tracking-tighter leading-none">{value}</p>
      {sub && <p className="text-[9px] text-slate-400 font-bold mt-2">{sub}</p>}
    </div>
  );
}

export default function WorkloadView({
  projects,
  config,
  workTimeConfig,
  onSilentSave,
  onEditProject,
  managerAgentIds,
  currentUid,
  managerAgentLabels,
}) {
  const [detailTask, setDetailTask] = useState(null);
  const [dragTask, setDragTask] = useState(null);
  const [dragOverAssignee, setDragOverAssignee] = useState(null);
  const [chargeMode, setChargeMode] = useState('par-operation');

  const todayStr = today();
  const active = (projects || []).filter((p) => p.status === 'active');

  const workloadChartData = useMemo(() => {
    const getMonday = (dateStr) => {
      const d = new Date(dateStr + 'T12:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    };
    const addDays = (dateStr, n) => {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const weekCount = 12;
    const thisMonday = getMonday(todayStr);
    const out = [];
    for (let i = 0; i < weekCount; i++) {
      const weekStart = addDays(thisMonday, i * 7);
      const weekEnd = addDays(weekStart, 6);
      let chargeHeures = 0;
      active.forEach((p) => {
        (p.tasks || []).forEach((t) => {
          if (t.done || t.status === 'Terminé') return;
          if (!t.dueDate || t.dueDate < weekStart || t.dueDate > weekEnd) return;
          const dur =
            t.estimatedDuration !== undefined && t.estimatedDuration !== null && t.estimatedDuration > 0
              ? Number(t.estimatedDuration)
              : 1;
          chargeHeures += dur;
        });
      });
      const labelShort = new Date(weekStart + 'T12:00:00').toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
      out.push({
        weekLabel: labelShort,
        weekStart,
        chargeHeures: Math.round(chargeHeures * 10) / 10,
      });
    }
    return out;
  }, [active, todayStr]);

  const weeklyCapacity = useMemo(() => {
    const wt = workTimeConfig || DEFAULT_WORKTIME;
    const days = wt.workDays || DEFAULT_WORKTIME.workDays;
    const hours = wt.workHours || {};
    const legacyHour =
      wt.hoursPerDay != null && !Number.isNaN(wt.hoursPerDay) ? Number(wt.hoursPerDay) : 7.5;
    let total = 0;
    if (days.mon) total += hours.mon != null ? Number(hours.mon) : legacyHour;
    if (days.tue) total += hours.tue != null ? Number(hours.tue) : legacyHour;
    if (days.wed) total += hours.wed != null ? Number(hours.wed) : legacyHour;
    if (days.thu) total += hours.thu != null ? Number(hours.thu) : legacyHour;
    if (days.fri) total += hours.fri != null ? Number(hours.fri) : legacyHour;
    return total;
  }, [workTimeConfig]);

  const operationStats = useMemo(() => {
    return active
      .map((p) => {
        const tasks = p.tasks || [];
        const activeTasks = tasks.filter((t) => !t.done && t.status !== 'Terminé');
        const late = activeTasks.filter((t) => t.dueDate && t.dueDate < todayStr).length;
        const thisWeek = activeTasks.filter(
          (t) => t.dueDate && t.dueDate >= todayStr && daysBetween(todayStr, t.dueDate) <= 7
        ).length;
        const urgent = activeTasks.filter((t) => t.urgent).length;
        return { project: p, count: activeTasks.length, late, thisWeek, urgent };
      })
      .sort((a, b) => b.count - a.count);
  }, [active, todayStr]);

  const assignees = useMemo(() => {
    const map = {};
    active.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        if (t.done || t.status === 'Terminé') return;
        let rawAssignees = t.assignee ? String(t.assignee).split(',') : ['Non assigné'];
        let cleanedAssignees = rawAssignees.map((a) => a.trim()).filter((a) => a.length > 0);
        if (cleanedAssignees.length === 0) cleanedAssignees = ['Non assigné'];
        cleanedAssignees.forEach((assigneeName) => {
          const standardName = assigneeName.charAt(0).toUpperCase() + assigneeName.slice(1);
          if (!map[standardName]) {
            map[standardName] = { name: standardName, tasks: [], late: 0, urgent: 0, thisWeek: 0 };
          }
          map[standardName].tasks.push({ ...t, _projTitle: p.title, _projId: p.id });
          if (t.dueDate && t.dueDate < todayStr) map[standardName].late++;
          if (t.urgent) map[standardName].urgent++;
          if (t.dueDate) {
            const d = daysBetween(todayStr, t.dueDate);
            if (d >= 0 && d <= 7) map[standardName].thisWeek++;
          }
        });
      });
    });
    return Object.values(map).sort((a, b) => {
      if (a.name === 'Non assigné') return -1;
      if (b.name === 'Non assigné') return 1;
      return b.tasks.length - a.tasks.length;
    });
  }, [projects]);

  let uniqueTasks = 0;
  let globalLate = 0;
  active.forEach((p) => {
    (p.tasks || []).forEach((t) => {
      if (!t.done && t.status !== 'Terminé') {
        uniqueTasks++;
        if (t.dueDate && t.dueDate < todayStr) globalLate++;
      }
    });
  });
  const unassignedCount = assignees.find((a) => a.name === 'Non assigné')?.tasks.length || 0;
  const topAssigneesList = assignees.filter((a) => a.name !== 'Non assigné');
  const topAssignee = topAssigneesList.length > 0 ? topAssigneesList[0] : null;

  const handleDrop = (targetAssigneeName) => {
    if (!dragTask) return;
    const newAssignee = targetAssigneeName === 'Non assigné' ? '' : targetAssigneeName;
    if (
      dragTask.assignee === newAssignee ||
      (targetAssigneeName === 'Non assigné' && !dragTask.assignee)
    ) {
      setDragTask(null);
      setDragOverAssignee(null);
      return;
    }
    const proj = active.find((p) => p.id === dragTask._projId);
    if (proj) {
      const hist = Array.isArray(dragTask.history) ? [...dragTask.history] : [];
      hist.push({
        ts: new Date().toISOString(),
        action: 'Réassigné',
        detail: 'Vers ' + targetAssigneeName,
      });
      const updProj = {
        ...proj,
        tasks: (proj.tasks || []).map((t) =>
          t.id === dragTask.id ? { ...t, assignee: newAssignee, history: hist } : t
        ),
      };
      onSilentSave(updProj);
    }
    setDragTask(null);
    setDragOverAssignee(null);
  };

  if (assignees.length === 0) {
    return (
      <div className="fi text-center py-20 text-slate-300">
        <p className="text-xl mb-2">👤</p>
        <p className="text-sm font-bold">Aucune tâche active à traiter.</p>
        <p className="text-xs mt-1">Créez des tâches dans vos opérations pour visualiser la charge.</p>
      </div>
    );
  }

  const maxTasks = Math.max(...assignees.map((a) => a.tasks.length), 10);

  const renderTaskRow = (t, isUnassigned) => {
    const col = getColDef(t.status, t.done);
    const isLate = t.dueDate && t.dueDate < todayStr;
    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          setDragTask(t);
        }}
        onDragEnd={() => {
          setDragTask(null);
          setDragOverAssignee(null);
        }}
        onClick={() => setDetailTask({ projectId: t._projId, taskId: t.id })}
        className="hover:shadow-md hover:scale-[1.01] hover:bg-white cursor-grab active:cursor-grabbing flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border-l-[3px] transition-all"
        style={{
          background: isLate ? '#fff8f7' : isUnassigned ? 'rgba(255,255,255,0.7)' : '#f8fafc',
          borderLeftColor: col.color,
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
            {t.description}
          </p>
          <p className="text-[9px] text-slate-400 font-bold">{t._projTitle}</p>
        </div>
        {t.dueDate && (
          <span
            className={`text-[8px] font-black flex-shrink-0 rounded-md ${
              isLate ? 'text-red-500 bg-red-100 py-0.5 px-1.5' : 'text-slate-400'
            }`}
          >
            {isLate ? '⚠ ' : ''}
            {fmtDate(t.dueDate)}
          </span>
        )}
        <span
          className="text-[8px] font-black rounded-md py-0.5 px-1.5 flex-shrink-0 uppercase tracking-wide"
          style={{ color: col.color, background: col.accent }}
        >
          {t.done ? 'Terminé' : t.status || 'À faire'}
        </span>
      </div>
    );
  };

  const renderTaskGroup = (title, tasksList, colorClass, isUnassigned) => {
    if (tasksList.length === 0) return null;
    return (
      <div className="mb-4 last:mb-0">
        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 px-1 ${colorClass || ''}`}>
          {title} ({tasksList.length})
        </p>
        <div className="space-y-2">{tasksList.map((t) => renderTaskRow(t, isUnassigned))}</div>
      </div>
    );
  };

  const TooltipContent = ({ payload, label }) => {
    if (!payload || payload.length === 0) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-[11px]">
        <p className="font-black text-slate-700">{label}</p>
        {d && <p className="text-slate-500 mt-1">Heures: {d.chargeHeures} h</p>}
      </div>
    );
  };

  return (
    <div className="fi space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            Charge de travail
          </h2>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">
            {chargeMode === 'par-operation'
              ? `${active.length} opération${active.length !== 1 ? 's' : ''}`
              : `${assignees.length} intervenant${assignees.length !== 1 ? 's' : ''} avec des tâches assignées`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChargeMode('par-operation')}
            className={`px-4 py-2 rounded-xl font-black uppercase transition-all ${
              chargeMode === 'par-operation' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Par opération
          </button>
          <button
            type="button"
            onClick={() => setChargeMode('par-responsable')}
            className={`px-4 py-2 rounded-xl font-black uppercase transition-all ${
              chargeMode === 'par-responsable'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Par responsable
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMini
          title="Tâches en cours"
          value={uniqueTasks}
          colorCls="border-blue-500"
          sub="Au total sur les projets"
        />
        <KpiMini
          title="En retard"
          value={globalLate}
          colorCls={globalLate > 0 ? 'border-red-500' : 'border-teal-500'}
          sub={globalLate > 0 ? 'Nécessite attention' : 'Tout est à jour'}
        />
        <KpiMini
          title="Le + chargé"
          value={topAssignee ? topAssignee.name : '—'}
          colorCls="border-amber-500"
          sub={topAssignee ? `${topAssignee.tasks.length} actions assignées` : ''}
        />
        <KpiMini
          title="Non assignées"
          value={unassignedCount}
          colorCls={unassignedCount > 0 ? 'border-slate-500' : 'border-slate-200'}
          sub={unassignedCount > 0 ? 'À distribuer' : 'Pilotes définis'}
        />
      </div>

      <div className="glass p-6 rounded-xl border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">
          Charge hebdomadaire (heures)
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={workloadChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="#94a3b8"
              label={{
                value: 'Heures',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 10, fill: '#64748b' },
              }}
            />
            <Tooltip content={<TooltipContent />} />
            <ReferenceLine
              y={weeklyCapacity}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Capacité Max (${weeklyCapacity} h)`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 10,
              }}
            />
            <Bar dataKey="chargeHeures" fill="#007A78" radius={[4, 4, 0, 0]} name="Heures" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {chargeMode === 'par-operation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {operationStats.length === 0 ? (
            <p className="text-slate-400 col-span-full text-center py-8">Aucune opération active.</p>
          ) : (
            operationStats.map((o) => {
              const p = o.project;
              const hasLate = o.late > 0;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEditProject && onEditProject(p)}
                  className={`glass p-5 rounded-xl border cursor-pointer hover:ring-2 hover:ring-[#007A78]/30 transition-all min-h-[100px] ${
                    hasLate ? 'border-red-200 bg-red-50/30' : 'border-slate-100'
                  }`}
                >
                  <p className="font-black text-slate-800 truncate mb-2">{p.title || 'Sans titre'}</p>
                  <p className="text-[9px] text-slate-500 font-bold mb-3">
                    {(p.location || '') + (p.subLocation ? ' — ' + p.subLocation : '')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[9px] font-black px-2 py-1 rounded bg-slate-100 text-slate-600">
                      {o.count} tâche{o.count !== 1 ? 's' : ''}
                    </span>
                    {o.late > 0 && (
                      <span className="text-[9px] font-black px-2 py-1 rounded bg-red-100 text-red-600">
                        {o.late} en retard
                      </span>
                    )}
                    {o.thisWeek > 0 && (
                      <span className="text-[9px] font-black px-2 py-1 rounded bg-amber-100 text-amber-700">
                        {o.thisWeek} cette semaine
                      </span>
                    )}
                    {o.urgent > 0 && (
                      <span className="text-[9px]">
                        🔥 {o.urgent}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {chargeMode === 'par-responsable' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {assignees.map((a) => {
            const isUnassigned = a.name === 'Non assigné';
            const isOver = dragOverAssignee === a.name;
            const avatarLetter = isUnassigned ? '?' : a.name.charAt(0).toUpperCase();
            const avatarBg = isUnassigned
              ? 'linear-gradient(135deg,#94a3b8,#cbd5e1)'
              : 'linear-gradient(135deg,#007A78,#3b82f6)';
            const lateTasks = a.tasks.filter((t) => t.dueDate && t.dueDate < todayStr);
            const thisWeekTasks = a.tasks.filter(
              (t) => t.dueDate && t.dueDate >= todayStr && daysBetween(todayStr, t.dueDate) <= 7
            );
            const nextWeekTasks = a.tasks.filter(
              (t) =>
                t.dueDate &&
                daysBetween(todayStr, t.dueDate) > 7 &&
                daysBetween(todayStr, t.dueDate) <= 14
            );
            const laterTasks = a.tasks.filter(
              (t) => !t.dueDate || daysBetween(todayStr, t.dueDate) > 14
            );
            return (
              <div
                key={a.name}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverAssignee(a.name);
                }}
                onDragLeave={() => setDragOverAssignee(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(a.name);
                }}
                className={`glass p-6 flex flex-col transition-all duration-200 ${
                  isUnassigned ? 'border-2 border-dashed border-slate-300 bg-slate-50/80' : ''
                } ${isOver ? 'ring-4 ring-[#007A78]/30 bg-teal-50 scale-[1.02] shadow-xl' : ''}`}
              >
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div className="flex items-center gap-3 pointer-events-none">
                    <div
                      className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md"
                      style={{ background: avatarBg }}
                    >
                      {avatarLetter}
                    </div>
                    <div>
                      <p
                        className={`text-base font-black ${
                          isUnassigned ? 'text-slate-500' : 'text-slate-800'
                        }`}
                      >
                        {a.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        {a.tasks.length} action{a.tasks.length > 1 ? 's' : ''} sous sa responsabilité
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pointer-events-none">
                    {a.late > 0 && (
                      <span className="badge-red text-[9px] font-black px-2 py-1 rounded-lg border">
                        {a.late} retard{a.late > 1 ? 's' : ''}
                      </span>
                    )}
                    {a.urgent > 0 && (
                      <span className="text-[10px]" title="Urgences">
                        🔥 {a.urgent}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-5 flex-shrink-0 pointer-events-none">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all ${
                        a.late > 0 ? 'bg-red-400' : a.tasks.length >= 8 ? 'bg-amber-400' : isUnassigned ? 'bg-slate-400' : 'bg-[#007A78]'
                      }`}
                      style={{ width: `${(a.tasks.length / maxTasks) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 w-8 text-right">
                    {Math.round((a.tasks.length / maxTasks) * 100)}%
                  </span>
                </div>
                <div className="max-h-[320px] overflow-y-auto pr-2 mt-1">
                  {renderTaskGroup('En retard', lateTasks, 'text-red-500', isUnassigned)}
                  {renderTaskGroup('Cette semaine', thisWeekTasks, 'text-amber-500', isUnassigned)}
                  {renderTaskGroup('Semaine pro', nextWeekTasks, 'text-blue-500', isUnassigned)}
                  {renderTaskGroup('À venir / Non planifié', laterTasks, 'text-slate-400', isUnassigned)}
                  {a.tasks.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center pointer-events-none mt-2">
                      <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">
                        Glissez une tâche ici
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailTask && (
        <ItemDetailPanel
          projectId={detailTask.projectId}
          taskId={detailTask.taskId}
          projects={projects}
          config={config || {}}
          onClose={() => setDetailTask(null)}
          onSave={(updTask) => {
            const p = active.find((x) => x.id === detailTask.projectId);
            if (!p) return;
            const updProj = { ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) };
            onSilentSave(updProj);
          }}
          onSilentSave={(updTask) => {
            const p = active.find((x) => x.id === detailTask.projectId);
            if (!p) return;
            const updProj = { ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) };
            onSilentSave(updProj);
          }}
          onDelete={() => {
            const p = active.find((x) => x.id === detailTask.projectId);
            if (!p) return;
            onSilentSave({ ...p, tasks: (p.tasks || []).filter((t) => t.id !== detailTask.taskId) });
            setDetailTask(null);
          }}
          onArchive={() => {
            const p = active.find((x) => x.id === detailTask.projectId);
            if (!p) return;
            const nowStr = new Date().toISOString();
            const task = (p.tasks || []).find((t) => t.id === detailTask.taskId);
            if (!task) return;
            const updTask = addTaskLog(
              { ...task, status: 'Terminé', done: true, completedAt: nowStr },
              'Archivée',
              'Via panneau détail'
            );
            onSilentSave({
              ...p,
              tasks: (p.tasks || []).map((t) => (t.id === detailTask.taskId ? updTask : t)),
            });
            setDetailTask(null);
          }}
          onEditFull={() => {
            if (onEditProject) { const p = active.find((x) => x.id === detailTask.projectId); if (p) onEditProject(p); }
            setDetailTask(null);
          }}
          managerAgentIds={managerAgentIds}
          currentUid={currentUid}
          managerAgentLabels={managerAgentLabels || {}}
        />
      )}
    </div>
  );
}
