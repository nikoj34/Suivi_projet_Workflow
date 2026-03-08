import { useState, useEffect, useRef } from 'react';
import { addTaskLog } from '../lib/utils';
import ic from './icons';

export default function TaskAlerts({ projects, onSilentSave }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const notifiedRef = useRef(new Set());
  const originalTitle = useRef(typeof document !== 'undefined' ? document.title : '');
  const snoozeInputRef = useRef({});

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied' &&
      window.location?.protocol !== 'file:'
    ) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const timeToMinutes = (s) => {
      if (!s || typeof s !== 'string') return 0;
      const parts = s.trim().replace(',', '.').split(/[h:]/);
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };
    const checkAlerts = () => {
      if (dismissed) return;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const newAlerts = [];
      let hasNewTrigger = false;

      (projects || []).forEach((p) => {
        if (p.status === 'archived') return;
        (p.tasks || []).forEach((t) => {
          if (t.done || t.status === 'Terminé') return;
          if (t.dueDate) {
            let shouldAlert = false;
            let reason = '';

            if (t.dueDate < todayStr) {
              shouldAlert = true;
              reason = 'En retard';
            } else if (t.dueDate === todayStr) {
              const dueM = timeToMinutes(t.dueTime);
              if (dueM === 0 || dueM <= nowMinutes) {
                shouldAlert = true;
                reason = t.dueTime ? `Échéance à ${t.dueTime}` : "Échéance aujourd'hui";
              }
            }

            if (shouldAlert) {
              newAlerts.push({
                proj: p,
                task: t,
                reason,
                snoozedDate: t.dueDate,
                snoozedTime: t.dueTime || '',
              });
              const notifId = `${t.id}_${t.dueDate}_${t.dueTime || 'notime'}`;
              if (!notifiedRef.current.has(notifId)) {
                hasNewTrigger = true;
                notifiedRef.current.add(notifId);
                if (
                  typeof window !== 'undefined' &&
                  'Notification' in window &&
                  Notification.permission === 'granted'
                ) {
                  const n = new Notification('🔔 Tâche DITAM : ' + (p.title || 'Projet'), {
                    body: `${t.description}\nStatut : ${reason}`,
                  });
                  n.onclick = () => {
                    window.focus();
                    n.close();
                  };
                }
              }
            }
          }
        });
      });

      setAlerts((prev) => (prev.length > 0 ? prev : newAlerts));
      if (hasNewTrigger && newAlerts.length > 0 && typeof document !== 'undefined') {
        document.title = '(🔴 ALERTE) DITAM Travaux';
        playBeep();
      } else if (newAlerts.length === 0 && typeof document !== 'undefined') {
        document.title = originalTitle.current;
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 15000);
    return () => clearInterval(interval);
  }, [projects, dismissed]);

  const handleComplete = (proj, task) => {
    const nowStr = new Date().toISOString();
    const updProj = {
      ...proj,
      tasks: (proj.tasks || []).map((x) =>
        x.id === task.id
          ? addTaskLog(
              { ...x, done: true, status: 'Terminé', completedAt: nowStr, statusChangedAt: nowStr },
              'Terminé',
              ''
            )
          : x
      ),
    };
    const done = () => setAlerts((prev) => prev.filter((a) => a.task.id !== task.id));
    if (onSilentSave) {
      const p = onSilentSave(updProj);
      if (p && typeof p.then === 'function') p.then(done).catch(() => {});
    } else {
      done();
    }
  };

  const handleSnooze = (proj, task, newDate, newTime) => {
    if (!newDate) return;
    const updProj = {
      ...proj,
      tasks: (proj.tasks || []).map((x) =>
        x.id === task.id
          ? addTaskLog(
              { ...x, dueDate: newDate, dueTime: newTime || '', status: 'En cours' },
              'Reporté',
              ''
            )
          : x
      ),
    };
    const done = () => setAlerts((prev) => prev.filter((a) => a.task.id !== task.id));
    if (onSilentSave) {
      const p = onSilentSave(updProj);
      if (p && typeof p.then === 'function') p.then(done).catch(() => {});
    } else {
      done();
    }
  };

  /** Efface uniquement la date d'échéance (dueDate/dueTime). Ne modifie pas status ni done. */
  const handleClearDueDate = (proj, task) => {
    const updProj = {
      ...proj,
      tasks: (proj.tasks || []).map((x) =>
        x.id === task.id ? { ...x, dueDate: '', dueTime: '' } : x
      ),
    };
    const done = () => setAlerts((prev) => prev.filter((a) => a.task.id !== task.id));
    if (onSilentSave) {
      const p = onSilentSave(updProj);
      if (p && typeof p.then === 'function') p.then(done).catch(() => {});
    } else {
      done();
    }
  };

  const setAlertSnooze = (i, patch) => {
    setAlerts((prev) => {
      const na = prev.slice();
      na[i] = { ...prev[i], ...patch };
      return na;
    });
  };

  const toDatetimeLocal = (d, t) => {
    if (!d) return '';
    const tm = t && t.length >= 5 ? t.slice(0, 5) : '09:00';
    return d + 'T' + tm;
  };
  const fromDatetimeLocal = (v) => {
    if (!v) return { d: '', t: '' };
    const parts = v.split('T');
    return { d: parts[0] || '', t: (parts[1] || '').slice(0, 5) };
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 fi">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-amber-500 p-5 flex justify-between items-center text-white">
          <h3 className="font-black text-lg flex items-center gap-2 uppercase tracking-widest">
            <ic.Warn s={22} /> Tâches requérant votre attention
          </h3>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50 flex-1">
          {alerts.map((a, i) => (
            <div
              key={a.task.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 pr-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {a.proj.title}
                  </p>
                  <p className="text-sm font-bold text-slate-800 leading-snug">
                    {a.task.description}
                  </p>
                </div>
                <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded whitespace-nowrap">
                  {a.reason}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => handleComplete(a.proj, a.task)}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <ic.Ok s={16} /> Terminer
                </button>
                <button
                  type="button"
                  onClick={() => handleClearDueDate(a.proj, a.task)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors flex items-center gap-1.5"
                  title="Retirer l'échéance sans modifier le statut de la tâche"
                >
                  <ic.Cal s={14} c="opacity-70" /> Effacer la date
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Reporter à :
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="datetime-local"
                      className="inp py-2.5 px-3 text-sm font-bold rounded-xl border-2 border-slate-200 bg-white shadow-inner min-w-[200px]"
                      value={toDatetimeLocal(a.snoozedDate, a.snoozedTime)}
                      onChange={(e) => {
                        const p = fromDatetimeLocal(e.target.value);
                        snoozeInputRef.current[a.task.id] = {
                          snoozedDate: p.d,
                          snoozedTime: p.t,
                        };
                        setAlertSnooze(i, { snoozedDate: p.d, snoozedTime: p.t });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        d.setHours(9, 0, 0, 0);
                        const ds = d.toISOString().slice(0, 10);
                        const tm = '09:00';
                        handleSnooze(a.proj, a.task, ds, tm);
                        delete snoozeInputRef.current[a.task.id];
                      }}
                      className="px-3 py-2 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      Demain 9h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        d.setHours(9, 0, 0, 0);
                        const ds = d.toISOString().slice(0, 10);
                        const tm = '09:00';
                        handleSnooze(a.proj, a.task, ds, tm);
                        delete snoozeInputRef.current[a.task.id];
                      }}
                      className="px-3 py-2 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      +3 jours 9h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const latest = snoozeInputRef.current[a.task.id];
                        const d = latest?.snoozedDate ? latest.snoozedDate : a.snoozedDate;
                        const tm =
                          latest?.snoozedTime !== undefined ? latest.snoozedTime : a.snoozedTime || '';
                        handleSnooze(a.proj, a.task, d, tm);
                        delete snoozeInputRef.current[a.task.id];
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
                    >
                      Reporter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              setAlerts([]);
              if (typeof document !== 'undefined') document.title = originalTitle.current;
            }}
            className="text-slate-500 text-[10px] uppercase font-black px-4 py-2 hover:bg-slate-100 rounded-lg"
          >
            Masquer (Ignorer)
          </button>
        </div>
      </div>
    </div>
  );
}
