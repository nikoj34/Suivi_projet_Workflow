import { useMemo } from 'react';
import { taskCompletedAt } from '../lib/utils';
import ProjectList from './ProjectList';
import ic from './icons';

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function groupByYearMonth(items, getDate) {
  const map = {};
  items.forEach((it) => {
    const d = getDate(it) || '';
    const dateStr = typeof d === 'string' && d.indexOf('T') >= 0 ? d.split('T')[0] : d;
    const year = dateStr ? dateStr.slice(0, 4) : 'Sans date';
    const monthKey = dateStr ? dateStr.slice(0, 7) : 'Sans date';
    if (!map[year]) map[year] = {};
    if (!map[year][monthKey]) map[year][monthKey] = [];
    map[year][monthKey].push(it);
  });
  const years = Object.keys(map)
    .sort((a, b) => (a === 'Sans date' ? '0000' : a).localeCompare(b === 'Sans date' ? '0000' : b, undefined, { numeric: true }))
    .reverse();
  const out = [];
  years.forEach((year) => {
    const months = Object.keys(map[year])
      .sort((a, b) => (a === 'Sans date' ? '' : a).localeCompare(b === 'Sans date' ? '' : b, undefined, { numeric: true }))
      .reverse();
    months.forEach((monthKey) => {
      const monthLabel =
        monthKey === 'Sans date'
          ? 'Sans date'
          : MONTH_NAMES[parseInt(monthKey.slice(5), 10) - 1] + ' ' + monthKey.slice(0, 4);
      out.push({ year, monthKey, monthLabel, items: map[year][monthKey] });
    });
  });
  return out;
}

function taskCompletedDateStr(t) {
  const d = taskCompletedAt(t);
  if (!d) return '';
  return typeof d === 'string' && d.indexOf('T') >= 0 ? d.split('T')[0] : d;
}

export default function ArchivesView({ projects, onEdit, onDelete, onArchive, onRestore, onSilentSave, currentUid }) {
  const archivedProjects = useMemo(
    () => (projects || []).filter((p) => p.status === 'archived'),
    [projects]
  );
  const projectGroups = useMemo(
    () => groupByYearMonth(archivedProjects, (p) => p.archivedAt || p.createdAt || ''),
    [archivedProjects]
  );

  const allTasksWithProj = useMemo(() => {
    return (projects || []).flatMap((p) =>
      (p.tasks || [])
        .filter((t) => (t.done || t.status === 'Terminé') && taskCompletedAt(t))
        .map((t) => ({ ...t, _projTitle: p.title, _projId: p.id, _proj: p }))
    );
  }, [projects]);
  const taskGroups = useMemo(
    () => groupByYearMonth(allTasksWithProj, (t) => taskCompletedDateStr(t)),
    [allTasksWithProj]
  );

  const handleDeleteArchivedTask = (t) => {
    if (!window.confirm('Supprimer définitivement cette tâche des archives ?')) return;
    if (onSilentSave && t._proj) {
      onSilentSave({
        ...t._proj,
        tasks: (t._proj.tasks || []).filter((x) => x.id !== t.id),
      });
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          Archives
        </h2>
        <p className="text-[10px] text-slate-400 mt-1">
          Projets et tâches archivés par mois
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Projets archivés
        </h3>
        {projectGroups.length === 0 ? (
          <div className="rounded-xl bg-slate-50/80 border border-slate-100 py-10 text-center">
            <ic.Arch s={24} c="text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-[10px] font-medium">
              Aucun projet archivé
            </p>
          </div>
        ) : (
          projectGroups.map((g) => (
            <div key={g.year + '-' + g.monthKey} className="space-y-2">
              <ProjectList
                projects={[]}
                listOverride={g.items}
                sectionTitle={g.monthLabel}
                onEdit={onEdit}
                onDelete={onDelete}
                onArchive={onArchive}
                onRestore={onRestore}
                isArchive
                currentUid={currentUid}
              />
            </div>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Tâches terminées (archives)
        </h3>
        {taskGroups.length === 0 ? (
          <div className="rounded-xl bg-slate-50/80 border border-slate-100 py-10 text-center">
            <ic.Arch s={24} c="text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-[10px] font-medium">
              Aucune tâche archivée
            </p>
          </div>
        ) : (
          taskGroups.map((g) => (
            <div key={'t-' + g.year + '-' + g.monthKey} className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 pl-1">
                {g.monthLabel}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {g.items.map((t) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEdit && t._proj && onEdit(t._proj)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit && t._proj && onEdit(t._proj); } }}
                    className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-white/60 border border-slate-100 hover:border-slate-200 hover:bg-white/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {t.description || '—'}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {t._projTitle || 'Projet'}
                        {taskCompletedDateStr(t) && (
                          <span className="text-slate-300 ml-1.5">
                            · {new Date(taskCompletedDateStr(t) + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </p>
                    </div>
                    {onSilentSave && t._proj && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteArchivedTask(t); }}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50/80 transition-colors flex-shrink-0"
                        title="Supprimer"
                      >
                        <ic.Tr s={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
