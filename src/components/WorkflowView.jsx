import { getCloudAuth } from '../lib/firebase';

function statusLabel(v) {
  if (!v || !v.status) return '—';
  if (v.status === 'pending_manager') return 'En attente (manager)';
  if (v.status === 'pending_director') return 'En attente (directeur)';
  if (v.status === 'returned_for_info') return 'Correction demandée';
  if (v.status === 'approved') return 'Approuvée';
  if (v.status === 'rejected') return 'Refusé';
  if (v.status === 'archived') return 'Archivée';
  return v.status;
}

function renderTable(rows, emptyMsg, onOpenTask) {
  if (!rows.length) return <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-10 text-center"><p className="text-slate-500 font-bold text-sm">{emptyMsg}</p></div>;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 120px', gap: 12, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        <span>Titre</span>
        <span>Projet</span>
        <span>Statut</span>
        <span>Dernière modif.</span>
      </div>
      {rows.map((row) => {
        const dateStr = row.lastDate ? (new Date(row.lastDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date(row.lastDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) : '—';
        return (
          <button
            key={row.task.id + '_' + row.project.id}
            type="button"
            onClick={() => onOpenTask && onOpenTask(row.project, row.task)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 120px', gap: 12, padding: '12px 16px', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', fontSize: 12, color: '#1e293b', alignItems: 'center' }}
            className="hover:bg-slate-50 transition-colors"
          >
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.task.description || '—'}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{row.project.title || '—'}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{statusLabel(row.task.validation)}</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{dateStr}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function WorkflowView({ projects, onOpenTask, currentUserUid }) {
  const cloudAuth = getCloudAuth();
  const uid = currentUserUid || (cloudAuth && cloudAuth.currentUser ? cloudAuth.currentUser.uid : 'local');
  const active = (projects || []).filter((p) => p.status === 'active');

  const withValidation = [];
  active.forEach((p) => {
    (p.tasks || []).forEach((t) => {
      if (!t.validation || t.validation.requestedBy !== uid) return;
      const lastDate = (t.validation.history && t.validation.history.length) ? t.validation.history[t.validation.history.length - 1].date : (t.validation.decidedAt || t.validation.requestedAt || '');
      withValidation.push({ task: t, project: p, lastDate });
    });
  });

  /* Action requise : retours du manager non lus (Validé, À retravailler ou Refusé avec readByAgent === false) */
  const actionRequise = withValidation.filter((x) => {
    const s = x.task.validation.status;
    const unread = x.task.validation.readByAgent === false;
    return unread && (s === 'approved' || s === 'returned_for_info' || s === 'rejected');
  });
  /* En attente : tâches en attente de décision du manager */
  const enAttente = withValidation.filter((x) => {
    const s = x.task.validation.status;
    return s === 'pending_manager' || s === 'pending_director';
  });
  const archives = withValidation.filter((x) => x.task.validation.status === 'archived');
  const archivesByMonth = {};
  archives.forEach((x) => {
    const d = x.lastDate ? new Date(x.lastDate) : new Date();
    const key = d.getFullYear() + '-' + (d.getMonth() + 1);
    if (!archivesByMonth[key]) archivesByMonth[key] = [];
    archivesByMonth[key].push(x);
  });
  const monthLabels = Object.keys(archivesByMonth).sort().reverse();

  return (
    <div className="fi space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Mon Workflow</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tâches envoyées en validation</p>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2" style={{ color: '#dc2626' }}>Action requise ({actionRequise.length})</h3>
          {renderTable(actionRequise, 'Aucune action requise.', onOpenTask)}
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">En attente ({enAttente.length})</h3>
          {renderTable(enAttente, 'Aucune tâche en attente.', onOpenTask)}
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Archives ({archives.length})</h3>
          {monthLabels.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-10 text-center"><p className="text-slate-500 font-bold text-sm">Aucune archive.</p></div>
          ) : (
            monthLabels.map((key) => {
              const parts = key.split('-');
              const y = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10) - 1;
              const label = new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
              const cap = label.charAt(0).toUpperCase() + label.slice(1);
              return (
                <div key={key} className="mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{cap}</p>
                  {renderTable(archivesByMonth[key], '—', onOpenTask)}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
