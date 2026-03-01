import { useState, useMemo, useEffect } from 'react';
import { getCloudAuth } from '../lib/firebase';
import { BOARD_COLS, PRIORITIES } from '../lib/constants';
import { today, isTaskArchived, addTaskLog, fmtDate, getPriority } from '../lib/utils';
import ic from './icons';
import ItemDetailPanel from './ItemDetailPanel';

export default function BoardView({ projects, projectsForCreate, config, onSilentSave, onEditProject, managerAgentIds, openNewTaskModal, onClearedOpenNewTask, currentUid, managerAgentLabels }) {
  const [filterProj, setFilterProj] = useState('');
  const [dragTask, setDragTask] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({
    description: '', projId: 'general', assignee: '', tag: '', dueDate: '', priority: '', status: 'À faire',
  });
  const [detailTask, setDetailTask] = useState(null);

  const todayStr = today();
  const active = (projects || []).filter((p) => p.status === 'active');
  const activeForCreate = ((projectsForCreate || projects) || []).filter((p) => p.status === 'active');

  const allTasks = useMemo(() => {
    const list = [];
    active.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        if (isTaskArchived(t)) return;
        if (filterProj && p.id !== filterProj) return;
        list.push({ ...t, _projId: p.id, _projTitle: p.title });
      });
    });
    return list;
  }, [projects, filterProj]);

  const tasksByCol = useMemo(() => {
    const m = {};
    BOARD_COLS.forEach((c) => (m[c.id] = []));
    allTasks.forEach((t) => {
      const col = t.done ? 'Terminé' : (t.status || 'À faire');
      const key = BOARD_COLS.some((c) => c.id === col) ? col : 'À faire';
      m[key].push(t);
    });
    return m;
  }, [allTasks]);

  const isManager = managerAgentIds && managerAgentIds.length > 0;
  const canDragTask = (task) => task.status !== 'À valider' || isManager;

  const handleCreateTask = () => {
    if (!newTask.description.trim()) return alert('Veuillez saisir une description.');
    const cloudAuth = getCloudAuth();
    const uid = cloudAuth && cloudAuth.currentUser ? cloudAuth.currentUser.uid : 'local';
    let targetProjId = (newTask.projId || '').trim();
    let proj = targetProjId ? active.find((p) => p.id === targetProjId) : null;
    if (!proj) {
      const unassignedId = 'proj_unassigned_' + uid;
      proj = active.find((p) => p.id === unassignedId) || activeForCreate.find((p) => p.id === unassignedId) || { id: unassignedId, title: 'Tâches non affectées', status: 'active', tasks: [], createdAt: new Date().toISOString(), ownerId: uid };
    }
    const nowStr = new Date().toISOString();
    const taskObj = {
      id: Date.now().toString(),
      description: newTask.description.trim(),
      status: newTask.status,
      done: newTask.status === 'Terminé',
      assignee: newTask.assignee,
      tag: newTask.tag,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      statusChangedAt: nowStr,
      completedAt: newTask.status === 'Terminé' ? nowStr : null,
      history: [{ ts: nowStr, action: 'Créée', detail: 'Via Kanban' }],
    };
    onSilentSave({ ...proj, tasks: [...(proj.tasks || []), taskObj] });
    setShowModal(false);
    setNewTask({ description: '', projId: '', assignee: '', tag: '', dueDate: '', priority: '', status: 'À faire' });
  };

  const moveTask = (task, newStatus, opts = {}) => {
    const proj = active.find((p) => p.id === task._projId);
    if (!proj) return;
    const isDone = newStatus === 'Terminé';
    const nowStr = new Date().toISOString();
    const clearValidation = opts.clearValidation === true;
    const updTask = (tt) => {
      let next = addTaskLog(
        { ...tt, status: newStatus, done: isDone, statusChangedAt: nowStr, ...(isDone ? { completedAt: nowStr } : {}) },
        'Statut → ' + newStatus,
        'Kanban'
      );
      if (clearValidation) next = { ...next, validation: undefined };
      return next;
    };
    const updProj = {
      ...proj,
      tasks: (proj.tasks || []).map((t) => (t.id === task.id ? updTask(t) : t)),
    };
    onSilentSave(updProj);
  };

  const onDragStart = (task) => { if (canDragTask(task)) setDragTask(task); };
  const onDragEnd = () => { setDragTask(null); setDragOver(null); };
  const onDrop = (colId) => {
    if (!dragTask) { setDragOver(null); return; }
    if (!canDragTask(dragTask)) { setDragOver(null); return; }
    /* Interdiction absolue : aucun drop dans la colonne "À valider". Seul le bouton dans ItemDetailPanel peut y envoyer une tâche. */
    if (colId === 'À valider') { setDragOver(null); return; }
    if (dragTask.status === 'À valider') moveTask(dragTask, colId, { clearValidation: true });
    else moveTask(dragTask, colId);
    setDragOver(null);
  };

  const activeCount = allTasks.filter((t) => !t.done && t.status !== 'Terminé').length;
  /* Liste pour le menu "Projet" de la modale Nouvelle tâche : tous les projets actifs, y compris Tâches générales / non affectées */
  const optionsProjetsPourCreate = activeForCreate;

  useEffect(() => {
    if (openNewTaskModal) {
      setNewTask({ description: '', projId: filterProj || '', assignee: '', tag: '', dueDate: '', priority: '', status: 'À faire' });
      setShowModal(true);
      onClearedOpenNewTask?.();
    }
  }, [openNewTaskModal]);

  return (
    <div className="fi" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Vue Kanban Global</h2>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{activeCount} tâches actives</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="inp py-1.5 text-xs w-44" value={filterProj} onChange={(e) => setFilterProj(e.target.value)}>
            <option value="">Tous les projets</option>
            {active.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 flex-1 pb-2 flex-nowrap overflow-x-auto snap-x snap-mandatory min-h-0 md:overflow-hidden" style={{ minHeight: 0 }}>
        {BOARD_COLS.map((col) => {
          const cards = tasksByCol[col.id] || [];
          const isOver = dragOver === col.id;
          return (
            <div
              key={col.id}
              className="min-w-[85vw] max-w-[100vw] md:min-w-0 md:max-w-none snap-center flex-shrink-0 md:flex-1 flex flex-col rounded-2xl transition-all duration-150 overflow-hidden"
              style={{ background: isOver ? col.accent : 'rgba(255,255,255,0.4)', border: `2px solid ${isOver ? col.color : 'rgba(255,255,255,0.6)'}` }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDrop={() => onDrop(col.id)}
            >
              <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#334155', textTransform: 'uppercase' }}>{col.label}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-400">{cards.length}</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cards.map((task) => {
                  const prio = getPriority(task.priority);
                  const isPendingValidation = task.validation && task.validation.status === 'pending_manager';
                  return (
                    <div
                      key={task.id}
                      draggable={canDragTask(task)}
                      onDragStart={() => canDragTask(task) && onDragStart(task)}
                      onDragEnd={onDragEnd}
                      onClick={() => { const p = active.find((x) => x.id === task._projId) || { title: 'Général', tasks: [] }; setDetailTask({ projectId: task._projId, taskId: task.id }); }}
                      className="hover:shadow-md transition-shadow group relative overflow-hidden max-w-full w-full"
                      style={{ background: 'white', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 10, padding: 8, cursor: canDragTask(task) ? 'grab' : 'default' }}
                    >
                      {isPendingValidation && <div className="absolute top-1.5 right-1.5 flex items-center gap-1" style={{ fontSize: 8, fontWeight: 900, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 6 }}>⏳ En validation</div>}
                      <div className="flex justify-between items-start mb-1.5 min-w-0">
                        <span className="truncate max-w-full min-w-0 inline-block text-[7px] font-black uppercase rounded px-1.5 py-0.5" style={{ color: col.color, background: col.accent }}>{task._projTitle || 'Général'}</span>
                        {task.priority && <div style={{ width: 3, height: 10, borderRadius: 2, background: prio.color }} className="flex-shrink-0" />}
                      </div>
                      <div className="whitespace-normal break-words overflow-hidden min-w-0" style={{ overflowWrap: 'anywhere' }}>
                        <p className="text-[10px] font-bold text-slate-800 leading-tight mb-1.5 line-clamp-3 block w-full" style={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{task.description}</p>
                      </div>
                      {task.interlocuteur && String(task.interlocuteur).trim() && <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1 min-w-0 truncate">🏢 {String(task.interlocuteur).trim()}</p>}
                      <div className="flex flex-wrap gap-1 items-center">
                        {task.assignee && <span className="text-[7px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded">👤 {task.assignee}</span>}
                        {task.tag && <span className="text-[7px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">#{task.tag}</span>}
                        {task.dueDate && <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">📅 {fmtDate(task.dueDate)}</span>}
                        {isManager && task.validation && ['approved', 'returned_for_info', 'rejected'].includes(task.validation.status) && (
                          <span className="text-[7px] font-bold ml-auto flex items-center gap-0.5" style={{ color: task.validation.readByAgent ? '#16a34a' : '#94a3b8' }} title={task.validation.readByAgent ? 'Lu par l\'agent' : 'Non lu par l\'agent'}>
                            {task.validation.readByAgent ? <>✓✓ Lu</> : <>⏳ Non lu</>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-md p-0 md:p-4">
          <div className="w-full h-full min-h-screen max-h-screen md:w-auto md:max-w-2xl md:h-auto md:min-h-0 md:max-h-[90vh] shadow-2xl rounded-none md:rounded-[32px] overflow-hidden border-0 md:border border-white/60 relative fi flex flex-col bg-gradient-to-br from-white via-[rgba(255,245,250,0.98)] to-[rgba(245,255,250,0.98)]">
            <div className="px-4 md:px-8 py-6 border-b border-black/5 flex justify-between items-center flex-shrink-0">
              <div><h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">Nouvelle action</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Saisie rapide</p></div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors text-slate-500">✕</button>
            </div>
            <div className="p-4 md:p-8 space-y-6 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Description de la tâche</label>
                <input autoFocus type="text" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:border-[#007A78] focus:bg-white transition-all outline-none shadow-sm" placeholder="Que faut-il faire ?" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Projet</label>
                  <select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTask.projId || ''} onChange={(e) => setNewTask({ ...newTask, projId: e.target.value })}>
                    <option value="">— Aucun projet —</option>
                    {optionsProjetsPourCreate.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Responsable</label>
                  <input type="text" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" placeholder="Nom..." value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Tag</label>
                  <select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTask.tag} onChange={(e) => setNewTask({ ...newTask, tag: e.target.value })}>
                    <option value="">Aucun tag</option>
                    {(config?.taskTags || []).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Échéance</label>
                  <input type="date" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Priorité</label>
                  <select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Statut</label>
                  <select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTask.status} onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}>
                    {BOARD_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-4 md:px-8 py-6 bg-black/5 flex gap-4 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white text-slate-400 hover:text-slate-600 border border-slate-100 transition-all shadow-sm">Annuler</button>
              <button onClick={handleCreateTask} className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-[#007A78] text-white hover:bg-teal-700 transition-all shadow-lg active:scale-95">Enregistrer l'action</button>
            </div>
          </div>
        </div>
      )}

      {detailTask && (
        <ItemDetailPanel
          projectId={detailTask.projectId}
          taskId={detailTask.taskId}
          projects={projects}
          config={config}
          onClose={() => setDetailTask(null)}
          onSave={(updTask) => { const p = active.find((x) => x.id === detailTask.projectId) || {}; if (!p.id) return; onSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) }); }}
          onSilentSave={(updTask) => { const p = active.find((x) => x.id === detailTask.projectId) || {}; if (!p.id) return; onSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) }); }}
          onDelete={() => { const p = active.find((x) => x.id === detailTask.projectId); if (!p) return; onSilentSave({ ...p, tasks: (p.tasks || []).filter((t) => t.id !== detailTask.taskId) }); setDetailTask(null); }}
          onArchive={() => { const p = active.find((x) => x.id === detailTask.projectId); if (!p) return; const nowStr = new Date().toISOString(); const task = (p.tasks || []).find((t) => t.id === detailTask.taskId); if (!task) return; const updTask = addTaskLog({ ...task, status: 'Terminé', done: true, completedAt: nowStr }, 'Archivée', 'Via panneau détail'); onSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === detailTask.taskId ? updTask : t)) }); setDetailTask(null); }}
          onEditFull={() => { if (onEditProject) { const p = active.find((x) => x.id === detailTask.projectId); if (p) onEditProject(p); } setDetailTask(null); }}
          managerAgentIds={managerAgentIds}
          currentUid={currentUid}
          managerAgentLabels={managerAgentLabels || {}}
        />
      )}
    </div>
  );
}
