import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getCloudAuth } from '../lib/firebase';
import { BOARD_COLS, PRIORITIES, ESTIMATED_DURATION_OPTIONS } from '../lib/constants';
import { today, addTaskLog, formatAgentDisplayName } from '../lib/utils';
import TaskTagBadge from './TaskTagBadge';

/** Mettre à true pour réafficher le bouton Archiver dans le détail d'une action. */
const SHOW_ARCHIVE_BUTTON = false;
/** Mettre à true pour réafficher le bloc "Message pour le valideur" et le bouton "Demander la validation". */
const SHOW_VALIDATION_REQUEST = false;

export default function ItemDetailPanel({ projectId, taskId, projects, config, onClose, onSave, onEditFull, onDelete, onArchive, managerAgentIds, onSilentSave, currentUid, managerAgentLabels }) {
  const proj = (projects || []).find((p) => p.id === projectId);
  const taskFromSource = proj ? (proj.tasks || []).find((t) => t.id === taskId) : null;
  const [t, setT] = useState(() => (taskFromSource ? { ...taskFromSource } : {}));
  const [showValidationRequestModal, setShowValidationRequestModal] = useState(false);
  const [validationRequestMessage, setValidationRequestMessage] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [workflowReplyMessage, setWorkflowReplyMessage] = useState('');

  useEffect(() => {
    if (taskFromSource) setT({ ...taskFromSource });
  }, [projectId, taskId, taskFromSource?.id, taskFromSource?.status, taskFromSource?.validation?.status]);

  const cloudAuth = getCloudAuth();
  const user = cloudAuth && cloudAuth.currentUser ? cloudAuth.currentUser : null;
  const userEmail = (user && user.email) ? user.email : '';
  const todayStr = today();
  const ids = Array.isArray(managerAgentIds) ? managerAgentIds : [];
  const isManagerForThisTask = ids.length > 0 && t.status === 'À valider' && t.validation && t.validation.status === 'pending_manager' && ids.indexOf(t.validation.requestedBy) !== -1;
  const isLocked = (t.status === 'À valider' && t.validation && t.validation.status === 'pending_manager') && !isManagerForThisTask;
  const isReadOnly = proj && proj.ownerId && proj.ownerId !== (currentUid || 'local');
  const fieldLock = isReadOnly && !isManagerForThisTask;
  const changed = taskFromSource && JSON.stringify(t) !== JSON.stringify(taskFromSource);
  const isValidationFeedback = t.validation && (t.validation.status === 'approved' || t.validation.status === 'rejected');
  const hasUnreadFeedback = isValidationFeedback && t.validation.readByAgent === false;
  const isReturnedForInfo = t.validation && t.validation.status === 'returned_for_info';
  const isManagerViewingProcessedTask = ids.length > 0 && t.validation && ['approved', 'returned_for_info', 'rejected'].includes(t.validation.status);
  const ownerDisplayName = proj && proj.ownerId
    ? formatAgentDisplayName((managerAgentLabels && managerAgentLabels[proj.ownerId]) || (proj.ownerEmail || ''))
    || 'Un agent'
    : 'Un agent';
  const managerDisplayName = (user && user.email) ? formatAgentDisplayName(user.email) : '—';

  if (!proj || !taskFromSource) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-md p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-bold text-slate-600">Tâche introuvable.</p>
          <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-xl text-[11px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200">Fermer</button>
        </div>
      </div>,
      document.body
    );
  }

  const upd = (patch) => setT((prev) => ({ ...prev, ...patch }));

  const effectiveLock = fieldLock || isLocked || isManagerForThisTask;

  const save = () => {
    let toSave = t;
    if ((t.done || t.status === 'Terminé') && !t.completedAt) {
      const nowStr = new Date().toISOString();
      toSave = { ...t, completedAt: nowStr, statusChangedAt: nowStr };
    }
    onSave(addTaskLog(toSave, 'Modifié', 'Via panneau détail'));
  };

  const handleDelete = () => { if (onDelete && confirm('Supprimer définitivement cette action ?')) { onDelete(); onClose(); } };
  const handleArchive = () => { if (onArchive && confirm('Archiver cette action ? Elle passera en statut Terminé.')) { onArchive(); onClose(); } };

  const handleRequestValidation = () => {
    const uid = user ? user.uid : 'local';
    const nowStr = new Date().toISOString();
    const agentDisplayName = (user && user.email) ? formatAgentDisplayName(user.email) : '';
    const updated = addTaskLog(
      {
        ...t,
        status: 'À valider',
        validation: {
          status: 'pending_manager',
          requestedBy: uid,
          requestedAt: nowStr,
          previousStatus: t.status,
          requestMessage: (validationRequestMessage || '').trim(),
          history: [{ date: nowStr, actorName: agentDisplayName, action: 'Demande de validation', comment: (validationRequestMessage || '').trim() }],
        },
      },
      'Demande de validation',
      'Via panneau détail'
    );
    onSave(updated);
    setT(updated);
    setValidationRequestMessage('');
  };

  const handleCancelValidationRequest = () => {
    const updated = addTaskLog({ ...t, status: 'En cours', validation: undefined }, 'Demande annulée', 'Via panneau détail');
    onSave(updated);
    setT(updated);
  };

  const handleManagerApprove = () => {
    const nowStr = new Date().toISOString();
    const hist = (t.validation && t.validation.history) ? t.validation.history.slice() : [];
    hist.push({ date: nowStr, actorName: managerDisplayName, action: 'Approuvée', comment: (managerComment || '').trim() });
    const updated = addTaskLog(
      { ...t, status: 'Validé', validation: { ...t.validation, status: 'approved', comment: (managerComment || '').trim(), decidedAt: nowStr, readByAgent: false, history: hist } },
      'Approuvée',
      'Par le responsable'
    );
    onSave(updated);
    setT(updated);
    setManagerComment('');
  };

  const handleManagerReturnForCorrection = () => {
    const comment = (managerComment || '').trim();
    if (!comment) return alert('Un commentaire est obligatoire pour demander une correction.');
    const nowStr = new Date().toISOString();
    const hist = (t.validation && t.validation.history) ? t.validation.history.slice() : [];
    hist.push({ date: nowStr, actorName: managerDisplayName, action: 'Correction demandée', comment });
    const updated = addTaskLog(
      { ...t, status: 'À retravailler', validation: { ...t.validation, status: 'returned_for_info', comment, decidedAt: nowStr, readByAgent: false, history: hist } },
      'Correction demandée',
      'Retour du responsable'
    );
    onSave(updated);
    setT(updated);
    setManagerComment('');
  };

  const handleManagerReject = () => {
    const comment = (managerComment || '').trim();
    if (!comment) return alert('Un commentaire est obligatoire pour refuser la validation.');
    const nowStr = new Date().toISOString();
    const hist = (t.validation && t.validation.history) ? t.validation.history.slice() : [];
    hist.push({ date: nowStr, actorName: managerDisplayName, action: 'Refusé', comment });
    const updated = addTaskLog(
      { ...t, status: 'Refusé', validation: { ...t.validation, status: 'rejected', comment, decidedAt: nowStr, readByAgent: false, history: hist } },
      'Refusé',
      'Retour du responsable'
    );
    onSave(updated);
    setT(updated);
    setManagerComment('');
  };

  const handleDismissValidationFeedback = () => {
    const updated = addTaskLog({ ...t, validation: undefined }, 'Validation lue', 'Bandeau effacé');
    onSave(updated);
    setT(updated);
  };

  const handleWorkflowReplyAndResend = () => {
    if (!t.validation || !t.validation.history) return;
    const nowStr = new Date().toISOString();
    const newHistory = (t.validation.history || []).slice();
    newHistory.push({ date: nowStr, actorName: (user && user.email) ? formatAgentDisplayName(user.email) : (userEmail ? formatAgentDisplayName(userEmail) : '') || '', action: 'Réponse agent', comment: (workflowReplyMessage || '').trim() });
    const updated = addTaskLog({ ...t, validation: { ...t.validation, status: 'pending_manager', history: newHistory } }, 'Répondre et renvoyer', 'Workflow');
    onSave(updated);
    setT(updated);
    setWorkflowReplyMessage('');
  };

  const handleArchiveValidation = () => {
    if (!t.validation) return;
    const updated = addTaskLog({ ...t, validation: { ...t.validation, status: 'archived' } }, 'Classé aux archives', 'Workflow');
    onSave(updated);
    setT(updated);
  };

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleMarkFeedbackAsRead = () => {
    if (!t.validation || !onSilentSave) return;
    const updated = { ...t, validation: { ...t.validation, readByAgent: true } };
    onSilentSave(updated);
    setT(updated);
  };

  const isLate = t.dueDate && t.dueDate < todayStr && !t.done;
  const inpCls = 'w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none focus:border-[#007A78] focus:bg-white transition-all';
  const lblCls = 'text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-md p-0 md:p-4" onClick={onClose}>
      <div
        className="fixed inset-0 w-full h-[100dvh] min-h-0 max-h-[100dvh] md:static md:w-auto md:max-w-2xl md:h-auto md:min-h-0 md:max-h-[90vh] shadow-2xl rounded-none md:rounded-[32px] overflow-hidden border-0 md:border border-white/60 flex flex-col bg-gradient-to-br from-white via-[rgba(255,245,250,0.98)] to-[rgba(245,255,250,0.98)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : sticky top, fond blanc */}
        <div className="sticky top-0 bg-white z-50 p-4 border-b border-black/5 pt-[env(safe-area-inset-top,20px)] md:pt-4 flex justify-between items-center flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-base md:text-lg font-black uppercase tracking-tighter text-slate-800 block w-full whitespace-normal break-words">Détail de l'action</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block w-full whitespace-normal break-words">{proj?.title || 'Tâche'}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {onEditFull && <button onClick={onEditFull} className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-500 hover:text-slate-700 border border-slate-100 transition-all">{isReadOnly ? 'Consulter le projet' : 'Ouvrir projet'}</button>}
            <button onClick={onClose} aria-label="Fermer" className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors text-slate-500">✕</button>
          </div>
        </div>

        {/* Contenu scrollable unique : champs, historique, boutons */}
        <div className="flex-grow overflow-y-auto p-4 min-h-0">
          <div className="py-4 md:py-6 space-y-4 md:space-y-6">
            {isReadOnly && (
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3">
                <span className="text-lg" title="Consultation uniquement">🔒</span>
                <span className="text-[11px] font-bold block w-full whitespace-normal break-words">Consultation uniquement (Propriété de : {ownerDisplayName})</span>
              </div>
            )}

            {isValidationFeedback && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl flex-wrap px-4 py-3" style={{ background: t.validation.status === 'approved' ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #fed7aa 0%, #fffbeb 100%)', border: t.validation.status === 'approved' ? '1px solid rgba(34,161,38,0.3)' : '1px solid rgba(245,158,11,0.4)' }}>
                <span className="text-[12px] font-bold text-slate-800 block w-full whitespace-normal break-words">Réponse de votre responsable : {(t.validation && t.validation.comment) ? t.validation.comment : '—'}</span>
                {!fieldLock && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasUnreadFeedback && (
                      <button type="button" onClick={handleMarkFeedbackAsRead} className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 transition-all">J'ai pris connaissance du retour</button>
                    )}
                    <button type="button" onClick={handleDismissValidationFeedback} className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-600 text-white hover:bg-slate-700 transition-all">Marquer comme lu / Effacer</button>
                  </div>
                )}
              </div>
            )}

            {isLocked && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #f1f5f9 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <span className="text-[12px] font-bold text-slate-700 block w-full whitespace-normal break-words">🔒 En attente de validation par un responsable.</span>
                <button type="button" onClick={handleCancelValidationRequest} className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all">Annuler la demande de validation</button>
              </div>
            )}

            {isManagerForThisTask && (
              <div className="px-4 py-4 rounded-xl space-y-3" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)', border: '1px solid rgba(59,130,246,0.4)' }}>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest block w-full whitespace-normal break-words">Encart de Décision Manager</p>
                {t.validation && (t.validation.requestMessage || '').trim() && (
                  <p className="text-[11px] text-slate-700 bg-white/60 rounded-lg px-3 py-2 border border-slate-200 block w-full whitespace-normal break-words">
                    <span className="font-black text-slate-500">Message du demandeur :</span> {(t.validation.requestMessage || '').trim()}
                  </p>
                )}
                <textarea className="w-full whitespace-normal break-words resize-none min-h-[100px] py-2 px-3 border-2 border-slate-200 rounded-xl text-[12px] font-bold text-slate-800 outline-none focus:border-blue-500 bg-white" rows={3} placeholder="Commentaire (obligatoire pour correction ou déclin)..." value={managerComment} onChange={(e) => setManagerComment(e.target.value)} />
                <div className="flex gap-3 flex-wrap">
                  <button type="button" onClick={handleManagerApprove} className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#007A78] text-white hover:bg-[#006664] transition-all">Approuver</button>
                  <button type="button" onClick={handleManagerReturnForCorrection} className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 transition-all">Demander une correction</button>
                  <button type="button" onClick={handleManagerReject} className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all">Refuser</button>
                </div>
              </div>
            )}

            {isManagerViewingProcessedTask && (
              <div className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80">
                <p className="text-[11px] font-bold text-slate-700 block w-full whitespace-normal break-words">Votre retour : {(t.validation.comment || '').trim() || '—'}</p>
                <p className="text-[10px] text-slate-500 mt-1 block w-full whitespace-normal break-words">{t.validation.readByAgent ? "👁️ L'agent a pris connaissance de ce retour." : "⏳ En attente de lecture par l'agent."}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className={lblCls}>Description de la tâche</label>
              <textarea className="w-full whitespace-normal break-words resize-none min-h-[100px] py-2 px-3 bg-white/50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:border-[#007A78] focus:bg-white outline-none shadow-sm overflow-y-auto" placeholder="Que faut-il faire ?" value={t.description || ''} onChange={(e) => upd({ description: e.target.value })} disabled={effectiveLock} rows={4} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={lblCls}>Projet</label>
                <div className={inpCls + ' py-3 flex items-center text-slate-600 block w-full whitespace-normal break-words'}>{proj?.title || '—'}</div>
              </div>
              <div className="space-y-2">
                <label className={lblCls}>Responsable</label>
                <textarea className="w-full whitespace-normal break-words resize-none min-h-[80px] py-2 px-3 border-2 border-slate-100 rounded-2xl text-[12px] font-bold text-slate-800 outline-none focus:border-[#007A78] focus:bg-white bg-white/50" placeholder="Nom..." value={t.assignee || ''} onChange={(e) => upd({ assignee: e.target.value })} disabled={effectiveLock} rows={2} />
              </div>
              <div className="space-y-2">
                <label className={lblCls}>Tag</label>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={inpCls} value={t.tag || ''} onChange={(e) => upd({ tag: e.target.value })} disabled={effectiveLock}>
                    <option value="">Aucun tag</option>
                    {(config?.taskTags || []).map((tg) => <option key={tg} value={tg}>{tg}</option>)}
                  </select>
                  {t.tag && <TaskTagBadge tag={t.tag} config={config} size="md" />}
                </div>
              </div>
              <div className="space-y-2">
                <label className={lblCls}>Échéance</label>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="date"
                    className={inpCls}
                    value={t.dueDate || ''}
                    onChange={(e) => {
                      const v = e.target.value || '';
                      upd({ dueDate: v, dueTime: v ? (t.dueTime || '') : '' });
                    }}
                    disabled={effectiveLock}
                  />
                  <input
                    type="time"
                    className={inpCls}
                    value={t.dueTime || ''}
                    onChange={(e) => upd({ dueTime: e.target.value || '' })}
                    disabled={effectiveLock}
                  />
                  {(t.dueDate || t.dueTime) && (
                    <button
                      type="button"
                      onClick={() => upd({ dueDate: '', dueTime: '' })}
                      className="text-[10px] font-bold text-slate-400 hover:text-red-600 px-2 py-1 rounded border border-slate-200 hover:border-red-200 transition-colors"
                      title="Effacer la date d'échéance"
                    >
                      Effacer
                    </button>
                  )}
                  {isLate && <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg">⚠ Retard</span>}
                </div>
              </div>
              <div className="space-y-2">
                <label className={lblCls}>Priorité</label>
                <select className={inpCls} value={t.priority || ''} onChange={(e) => upd({ priority: e.target.value })} disabled={effectiveLock}>
                  {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={lblCls}>Statut</label>
                <select className={inpCls} value={t.done ? 'Terminé' : (t.status === 'Validé' ? 'À faire' : (t.status || 'À faire'))} onChange={(e) => { const v = e.target.value; upd({ status: v, done: v === 'Terminé' }); }} disabled={effectiveLock}>
                  {BOARD_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={lblCls}>Temps estimé</label>
                <select className={inpCls} value={t.estimatedDuration !== undefined && t.estimatedDuration !== null ? String(t.estimatedDuration) : '0'} onChange={(e) => { const v = e.target.value; upd({ estimatedDuration: parseFloat(v) }); }} disabled={effectiveLock}>
                  {ESTIMATED_DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2 col-span-full">
              <label className={lblCls}>Interlocuteur / Société concernée</label>
              <textarea className="w-full whitespace-normal break-words resize-none min-h-[100px] py-2 px-3 bg-white/50 border-2 border-slate-100 rounded-2xl text-[12px] font-bold text-slate-800 outline-none focus:border-[#007A78] focus:bg-white" placeholder="Ex: Entreprise Dupont, Mairie, Chercheur..." value={t.interlocuteur || ''} onChange={(e) => upd({ interlocuteur: e.target.value })} disabled={effectiveLock} rows={3} />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={!!t.urgent} onChange={(e) => upd({ urgent: e.target.checked })} className="w-4 h-4 rounded border-slate-200" disabled={effectiveLock} />
                🔥 Urgent
              </label>
            </div>

            {(t.history && t.history.length) > 0 && (
              <div className="space-y-2">
                <label className={lblCls}>Historique</label>
                <div className="max-h-40 overflow-y-auto flex flex-col gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  {(t.history || []).slice().reverse().map((h, i) => (
                    <div key={i} className="flex gap-2 text-[11px] flex-wrap">
                      <span className="text-blue-600 font-bold flex-shrink-0 block w-full sm:w-auto whitespace-normal break-words">{new Date(h.ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} {new Date(h.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-slate-600 block w-full whitespace-normal break-words"><strong>{h.action}</strong>{h.detail ? ' · ' + h.detail : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {t.validation && t.validation.history && t.validation.history.length > 0 && (
              <div className="space-y-2">
                <label className={lblCls}>Historique Workflow</label>
                <div className="max-h-48 overflow-y-auto flex flex-col gap-2 p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100">
                  {(t.validation.history || []).slice().reverse().map((h, i) => {
                    const d = (h.date && new Date(h.date)) || new Date();
                    const actorDisplay = (h.actorName && formatAgentDisplayName(h.actorName)) || '—';
                    return (
                      <div key={i} className="flex flex-col gap-0.5 text-[11px]">
                        <span className="text-indigo-700 font-bold block w-full whitespace-normal break-words">{d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="text-slate-600 block w-full whitespace-normal break-words">{(actorDisplay !== '—' ? actorDisplay + ' · ' : '') + (h.action || '')}{h.comment ? ' — ' + h.comment : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!fieldLock && isReturnedForInfo && (
              <div className="space-y-2 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', border: '1px solid rgba(245,158,11,0.4)' }}>
                <label className={lblCls}>Répondre au responsable</label>
                {t.validation && t.validation.readByAgent === false && (
                  <p className="text-[11px] font-bold text-slate-700 block w-full whitespace-normal break-words">Retour du responsable : {(t.validation.comment || '').trim() || '—'}</p>
                )}
                <textarea className="w-full whitespace-normal break-words resize-none min-h-[100px] py-2 px-3 border-2 border-slate-200 rounded-xl text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 bg-white" rows={3} placeholder="Votre réponse..." value={workflowReplyMessage} onChange={(e) => setWorkflowReplyMessage(e.target.value)} />
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={handleWorkflowReplyAndResend} className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 transition-all">Répondre et renvoyer</button>
                  {t.validation && t.validation.readByAgent === false && (
                    <button type="button" onClick={handleMarkFeedbackAsRead} className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-500 text-white hover:bg-slate-600 transition-all">J'ai pris connaissance</button>
                  )}
                </div>
              </div>
            )}

            {/* Bloc boutons en fin de contenu scrollable (aucun fixed/absolute/sticky/bottom-0) */}
            <div className="flex flex-wrap gap-3 pt-2 pb-6">
              {SHOW_ARCHIVE_BUTTON && !fieldLock && !isManagerForThisTask && onArchive && <button type="button" onClick={handleArchive} className="px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm">Archiver</button>}
              {!fieldLock && !isManagerForThisTask && onDelete && <button type="button" onClick={handleDelete} className="px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm">Supprimer</button>}
              <button onClick={onClose} className="flex-1 min-w-[100px] px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white text-slate-400 hover:text-slate-600 border border-slate-100 transition-all shadow-sm">Fermer</button>
              {SHOW_VALIDATION_REQUEST && !effectiveLock && t.status !== 'À valider' && (
                <div className="w-full space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Message pour le valideur (optionnel)</label>
                  <textarea className="w-full whitespace-normal break-words resize-none min-h-[100px] py-2 px-3 border-2 border-slate-100 rounded-xl text-[12px] font-bold text-slate-800 outline-none focus:border-indigo-400 bg-white/50" rows={3} placeholder="Ex: Merci de valider cette action après vérification..." value={validationRequestMessage} onChange={(e) => setValidationRequestMessage(e.target.value)} />
                  <button type="button" onClick={handleRequestValidation} className="px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-sm">Demander la validation</button>
                </div>
              )}
              {!fieldLock && isValidationFeedback && !isManagerForThisTask && <button type="button" onClick={handleArchiveValidation} className="px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-slate-500 text-white hover:bg-slate-600 transition-all shadow-sm">Classer aux archives</button>}
              {!fieldLock && !isManagerForThisTask && <button onClick={save} disabled={!changed} className="flex-1 min-w-[100px] px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-[#007A78] text-white hover:bg-teal-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Sauvegarder les modifications</button>}
            </div>

            {/* Espace de fin pour que le clavier iPhone ne cache pas les boutons */}
            <div className="h-24" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
