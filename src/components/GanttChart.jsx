import { useState } from 'react';
import { fmtDate, daysBetween, today } from '../lib/utils';
import ic from './icons';

const GANTT_ROW_H = 52;
const GANTT_LBL_W = 200;
const ZOOM_MODES = ['Jour', 'Semaine', 'Mois', 'Trimestre', 'Année'];
/** Nombre de jours à afficher avant la date du jour pour ancrer le Gantt sur "aujourd'hui". */
const DAYS_BEFORE_TODAY = 14;

function isoWeek(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w) / 86400000 - (3 - (w.getDay() + 6) % 7)) / 7);
}

const BTN =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all';

export default function GanttChart({
  tasks,
  projectTitle,
  onExportXlsx,
  onDownloadTemplate,
  onImportRef,
  onTaskClick,
}) {
  const [zoom, setZoom] = useState('Semaine');
  const todayStr = today();
  const validTasks = (tasks || []).filter(
    (t) => t.planStart || t.planEnd || t.actualStart || t.actualEnd
  );

  if (validTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-slate-300 gap-3">
        <ic.Gnt s={40} />
        <p className="text-[11px] font-black uppercase tracking-widest">
          Saisissez des dates pour afficher le Gantt
        </p>
      </div>
    );
  }

  const allDs = [];
  tasks.forEach((t) => {
    ['planStart', 'planEnd', 'actualStart', 'actualEnd'].forEach((k) => {
      if (t[k]) allDs.push(new Date(t[k] + 'T00:00:00'));
    });
  });
  const todayDate = new Date(todayStr + 'T00:00:00');
  allDs.push(todayDate);
  const maxTaskDate = allDs.length > 0 ? new Date(Math.max(...allDs)) : todayDate;
  // Toujours ancrer le Gantt sur la date du jour avec quelques jours avant
  let minD = new Date(todayDate);
  minD.setDate(minD.getDate() - DAYS_BEFORE_TODAY);
  let maxD = new Date(maxTaskDate);
  if (maxD < todayDate) maxD = new Date(todayDate);
  maxD.setDate(maxD.getDate() + DAYS_BEFORE_TODAY);

  if (zoom === 'Jour') {
    const dow = minD.getDay();
    minD.setDate(minD.getDate() - (dow === 0 ? 6 : dow - 1));
    maxD.setDate(maxD.getDate() + ((7 - maxD.getDay()) % 7) + 14);
  } else if (zoom === 'Semaine') {
    const dow = minD.getDay();
    minD.setDate(minD.getDate() - (dow === 0 ? 6 : dow - 1));
    maxD.setDate(maxD.getDate() + ((7 - maxD.getDay()) % 7) + 14);
  } else if (zoom === 'Mois') {
    minD = new Date(minD.getFullYear(), minD.getMonth(), 1);
    maxD = new Date(maxD.getFullYear(), maxD.getMonth() + 2, 0);
  } else if (zoom === 'Trimestre') {
    const qMin = Math.floor(minD.getMonth() / 3);
    minD = new Date(minD.getFullYear(), qMin * 3, 1);
    const qMax = Math.floor(maxD.getMonth() / 3);
    maxD = new Date(maxD.getFullYear(), qMax * 3 + 6, 0);
  } else if (zoom === 'Année') {
    minD = new Date(minD.getFullYear(), 0, 1);
    maxD = new Date(maxD.getFullYear() + 1, 11, 31);
  }

  const colW =
    zoom === 'Jour' ? 22 : zoom === 'Semaine' ? 14 : zoom === 'Mois' ? 6 : zoom === 'Trimestre' ? 3 : 1.5;
  const weW =
    zoom === 'Jour' ? 8 : zoom === 'Semaine' ? 5 : zoom === 'Mois' ? 3 : zoom === 'Trimestre' ? 1.5 : 0.8;

  const days = [];
  let px = 0;
  const d = new Date(minD);
  while (d <= maxD) {
    const wd = d.getDay();
    const isWE = wd === 0 || wd === 6;
    const w = isWE ? weW : colW;
    days.push({
      date: new Date(d),
      isWeekend: isWE,
      px,
      w,
      str: d.toISOString().split('T')[0],
    });
    px += w;
    d.setDate(d.getDate() + 1);
  }
  const totalW = Math.max(px, 100);

  const pxMap = {};
  days.forEach((day) => { pxMap[day.str] = day.px; });
  const gX = (str) => (str && pxMap[str] != null ? pxMap[str] : null);
  const gW = (s, e) => {
    if (!s || !e) return 0;
    const x1 = gX(s);
    const x2 = gX(e);
    if (x1 == null || x2 == null) return 0;
    const ed = days.find((d2) => d2.str === e);
    return Math.max(x2 - x1 + (ed ? ed.w : colW), 3);
  };
  const todayX = gX(todayStr);

  const yMap = {};
  days.forEach((day) => {
    const k = day.date.getFullYear();
    if (!yMap[k]) yMap[k] = { label: String(k), px: day.px, width: 0 };
    yMap[k].width += day.w;
  });
  const years = Object.values(yMap);

  const mMap = {};
  days.forEach((day) => {
    const k = day.date.getFullYear() + '-' + day.date.getMonth();
    if (!mMap[k])
      mMap[k] = {
        label: day.date.toLocaleDateString('fr-FR', {
          month: zoom === 'Année' ? 'short' : 'long',
          year: zoom === 'Année' ? undefined : 'numeric',
        }),
        px: day.px,
        width: 0,
      };
    mMap[k].width += day.w;
  });
  const months = Object.values(mMap);

  const wMap = {};
  days.forEach((day) => {
    if (day.date.getDay() === 1 || Object.keys(wMap).length === 0) {
      const tmp = new Date(day.date);
      tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
      const wn = isoWeek(day.date);
      const k = tmp.getFullYear() + '-' + wn;
      if (!wMap[k]) wMap[k] = { wn, px: day.px, width: 0 };
      wMap[k].width += day.w;
    } else {
      const keys = Object.keys(wMap);
      if (keys.length) wMap[keys[keys.length - 1]].width += day.w;
    }
  });
  const weeks = Object.values(wMap);

  const qMap = {};
  days.forEach((day) => {
    const q = Math.floor(day.date.getMonth() / 3) + 1;
    const k = day.date.getFullYear() + '-Q' + q;
    if (!qMap[k]) qMap[k] = { label: 'T' + q + ' ' + day.date.getFullYear(), px: day.px, width: 0 };
    qMap[k].width += day.w;
  });
  const quarters = Object.values(qMap);

  const showYears = zoom === 'Année' || zoom === 'Trimestre';
  const showQuarters = zoom === 'Trimestre';
  const showMonths = zoom === 'Mois' || zoom === 'Semaine' || zoom === 'Jour';
  const showWeeks = zoom === 'Semaine' || zoom === 'Jour';
  const showDays = zoom === 'Jour';

  const printHeader = (
    <div
      className="gantt-print-header mb-6"
      style={{ borderBottom: '2px solid #007A78', paddingBottom: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#1e293b', marginBottom: 2 }}>
            Planning Gantt — {projectTitle || 'Projet DITAM'}
          </p>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>DITAM Travaux Manager</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
            Exporté le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
            Aujourd'hui : {fmtDate(todayStr)}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0">
      {printHeader}
      <div className="flex items-center gap-2 mb-4 flex-wrap no-print">
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/50">
          {ZOOM_MODES.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={
                'px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ' +
                (zoom === z
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-400 hover:text-slate-600')
              }
            >
              {z}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => onExportXlsx?.()}
          className={BTN + ' bg-teal-600 text-white hover:bg-teal-700'}
        >
          <ic.Dl s={12} /> Export Excel
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className={BTN + ' bg-slate-700 text-white hover:bg-slate-900'}
        >
          <ic.Dl s={12} /> Export PDF
        </button>
        <button
          type="button"
          onClick={() => onDownloadTemplate?.()}
          className={BTN + ' border border-slate-200 text-slate-600 hover:bg-slate-50'}
        >
          <ic.Dl s={12} /> Template Excel
        </button>
        {onImportRef && (
          <button
            type="button"
            onClick={() => onImportRef.current?.click()}
            className={BTN + ' border border-[#007A78] text-[#007A78] hover:bg-teal-50'}
          >
            <ic.Up s={12} /> Importer Excel
          </button>
        )}
      </div>

      <div
        className="gantt-h-scroll overflow-x-scroll overflow-y-visible w-full"
        style={{ maxWidth: '100%', minHeight: 0, WebkitOverflowScrolling: 'touch' }}
      >
        <div
          style={{
            width: GANTT_LBL_W + totalW,
            minWidth: GANTT_LBL_W + totalW,
            position: 'relative',
            fontFamily: 'Inter,sans-serif',
          }}
        >
          {showYears && (
            <div
              style={{
                display: 'flex',
                height: 22,
                marginLeft: GANTT_LBL_W,
                position: 'relative',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {years.map((y, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: y.px,
                    width: y.width,
                    height: 22,
                    borderLeft: '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    background: i % 2 ? 'rgba(241,245,249,0.6)' : 'rgba(248,250,252,0.4)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      color: '#64748b',
                      paddingLeft: 6,
                      whiteSpace: 'nowrap',
                      letterSpacing: '.05em',
                    }}
                  >
                    {y.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          {showQuarters && (
            <div
              style={{
                display: 'flex',
                height: 18,
                marginLeft: GANTT_LBL_W,
                position: 'relative',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {quarters.map((q, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: q.px,
                    width: q.width,
                    height: 18,
                    borderLeft: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    background: i % 2 ? 'rgba(250,250,255,0.5)' : 'rgba(245,247,255,0.4)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      color: '#94a3b8',
                      paddingLeft: 5,
                      whiteSpace: 'nowrap',
                      letterSpacing: '.08em',
                    }}
                  >
                    {q.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          {showMonths && (
            <div
              style={{
                display: 'flex',
                height: 22,
                marginLeft: GANTT_LBL_W,
                position: 'relative',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {months.map((m, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: m.px,
                    width: m.width,
                    height: 22,
                    borderLeft: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    background: i % 2 ? 'rgba(248,250,252,0.4)' : 'rgba(241,245,249,0.5)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 900,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      paddingLeft: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          {showWeeks && (
            <div
              style={{
                display: 'flex',
                height: 16,
                marginLeft: GANTT_LBL_W,
                position: 'relative',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {weeks.map((w, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: w.px,
                    width: w.width,
                    height: 16,
                    borderLeft: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {w.width > 12 && (
                    <span
                      style={{
                        fontSize: 7,
                        fontWeight: 900,
                        color: '#cbd5e1',
                        paddingLeft: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      S{w.wn}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {showDays && (
            <div
              style={{
                display: 'flex',
                height: 14,
                marginLeft: GANTT_LBL_W,
                position: 'relative',
                borderBottom: '2px solid #e2e8f0',
              }}
            >
              {days.map((dd, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: dd.px,
                    width: dd.w,
                    height: 14,
                    borderLeft: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: dd.isWeekend
                      ? 'rgba(241,245,249,0.8)'
                      : dd.str === todayStr
                        ? 'rgba(239,68,68,0.08)'
                        : 'transparent',
                  }}
                >
                  {dd.w >= 14 && (
                    <span
                      style={{
                        fontSize: 6,
                        fontWeight: 900,
                        color:
                          dd.str === todayStr ? '#ef4444' : dd.isWeekend ? '#cbd5e1' : '#94a3b8',
                      }}
                    >
                      {dd.date.getDate()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            {days.filter((dd) => dd.isWeekend).map((dd, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: GANTT_LBL_W + dd.px,
                  width: dd.w,
                  background: 'rgba(241,245,249,0.65)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {todayX != null && (
              <>
                {/* Ligne verticale rouge "Jour J" sur toute la hauteur du Gantt */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: GANTT_LBL_W + todayX + (zoom === 'Jour' ? colW / 2 : 0) - 2,
                    width: 4,
                    background: '#dc2626',
                    zIndex: 15,
                    pointerEvents: 'none',
                    boxShadow: '0 0 8px rgba(220,38,38,0.5)',
                  }}
                  aria-hidden
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: GANTT_LBL_W + todayX + (zoom === 'Jour' ? colW / 2 : 0) - 2,
                    transform: 'translateX(-50%)',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                  className="no-print"
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: '#dc2626',
                      color: 'white',
                      fontSize: 8,
                      fontWeight: 900,
                      padding: '2px 6px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      letterSpacing: '.05em',
                      boxShadow: '0 1px 4px rgba(220,38,38,0.5)',
                    }}
                  >
                    Jour J
                  </span>
                </div>
              </>
            )}
            {months.map((m, i) => (
              <div
                key={'vs' + i}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: GANTT_LBL_W + m.px,
                  width: 1,
                  background: 'rgba(226,232,240,0.6)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {tasks.map((t, idx) => {
              const pX = gX(t.planStart);
              const pW = gW(t.planStart, t.planEnd);
              const aX = gX(t.actualStart);
              const aW = t.actualStart
                ? gW(t.actualStart, t.actualEnd || todayStr)
                : 0;
              const delayed =
                t.planEnd &&
                (t.actualEnd ? t.actualEnd > t.planEnd : todayStr > t.planEnd && !t.done);
              const delayDays = t.planEnd && t.actualEnd
                ? daysBetween(t.planEnd, t.actualEnd)
                : t.planEnd && !t.done && todayStr > t.planEnd
                  ? daysBetween(t.planEnd, todayStr)
                  : 0;
              const prog = Math.min(100, Math.max(0, parseInt(t.progress) || 0));
              const statusColor = t.done
                ? '#007A78'
                : delayed
                  ? '#dd007e'
                  : t.actualStart
                    ? '#3b82f6'
                    : '#94a3b8';
              const statusLabel = t.done
                ? '✓ Terminé'
                : delayDays > 0
                  ? t.actualEnd
                    ? `+${delayDays}j retard`
                    : `En cours (+${delayDays}j retard)`
                  : t.actualStart && !t.actualEnd
                    ? 'En cours'
                    : 'Planifié';

              return (
                <div
                  key={t.id}
                  role={onTaskClick ? 'button' : undefined}
                  tabIndex={onTaskClick ? 0 : undefined}
                  onClick={() => onTaskClick?.(t)}
                  onKeyDown={(e) => onTaskClick && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTaskClick(t))}
                  className="gantt-row"
                  style={{
                    display: 'flex',
                    height: GANTT_ROW_H,
                    borderBottom: '1px solid rgba(226,232,240,0.5)',
                    position: 'relative',
                    zIndex: 2,
                    cursor: onTaskClick ? 'pointer' : undefined,
                  }}
                >
                  <div
                    style={{
                      width: GANTT_LBL_W,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      paddingRight: 10,
                      paddingLeft: 6,
                      background: 'rgba(255,255,255,0.4)',
                      borderRight: '1px solid rgba(226,232,240,0.7)',
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        fontWeight: 900,
                        color: 'white',
                        background: statusColor,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        className="gantt-label"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#374151',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.3,
                        }}
                      >
                        {t.label}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span
                          style={{
                            fontSize: 7,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            color: statusColor,
                            letterSpacing: '.06em',
                          }}
                        >
                          {statusLabel}
                        </span>
                        {prog > 0 && !t.done && (
                          <span style={{ fontSize: 7, fontWeight: 900, color: '#94a3b8' }}>
                            {prog}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      height: GANTT_ROW_H,
                    }}
                  >
                    {pX != null && pW > 0 && (
                      <div
                        title={`Prévu: ${fmtDate(t.planStart)} → ${fmtDate(t.planEnd)}`}
                        style={{
                          position: 'absolute',
                          top: 8,
                          height: 13,
                          left: pX,
                          width: pW,
                          background: 'rgba(100,116,139,0.10)',
                          border: '1.5px solid rgba(100,116,139,0.30)',
                          borderRadius: 3,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 3,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 6,
                            fontWeight: 900,
                            color: '#94a3b8',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Prévu
                        </span>
                      </div>
                    )}
                    {aX != null && aW > 0 && (
                      <div
                        title={`Réel: ${fmtDate(t.actualStart)} → ${t.actualEnd ? fmtDate(t.actualEnd) : 'en cours'}`}
                        style={{
                          position: 'absolute',
                          top: 27,
                          height: 15,
                          left: aX,
                          width: aW,
                          borderRadius: 4,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          border:
                            '1.5px solid ' +
                            (t.done ? '#007A78' : delayed ? '#dd007e' : '#3b82f6'),
                          background: t.done
                            ? 'rgba(34,161,38,0.12)'
                            : delayed
                              ? 'rgba(221,0,126,0.10)'
                              : 'rgba(59,130,246,0.10)',
                        }}
                      >
                        {prog > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: prog + '%',
                              background: t.done
                                ? 'rgba(34,161,38,0.35)'
                                : delayed
                                  ? 'rgba(221,0,126,0.30)'
                                  : 'rgba(59,130,246,0.30)',
                              borderRadius: 2,
                            }}
                          />
                        )}
                        <div
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                            paddingLeft: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 6,
                              fontWeight: 900,
                              color: t.done ? '#007A78' : delayed ? '#dd007e' : '#3b82f6',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.actualEnd ? 'Réel' : 'En cours'}
                            {prog > 0 ? ` · ${prog}%` : ''}
                          </span>
                        </div>
                      </div>
                    )}
                    {delayDays > 0 && pX != null && pW > 0 && (
                      <div
                        title={`Retard: +${delayDays} jours`}
                        style={{
                          position: 'absolute',
                          top: 9,
                          left: pX + pW + 2,
                          height: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          zIndex: 5,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 8,
                            color: '#dd007e',
                            fontWeight: 900,
                            lineHeight: 1,
                          }}
                        >
                          ▶
                        </span>
                        <span
                          style={{
                            fontSize: 6,
                            fontWeight: 900,
                            color: '#dd007e',
                            background: 'rgba(221,0,126,0.08)',
                            border: '1px solid rgba(221,0,126,0.25)',
                            borderRadius: 3,
                            padding: '0 3px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          +{delayDays}j
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex items-center gap-5 mt-4 pt-3 flex-wrap no-print"
            style={{ paddingLeft: GANTT_LBL_W, borderTop: '1px solid #f1f5f9' }}
          >
            {[
              {
                bg: 'rgba(100,116,139,0.10)',
                brd: 'rgba(100,116,139,0.30)',
                lbl: 'Planifié',
              },
              { bg: 'rgba(59,130,246,0.10)', brd: '#3b82f6', lbl: 'En cours' },
              { bg: 'rgba(34,161,38,0.12)', brd: '#007A78', lbl: 'Réel — dans délais' },
              { bg: 'rgba(221,0,126,0.10)', brd: '#dd007e', lbl: 'Réel — en retard' },
            ].map(({ bg, brd, lbl }) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  style={{
                    width: 18,
                    height: 8,
                    borderRadius: 2,
                    background: bg,
                    border: '1.5px solid ' + brd,
                  }}
                />
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 900,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                  }}
                >
                  {lbl}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 3,
                  height: 12,
                  background: '#dc2626',
                  borderRadius: 1,
                  boxShadow: '0 0 3px rgba(220,38,38,0.5)',
                }}
              />
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 900,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                Jour J
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: '#dd007e', fontWeight: 900 }}>▶</span>
              <span
                style={{
                  fontSize: 7,
                  fontWeight: 900,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                Retard : fin prévue dépassée, tâche non terminée ou fin réelle après la fin prévue
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
