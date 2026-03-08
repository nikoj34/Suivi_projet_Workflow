import { useState, useEffect } from 'react';
import { emailToDisplayName, today } from '../lib/utils';
import ic, { KanbanIcon, WorkflowIcon, WorkloadIcon, ValidationIcon } from './icons';
import logoDitam from '../assets/logo-ditam.png';

/** Mettre à true pour réafficher "Mon Workflow" et "Ma charge" dans le menu. */
const SHOW_WORKFLOW_AND_WORKLOAD = false;

/** Mettre à true pour réafficher "Mon temps de travail" dans le menu Outils. */
const SHOW_WORK_TIME = false;

const navItemStyle = (active) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 14px',
  borderRadius: 12,
  transition: 'all .15s',
  background: active ? 'rgba(255,255,255,0.85)' : 'transparent',
  border: active ? '1px solid rgba(255,255,255,0.9)' : '1px solid transparent',
  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
  cursor: 'pointer',
  color: active ? '#1e293b' : '#64748b',
  textAlign: 'left',
  marginBottom: 1,
});

function NavGroup({ label, children }) {
  return (
    <div className="mb-3">
      <p style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.2em', padding: '6px 14px 4px', userSelect: 'none' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function NavItem({ id, label, Icon, badge, badgeColor = 'bg-slate-200 text-slate-600', sub, view, onNav }) {
  const active = view === id || (view === 'edit' && id === 'list');
  return (
    <button type="button" onClick={() => onNav(id)} style={navItemStyle(active)}>
      <span style={{ color: active ? '#007A78' : '#94a3b8', flexShrink: 0, display: 'flex' }}>
        <Icon s={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: active ? 900 : 700, textTransform: 'uppercase', letterSpacing: '.07em', display: 'block' }}>
          {label}
        </span>
        {sub && <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600, display: 'block', marginTop: 1 }}>{sub}</span>}
      </div>
      {badge != null && badge > 0 && (
        <span style={{ fontSize: 7, fontWeight: 900, padding: '2px 5px', borderRadius: 10, flexShrink: 0 }} className={badgeColor}>
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Layout({
  children,
  view,
  onNav,
  config,
  lastBackup,
  fileLinked,
  fileName,
  projects,
  cloudStatus,
  lastSyncSuccessAt,
  onSearch,
  onBackToLogin,
  isAnonymous,
  userEmail,
  showManagerView,
  listBadgeCount,
  boardTaskBadgeCount,
  onOpenWorkTime,
  validationPendingCount,
  workflowBadgeCount,
  onSignOut,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  useEffect(() => {
    if (lastSyncSuccessAt == null) return;
    setShowSavedBadge(true);
    const t = setTimeout(() => setShowSavedBadge(false), 4000);
    return () => clearTimeout(t);
  }, [lastSyncSuccessAt]);
  const showCloudCheck = showSavedBadge;
  const handleNav = (v) => {
    setSidebarOpen(false);
    onNav(v);
  };
  const active = (projects || []).filter((p) => p.status === 'active');
  const listCount = listBadgeCount != null ? listBadgeCount : active.length;
  const lateCount = active.reduce((s, p) => s + (p.tasks || []).filter((t) => !t.done && t.dueDate && t.dueDate < today()).length, 0);
  const allTaskCount = boardTaskBadgeCount != null ? boardTaskBadgeCount : active.reduce((s, p) => s + (p.tasks || []).filter((t) => !t.done && t.status !== 'Terminé').length, 0);

  const handleSaveExport = () => {
    if (fs.linked()) fs.write();
    else db.export();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* TopBar mobile : visible uniquement en dessous de md */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <span className="text-xl leading-none">☰</span>
          </button>
          <div className="min-w-0 flex items-center">
            {(config.customLogo || logoDitam) ? (
              <img src={config.customLogo || logoDitam} alt="Logo DITAM" className="h-10 w-auto object-contain object-left max-w-[140px] mix-blend-multiply" />
            ) : (
              <div className="flex items-center gap-2 bg-white/80 px-2 py-1.5 rounded-lg border border-slate-200/80">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#007A78] to-[#006664] flex items-center justify-center text-white font-black text-sm italic">D</div>
                <div>
                  <span className="font-black text-sm text-slate-800 italic">ditam</span>
                  <span className="block text-[9px] font-black text-[#dd007e] uppercase tracking-wider">Travaux</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overlay mobile quand le menu est ouvert */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-20
          w-[280px] max-w-[85vw] md:w-[230px] flex-shrink-0
          flex flex-col
          bg-white md:bg-[rgba(255,255,255,0.5)] md:backdrop-blur-[40px]
          border-r border-slate-200 md:border-[rgba(255,255,255,0.7)]
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div style={{ padding: '20px 14px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ height: 46, display: 'flex', alignItems: 'center' }}>
              {(config.customLogo || logoDitam) ? (
                <img src={config.customLogo || logoDitam} alt="Logo DITAM" className="max-h-full max-w-[140px] object-contain mix-blend-multiply" style={{ maxHeight: '100%', maxWidth: '140px', objectFit: 'contain' }} />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255,255,255,0.6)',
                    padding: '8px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.8)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg,#007A78,#006664)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: 16,
                      fontStyle: 'italic',
                      flexShrink: 0,
                    }}
                  >
                    D
                  </div>
                  <div>
                    <span style={{ fontWeight: 900, fontSize: 14, color: '#1e293b', fontStyle: 'italic', letterSpacing: '-0.5px' }}>ditam</span>
                    <br />
                    <span style={{ fontSize: 7, fontWeight: 900, color: '#dd007e', textTransform: 'uppercase', letterSpacing: '.2em' }}>Travaux</span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              aria-label="Fermer le menu"
            >
              ✕
            </button>
            <div
              title={
                cloudStatus === 'online'
                  ? (showCloudCheck ? 'Synchronisation réussie' : 'Synchronisé avec Firebase Firestore')
                  : cloudStatus === 'connecting'
                    ? 'Connexion au cloud en cours…'
                    : 'Données locales uniquement.'
              }
              className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm flex-shrink-0 ${
                cloudStatus === 'online' ? 'bg-teal-50 border-teal-100 text-teal-600' : cloudStatus === 'connecting' ? 'bg-amber-50 border-amber-100 text-amber-500' : 'bg-red-50 border-red-100 text-red-500'
              }`}
            >
              {cloudStatus === 'online' ? (
                showCloudCheck ? (
                  <>
                    <ic.CloudCheck s={13} />
                    <span className="text-[8px] font-black">SYNC OK</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                    <span className="text-[8px] font-black">CLOUD</span>
                  </>
                )
              ) : cloudStatus === 'connecting' ? (
                <span className="text-[8px] font-black">SYNC...</span>
              ) : (
                <span className="text-[8px] font-black">LOCAL</span>
              )}
            </div>
          </div>
          {userEmail && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.6)',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.06)',
                fontSize: 9,
                color: '#475569',
                fontWeight: 700,
              }}
              title={`Compte connecté (${userEmail})`}
            >
              <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>Connecté : </span>
              <span style={{ wordBreak: 'break-word' }}>{emailToDisplayName(userEmail)}</span>
            </div>
          )}
        </div>
        <div style={{ padding: '0 8px 8px', flexShrink: 0 }}>
          <button
            onClick={onSearch}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px dashed rgba(148,163,184,0.4)',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <ic.Srch s={13} />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Rechercher… ⌘K</span>
          </button>
        </div>
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
          <NavGroup label="Vues">
            <NavItem id="dashboard" label="Dashboard" Icon={ic.Dash} view={view} onNav={handleNav} />
            <NavItem id="board" label="Suivi des tâches" Icon={KanbanIcon} badge={allTaskCount > 0 ? allTaskCount : null} badgeColor="bg-blue-100 text-blue-600" sub="Kanban · Tableau · Calendrier" view={view} onNav={handleNav} />
            {SHOW_WORKFLOW_AND_WORKLOAD && <NavItem id="workflow" label="Mon Workflow" Icon={WorkflowIcon} badge={(workflowBadgeCount ?? 0) > 0 ? workflowBadgeCount : null} badgeColor="bg-red-100 text-red-600" view={view} onNav={handleNav} />}
            {SHOW_WORKFLOW_AND_WORKLOAD && <NavItem id="workload" label="Ma charge" Icon={WorkloadIcon} sub="Par responsable" view={view} onNav={handleNav} />}
            {showManagerView && <NavItem id="managerView" label="Vue Manager" Icon={WorkloadIcon} sub="Charge équipe" view={view} onNav={handleNav} />}
            {showManagerView && <NavItem id="validation" label="Centre de Validation" Icon={ValidationIcon} badge={(validationPendingCount ?? 0) > 0 ? validationPendingCount : null} badgeColor="bg-red-100 text-red-600" view={view} onNav={handleNav} />}
          </NavGroup>
          <NavGroup label="Projets">
            <NavItem id="list" label="Suivi projets" Icon={ic.List} badge={listCount > 0 ? listCount : null} badgeColor="bg-teal-100 text-teal-700" view={view} onNav={handleNav} />
          </NavGroup>
          <NavGroup label="Outils">
            {SHOW_WORK_TIME && onOpenWorkTime && (
              <button
                type="button"
                onClick={onOpenWorkTime}
                style={navItemStyle(false)}
                className="hover:bg-white/50 hover:border-white/80"
              >
                <span style={{ flexShrink: 0 }}>⚙️</span>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>Mon temps de travail</span>
                </div>
              </button>
            )}
            <NavItem id="contacts" label="Contacts" Icon={ic.Addr} view={view} onNav={handleNav} />
            <NavItem id="config" label="Paramètres" Icon={ic.Cog} view={view} onNav={handleNav} />
            <NavItem id="archives" label="Archives" Icon={ic.Arch} view={view} onNav={handleNav} />
          </NavGroup>
        </nav>
        <div style={{ padding: '8px 10px 12px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleSaveExport}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px',
              borderRadius: 10,
              background: '#007A78',
              color: 'white',
              border: 'none',
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              cursor: 'pointer',
              marginBottom: 8,
              transition: 'all .15s',
            }}
            className="hover:bg-[#006664]"
          >
            <ic.Sv s={13} /> {fileLinked ? '💾 Sauvegarder' : '💾 Exporter JSON'}
          </button>
          {isAnonymous && onBackToLogin && (
            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px',
                borderRadius: 10,
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                fontSize: 9,
                fontWeight: 900,
                textTransform: 'uppercase',
                cursor: 'pointer',
                marginBottom: 8,
                transition: 'all 0.2s',
              }}
              className="hover:bg-slate-50 hover:border-slate-200"
            >
              Revenir à la connexion
            </button>
          )}
          {!isAnonymous && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px',
                borderRadius: 10,
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #fee2e2',
                fontSize: 9,
                fontWeight: 900,
                textTransform: 'uppercase',
                cursor: 'pointer',
                marginBottom: 8,
                transition: 'all 0.2s',
              }}
              className="hover:bg-red-50 hover:border-red-200"
            >
              🔴 DÉCONNEXION
            </button>
          )}
          <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.5)', textAlign: 'center' }}>
            {fileLinked ? (
              <>
                <p style={{ fontSize: 7, fontWeight: 900, color: '#007A78', textTransform: 'uppercase', letterSpacing: '.15em' }}>● Auto-save actif</p>
                <p style={{ fontSize: 7, color: '#64748b', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{fileName}</p>
              </>
            ) : (
              <p style={{ fontSize: 7, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.15em' }}>● Non lié à un fichier</p>
            )}
            {lastBackup && (
              <p style={{ fontSize: 7, color: '#cbd5e1', marginTop: 4, borderTop: '1px solid rgba(226,232,240,0.5)', paddingTop: 4 }}>
                Sauvegardé {new Date(lastBackup).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <p style={{ fontSize: 6, fontWeight: 900, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 3 }}>© N. Jamet — DITAM</p>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pt-14 md:pt-0">
        <div className="flex-1 min-h-0 overflow-auto p-3 md:p-4 box-border w-full max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
