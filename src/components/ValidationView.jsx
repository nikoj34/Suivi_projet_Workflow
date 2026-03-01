import { useMemo } from 'react';
import { formatAgentDisplayName } from '../lib/utils';

/**
 * Centre de Validation (Manager) : n'affiche QUE les tâches avec
 * t.status === 'À valider' ET t.validation.status === 'pending_manager',
 * et (requestedBy in managerAgentIds OU projet.ownerId in managerAgentIds).
 */
function getPendingValidationTasks(projects, managerAgentIds) {
  const ids = Array.isArray(managerAgentIds) ? managerAgentIds : [];
  const list = [];
  (projects || []).forEach((p) => {
    (p.tasks || []).forEach((t) => {
      if (t.status !== 'À valider' || !t.validation || t.validation.status !== 'pending_manager') return;
      const requestedBy = t.validation.requestedBy;
      const ownerInAgents = p.ownerId && ids.indexOf(p.ownerId) !== -1;
      const requesterInAgents = requestedBy && ids.indexOf(requestedBy) !== -1;
      if (!ownerInAgents && !requesterInAgents) return;
      list.push({ task: t, project: p });
    });
  });
  return list;
}

/** Résout le nom d'affichage pour requestedBy : projets (ownerEmail) ou managerAgentLabels, formaté "Prénom NOM". Jamais l'UID. */
function getAgentDisplayName(requestedBy, projects, managerAgentLabels) {
  let raw = (managerAgentLabels && managerAgentLabels[requestedBy]) || '';
  if (!raw && projects && projects.length) {
    const proj = projects.find((p) => p.ownerId === requestedBy);
    if (proj && proj.ownerEmail != null) raw = proj.ownerEmail;
  }
  const formatted = formatAgentDisplayName(String(raw || '').trim());
  if (formatted) return formatted;
  return '—';
}

export default function ValidationView({ projects, onOpenTask, managerAgentIds, managerAgentLabels, validationPendingCount }) {
  const pendingTasks = useMemo(
    () => getPendingValidationTasks(projects, managerAgentIds),
    [projects, managerAgentIds]
  );
  const displayCount = validationPendingCount != null ? validationPendingCount : pendingTasks.length;

  return (
    <div className="fi space-y-4">
      <div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Centre de Validation</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{displayCount} action(s) en attente de votre validation</p>
      </div>
      {pendingTasks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <p className="text-slate-500 font-bold">Aucune action en attente de validation.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-[500px]">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 120px', gap: 12, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            <span>Titre de la tâche</span>
            <span>Projet</span>
            <span>Agent demandeur</span>
            <span>Date demande</span>
          </div>
          {pendingTasks.map((row) => {
            const reqAt = row.task.validation && row.task.validation.requestedAt;
            const dateStr = reqAt ? (new Date(reqAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date(reqAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) : '—';
            const agentName = getAgentDisplayName(
              (row.task.validation && row.task.validation.requestedBy) || row.project.ownerId,
              projects,
              managerAgentLabels
            );
            return (
              <button
                key={row.task.id + '_' + (row.project.id || '')}
                type="button"
                onClick={() => onOpenTask && onOpenTask(row.project, row.task)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 120px', gap: 12, padding: '14px 16px', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', fontSize: 12, color: '#1e293b', alignItems: 'center' }}
                className="hover:bg-slate-50 transition-colors"
              >
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.task.description || '—'}</span>
                <span style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.project.title || '—'}</span>
                <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>{agentName}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{dateStr}</span>
              </button>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
