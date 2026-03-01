import { useState } from 'react';
import { formatAgentDisplayName } from '../lib/utils';
import WorkloadView from './WorkloadView';

export default function ManagerView({
  projects,
  managerAgentIds,
  managerAgentLabels,
  config,
  workTimeConfig,
  onSilentSave,
  onEditProject,
}) {
  const [mode, setMode] = useState('par-agent');
  const ids = Array.isArray(managerAgentIds) ? managerAgentIds : [];
  const agentProjects = (projects || []).filter(
    (p) => p && p.ownerId && ids.indexOf(p.ownerId) !== -1
  );
  const agentIds = ids.filter(Boolean);

  const getAgentLabel = (uid) => {
    if (!uid) return '—';
    const raw = (managerAgentLabels && managerAgentLabels[uid]) || agentProjects.find((p) => p.ownerId === uid)?.ownerEmail || '';
    return formatAgentDisplayName(String(raw || '').trim()) || 'Agent';
  };

  if (agentIds.length === 0) {
    return (
      <div className="fi text-center py-20 text-slate-500">
        <p className="text-lg font-bold mb-2">Vue Manager</p>
        <p className="text-sm">
          Configurez la liste de vos agents dans Paramètres pour voir leur charge ici.
        </p>
      </div>
    );
  }

  return (
    <div className="fi space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
          Vue Manager — Charge équipe
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('par-agent')}
            className={`px-4 py-2 rounded-xl font-black uppercase transition-all ${
              mode === 'par-agent' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Par agent
          </button>
          <button
            type="button"
            onClick={() => setMode('tous')}
            className={`px-4 py-2 rounded-xl font-black uppercase transition-all ${
              mode === 'tous' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous ensemble
          </button>
        </div>
      </div>
      {mode === 'tous' ? (
        <WorkloadView
          projects={agentProjects}
          config={config}
          workTimeConfig={workTimeConfig}
          onSilentSave={onSilentSave}
          onEditProject={onEditProject}
        />
      ) : (
        <div className="space-y-8">
          {agentIds.map((uid) => {
            const projs = agentProjects.filter((p) => p.ownerId === uid);
            return (
              <div
                key={uid}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <p className="font-black text-slate-500 uppercase tracking-widest">Agent</p>
                  <p className="text-sm font-black text-slate-800">{getAgentLabel(uid)}</p>
                  <p className="text-slate-400 mt-0.5">
                    {projs.length} opération{projs.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-4">
                  {projs.length > 0 ? (
                    <WorkloadView
                      projects={projs}
                      config={config}
                      workTimeConfig={workTimeConfig}
                      onSilentSave={onSilentSave}
                      onEditProject={onEditProject}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 italic">Aucun projet actif.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
