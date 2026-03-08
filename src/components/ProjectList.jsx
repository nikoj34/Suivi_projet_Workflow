import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { today, projBudget, fmtAmt2Dec } from '../lib/utils';
import ic from './icons';

/* Palette étendue : couleurs bien distinctes (teintes variées, pas trop proches). */
const CARD_COLORS = [
  '#007A78', '#0d9488', '#0ea5e9', '#0284c7', '#2563eb', '#4f46e5', '#7c3aed', '#9333ea',
  '#c026d3', '#dd007e', '#e11d48', '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#059669', '#0f766e', '#155e75', '#1e3a5f', '#4c1d95', '#831843', '#713f12',
];

/* Icônes / emojis pour personnaliser la vignette projet. */
const CARD_ICONS = [
  '🏗️', '🏢', '🏠', '🔧', '⚙️', '📋', '✅', '⭐', '🔥', '💡', '🔑', '📌', '📍', '📦', '🚀', '💼',
  '🏭', '🌱', '📊', '🎯', '⚡', '🛠️', '📐', '🔒', '📁', '📂', '🏛️', '🌍', '⏱️', '💰', '📝', '—',
];

export default function ProjectList({
  projects,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  isArchive,
  onDuplicate,
  onSilentSave,
  onReorderProjects,
  onNewOperation,
  listOverride,
  sectionTitle,
  currentUid,
}) {
  const [dragId, setDragId] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(null);
  const colorPickerRectRef = useRef(null);
  const dragRef = useRef({ id: null, startX: 0, startY: 0, hasMoved: false });
  const dragProjectRef = useRef(null);
  const listRef = useRef([]);
  const onReorderProjectsRef = useRef(null);
  const lastDropIndexRef = useRef(null);

  const rawList = listOverride !== undefined ? listOverride : projects.filter((p) => (isArchive ? p.status === 'archived' : p.status === 'active'));
  const list = useMemo(() => {
    if (isArchive || !onSilentSave) return rawList;
    return [...rawList].sort((a, b) => {
      const oa = a.listOrder ?? 9999;
      const ob = b.listOrder ?? 9999;
      if (oa !== ob) return oa - ob;
      return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    });
  }, [rawList, isArchive, onSilentSave]);

  const todayStr = today();
  const title = sectionTitle != null ? sectionTitle : isArchive ? 'Archives' : 'Suivi des Opérations';
  const isKanbanMode = !isArchive && onSilentSave;

  /* Même principe que BoardView Kanban : état drag + drop zones qui passent l’index cible à onDrop. */
  listRef.current = list;
  onReorderProjectsRef.current = onReorderProjects;

  const handleMouseDown = (e, p) => {
    if (!isKanbanMode || !onReorderProjects) return;
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) return;
    e.preventDefault();
    lastDropIndexRef.current = null;
    dragProjectRef.current = p;
    const dr = { id: p.id, startX: e.clientX, startY: e.clientY, hasMoved: false };
    dragRef.current = dr;
    setDragId(p.id);

    const onMove = (ev) => {
      if (!dragRef.current.id) return;
      if (!dragRef.current.hasMoved) {
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        if (dx !== 0 || dy !== 0) dragRef.current.hasMoved = true;
      }
      if (dragRef.current.hasMoved) {
        setDragPosition({ x: ev.clientX, y: ev.clientY });
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const zone = under?.closest?.('[data-drop-index]');
        if (zone != null) {
          const idx = parseInt(zone.getAttribute('data-drop-index'), 10);
          if (!Number.isNaN(idx)) {
            lastDropIndexRef.current = idx;
            setDropIndex(idx);
          }
        } else setDropIndex(null);
      }
    };
    const onUp = (ev) => {
      const current = dragRef.current;
      if (!current.id) return;
      if (current.hasMoved) {
        let dropIdx = null;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const z = under?.closest?.('[data-drop-index]');
        if (z != null) dropIdx = parseInt(z.getAttribute('data-drop-index'), 10);
        if (dropIdx == null || Number.isNaN(dropIdx)) dropIdx = lastDropIndexRef.current;
        const currentList = listRef.current;
        const fromIdx = currentList.findIndex((x) => x.id === current.id);
        if (fromIdx !== -1 && dropIdx != null && !Number.isNaN(dropIdx) && fromIdx !== dropIdx) {
          const reordered = [...currentList];
          const [removed] = reordered.splice(fromIdx, 1);
          reordered.splice(dropIdx, 0, removed);
          onReorderProjectsRef.current?.(reordered.map((proj, i) => ({ ...proj, listOrder: i })));
        }
      }
      dragRef.current = { id: null, startX: 0, startY: 0, hasMoved: false };
      dragProjectRef.current = null;
      setDragId(null);
      setDragPosition(null);
      setDropIndex(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleColorSelect = (p, color) => {
    if (!onSilentSave) return;
    onSilentSave({ ...p, cardColor: color || undefined });
  };
  const handleIconSelect = (p, icon) => {
    if (!onSilentSave) return;
    onSilentSave({ ...p, cardIcon: icon === '—' ? undefined : icon });
  };

  if (list.length === 0) {
    return (
      <div className="space-y-4 fi">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            {title}
            <span className="ml-3 text-sm font-bold text-slate-300 normal-case">
              {list.length} projet{list.length !== 1 ? 's' : ''}
            </span>
          </h2>
          {!isArchive && onNewOperation && (
            <button
              type="button"
              onClick={onNewOperation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#007A78] text-white hover:bg-[#006664] transition-colors text-sm font-black uppercase tracking-widest shadow-sm"
            >
              <ic.PlusC s={18} /> Nouvelle opération
            </button>
          )}
        </div>
        <div className="glass py-20 text-center">
          <ic.Arch s={36} c="text-slate-200 mx-auto mb-4" />
          <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">
            Aucun projet {isArchive ? 'archivé' : 'en cours'}
          </p>
          {!isArchive && onNewOperation && (
            <button
              type="button"
              onClick={onNewOperation}
              className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#007A78] text-white hover:bg-[#006664] transition-colors text-sm font-black uppercase tracking-widest"
            >
              <ic.PlusC s={18} /> Nouvelle opération
            </button>
          )}
        </div>
      </div>
    );
  }

  const gridClass = isKanbanMode
    ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
    : 'grid grid-cols-1 xl:grid-cols-2 gap-4';

  return (
    <div className="space-y-4 fi">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
          {title}
          <span className="ml-3 text-sm font-bold text-slate-300 normal-case">
            {list.length} projet{list.length !== 1 ? 's' : ''}
          </span>
          {isKanbanMode && (
            <span className="ml-2 text-[10px] font-bold text-slate-400 normal-case">
              Glisser-déposer pour réordonner
            </span>
          )}
        </h2>
        {!isArchive && onNewOperation && (
          <button
            type="button"
            onClick={onNewOperation}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#007A78] text-white hover:bg-[#006664] transition-colors text-sm font-black uppercase tracking-widest shadow-sm"
          >
            <ic.PlusC s={18} /> Nouvelle opération
          </button>
        )}
      </div>
      <div className={gridClass}>
        {list.map((p, index) => {
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
          const cardColor = isKanbanMode && p.cardColor ? p.cardColor : null;
          const isDragging = dragId === p.id;
          const isDropTarget = dropIndex === index;

          return (
            <div
              key={p.id}
              className="min-h-[140px]"
              data-drop-index={index}
            >
              <div
                onMouseDown={isKanbanMode ? (e) => handleMouseDown(e, p) : undefined}
                onClick={isArchive && onEdit ? () => onEdit(p) : undefined}
                role={isArchive && onEdit ? 'button' : undefined}
                className={`
                  glass p-5 group transition-all min-h-[140px] h-full
                  ${isKanbanMode ? 'cursor-grab active:cursor-grabbing' : ''}
                  ${isArchive && onEdit ? 'cursor-pointer' : ''}
                  ${isDragging ? 'opacity-30 scale-[0.98] shadow-none' : ''}
                  ${isDropTarget ? 'ring-2 ring-[#007A78] ring-offset-2 bg-teal-50/50' : ''}
                  hover:bg-white/65
                `}
                style={
                  cardColor
                    ? {
                        backgroundColor: cardColor + '22',
                        borderLeft: `4px solid ${cardColor}`,
                      }
                    : undefined
                }
              >
              <div className="flex flex-col h-full min-h-[120px]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isKanbanMode && p.cardIcon && p.cardIcon !== '—' && (
                      <span className="text-base leading-none w-6 h-6 flex items-center justify-center rounded bg-white/80 border border-slate-200 flex-shrink-0" title="Icône de la vignette">
                        {p.cardIcon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4
                        onClick={(e) => { if (isArchive) e.stopPropagation(); onEdit(p); }}
                        className="text-base font-black text-slate-800 cursor-pointer hover:text-[#007A78] transition-colors break-words min-w-0"
                        title={isArchive ? 'Cliquer pour consulter (lecture seule)' : 'Cliquer pour modifier l\'opération'}
                      >
                        {p.title || 'Sans titre'}
                      </h4>
                    </div>
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
                    {budget > 0 && <span>Budget: {fmtAmt2Dec(budget)}</span>}
                    {spent > 0 && (
                      <span className={over ? 'text-[#dd007e]' : ''}>Engagé: {fmtAmt2Dec(spent)}</span>
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

                <div className="flex gap-1 flex-shrink-0 justify-end mt-auto pt-3 flex-wrap">
                  {isKanbanMode && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (colorPickerOpen === p.id) {
                            setColorPickerOpen(null);
                          } else {
                            colorPickerRectRef.current = e.currentTarget.getBoundingClientRect();
                            setColorPickerOpen(p.id);
                          }
                        }}
                        className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex-shrink-0 w-8 h-8 flex items-center justify-center"
                        style={{ backgroundColor: p.cardColor || '#e2e8f0' }}
                        title="Couleur et icône de la vignette"
                      />
                    </>
                  )}
                  {!isArchive && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-[#007A78] transition-all shadow-sm border border-slate-100"
                        title="Modifier"
                      >
                        <ic.Ed s={12} />
                      </button>
                      {isOwner && !isArchive && onDuplicate && (
                        <button
                          type="button"
                          onClick={() => onDuplicate(p)}
                          className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-blue-500 transition-all shadow-sm border border-slate-100"
                          title="Dupliquer comme modèle"
                        >
                          <ic.Copy s={12} />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => onArchive(p.id)}
                          className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-amber-500 transition-all shadow-sm border border-slate-100"
                          title="Archiver"
                        >
                          <ic.Arch s={12} />
                        </button>
                      )}
                    </>
                  )}
                  {isArchive && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                        className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-[#007A78] transition-all shadow-sm border border-slate-100"
                        title="Consulter"
                      >
                        <ic.Ed s={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRestore(p.id); }}
                        className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-[#007A78] transition-all shadow-sm border border-slate-100"
                        title="Restaurer"
                      >
                        <ic.Rst s={12} />
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                      className="p-1.5 bg-white rounded-lg text-slate-400 hover:text-red-500 transition-all shadow-sm border border-slate-100"
                      title="Supprimer"
                    >
                      <ic.Tr s={12} />
                    </button>
                  )}
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>
      {isKanbanMode && dragPosition && dragProjectRef.current && (() => {
        const proj = dragProjectRef.current;
        const ghostColor = proj.cardColor;
        return createPortal(
          <div
            className="fixed z-[200] pointer-events-none w-[280px] max-w-[90vw]"
            style={{
              left: dragPosition.x,
              top: dragPosition.y,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
            }}
          >
            <div
              className="rounded-2xl border border-white/80 p-4 transition-shadow flex items-center gap-2"
              style={{
                background: ghostColor ? ghostColor + 'EE' : 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(12px)',
                borderLeft: ghostColor ? `4px solid ${ghostColor}` : undefined,
              }}
            >
              {proj.cardIcon && proj.cardIcon !== '—' && <span className="text-lg leading-none">{proj.cardIcon}</span>}
              <p className="text-sm font-black text-slate-800 truncate flex-1 min-w-0">{proj.title || 'Sans titre'}</p>
              {(proj.location || proj.typeTravaux) && (
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate">
                  {[proj.location, proj.typeTravaux].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>,
          document.body
        );
      })()}
      {colorPickerOpen && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            aria-hidden="true"
            onClick={() => setColorPickerOpen(null)}
          />
          {createPortal(
            (() => {
              const proj = list.find((x) => x.id === colorPickerOpen);
              const rect = colorPickerRectRef.current;
              if (!proj || !rect) return null;
              return (
                <div
                  className="fixed z-[100] p-3 rounded-2xl bg-white border border-slate-200 shadow-xl max-w-[320px]"
                  style={{ left: Math.min(rect.left, window.innerWidth - 330), top: rect.bottom + 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Couleur</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {CARD_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className="w-6 h-6 rounded-lg border-2 border-slate-200 hover:scale-110 hover:border-slate-300 transition-transform"
                        style={{ backgroundColor: hex }}
                        onClick={() => handleColorSelect(proj, hex)}
                        title={hex}
                      />
                    ))}
                    <button
                      type="button"
                      className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 text-[10px] font-bold hover:bg-slate-50 flex items-center justify-center"
                      onClick={() => handleColorSelect(proj, null)}
                      title="Pas de couleur"
                    >
                      —
                    </button>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Icône / emoji</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CARD_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={`w-8 h-8 rounded-lg border-2 text-lg flex items-center justify-center transition-transform hover:scale-110 ${proj.cardIcon === emoji && emoji !== '—' ? 'border-[#007A78] bg-teal-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                        onClick={() => handleIconSelect(proj, emoji)}
                        title={emoji === '—' ? 'Pas d\'icône' : emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </>
      )}
    </div>
  );
}
