import { useState, useMemo } from 'react';
import GanttChart from './GanttChart';
import ItemDetailPanel from './ItemDetailPanel';
import { isTaskArchived, addTaskLog } from '../lib/utils';

/**
 * Vue Gantt du suivi des tâches : agrège les tâches de tous les projets (board)
 * et les affiche sur une timeline par échéance (dueDate → planStart/planEnd).
 * Les tâches sont cliquables et ouvrent le panneau de détail comme en vue Tableau/Kanban.
 */
export default function BoardGanttView({
  projects,
  config,
  onSilentSave,
  onEditProject,
  managerAgentIds,
  currentUid,
  managerAgentLabels,
}) {
  const [detailTask, setDetailTask] = useState(null);
  const active = (projects || []).filter((p) => p.status === 'active');

  const ganttTasks = useMemo(() => {
    const list = [];
    (projects || []).forEach((p) => {
      (p.tasks || [])
        .filter((t) => !isTaskArchived(t) && t.dueDate)
        .forEach((t) => {
          list.push({
            id: t.id || `${p.id}-${t.description?.slice(0, 8) || 't'}-${list.length}`,
            label: p.title ? `${p.title} — ${(t.description || 'Sans titre').trim()}` : (t.description || 'Sans titre').trim(),
            planStart: t.dueDate,
            planEnd: t.dueDate,
            done: t.done,
            progress: t.progress,
            _projId: p.id,
            _projTitle: p.title,
          });
        });
    });
    return list;
  }, [projects]);

  return (
    <>
      <div className="w-full min-w-0">
        <GanttChart
        tasks={ganttTasks}
        projectTitle="Suivi des tâches"
        onExportXlsx={undefined}
        onDownloadTemplate={undefined}
        onImportRef={undefined}
        onTaskClick={(t) => setDetailTask({ projectId: t._projId, taskId: t.id })}
      />
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
            onSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) });
          }}
          onSilentSave={(updTask) => {
            const p = active.find((x) => x.id === detailTask.projectId);
            if (!p) return;
            onSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) });
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
    </>
  );
}
