import { today, projBudget, fmtAmt } from '../lib/utils';
import ic from './icons';
export default function ProjectList({
  projects,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  isArchive,
  onDuplicate,
  listOverride,
  sectionTitle,
  currentUid,
}) {
  const list = listOverride !== undefined ? listOverride : projects.filter((p) => (isArchive ? p.status === 'archived' : p.status === 'active'));
  const todayStr = today();
  const title = sectionTitle != null ? sectionTitle : isArchive ? 'Archives' : 'Suivi des Opérations';

  if (list.length === 0) {
    return (
      <div className="space-y-4 fi">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-5">
          {title}
          <span className="ml-3 text-sm font-bold text-slate-300 normal-case">
            {list.length} projet{list.length !== 1 ? 's' : ''}
          </span>
        </h2>
        <div className="glass py-20 text-center">
          <ic.Arch s={36} c="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">
            Aucun projet {isArchive ? 'archivé' : 'en cours'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fi">
      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-5">
        {title}
        <span className="ml-3 text-sm font-bold text-slate-300 normal-case">
          {list.length} projet{list.length !== 1 ? 's' : ''}
        </span>
      </h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {list.map((p) => {
          const isOwner = !p.ownerId || p.ownerId === (currentUid || 'local');
          const spent = (p.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
          const budget = projBudget(p);
          const ratio = budget > 0 ? (spent / budget) * 100 : 0;
          const over = ratio > 100;
          const delayed = (p.timelineTasks || []).some((t) => t.planEnd && t.planEnd < todayStr && !t.done && t.actualStart);

          const validT = (p.timelineTasks || []).filter((t) => t.planStart && t.planEnd);
          let timeProg = 0;
          if (validT.length > 0) {
            const minS = Math.min(...validT.map((t) => new Date(t.planStart).getTime()));
            const maxE = Math.max(...validT.map((t) => new Date(t.planEnd).getTime()));
            const nw = new Date(todayStr).getTime();
            if (nw > maxE) timeProg = 100;
            else if (nw > minS && maxE > minS) timeProg = Math.round(((nw - minS) / (maxE - minS)) * 100);
          }

          return (
            <div key={p.id} className="glass p-5 group hover:bg-white/65 transition-all">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4
                      onClick={() => onEdit(p)}
                      className="text-base font-black text-slate-800 cursor-pointer hover:text-[#007A78] transition-colors"
                      title="Cliquer pour modifier l'opération"
                    >
                      {p.title || 'Sans titre'}
                    </h4>
                    {over && (
                      <span className="badge-red text-[8px] font-black px-2 py-0.5 rounded-full border">
                        Dépassement +{Math.round(ratio - 100)}%
                      </span>
                    )}
                    {delayed && (
                      <span className="badge-amber text-[8px] font-black px-2 py-0.5 rounded-full border">
                        ⚠ Retard
                      </span>
                    )}
                    {p.phaseActive && (
                      <span className="badge-blue text-[8px] font-black px-2 py-0.5 rounded-full border">
                        {p.phaseActive}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex-wrap">
                    <span className="flex items-center gap-1">
                      <ic.Pin s={10} c="text-[#007A78]" />
                      {p.location}
                      {p.subLocation ? ` · ${p.subLocation}` : ''}
                    </span>
                    {p.typeTravaux && (
                      <span className="flex items-center gap-1">
                        <ic.Build s={10} />
                        {p.typeTravaux}
                      </span>
                    )}
                    {budget > 0 && <span>Budget: {fmtAmt(budget)}</span>}
                    {spent > 0 && (
                      <span className={over ? 'text-[#dd007e]' : ''}>Engagé: {fmtAmt(spent)}</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5 max-w-md">
                    {budget > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black text-slate-400 uppercase w-10">
                          Budget
                        </span>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-1">
                          <div
                            className={`h-full rounded-full ${over ? 'bg-[#dd007e]' : 'bg-[#007A78]'}`}
                            style={{ width: `${Math.min(ratio, 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 w-8 text-right">
                          {Math.round(ratio)}%
                        </span>
                      </div>
                    )}
                    {validT.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black text-slate-400 uppercase w-10">
                          Délai
                        </span>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-1">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{ width: `${timeProg}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 w-8 text-right">
                          {timeProg}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 flex-shrink-0">
                  {!isArchive && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-[#007A78] transition-all shadow-sm border border-slate-100"
                        title="Modifier"
                      >
                        <ic.Ed s={15} />
                      </button>
                      {isOwner && !isArchive && onDuplicate && (
                        <button
                          type="button"
                          onClick={() => onDuplicate(p)}
                          className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-blue-500 transition-all shadow-sm border border-slate-100"
                          title="Dupliquer comme modèle"
                        >
                          <ic.Copy s={15} />
                        </button>
                      )}
                      {isOwner && (
                      <button
                        type="button"
                        onClick={() => onArchive(p.id)}
                        className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-amber-500 transition-all shadow-sm border border-slate-100"
                        title="Archiver"
                      >
                        <ic.Arch s={15} />
                      </button>
                      )}
                    </>
                  )}
                  {isArchive && (
                    <button
                      type="button"
                      onClick={() => onRestore(p.id)}
                      className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-[#007A78] transition-all shadow-sm border border-slate-100"
                      title="Restaurer"
                    >
                      <ic.Rst s={15} />
                    </button>
                  )}
                  {isOwner && (
                  <button
                    type="button"
                    onClick={() => onDelete(p.id)}
                    className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-red-500 transition-all shadow-sm border border-slate-100"
                    title="Supprimer"
                  >
                    <ic.Tr s={15} />
                  </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
