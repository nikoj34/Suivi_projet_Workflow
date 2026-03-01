import { useState, useMemo } from 'react';
import { BOARD_COLS, PRIORITIES } from '../lib/constants';
import { today, isTaskArchived, addTaskLog, fmtDate, getPriority, getColDef } from '../lib/utils';
import ItemDetailPanel from './ItemDetailPanel';

const colW = { check: '36px', projet: '160px', task: '1fr', status: '120px', priority: '100px', assignee: '120px', interlocuteur: '130px', dueDate: '100px', tag: '90px', actions: '60px' };
const gridCols = `${colW.check} ${colW.projet} ${colW.task} ${colW.status} ${colW.priority} ${colW.assignee} ${colW.interlocuteur} ${colW.dueDate} ${colW.tag} ${colW.actions}`;

function SortBtn({ col, label, sortCol, sortDir, onSort }) {
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className="flex items-center gap-0.5 border-none bg-transparent cursor-pointer text-slate-400 text-[8px] font-black uppercase tracking-wider p-0"
    >
      {label}
      {sortCol === col && <span className="text-[10px] text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

export default function TableView({ projects, config, onSilentSave, onEditProject, managerAgentIds, currentUid, managerAgentLabels }) {
  const [sortCol, setSortCol] = useState('dueDate');
  const [sortDir, setSortDir] = useState('asc');
  const [filterProj, setFilterProj] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('project');
  const [detailTask, setDetailTask] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const todayStr = today();

  const active = (projects || []).filter((p) => p.status === 'active');

  const allTasks = useMemo(() => {
    let list = [];
    active.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        if (isTaskArchived(t)) return;
        list.push({ ...t, _projId: p.id, _projTitle: p.title });
      });
    });
    if (!showDone) list = list.filter((t) => !t.done && t.status !== 'Terminé');
    if (filterProj) list = list.filter((t) => t._projId === filterProj);
    if (filterStatus) list = list.filter((t) => (t.status || 'À faire') === filterStatus);
    if (filterPrio) list = list.filter((t) => (t.priority || '') === filterPrio);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.description || '').toLowerCase().includes(q) ||
          (t.assignee || '').toLowerCase().includes(q) ||
          (t.tag || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va = '',
        vb = '';
      if (sortCol === 'dueDate') {
        va = a.dueDate || '9999';
        vb = b.dueDate || '9999';
      } else if (sortCol === 'status') {
        va = a.done ? 'Terminé' : a.status || 'À faire';
        vb = b.done ? 'Terminé' : b.status || 'À faire';
      } else if (sortCol === 'priority') {
        const order = { Critique: 0, Élevée: 1, Normale: 2, Faible: 3, '': 4 };
        va = order[a.priority || ''];
        vb = order[b.priority || ''];
      } else if (sortCol === 'assignee') {
        va = a.assignee || '';
        vb = b.assignee || '';
      } else {
        va = a.description || '';
        vb = b.description || '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [projects, filterProj, filterStatus, filterPrio, search, showDone, sortCol, sortDir]);

  const updateTask = (task, patch) => {
    const proj = active.find((p) => p.id === task._projId);
    if (!proj) return;
    const isTermine = patch.status === 'Terminé' || patch.done === true;
    const nowStr = new Date().toISOString();
    const fullPatch = { ...patch };
    if (isTermine) {
      fullPatch.completedAt = nowStr;
      fullPatch.statusChangedAt = nowStr;
    }
    const updTask = addTaskLog({ ...task, ...fullPatch }, Object.keys(patch).join(', '), 'Via Table');
    onSilentSave({ ...proj, tasks: (proj.tasks || []).map((t) => (t.id === task.id ? updTask : t)) });
  };

  const deleteTask = (task) => {
    if (!window.confirm('Supprimer ?')) return;
    const proj = active.find((p) => p.id === task._projId);
    if (!proj) return;
    onSilentSave({ ...proj, tasks: (proj.tasks || []).filter((t) => t.id !== task.id) });
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', label: 'Toutes les tâches', tasks: allTasks }];
    if (groupBy === 'project') {
      const projs = [...new Set(allTasks.map((t) => t._projId))];
      return projs.map((id) => ({
        key: id,
        label: active.find((p) => p.id === id)?.title || id,
        tasks: allTasks.filter((t) => t._projId === id),
      }));
    }
    if (groupBy === 'status') {
      return BOARD_COLS.map((col) => ({
        key: col.id,
        label: col.label,
        color: col.color,
        tasks: allTasks.filter((t) => (t.done ? 'Terminé' : t.status || 'À faire') === col.id),
      })).filter((g) => g.tasks.length > 0);
    }
    if (groupBy === 'priority') {
      return PRIORITIES.map((p) => ({
        key: p.id,
        label: p.id || 'Sans priorité',
        color: p.color,
        tasks: allTasks.filter((t) => (t.priority || '') === p.id),
      })).filter((g) => g.tasks.length > 0);
    }
    return [];
  }, [allTasks, groupBy, active]);

  function TaskRow({ task }) {
    const colDef = getColDef(task.status, task.done);
    const prio = getPriority(task.priority);
    const isLate = task.dueDate && task.dueDate < todayStr && !task.done;
    return (
      <div
        className="grid items-center gap-0 border-b border-slate-100 px-2 min-h-[42px] group hover:bg-slate-50 transition-colors"
        style={{
          gridTemplateColumns: gridCols,
          background: task.done ? '#f8fafc' : isLate ? '#fff8f7' : 'white',
        }}
      >
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={!!task.done}
            onChange={(e) =>
              updateTask(task, {
                done: e.target.checked,
                status: e.target.checked ? 'Terminé' : task.status === 'Terminé' ? 'À faire' : task.status,
              })
            }
            className="w-3.5 h-3.5 cursor-pointer accent-[#007A78]"
          />
        </div>
        <div className="overflow-hidden pr-2">
          <span
            className="block text-[9px] font-black uppercase tracking-wide max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded px-1.5 py-0.5"
            style={{ color: colDef.color, background: colDef.accent }}
          >
            {task._projTitle}
          </span>
        </div>
        <div
          className="overflow-hidden pr-2 cursor-pointer"
          onClick={() => setDetailTask({ projectId: task._projId, taskId: task.id })}
        >
          <p
            className="text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ color: task.done ? '#94a3b8' : '#1e293b', textDecoration: task.done ? 'line-through' : 'none' }}
          >
            {task.description}
          </p>
        </div>
        <div className="pr-2">
          <select
            value={task.done ? 'Terminé' : task.status || 'À faire'}
            onChange={(e) => updateTask(task, { status: e.target.value, done: e.target.value === 'Terminé' })}
            className="text-[9px] font-black py-0.5 px-1.5 rounded-md cursor-pointer w-full uppercase tracking-wide border-[1.5px]"
            style={{ borderColor: colDef.color, background: colDef.accent, color: colDef.color }}
          >
            {BOARD_COLS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="pr-2">
          <select
            value={task.priority || ''}
            onChange={(e) => updateTask(task, { priority: e.target.value })}
            className="text-[9px] font-black py-0.5 px-1.5 rounded-md cursor-pointer w-full border-[1.5px]"
            style={{
              borderColor: task.priority ? prio.color : '#e2e8f0',
              background: task.priority ? prio.bg : 'white',
              color: task.priority ? prio.color : '#94a3b8',
            }}
          >
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id || '—'}
              </option>
            ))}
          </select>
        </div>
        <div className="pr-2">
          <input
            value={task.assignee || ''}
            onChange={(e) => updateTask(task, { assignee: e.target.value })}
            className="text-[11px] text-slate-600 bg-transparent border-none outline-none w-full font-semibold"
            placeholder="—"
          />
        </div>
        <div className="pr-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="text-[10px] text-slate-500 font-medium">
            {task.interlocuteur && String(task.interlocuteur).trim() ? `🏢 ${String(task.interlocuteur).trim()}` : '—'}
          </span>
        </div>
        <div className="pr-2">
          <input
            type="date"
            value={task.dueDate || ''}
            onChange={(e) => updateTask(task, { dueDate: e.target.value })}
            className={`text-[9px] font-semibold bg-transparent border-none outline-none w-full ${isLate ? 'text-red-500 font-black' : 'text-slate-500'}`}
          />
        </div>
        <div className="pr-2">
          <span className="block text-[8px] font-black text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded overflow-hidden text-ellipsis whitespace-nowrap">
            {task.tag || ''}
          </span>
        </div>
        <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setDetailTask({ projectId: task._projId, taskId: task.id })}
            className="border-none bg-transparent cursor-pointer text-slate-400 text-sm p-0.5 hover:text-blue-500"
            title="Détails"
          >
            ⋯
          </button>
          <button
            type="button"
            onClick={() => deleteTask(task)}
            className="border-none bg-transparent cursor-pointer text-slate-300 text-[13px] p-0.5 hover:text-red-400"
            title="Supprimer"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  const hexToRgba = (hex, alpha) => {
    if (!hex) return '#f8fafc';
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m) return '#f8fafc';
    const r = parseInt(m[0], 16);
    const g = parseInt(m[1], 16);
    const b = parseInt(m[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <div className="fi space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Vue Tableau</h2>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">
            {allTasks.length} tâche{allTasks.length > 1 ? 's' : ''} · cliquez sur une ligne pour voir les détails
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: '#007A78' }} />
            {' '}Afficher terminées
          </label>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher des tâches..."
            style={{ paddingLeft: 30, width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px 6px 28px', fontSize: 11, color: '#374151', outline: 'none' }}
          />
        </div>
        <select value={filterProj} onChange={(e) => setFilterProj(e.target.value)} className="inp py-1.5 text-xs" style={{ width: 160 }}>
          <option value="">Tous les projets</option>
          {active.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="inp py-1.5 text-xs" style={{ width: 130 }}>
          <option value="">Tous statuts</option>
          {BOARD_COLS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)} className="inp py-1.5 text-xs" style={{ width: 120 }}>
          <option value="">Toutes priorités</option>
          {PRIORITIES.filter((p) => p.id).map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', borderLeft: '1px solid #e2e8f0', paddingLeft: 8 }}>
          <span style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>Grouper :</span>
          {[{ id: 'project', label: 'Projet' }, { id: 'status', label: 'Statut' }, { id: 'priority', label: 'Priorité' }, { id: 'none', label: 'Aucun' }].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroupBy(g.id)}
              style={{
                fontSize: 8,
                fontWeight: 900,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1.5px solid',
                borderColor: groupBy === g.id ? '#007A78' : '#e2e8f0',
                background: groupBy === g.id ? '#f0fdf4' : 'white',
                color: groupBy === g.id ? '#007A78' : '#94a3b8',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', minWidth: 'min(100%, 900px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', gap: 0, padding: '10px 8px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
          <div />
          <SortBtn col="project" label="Projet" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortBtn col="task" label="Tâche" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortBtn col="status" label="Statut" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortBtn col="priority" label="Priorité" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortBtn col="assignee" label="Responsable" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <span style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Interlocuteur</span>
          <SortBtn col="dueDate" label="Échéance" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <span style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Tag</span>
          <div />
        </div>

        {allTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#cbd5e1' }}>
            <p style={{ fontSize: 12, fontWeight: 700 }}>Aucune tâche correspondant aux filtres</p>
          </div>
        )}

        {groupedTasks.map((group) => (
          <div key={group.key}>
            {groupBy !== 'none' && group.tasks.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: group.color ? hexToRgba(group.color, 0.08) : '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color || '#94a3b8', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 900, color: '#374151', textTransform: 'uppercase', letterSpacing: '.07em' }}>{group.label}</span>
                <span style={{ fontSize: 9, fontWeight: 900, color: group.color || '#94a3b8', background: 'white', padding: '1px 6px', borderRadius: 8, border: '1px solid #e2e8f0' }}>{group.tasks.length}</span>
              </div>
            )}
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        ))}
      </div>
      </div>

      {detailTask && (
        <ItemDetailPanel
          projectId={detailTask.projectId}
          taskId={detailTask.taskId}
          projects={projects}
          config={config}
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
          onEditFull={() => {
            if (onEditProject) { const p = active.find((x) => x.id === detailTask.projectId); if (p) onEditProject(p); }
            setDetailTask(null);
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
            onSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === detailTask.taskId ? updTask : t)) });
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
