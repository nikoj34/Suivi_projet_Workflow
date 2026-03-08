import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getCloudDb, getCloudAuth } from '../lib/firebase';
import { db, fs, backup } from '../lib/storage';
import { SK, DEF_CFG, DEFAULT_WORKTIME } from '../lib/constants';
import { projectsKey, withOwner, formatAgentDisplayName, isGlobalOperation } from '../lib/utils';
import LoginScreen from './LoginScreen';
import StartupScreen from './StartupScreen';
import Layout from './Layout';
import Dashboard from './Dashboard';
import BoardView from './BoardView';
import TableView from './TableView';
import CalendarView from './CalendarView';
import BoardGanttView from './BoardGanttView';
import WorkflowView from './WorkflowView';
import WorkloadView from './WorkloadView';
import ValidationView from './ValidationView';
import ItemDetailPanel from './ItemDetailPanel';
import ProjectForm from './ProjectForm';
import ProjectList from './ProjectList';
import ArchivesView from './ArchivesView';
import SettingsModal from './SettingsModal';
import GlobalContacts from './GlobalContacts';
import WorkTimeModal from './WorkTimeModal';
import SearchModal from './SearchModal';
import TaskAlerts from './TaskAlerts';
import ManagerView from './ManagerView';
import { addTaskLog } from '../lib/utils';
import ic from './icons';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [boardSubView, setBoardSubView] = useState('kanban');
  const [boardTaskFilter, setBoardTaskFilter] = useState('mine');
  const [projects, setProjects] = useState([]);
  const [config, setConfig] = useState(DEF_CFG);
  const [editing, setEditing] = useState(null);
  const [editTab, setEditTab] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [fileLinked, setFileLinked] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showStartup, setShowStartup] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('connecting');
  const [lastSyncSuccessAt, setLastSyncSuccessAt] = useState(null);
  const [user, setUser] = useState(undefined);
  const [managerAgentIds, setManagerAgentIds] = useState([]);
  const [managerAgentLabels, setManagerAgentLabels] = useState({});
  const [workTimeConfig, setWorkTimeConfig] = useState(() => ({ ...DEFAULT_WORKTIME }));
  const [showWorkTimeModal, setShowWorkTimeModal] = useState(false);
  const [detailTaskFromValidation, setDetailTaskFromValidation] = useState(null);
  const [detailTaskFromWorkflow, setDetailTaskFromWorkflow] = useState(null);
  const [openNewTaskModal, setOpenNewTaskModal] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const projectsRef = useRef([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const cloudDb = getCloudDb();
  const cloudAuth = getCloudAuth();

  const refreshFS = () => {
    setFileLinked(fs.linked());
    setFileName(fs.name());
    setLastBackup(localStorage.getItem(SK.BACKUP));
  };
  const refresh = useCallback(() => {
    setProjects(db.all());
    setLastBackup(localStorage.getItem(SK.BACKUP));
  }, []);

  const isHostedAuth = typeof location !== 'undefined' && location.protocol === 'https:' && (location.hostname.endsWith('.web.app') || location.hostname.endsWith('.firebaseapp.com'));

  useEffect(() => {
    if (user && user.isAnonymous && isHostedAuth && cloudAuth) {
      cloudAuth.signOut();
      setUser(null);
    }
  }, [user, isHostedAuth, cloudAuth]);

  useEffect(() => {
    if (!user || user.isAnonymous || !cloudDb) {
      setWorkTimeConfig(() => ({ ...DEFAULT_WORKTIME }));
      return;
    }
    cloudDb.collection('config').doc('worktime_' + user.uid).get().then((docSnap) => {
      if (docSnap.exists && docSnap.data()) {
        const d = docSnap.data();
        setWorkTimeConfig({
          hoursPerDay: d.hoursPerDay != null ? d.hoursPerDay : 7.5,
          workDays: d.workDays && typeof d.workDays === 'object' ? { ...DEFAULT_WORKTIME.workDays, ...d.workDays } : { ...DEFAULT_WORKTIME.workDays },
        });
      }
    }).catch(() => {});
  }, [user, cloudDb]);

  useEffect(() => {
    if (!user || user.isAnonymous || !cloudDb) {
      setManagerAgentIds([]);
      setManagerAgentLabels({});
      return;
    }
    const unsub = cloudDb.collection('managers').doc(user.uid).onSnapshot(
      (docSnap) => {
        if (docSnap.exists) {
          const d = docSnap.data();
          setManagerAgentIds(d.agentIds && Array.isArray(d.agentIds) ? d.agentIds : []);
          setManagerAgentLabels(d.agentLabels && typeof d.agentLabels === 'object' ? d.agentLabels : {});
        } else {
          setManagerAgentIds([]);
          setManagerAgentLabels({});
        }
      },
      () => {
        setManagerAgentIds([]);
        setManagerAgentLabels({});
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, [user, cloudDb]);

  useEffect(() => {
    if (!cloudAuth) {
      const timeoutId = setTimeout(() => {
        setUser((prev) => (prev === undefined ? null : prev));
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
    const unsubscribe = cloudAuth.onAuthStateChanged((u) => setUser(u));
    const fallback = setTimeout(() => {
      setUser((prev) => (prev === undefined ? null : prev));
    }, 2000);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [cloudAuth]);

  /** Plus d'état "connecting" qui clignote : dès qu'on a user + cloudDb, on affiche "online" (vert).
   * On ne passe en "offline" (rouge) qu'en cas d'erreur Firestore. Ainsi la sauvegarde passe tout de suite en vert. */
  useEffect(() => {
    if (!user || !cloudDb) return;
    setCloudStatus('online');
  }, [user, cloudDb]);

  /** Fallback : si malgré tout l'icône reste "connecting" (orange) plus de 2 s, forcer "online". */
  useEffect(() => {
    if (cloudStatus !== 'connecting') return;
    const fallbackId = setTimeout(() => {
      setCloudStatus('online');
      setLastSyncSuccessAt(Date.now());
    }, 2000);
    return () => clearTimeout(fallbackId);
  }, [cloudStatus]);

  useEffect(() => {
    if (!user) {
      setCloudStatus('offline');
      return;
    }

    const localProjs = db.all();
    const isCloudMode = !user.isAnonymous && cloudDb;
    if (isCloudMode) {
      setShowStartup(false);
    } else {
      if (localProjs.length === 0) setShowStartup(true);
      else setProjects(localProjs);
    }
    setConfig(db.cfg());
    setLastBackup(localStorage.getItem(SK.BACKUP));

    if (!cloudDb) {
      setCloudStatus('offline');
      return;
    }
    let offlineTimeoutId = null;
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

    const unsubProjects = cloudDb.collection('projects').onSnapshot(
      (snapshot) => {
        if (offlineTimeoutId) {
          clearTimeout(offlineTimeoutId);
          offlineTimeoutId = null;
        }
        setCloudStatus('online');
        setLastSyncSuccessAt(Date.now());
        const _projectsKeyVal = projectsKey(getCloudAuth);
        const _withOwnerFn = (p) => withOwner(p, getCloudAuth);
        const localProjs = (() => {
          try {
            return JSON.parse(localStorage.getItem(_projectsKeyVal) || '[]');
          } catch (e) {
            return [];
          }
        })();

        if (snapshot.empty && localProjs.length > 0 && !isCloudMode) {
          localProjs.forEach((p) => cloudDb.collection('projects').doc(p.id).set(_withOwnerFn(p)));
          cloudDb.collection('config').doc('main').set(db.cfg());
        }
        if (!snapshot.empty) {
          const cloudProjects = [];
          snapshot.forEach((docSnap) => cloudProjects.push(docSnap.data()));
          const cloudIds = {};
          cloudProjects.forEach((cp) => (cloudIds[cp.id] = true));
          const currentInState = projectsRef.current || [];
          const merged = cloudProjects.map((cp) => {
            const inState = currentInState.find((p) => p.id === cp.id);
            if (inState && inState.updatedAt && cp.updatedAt && new Date(inState.updatedAt) > new Date(cp.updatedAt)) {
              return inState;
            }
            const local = localProjs.find((p) => p.id === cp.id);
            if (local && local.updatedAt && cp.updatedAt) {
              if (new Date(cp.updatedAt) > new Date(local.updatedAt)) return { ...local, ...cp };
              return local;
            }
            if (local) return { ...local, ...cp };
            return cp;
          });
          localProjs.forEach((p) => {
            if (!cloudIds[p.id]) merged.push(p);
          });
          localStorage.setItem(_projectsKeyVal, JSON.stringify(merged));
          setProjects(merged);
        }
        setShowStartup(false);
      },
      (error) => {
        console.error('Erreur Cloud:', error);
        const isUnavailable = error && (error.code === 'unavailable' || (error.message && String(error.message).toLowerCase().includes('unavailable')));
        if (isUnavailable) {
          setCloudStatus('offline');
        } else if (isMobile) {
          offlineTimeoutId = setTimeout(() => setCloudStatus('offline'), 5000);
        } else {
          setCloudStatus('offline');
        }
      }
    );

    const unsubConfig = cloudDb.collection('config').doc('main').onSnapshot((docSnap) => {
      if (docSnap.exists) {
        const c = docSnap.data();
        const current = db.cfg();
        const merged = { ...DEF_CFG, ...c };
        if (merged.customLogo == null && current.customLogo) merged.customLogo = current.customLogo;
        setConfig(merged);
        localStorage.setItem(SK.CONFIG, JSON.stringify(merged));
      }
    });

    fs.setOnChange && fs.setOnChange(refreshFS);
    fs.restore().then((r) => {
      if (r) refreshFS();
    });
    backup.auto();
    const autoSave = setInterval(() => {
      if (fs.linked()) fs.write();
    }, 15 * 60 * 1000);

    return () => {
      if (fs.setOnChange) fs.setOnChange(null);
      clearInterval(autoSave);
      if (offlineTimeoutId) clearTimeout(offlineTimeoutId);
      if (unsubProjects) unsubProjects();
      if (unsubConfig) unsubConfig();
    };
  }, [user, cloudDb]);

  useEffect(() => {
    if (!user) return;
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [user]);

  const currentUid = user && user.uid ? user.uid : 'local';

  const handleLoaded = () => {
    setShowStartup(false);
    refresh();
    setConfig(db.cfg());
    refreshFS();
  };
  const handleFresh = () => setShowStartup(false);
  const handleSave = useCallback((data) => {
    if (data.ownerId && data.ownerId !== currentUid) {
      setSaveError('Vous ne pouvez modifier que les opérations dont vous êtes propriétaire.');
      return;
    }
    db.save(data).then(() => {
      refresh();
      setEditing(null);
      setView('list');
      setLastSyncSuccessAt(Date.now());
      setCloudStatus('online');
    }).catch((err) => {
      setSaveError(err?.message || 'Erreur d\'enregistrement');
    });
  }, [currentUid, refresh]);
  const handleSilentSave = useCallback((p) => {
    const current = projects.find((x) => x.id === p.id);
    const isNewProject = !current;
    const hasNoTitle = !(p.title || '').trim();
    if (isNewProject && hasNoTitle) return Promise.resolve();
    const isOwner = !p.ownerId || p.ownerId === currentUid;
    const isManagerOfOwner = managerAgentIds && managerAgentIds.indexOf(p.ownerId) !== -1;
    if (!isOwner && !isManagerOfOwner) {
      setSaveError('Vous ne pouvez modifier que les opérations dont vous êtes propriétaire.');
      return;
    }
    const full = current ? { ...current, ...p } : p;
    const withOwnerProj = user && !user.isAnonymous ? withOwner({ ...full }, getCloudAuth) : full;
    if (isNewProject && !(withOwnerProj.title || '').trim()) return Promise.resolve();
    const withOwnerProjToSave = { ...withOwnerProj, updatedAt: new Date().toISOString() };
    const nextList = (projects || []).slice();
    const idx = nextList.findIndex((x) => x.id === withOwnerProjToSave.id);
    if (idx >= 0) nextList[idx] = withOwnerProjToSave;
    else nextList.push(withOwnerProjToSave);
    projectsRef.current = nextList;
    setProjects(nextList);
    setEditing((prev) => (prev && prev.id === withOwnerProjToSave.id ? { ...prev, tasks: withOwnerProjToSave.tasks } : prev));
    const promise = db.save(withOwnerProjToSave);
    promise.then(() => {
      setProjects((prev) => {
        const list = prev ? prev.slice() : [];
        const idx = list.findIndex((x) => x.id === withOwnerProjToSave.id);
        if (idx >= 0) list[idx] = withOwnerProjToSave;
        else list.push(withOwnerProjToSave);
        return list;
      });
      // Si on est en vue édition sur ce projet, mettre à jour l’état editing pour que le formulaire reflète la tâche (rappels : Terminer / Reporter)
      setEditing((prev) => (prev && prev.id === withOwnerProjToSave.id ? { ...prev, tasks: withOwnerProjToSave.tasks } : prev));
      setLastSyncSuccessAt(Date.now());
      setCloudStatus('online');
    }).catch((err) => {
      setSaveError(err?.message || 'Erreur d\'enregistrement Firestore');
    });
    return promise;
  }, [projects, currentUid, managerAgentIds, user]);
  /** Réordonne les projets (Suivi Opérations) : une seule mise à jour state + sauvegarde de chaque projet. */
  const handleReorderProjects = (orderedProjects) => {
    if (!orderedProjects || orderedProjects.length === 0) return;
    const withOwnerList = orderedProjects.map((p) => {
      const current = projects.find((x) => x.id === p.id);
      const full = current ? { ...current, ...p } : p;
      return user && !user.isAnonymous ? withOwner({ ...full }, getCloudAuth) : full;
    });
    Promise.all(withOwnerList.map((p) => db.save(p)))
      .then(() => {
        setProjects((prev) => {
          const next = prev ? prev.slice() : [];
          withOwnerList.forEach((p) => {
            const idx = next.findIndex((x) => x.id === p.id);
            if (idx >= 0) next[idx] = p;
            else next.push(p);
          });
          return next;
        });
        setLastSyncSuccessAt(Date.now());
        setCloudStatus('online');
      })
      .catch((err) => setSaveError(err?.message || 'Erreur d\'enregistrement'));
  };
  const handleDelete = (id) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (p.ownerId && p.ownerId !== currentUid) {
      setSaveError('Vous ne pouvez supprimer que les opérations dont vous êtes propriétaire.');
      return;
    }
    if (window.confirm('Supprimer ?')) {
      db.del(id);
      refresh();
    }
  };
  const handleArchive = (id) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (p.ownerId && p.ownerId !== currentUid) {
      setSaveError('Vous ne pouvez archiver que les opérations dont vous êtes propriétaire.');
      return;
    }
    db.save({ ...p, status: 'archived', archivedAt: new Date().toISOString() }).then(() => {
      refresh();
      setLastSyncSuccessAt(Date.now());
      setCloudStatus('online');
    }).catch((err) => setSaveError(err?.message || 'Erreur d\'enregistrement'));
  };
  const handleRestore = (id) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (p.ownerId && p.ownerId !== currentUid) {
      setSaveError('Vous ne pouvez restaurer que les opérations dont vous êtes propriétaire.');
      return;
    }
    const { archivedAt, ...rest } = p;
    db.save({ ...rest, status: 'active' }).then(() => {
      refresh();
      setLastSyncSuccessAt(Date.now());
      setCloudStatus('online');
    }).catch((err) => setSaveError(err?.message || 'Erreur d\'enregistrement'));
  };
  const handleNav = (v) => {
    if (v === 'table' || v === 'calendar' || v === 'gantt') {
      setBoardSubView(v);
      setView('board');
    } else {
      setView(v);
    }
    if (v !== 'edit') setEditing(null);
  };
  const handleLinkFile = async () => {
    const ok = await fs.link();
    if (ok) refreshFS();
    return ok;
  };
  const handleUnlinkFile = async () => {
    await fs.unlink();
    refreshFS();
  };
  const handleEditProject = (p) => {
    setEditing(p);
    setEditTab(null);
    setView('edit');
  };
  const handleDuplicate = (p) => {
    if (p.ownerId && p.ownerId !== currentUid) {
      setSaveError('Vous ne pouvez dupliquer que les opérations dont vous êtes propriétaire.');
      return;
    }
    const copy = {
      ...JSON.parse(JSON.stringify(p)),
      id: Date.now().toString(),
      title: p.title + ' (Copie)',
      status: 'active',
      createdAt: new Date().toISOString(),
      tasks: (p.tasks || []).map((t) => ({
        ...t,
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        done: false,
        status: 'À faire',
        history: [{ ts: new Date().toISOString(), action: 'Créée', detail: 'Dupliqué depuis ' + p.title }],
      })),
      expenses: [],
      journal: [],
    };
    db.save(copy).then(() => {
      refresh();
      setEditing(copy);
      setView('edit');
      setLastSyncSuccessAt(Date.now());
      setCloudStatus('online');
    }).catch((err) => setSaveError(err?.message || 'Erreur d\'enregistrement'));
  };
  const handleClaimUnclaimed = () => {
    const uid = user && user.uid;
    if (!uid || !cloudDb) return;
    const toClaim = projects.filter((p) => !p.ownerId);
    const promises = toClaim.map((p) => db.save({ ...p, ownerId: uid, ownerEmail: user.email || '' }));
    Promise.all(promises).then(() => {
      refresh();
      setLastSyncSuccessAt(Date.now());
      setCloudStatus('online');
    }).catch((err) => setSaveError(err?.message || 'Erreur d\'enregistrement'));
  };

  const unclaimed = (projects || []).filter((p) => !p.ownerId);
  const myProjects = (projects || []).filter((p) => !p.ownerId || p.ownerId === currentUid);
  const displayedProjects = (projects || []).filter(
    (p) =>
      !user ||
      user.isAnonymous ||
      !p.ownerId ||
      p.ownerId === user.uid ||
      (managerAgentIds.length > 0 && p.ownerId && managerAgentIds.indexOf(p.ownerId) !== -1)
  );
  const taskProjects =
    managerAgentIds.length === 0
      ? displayedProjects
      : boardTaskFilter === 'mine'
        ? myProjects
        : boardTaskFilter === 'all'
          ? displayedProjects
          : displayedProjects.filter((p) => p.ownerId === boardTaskFilter);

  const { validationPendingCount, workflowBadgeCount, boardTaskBadgeCount } = useMemo(() => {
    let validationPending = 0;
    let workflowBadge = 0;
    /* Centre de Validation : status === 'À valider' ET validation.status === 'pending_manager' ET (requestedBy ou ownerId in managerAgentIds) */
    (projects || []).forEach((p) => {
      (p.tasks || []).forEach((t) => {
        if (t.status !== 'À valider' || !t.validation || t.validation.status !== 'pending_manager') return;
        const requestedBy = t.validation.requestedBy;
        const ownerInAgents = p.ownerId && managerAgentIds.indexOf(p.ownerId) !== -1;
        const requesterInAgents = requestedBy && managerAgentIds.indexOf(requestedBy) !== -1;
        if (ownerInAgents || requesterInAgents) validationPending++;
      });
    });
    /* Mon Workflow (agent) : retours du manager non lus = Validé / À retravailler / Refusé avec readByAgent === false */
    displayedProjects.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        if (!t.validation || t.validation.requestedBy !== currentUid) return;
        const st = t.validation.status;
        const unread = t.validation.readByAgent === false;
        if ((st === 'approved' && unread) || (st === 'returned_for_info' && unread) || (st === 'rejected' && unread)) workflowBadge++;
      });
    });
    let boardTask = 0;
    /* Même périmètre que le Kanban : taskProjects (agent = ses projets + globaux ; manager = selon filtre) */
    const active = (taskProjects || []).filter((p) => p.status === 'active');
    active.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        if (!t.done && t.status !== 'Terminé') boardTask++;
      });
    });
    return { validationPendingCount: validationPending, workflowBadgeCount: workflowBadge, boardTaskBadgeCount: boardTask };
  }, [projects, displayedProjects, managerAgentIds, currentUid, taskProjects]);

  const taskFilterOptions = useMemo(() => {
    if (!managerAgentIds || managerAgentIds.length === 0) return [];
    const opts = [{ value: 'mine', label: 'Mes tâches' }, { value: 'all', label: 'Vue équipe' }];
    if (displayedProjects) {
      const seen = {};
      displayedProjects.forEach((p) => {
        if (p.ownerId && managerAgentIds.indexOf(p.ownerId) !== -1 && !seen[p.ownerId]) {
          seen[p.ownerId] = true;
          const raw = (managerAgentLabels[p.ownerId] || p.ownerEmail || p.ownerId || '').trim() || p.ownerId;
          const label = formatAgentDisplayName(raw) || 'Agent';
          opts.push({ value: p.ownerId, label });
        }
      });
    }
    return opts;
  }, [managerAgentIds, managerAgentLabels, displayedProjects]);

  const agentOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Vue globale' }];
    if (managerAgentIds && managerAgentIds.length > 0 && displayedProjects) {
      const seen = {};
      displayedProjects.forEach((p) => {
        if (p.ownerId && managerAgentIds.indexOf(p.ownerId) !== -1 && !seen[p.ownerId]) {
          seen[p.ownerId] = true;
          const raw = (managerAgentLabels[p.ownerId] || p.ownerEmail || p.ownerId || '').trim() || p.ownerId;
          const label = formatAgentDisplayName(raw) || 'Agent';
          opts.push({ value: p.ownerId, label });
        }
      });
    }
    return opts;
  }, [managerAgentIds, managerAgentLabels, displayedProjects]);

  /** Liste pour "Suivi des opérations" : projets dont le propriétaire est l'utilisateur connecté. Masque "Tâches non affectées" et "Tâches générales". */
  const operationsListProjects = useMemo(() => {
    const mine = (projects || []).filter((p) => !p.ownerId || p.ownerId === currentUid);
    const withGlobalFlag = mine.map((p) => {
      if (p.isGlobal === true || p.isGlobalOperation === true) return p;
      const t = (p.title || '').trim().toLowerCase();
      const byTitle =
        t.includes('tâches non affectées') ||
        t.includes('taches non affectees') ||
        t.includes('tâches générales') ||
        t.includes('taches generales');
      if (byTitle) return { ...p, isGlobal: true };
      return p;
    });
    return withGlobalFlag.filter((p) => !isGlobalOperation(p));
  }, [projects, currentUid]);

  /** Projets proposés dans le menu "Projet" lors de la création d'une tâche (Kanban) : exclut Tâches non affectées / Tâches générales. */
  const taskProjectsForCreate = useMemo(
    () => (taskProjects || []).filter((p) => !isGlobalOperation(p)),
    [taskProjects]
  );

  /** Liste pour "Suivi des opérations" et Manager. */
  const listAndManagerProjects = useMemo(() => {
    const withGlobalFlag = displayedProjects.map((p) => {
      if (p.isGlobal === true || p.isGlobalOperation === true) return p;
      const t = (p.title || '').trim().toLowerCase();
      const byTitle =
        t.includes('tâches non affectées') ||
        t.includes('taches non affectees') ||
        t.includes('tâches générales') ||
        t.includes('taches generales');
      if (byTitle) return { ...p, isGlobal: true };
      return p;
    });
    return withGlobalFlag;
  }, [displayedProjects]);

  if (user === null) {
    return <LoginScreen config={db.cfg()} onLocalAccess={isHostedAuth ? undefined : () => setUser({ isAnonymous: true })} />;
  }

  function renderView() {
    const editTask = (p, initialTab = 'tasks') => {
      setEditing(p);
      setEditTab(initialTab);
      setView('edit');
    };
    switch (view) {
      case 'board':
        return (
          <>
            <div className="flex items-center gap-4 mb-6 flex-shrink-0 flex-wrap" style={{ flexWrap: 'wrap' }}>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                <span style={{ whiteSpace: 'nowrap' }}>Vue :</span>
                <select
                  value={boardSubView}
                  onChange={(e) => {
                    setBoardSubView(e.target.value);
                    setView('board');
                  }}
                  className="inp py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white min-w-[160px]"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="kanban">Kanban</option>
                  <option value="table">Tableau</option>
                  <option value="calendar">Calendrier</option>
                  <option value="gantt">Gantt</option>
                </select>
              </label>
              {taskFilterOptions.length > 0 && (
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Filtrer :</span>
                  <select
                    value={boardTaskFilter}
                    onChange={(e) => setBoardTaskFilter(e.target.value)}
                    className="inp py-2 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-white min-w-[180px]"
                    style={{ cursor: 'pointer' }}
                  >
                    {taskFilterOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  setBoardSubView('kanban');
                  setOpenNewTaskModal(true);
                }}
                className="bg-[#007A78] text-white py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-[#006664] transition-all"
              >
                <ic.Plus s={12} /> Nouvelle tâche
              </button>
            </div>
            {boardSubView === 'table' ? (
              <TableView
                projects={taskProjects}
                config={config}
                onSilentSave={handleSilentSave}
                onEditProject={handleEditProject}
                managerAgentIds={managerAgentIds}
                currentUid={currentUid}
                managerAgentLabels={managerAgentLabels}
              />
            ) : boardSubView === 'calendar' ? (
              <CalendarView projects={taskProjects} onOpenProject={handleEditProject} />
            ) : boardSubView === 'gantt' ? (
              <div className="glass p-6 md:p-8 rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm min-w-0 w-full">
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-5">Diagramme de Gantt — Suivi des opérations</p>
                <div className="min-h-[320px] w-full min-w-0">
                  <BoardGanttView
                    projects={taskProjects}
                    config={config}
                    onSilentSave={handleSilentSave}
                    onEditProject={handleEditProject}
                    managerAgentIds={managerAgentIds}
                    currentUid={currentUid}
                    managerAgentLabels={managerAgentLabels}
                  />
                </div>
              </div>
            ) : (
              <BoardView
                projects={taskProjects}
                projectsForCreate={taskProjectsForCreate}
                config={config}
                onSilentSave={handleSilentSave}
                onEditProject={handleEditProject}
                managerAgentIds={managerAgentIds}
                openNewTaskModal={openNewTaskModal}
                onClearedOpenNewTask={() => setOpenNewTaskModal(false)}
                currentUid={currentUid}
                managerAgentLabels={managerAgentLabels}
              />
            )}
          </>
        );
      case 'workload':
        return (
          <WorkloadView
            projects={myProjects}
            config={config}
            workTimeConfig={workTimeConfig}
            onSilentSave={handleSilentSave}
            onEditProject={handleEditProject}
            managerAgentIds={managerAgentIds}
            currentUid={currentUid}
            managerAgentLabels={managerAgentLabels}
          />
        );
      case 'managerView':
        return (
          <ManagerView
            projects={listAndManagerProjects}
            managerAgentIds={managerAgentIds}
            managerAgentLabels={managerAgentLabels}
            config={config}
            workTimeConfig={workTimeConfig}
            onSilentSave={handleSilentSave}
            onEditProject={handleEditProject}
          />
        );
      case 'validation':
        return (
          <ValidationView
            projects={projects}
            validationPendingCount={validationPendingCount}
            onOpenTask={(project, task) => setDetailTaskFromValidation({ projectId: project.id, taskId: task.id })}
            managerAgentIds={managerAgentIds}
            managerAgentLabels={managerAgentLabels}
          />
        );
      case 'workflow':
        return (
          <WorkflowView
            projects={displayedProjects}
            onOpenTask={(project, task) => setDetailTaskFromWorkflow({ projectId: project.id, taskId: task.id })}
            currentUserUid={currentUid}
          />
        );
      case 'new':
        return <ProjectForm onSave={handleSave} onSilentSave={handleSilentSave} onCancel={() => setView('list')} config={config} />;
      case 'list':
        return (
          <ProjectList
            projects={operationsListProjects}
            onEdit={handleEditProject}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDuplicate={handleDuplicate}
            onSilentSave={handleSilentSave}
            onReorderProjects={handleReorderProjects}
            onNewOperation={() => setView('new')}
            currentUid={currentUid}
          />
        );
      case 'edit':
        return editing ? <ProjectForm project={editing} onSave={handleSave} onSilentSave={handleSilentSave} onCancel={() => { setEditing(null); setEditTab(null); setView('list'); }} config={config} initialTab={editTab} currentUid={currentUid} managerAgentLabels={managerAgentLabels} managerAgentIds={managerAgentIds} /> : null;
      case 'archives':
        return (
          <ArchivesView
            projects={operationsListProjects}
            onEdit={handleEditProject}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onSilentSave={handleSilentSave}
            currentUid={currentUid}
          />
        );
      case 'contacts':
        return (
          <GlobalContacts
            config={config}
            onSave={(c) => {
              db.saveCfg(c);
              setConfig(c);
            }}
            projects={displayedProjects}
          />
        );
      case 'config':
        return (
          <SettingsModal
            config={config}
            onSave={(c) => {
              db.saveCfg(c);
              setConfig(c);
            }}
            fileLinked={fileLinked}
            fileName={fileName}
            onLinkFile={handleLinkFile}
            onUnlinkFile={handleUnlinkFile}
            cloudDb={cloudDb}
            cloudAuth={cloudAuth}
            projects={displayedProjects}
          />
        );
      default:
        return (
          <Dashboard
            projects={displayedProjects}
            config={config}
            onEditTask={editTask}
            onSilentSave={handleSilentSave}
            showAgentFilter={managerAgentIds.length > 0}
            agentOptions={agentOptions}
          />
        );
    }
  }

  return (
    <>
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ zIndex: 9999 }}>
          <span className="text-xs font-bold text-red-800">⚠ Erreur d'enregistrement : {saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded-lg transition-colors">
            Fermer
          </button>
        </div>
      )}
      {showStartup && (
        <StartupScreen
          onLoad={handleLoaded}
          onFresh={handleFresh}
          onBackToLogin={user && user.isAnonymous ? () => setUser(null) : undefined}
          onSignOut={user && !user.isAnonymous && cloudAuth ? () => { cloudAuth.signOut(); setUser(null); } : undefined}
        />
      )}
      {user && !user.isAnonymous && unclaimed.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 flex-wrap" style={{ zIndex: 9998 }}>
          <span className="text-xs font-bold text-amber-800">{unclaimed.length} projet(s) sans propriétaire (ancienne base).</span>
          <button type="button" onClick={handleClaimUnclaimed} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase rounded-lg transition-colors">
            Tout rattacher à mon compte
          </button>
        </div>
      )}
      {showWorkTimeModal && (
        <WorkTimeModal
          visible
          onClose={() => setShowWorkTimeModal(false)}
          workTimeConfig={workTimeConfig}
          onSave={(cfg) => {
            if (cloudDb && user && !user.isAnonymous) {
              try {
                cloudDb.collection('config').doc('worktime_' + user.uid).set(cfg);
              } catch (e) {}
            }
            setWorkTimeConfig(cfg);
            setShowWorkTimeModal(false);
          }}
        />
      )}
      <TaskAlerts projects={displayedProjects} onSilentSave={handleSilentSave} />
      {showSearch && (
        <SearchModal
          projects={displayedProjects}
          config={config}
          onClose={() => setShowSearch(false)}
          onOpenProject={(p) => {
            setEditing(p);
            setView('edit');
          }}
          onNav={(v) => {
            setView(v);
            setShowSearch(false);
          }}
        />
      )}
      <Layout
        view={view}
        onNav={handleNav}
        config={config}
        lastBackup={lastBackup}
        fileLinked={fileLinked}
        fileName={fileName}
        projects={displayedProjects}
        listBadgeCount={myProjects.filter((p) => p.status === 'active').length}
        boardTaskBadgeCount={boardTaskBadgeCount}
        cloudStatus={cloudStatus}
        lastSyncSuccessAt={lastSyncSuccessAt}
        onSearch={() => setShowSearch(true)}
        onBackToLogin={() => setUser(null)}
        isAnonymous={!!(user && user.isAnonymous)}
        userEmail={user && user.email}
        showManagerView={managerAgentIds.length > 0}
        onOpenWorkTime={() => setShowWorkTimeModal(true)}
        validationPendingCount={validationPendingCount}
        workflowBadgeCount={workflowBadgeCount}
        onSignOut={cloudAuth ? () => { cloudAuth.signOut(); setUser(null); } : undefined}
      >
        {renderView()}
      </Layout>

      {detailTaskFromValidation && (
        <ItemDetailPanel
          projectId={detailTaskFromValidation.projectId}
          taskId={detailTaskFromValidation.taskId}
          projects={projects}
          config={config}
          onClose={() => setDetailTaskFromValidation(null)}
          onSave={(updTask) => {
            const p = projects.find((x) => x.id === detailTaskFromValidation.projectId);
            if (!p) return;
            handleSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) });
          }}
          onSilentSave={(updTask) => {
            const p = projects.find((x) => x.id === detailTaskFromValidation.projectId);
            if (!p) return;
            handleSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) });
          }}
          onDelete={() => {
            const p = projects.find((x) => x.id === detailTaskFromValidation.projectId);
            if (!p) return;
            handleSilentSave({ ...p, tasks: (p.tasks || []).filter((t) => t.id !== detailTaskFromValidation.taskId) });
            setDetailTaskFromValidation(null);
          }}
          onArchive={() => {
            const p = projects.find((x) => x.id === detailTaskFromValidation.projectId);
            if (!p) return;
            const nowStr = new Date().toISOString();
            const task = (p.tasks || []).find((t) => t.id === detailTaskFromValidation.taskId);
            if (!task) return;
            const updTask = addTaskLog({ ...task, status: 'Terminé', done: true, completedAt: nowStr }, 'Archivée', 'Via panneau détail');
            handleSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === detailTaskFromValidation.taskId ? updTask : t)) });
            setDetailTaskFromValidation(null);
          }}
          onEditFull={() => {
            const p = projects.find((x) => x.id === detailTaskFromValidation.projectId);
            if (p) handleEditProject(p);
            setDetailTaskFromValidation(null);
          }}
          managerAgentIds={managerAgentIds}
          currentUid={currentUid}
          managerAgentLabels={managerAgentLabels}
        />
      )}

      {detailTaskFromWorkflow && (
        <ItemDetailPanel
          projectId={detailTaskFromWorkflow.projectId}
          taskId={detailTaskFromWorkflow.taskId}
          projects={displayedProjects}
          config={config}
          onClose={() => setDetailTaskFromWorkflow(null)}
          onSave={(updTask) => {
            const p = displayedProjects.find((x) => x.id === detailTaskFromWorkflow.projectId);
            if (!p) return;
            handleSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) });
          }}
          onSilentSave={(updTask) => {
            const p = displayedProjects.find((x) => x.id === detailTaskFromWorkflow.projectId);
            if (!p) return;
            handleSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === updTask.id ? updTask : t)) });
          }}
          onDelete={() => {
            const p = displayedProjects.find((x) => x.id === detailTaskFromWorkflow.projectId);
            if (!p) return;
            handleSilentSave({ ...p, tasks: (p.tasks || []).filter((t) => t.id !== detailTaskFromWorkflow.taskId) });
            setDetailTaskFromWorkflow(null);
          }}
          onArchive={() => {
            const p = displayedProjects.find((x) => x.id === detailTaskFromWorkflow.projectId);
            if (!p) return;
            const task = (p.tasks || []).find((t) => t.id === detailTaskFromWorkflow.taskId);
            if (!task) return;
            const nowStr = new Date().toISOString();
            const updTask = addTaskLog({ ...task, status: 'Terminé', done: true, completedAt: nowStr }, 'Archivée', 'Via panneau détail');
            handleSilentSave({ ...p, tasks: (p.tasks || []).map((t) => (t.id === detailTaskFromWorkflow.taskId ? updTask : t)) });
            setDetailTaskFromWorkflow(null);
          }}
          onEditFull={() => {
            const p = displayedProjects.find((x) => x.id === detailTaskFromWorkflow.projectId);
            if (p) handleEditProject(p);
            setDetailTaskFromWorkflow(null);
          }}
          managerAgentIds={[]}
          currentUid={currentUid}
          managerAgentLabels={{}}
        />
      )}
    </>
  );
}
