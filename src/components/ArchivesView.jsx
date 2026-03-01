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
    <div className="space-y-10">
      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">
        Archives
      </h2>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">
        Archivage des projets et des tâches par mois et par année
      </p>

      <section className="space-y-6">
        <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight border-b border-slate-200 pb-2">
          Archives projets
        </h3>
        {projectGroups.length === 0 ? (
          <div className="glass py-12 text-center">
            <ic.Arch s={32} c="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              Aucun projet archivé
            </p>
          </div>
        ) : (
          projectGroups.map((g) => (
            <div key={g.year + '-' + g.monthKey} className="space-y-3">
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

      <section className="space-y-6">
        <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight border-b border-slate-200 pb-2">
          Archives tâches
        </h3>
        {taskGroups.length === 0 ? (
          <div className="glass py-12 text-center">
            <ic.Arch s={32} c="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              Aucune tâche archivée (terminée)
            </p>
          </div>
        ) : (
          taskGroups.map((g) => (
            <div key={'t-' + g.year + '-' + g.monthKey} className="space-y-3">
              <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                {g.monthLabel}
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {g.items.map((t) => (
                  <div
                    key={t.id}
                    className="glass p-4 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {t.description || '—'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {t._projTitle || 'Projet'}
                      </p>
                      {taskCompletedDateStr(t) && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          Terminé le{' '}
                          {new Date(taskCompletedDateStr(t) + 'T12:00:00').toLocaleDateString(
                            'fr-FR',
                            { day: '2-digit', month: 'short', year: 'numeric' }
                          )}
                        </p>
                      )}
                    </div>
                    {onSilentSave && t._proj && (
                      <button
                        type="button"
                        onClick={() => handleDeleteArchivedTask(t)}
                        className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-red-500 transition-all shadow-sm border border-slate-100 flex-shrink-0"
                        title="Supprimer"
                      >
                        <ic.Tr s={15} />
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
