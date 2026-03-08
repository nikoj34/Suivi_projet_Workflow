import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LOCATIONS,
  SUB_MAP,
  TYPES_TRAVAUX,
  TYPES_PROJET,
  INTENSITY_OPTIONS,
  ROLES_INTERV,
  BOARD_COLS,
  PRIORITIES,
  ESTIMATED_DURATION_OPTIONS,
} from '../lib/constants';
import { BLANK, today, daysBetween, addTaskLog, projBudget, fmtDate, fmtAmt, fmtAmt2Dec, formatAgentDisplayName, evaluateAmountExpression, getPriority, isTaskArchived } from '../lib/utils';
import { exportWordBlob, exportPdfHtml, genProjectRecap, genCoverPage } from '../lib/exportUtils';
import ic from './icons';
import AmtInput from './AmtInput';
import GanttChart from './GanttChart';
import TaskTagBadge from './TaskTagBadge';
import ItemDetailPanel from './ItemDetailPanel';
import * as XLSX from 'xlsx';

// ——— Champ nombre avec expressions (+, -, *, /) et bornes optionnelles — évaluées au blur / Entrée uniquement ———
function NumInput({ value, onChange, min, max, integer, className = '', style = {}, placeholder = '' }) {
  const [raw, setRaw] = useState(value === 0 || value === '' ? '' : String(value));
  const isFocusedRef = useRef(false);
  const rawRef = useRef(raw);
  rawRef.current = raw;
  useEffect(() => {
    if (!isFocusedRef.current) {
      const r = String(rawRef.current || '').trim();
      const hasOperator = /[+\-*/]/.test(r) && /[\d]/.test(r);
      if (!r || !hasOperator) setRaw(value === 0 || value === '' ? '' : String(value));
    }
  }, [value]);
  const apply = () => {
    const v = String(raw).trim().replace(/,/g, '.');
    if (v === '' || v === '-') {
      setRaw('');
      onChange(min != null ? min : '');
      return;
    }
    const fromExpr = evaluateAmountExpression(v);
    let n = fromExpr !== null ? fromExpr : parseFloat(v);
    if (isNaN(n)) {
      setRaw('');
      onChange(min != null ? min : '');
      return;
    }
    if (integer) n = Math.round(n);
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    setRaw(String(n));
    onChange(n);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder}
      className={className}
      style={style}
      onFocus={() => { isFocusedRef.current = true; }}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        setRaw(v);
        if (v === '' || v === '-') onChange(min != null ? min : '');
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        apply();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      }}
    />
  );
}

// ——— Export journal Word (pour onglet Journal) ———
function genJournalWord(p, logo) {
  const entries = (p.journal || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  let html = genCoverPage(p, 'Compte-rendu de réunion / Journal de chantier', logo);
  html += '<h1>Journal de chantier</h1>';
  if ((p.intervenants || []).length > 0) {
    html += '<h2>Intervenants</h2><table><tr><th>Entreprise</th><th>Rôle</th><th>Nom</th><th>Email</th><th>Tél</th><th>Lot</th></tr>';
    p.intervenants.forEach((i) => {
      html += `<tr><td>${i.entreprise || ''}</td><td>${i.role || ''}</td><td><strong>${i.nom || ''}</strong></td><td>${i.email || ''}</td><td>${i.tel || ''}</td><td>${i.lot || ''}</td></tr>`;
    });
    html += '</table>';
  }
  if (entries.length === 0) {
    html += '<p><em>Aucune entrée enregistrée.</em></p>';
  } else {
    entries.forEach((e) => {
      const tagCol = e.tag === 'Problème' ? 'bg-red' : e.tag === 'Décision' ? 'bg-blue' : e.tag === 'Réception' ? 'bg-green' : 'bg-amber';
      html += `<div class="section"><h3>${fmtDate(e.date)} — <span class="badge ${tagCol}">${e.tag || 'Note'}</span></h3><p>${(e.text || '').replace(/\n/g, '<br/>')}</p></div>`;
    });
  }
  if (p.chantierCR) {
    const cr = p.chantierCR;
    if (cr.indexOf('<') !== -1) html += '<h2>Notes générales</h2><div class="journal-rich">' + cr + '</div>';
    else html += '<h2>Notes générales</h2><p>' + cr.replace(/\n/g, '<br/>') + '</p>';
  }
  return html;
}

// ——— CR Chantier (extrait simplifié pour Word/PDF) ———
function genCRChantier(p, logo, crDate, nextReunion, presentsStr) {
  const d = crDate ? new Date(crDate + 'T12:00:00') : new Date();
  const dFmt = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const todayStr = today();
  const presSet = new Set((presentsStr || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const crCount = (p.journal || []).filter((e) => e.tag === 'Réunion de chantier' && e.date <= crDate).length || 1;
  const thS = 'border:1px solid #8db87b;padding:4pt 6pt;font-size:8pt;color:#1a5c00;font-weight:bold;background:#C5E0B3;text-transform:uppercase';
  const tdS = 'border:1px solid #bbb;padding:3pt 6pt;font-size:9pt';
  const tdC = 'border:1px solid #bbb;padding:3pt 4pt;font-size:9pt;text-align:center;font-weight:bold;width:24px';

  let html = `<div style="text-align:center;padding-top:50pt;page-break-after:always">`;
  html += logo ? `<img src="${logo}" style="max-width:180pt;margin-bottom:24pt"/><br/>` : `<div style="font-size:32pt;color:#007A78;font-weight:bold;margin-bottom:24pt">DITAM</div>`;
  html += `<p style="font-size:18pt;color:#007A78;font-weight:bold;line-height:1.4;margin-top:36pt">${p.title || 'Opération sans titre'}</p>`;
  html += `<p style="font-size:18pt;margin-top:14pt">Compte-rendu de réunion du ${dFmt}</p>`;
  if (nextReunion) {
    const nr = new Date(nextReunion + 'T12:00:00');
    html += `<p style="font-size:16pt;margin-top:8pt;text-decoration:underline">Prochaine réunion le ${nr.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à 13h30</p>`;
  }
  html += `<p style="font-size:9pt;margin-top:28pt;color:#666">CR n°${String(crCount).padStart(2, '0')} — ${p.location || ''}${p.subLocation ? ' — ' + p.subLocation : ''} — ${p.typeTravaux || ''}</p>`;
  html += `<p style="font-size:9pt;margin-top:8pt;color:#999"><strong>P</strong> : Présent(e) &nbsp;&nbsp; <strong>A</strong> : Absent(e) &nbsp;&nbsp; <strong>E</strong> : Excusé(e) &nbsp;&nbsp; <strong>C</strong> : Convoqué(e)</p>`;
  html += `</div>`;

  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14pt"><tr>`;
  html += `<th style="${thS};width:17%">Désignation</th><th style="${thS};width:13%">Société</th><th style="${thS};width:17%">Participant</th><th style="${thS};width:13%">Téléphone</th><th style="${thS}">Email</th>`;
  html += `<th style="${thS};width:24px">P</th><th style="${thS};width:24px">A</th><th style="${thS};width:24px">E</th><th style="${thS};width:24px">C</th></tr>`;
  (p.intervenants || []).forEach((iv, idx) => {
    const nameLC = (iv.nom || '').toLowerCase();
    const entLC = (iv.entreprise || '').toLowerCase();
    const isP = presSet.size === 0 || presSet.has(nameLC) || presSet.has(entLC) || [...presSet].some((s) => nameLC.includes(s) || entLC.includes(s));
    const desig = iv.role || (idx === 0 ? 'MOA' : `Entreprise lot ${String(idx).padStart(2, '0')}`);
    html += `<tr><td style="${tdS}">${desig}</td><td style="${tdS};font-weight:bold">${iv.entreprise || ''}</td><td style="${tdS}">${iv.nom || ''}</td><td style="${tdS}">${iv.tel || ''}</td><td style="${tdS}">${iv.email || ''}</td>`;
    html += `<td style="${tdC}">${isP ? 'X' : ''}</td><td style="${tdC}">${!isP ? 'X' : ''}</td><td style="${tdC}"></td><td style="${tdC}">C</td></tr>`;
  });
  if ((p.intervenants || []).length === 0) html += `<tr><td colspan="9" style="${tdS};text-align:center;color:#999;font-style:italic">Aucun intervenant — remplir l'onglet Intervenants</td></tr>`;
  html += `<tr><td colspan="9" style="${tdS};font-size:8pt;color:#666"><em>Nota 1 :</em></td></tr>`;
  html += `<tr><td colspan="9" style="${tdS};font-size:8pt;color:#666"><em>Nota 2 :</em></td></tr></table>`;

  const tasks = (p.timelineTasks || []).filter((t) => t.label);
  if (tasks.length > 0) {
    html += `<p style="font-size:11pt;font-weight:bold;text-decoration:underline;margin-top:14pt">Planning / réunion de chantier :</p>`;
    html += `<table style="border-collapse:collapse;width:100%;font-size:9pt;margin:6pt 0 14pt"><tr style="background:#C5E0B3">`;
    html += `<th style="${thS}">Tâche</th><th style="${thS};width:75px">Début prévu</th><th style="${thS};width:75px">Fin prévue</th><th style="${thS};width:75px">Début réel</th><th style="${thS};width:75px">Fin réelle</th><th style="${thS};width:42px">%</th><th style="${thS};width:70px">Statut</th></tr>`;
    tasks.forEach((t) => {
      const late = t.planEnd && t.planEnd < todayStr && !t.done;
      const st = t.done ? '✅ Terminé' : t.actualStart ? (late ? '⚠️ Retard' : '🔄 En cours') : '⏳ Planifié';
      html += `<tr${late ? ' style="background:#fff5f5"' : ''}><td style="${tdS};font-weight:bold">${t.label}</td>`;
      html += `<td style="${tdS};text-align:center;font-size:8pt">${t.planStart ? fmtDate(t.planStart) : '—'}</td><td style="${tdS};text-align:center;font-size:8pt">${t.planEnd ? fmtDate(t.planEnd) : '—'}</td>`;
      html += `<td style="${tdS};text-align:center;font-size:8pt">${t.actualStart ? fmtDate(t.actualStart) : '—'}</td><td style="${tdS};text-align:center;font-size:8pt">${t.actualEnd ? fmtDate(t.actualEnd) : '—'}</td>`;
      html += `<td style="${tdS};text-align:center;font-weight:bold">${t.progress || 0}%</td><td style="${tdS};font-size:8pt">${st}</td></tr>`;
    });
    html += `</table>`;
  }
  const entriesToday = (p.journal || []).filter((e) => e.date === crDate).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  if (entriesToday.length > 0) {
    html += `<p style="font-size:11pt;font-weight:bold;text-decoration:underline;margin-top:14pt">Compte-rendu de la réunion :</p>`;
    entriesToday.forEach((e) => {
      const tagCol = e.tag === 'Problème' ? '#dc2626' : e.tag === 'Décision' ? '#2563eb' : e.tag === 'Réception' ? '#059669' : '#333';
      html += `<div style="margin:6pt 0 10pt 4pt"><p style="font-size:10pt;font-weight:bold;color:${tagCol}">${e.tag || 'Note'}${e.presents ? ' — <span style="font-size:9pt;color:#666;font-weight:normal">👥 ' + e.presents + '</span>' : ''}</p>`;
      html += `<div style="font-size:10pt;margin-top:3pt;line-height:1.5;text-align:justify">${(e.text || '').replace(/\n/g, '<br/>')}</div></div>`;
    });
  }
  const allPending = (p.tasks || []).filter((t) => !t.done);
  if (allPending.length > 0) {
    html += `<p style="font-size:11pt;font-weight:bold;text-decoration:underline;margin-top:14pt">Tâches en cours (${allPending.length}) :</p>`;
    html += `<table style="border-collapse:collapse;width:100%;font-size:9pt;margin-top:4pt"><tr style="background:#C5E0B3">`;
    html += `<th style="${thS}">Description</th><th style="${thS};width:100px">Responsable</th><th style="${thS};width:65px">Statut</th><th style="${thS};width:75px">Échéance</th><th style="${thS};width:38px">🔥</th></tr>`;
    allPending.forEach((t) => {
      const late = t.dueDate && t.dueDate < todayStr;
      html += `<tr${late ? ' style="background:#fff5f5"' : ''}><td style="${tdS}">${t.description}</td><td style="${tdS}">${t.assignee || '—'}</td><td style="${tdS};font-size:8pt">${t.status || 'À faire'}</td>`;
      html += `<td style="${tdS};text-align:center${late ? ';color:#dc2626;font-weight:bold' : ''}">${t.dueDate ? fmtDate(t.dueDate) : '—'}</td><td style="${tdS};text-align:center">${t.urgent ? '🔥' : ''}</td></tr>`;
    });
    html += `</table>`;
  }
  html += `<div style="margin-top:30pt;padding-top:8pt;border-top:1px solid #ddd;font-size:8pt;color:#999;text-align:right">CR n°${String(crCount).padStart(2, '0')} — Généré par DITAM Travaux Manager — ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>`;
  return html;
}

// ——— Rendu hashtags (#contact) dans le texte du journal ———
function renderHashtags(text, cfg) {
  if (!text) return text;
  const contacts = (cfg?.contacts || []);
  const names = contacts.map((c) => c.entreprise).filter(Boolean);
  const parts = text.split(/(#\w+)/g);
  return parts.map((p, i) => {
    if (p.startsWith('#')) {
      const tag = p.slice(1);
      const match = names.find((n) => n.toLowerCase().replace(/\s+/g, '') === tag.toLowerCase());
      const contact = match ? contacts.find((c) => c.entreprise === match) : null;
      return (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded bg-indigo-100 text-indigo-700 text-[9px] font-black cursor-default mx-0.5"
          title={contact ? `${contact.entreprise} — ${contact.nom || ''} ${contact.tel || ''} ${contact.email || ''}` : tag}
        >
          🏢 {match || tag}
        </span>
      );
    }
    return p;
  });
}

// ——— Export / import planning Excel ———
function isoToJJMMAAAA(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const s = iso.trim().slice(0, 10);
  if (s.length < 10) return s;
  if (s[2] === '/' || s[2] === '-') {
    const parts = s.split(/[/-]/);
    if (parts.length >= 3) return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}
function parseDateToIso(val) {
  if (val == null) return '';
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim().slice(0, 10);
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function downloadGanttTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = [['Tâche', 'Début prévu (JJ/MM/AAAA)', 'Fin prévue (JJ/MM/AAAA)', 'Début réel (JJ/MM/AAAA)', 'Fin réelle (JJ/MM/AAAA)', '% avancement (0-100)', 'Terminé (OUI/NON)']];
  const sample = [
    ['Études', '06/01/2025', '28/02/2025', '06/01/2025', '07/03/2025', '100', 'OUI'],
    ["DCE / Appel d'offres", '01/02/2025', '30/04/2025', '05/02/2025', '', '60', 'NON'],
    ['Consultation / Attribution', '01/04/2025', '31/05/2025', '', '', '0', 'NON'],
    ['Préparation chantier', '15/05/2025', '30/06/2025', '', '', '0', 'NON'],
    ['Travaux', '01/07/2025', '31/12/2025', '', '', '0', 'NON'],
    ['Réception', '15/12/2025', '15/01/2026', '', '', '0', 'NON'],
    ['Levée de réserves', '16/01/2026', '28/02/2026', '', '', '0', 'NON'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
  ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Planning');
  XLSX.writeFile(wb, 'Modele_Planning_Gantt.xlsx');
}

function exportGanttXlsx(tasks, projectTitle) {
  const wb = XLSX.utils.book_new();
  const now = new Date();
  const exportDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const todayStr = today();
  const rows = [
    [`Planning Gantt — ${projectTitle || 'Projet DITAM'}`],
    [`Exporté le : ${exportDate}`],
    [],
    ['N°', 'Tâche', 'Début prévu (JJ/MM/AAAA)', 'Fin prévue (JJ/MM/AAAA)', 'Début réel (JJ/MM/AAAA)', 'Fin réelle (JJ/MM/AAAA)', '% Avancement', 'Terminé', 'Retard (j)', 'Statut'],
  ];
  tasks.forEach((t, i) => {
    const delayed = t.planEnd && (t.actualEnd ? t.actualEnd > t.planEnd : todayStr > t.planEnd && !t.done);
    const delayDays = t.planEnd && t.actualEnd ? daysBetween(t.planEnd, t.actualEnd) : t.planEnd && !t.done && todayStr > t.planEnd ? daysBetween(t.planEnd, todayStr) : 0;
    const statut = t.done ? 'Terminé' : delayed ? 'En retard' : t.actualStart && !t.actualEnd ? 'En cours' : 'Planifié';
    rows.push([
      i + 1,
      t.label,
      isoToJJMMAAAA(t.planStart),
      isoToJJMMAAAA(t.planEnd),
      isoToJJMMAAAA(t.actualStart),
      isoToJJMMAAAA(t.actualEnd),
      parseInt(t.progress) || 0,
      t.done ? 'OUI' : 'NON',
      delayDays > 0 ? delayDays : 0,
      statut,
    ]);
  });
  rows.push([]);
  rows.push(['', '', '', '', '', '', '', '', '', 'Généré par DITAM Travaux Manager']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Planning');
  const fname = `Gantt_${(projectTitle || 'Projet').replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fname);
}

function importGanttFromXlsx(file, onImport) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const headers = (rows[0] || []).map((h) => String(h).toLowerCase());
      const idxLabel = headers.findIndex((h) => h && (h.includes('tâche') || h.includes('task')));
      const idxPlanStart = headers.findIndex((h) => h && (h.includes('début prévu') || h.includes('date début') || h.includes('début')));
      const idxPlanEnd = headers.findIndex((h) => h && (h.includes('fin prévue') || h.includes('date fin') || h.includes('fin prévue')));
      const idxActualStart = headers.findIndex((h) => h && h.includes('début réel'));
      const idxActualEnd = headers.findIndex((h) => h && h.includes('fin réelle'));
      const idxProgress = headers.findIndex((h) => h && (h.includes('avancement') || h.includes('%')));
      const idxDone = headers.findIndex((h) => h && (h.includes('terminé') || h.includes('oui') || h.includes('non')));
      const imported = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const label = (idxLabel >= 0 ? row[idxLabel] : row[0]) || '';
        if (!String(label).trim()) continue;
        const rawPlanStart = idxPlanStart >= 0 ? row[idxPlanStart] : '';
        const rawPlanEnd = idxPlanEnd >= 0 ? row[idxPlanEnd] : '';
        const rawActualStart = idxActualStart >= 0 ? row[idxActualStart] : '';
        const rawActualEnd = idxActualEnd >= 0 ? row[idxActualEnd] : '';
        const planStart = rawPlanStart ? parseDateToIso(String(rawPlanStart)) : '';
        const planEnd = rawPlanEnd ? parseDateToIso(String(rawPlanEnd)) : '';
        const actualStart = rawActualStart ? parseDateToIso(String(rawActualStart)) : '';
        const actualEnd = rawActualEnd ? parseDateToIso(String(rawActualEnd)) : '';
        let progress = idxProgress >= 0 ? row[idxProgress] : 0;
        if (typeof progress === 'string') progress = parseFloat(progress) || 0;
        let done = false;
        if (idxDone >= 0 && row[idxDone] != null) {
          const v = String(row[idxDone]).toUpperCase();
          done = v === 'OUI' || v === 'O' || v === '1' || v === 'TRUE' || v === 'Y';
        }
        imported.push({
          id: String(Date.now() + i),
          label: String(label).trim(),
          planStart: planStart ? String(planStart).slice(0, 10) : '',
          planEnd: planEnd ? String(planEnd).slice(0, 10) : '',
          actualStart: actualStart ? String(actualStart).slice(0, 10) : '',
          actualEnd: actualEnd ? String(actualEnd).slice(0, 10) : '',
          progress: Math.min(100, Math.max(0, Number(progress) || 0)),
          done: !!done,
        });
      }
      onImport(imported);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'import Excel.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ——— Onglet Planning (timelineTasks + export/import Excel) ———
function PlanningTab({ form, upd }) {
  const planImportRef = useRef(null);
  const [showTableSaisie, setShowTableSaisie] = useState(true);
  const updTask = (id, patch) => upd({ timelineTasks: (form.timelineTasks || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const addTask = () =>
    upd({
      timelineTasks: [
        ...(form.timelineTasks || []),
        { id: Date.now().toString(), label: 'Nouvelle tâche', planStart: '', planEnd: '', actualStart: '', actualEnd: '', progress: 0, done: false },
      ],
    });
  const delTask = (id) => upd({ timelineTasks: (form.timelineTasks || []).filter((x) => x.id !== id) });
  const exportPlanningPdf = () => {
    const tasks = form.timelineTasks || [];
    if (tasks.length === 0) {
      alert('Aucune tâche à exporter.');
      return;
    }
    const todayS = today();
    let html = `<h1 style="font-size:18pt;color:#007A78;border-bottom:3px solid #007A78;padding-bottom:6pt">Planning — ${form.title || 'Projet'}</h1>`;
    html += `<p style="font-size:9pt;color:#94a3b8;margin-bottom:12pt">Exporté le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>`;
    html += `<table style="border-collapse:collapse;width:100%;font-size:9pt"><tr style="background:#f0f7f0">`;
    ['N°', 'Tâche', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle', '%', 'Statut'].forEach((h) => {
      html += `<th style="border:1px solid #bbb;padding:4pt 6pt;font-size:8pt;color:#006664">${h}</th>`;
    });
    html += '</tr>';
    tasks.forEach((t, i) => {
      const late = t.planEnd && t.planEnd < todayS && !t.done;
      const st = t.done ? '✅ Terminé' : t.actualStart ? (late ? '⚠️ Retard' : '🔄 En cours') : '⏳ Planifié';
      html += `<tr${late ? ' style="background:#fff5f5"' : ''}><td style="border:1px solid #ccc;padding:3pt 6pt;text-align:center">${i + 1}</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;font-weight:bold">${t.label}</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;text-align:center">${t.planStart ? fmtDate(t.planStart) : '—'}</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;text-align:center">${t.planEnd ? fmtDate(t.planEnd) : '—'}</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;text-align:center">${t.actualStart ? fmtDate(t.actualStart) : '—'}</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;text-align:center">${t.actualEnd ? fmtDate(t.actualEnd) : '—'}</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;text-align:center;font-weight:bold">${t.progress || 0}%</td>`;
      html += `<td style="border:1px solid #ccc;padding:3pt 6pt;font-size:8pt">${st}</td></tr>`;
    });
    html += '</table>';
    exportPdfHtml(html, 'Planning ' + form.title);
  };

  return (
    <div className="space-y-5">
      <div className="glass p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mr-1">Outils :</span>
          <button
            type="button"
            onClick={() => exportGanttXlsx(form.timelineTasks || [], form.title)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-all"
          >
            <ic.Dl s={12} /> Export Excel
          </button>
          <button
            type="button"
            onClick={exportPlanningPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-700 text-white hover:bg-slate-900 transition-all"
          >
            <ic.Dl s={12} /> Export PDF
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <button
            type="button"
            onClick={() => downloadGanttTemplate()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <ic.Dl s={12} /> Template import
          </button>
          <input
            ref={planImportRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={(e) => {
              if (e.target.files[0]) importGanttFromXlsx(e.target.files[0], (imported) => upd({ timelineTasks: imported }));
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => planImportRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-[#007A78] text-[#007A78] hover:bg-teal-50 transition-all"
          >
            <ic.Up s={12} /> Importer Excel
          </button>
        </div>
      </div>

      {/* Gantt en premier, plus visible */}
      <div className="glass p-6 md:p-8 rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm min-w-0 w-full">
        <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">Diagramme de Gantt</p>
        <p className="text-[10px] text-slate-500 mb-5">Saisissez ou modifiez les dates dans le tableau « Saisie du tableau » ci-dessous. Déplacez l’ascenseur horizontal pour naviguer dans le temps.</p>
        <div className="min-h-[280px] w-full min-w-0">
          <GanttChart
            tasks={form.timelineTasks || []}
            projectTitle={form.title}
            onExportXlsx={() => exportGanttXlsx(form.timelineTasks || [], form.title)}
            onDownloadTemplate={downloadGanttTemplate}
            onImportRef={planImportRef}
          />
        </div>
      </div>

      {/* Saisie du tableau repliable (ouverte par défaut pour saisir les dates) */}
      <div className="glass overflow-hidden rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setShowTableSaisie((prev) => !prev)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/40 transition-colors"
        >
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saisie du tableau — dates et tâches (cliquez pour replier)</span>
          <span className="text-slate-400" aria-hidden>{showTableSaisie ? '▲' : '▼'}</span>
        </button>
        {showTableSaisie && (
          <div className="px-5 pb-6 pt-0 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3 mt-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tâches du planning</p>
              <button
                type="button"
                onClick={addTask}
                className="bg-[#007A78] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"
              >
                <ic.Plus s={12} /> Ajouter une tâche
              </button>
            </div>
            <div className="overflow-x-auto min-w-0">
            <div className="min-w-[800px]">
            <div className="grid gap-2 mb-1 px-2" style={{ gridTemplateColumns: '2fr 110px 110px 110px 110px 56px 70px 36px 36px' }}>
              {['Tâche', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle', 'Retard', 'Avancement', 'OK', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {h}
                </span>
              ))}
            </div>
            <div className="space-y-1.5">
              {(form.timelineTasks || []).map((t) => {
                const planEnd = t.planEnd || '';
                const done = !!t.done;
                const todayStrPlan = today();
                const delayed = planEnd && !done && todayStrPlan > planEnd;
                const delayDays = delayed ? daysBetween(planEnd, todayStrPlan) : (planEnd && t.actualEnd && t.actualEnd > planEnd ? daysBetween(planEnd, t.actualEnd) : 0);
                return (
                  <div
                    key={t.id}
                    className="grid gap-2 items-center p-2 rounded-xl border bg-white/40 border-slate-100 hover:bg-white/60 transition-all"
                    style={{ gridTemplateColumns: '2fr 110px 110px 110px 110px 56px 70px 36px 36px' }}
                  >
                    <input
                      type="text"
                      value={t.label}
                      onChange={(e) => updTask(t.id, { label: e.target.value })}
                      className="text-[10px] font-bold bg-transparent focus:outline-none min-w-0"
                      placeholder="Nom de la tâche"
                    />
                    <input
                      type="date"
                      value={t.planStart || ''}
                      onChange={(e) => updTask(t.id, { planStart: e.target.value })}
                      className="text-[9px] p-1 rounded border border-slate-200 bg-white/60 w-full"
                    />
                    <input
                      type="date"
                      value={t.planEnd || ''}
                      onChange={(e) => updTask(t.id, { planEnd: e.target.value })}
                      className="text-[9px] p-1 rounded border border-slate-200 bg-white/60 w-full"
                    />
                    <input
                      type="date"
                      value={t.actualStart || ''}
                      onChange={(e) => updTask(t.id, { actualStart: e.target.value })}
                      className="text-[9px] p-1 rounded border border-slate-200 bg-white/60 w-full"
                    />
                    <input
                      type="date"
                      value={t.actualEnd || ''}
                      onChange={(e) => updTask(t.id, { actualEnd: e.target.value })}
                      className="text-[9px] p-1 rounded border border-slate-200 bg-white/60 w-full"
                    />
                    <div className="flex items-center justify-center" title={delayDays > 0 ? `Fin prévue dépassée de ${delayDays} jour${delayDays > 1 ? 's' : ''}` : ''}>
                      {delayDays > 0 ? (
                        <span className="text-[9px] font-black text-[#dd007e] whitespace-nowrap bg-[rgba(221,0,126,0.08)] border border-[rgba(221,0,126,0.25)] rounded px-1.5 py-0.5">
                          +{delayDays}&nbsp;j
                        </span>
                      ) : (
                        <span className="text-[8px] text-slate-300">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <NumInput
                        integer
                        min={0}
                        max={100}
                        value={t.progress || 0}
                        onChange={(n) => updTask(t.id, { progress: Math.min(100, Math.max(0, Number(n) || 0)) })}
                        className="text-[9px] p-1 rounded border border-slate-200 bg-white/60 w-12 text-center font-black"
                      />
                      <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updTask(t.id, { done: !t.done })}
                      className={t.done ? 'text-[#007A78]' : 'text-slate-300'}
                      title="Marquer terminé"
                    >
                      {t.done ? <ic.ChkSq s={18} /> : <ic.Sq s={18} />}
                    </button>
                    <button type="button" onClick={() => delTask(t.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <ic.Tr s={14} />
                    </button>
                  </div>
                );
              })}
              {(form.timelineTasks || []).length === 0 && (
                <div className="text-center py-8 text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-widest">Aucune tâche — cliquez sur &quot;Ajouter&quot; ou importez un fichier Excel</p>
                </div>
              )}
            </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TasksTab({ form, upd, project, tasks, todayStr, config, showNewTaskModal, setShowNewTaskModal, newTaskOp, setNewTaskOp, taskFilter, setTaskFilter, readOnly, showAllTasks, managerAgentIds, currentUid, managerAgentLabels }) {
  const [detailTask, setDetailTask] = useState(null);
  const [dragTask, setDragTask] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const displayTasks = tasks.filter((t) => {
    if (!showAllTasks && isTaskArchived(t)) return false;
    const isDone = t.status === 'Terminé' || t.done === true;
    if (taskFilter === 'late') return t.dueDate && t.dueDate < todayStr && !isDone;
    if (taskFilter === 'week') {
      if (!t.dueDate || isDone) return false;
      const diff = daysBetween(todayStr, t.dueDate);
      return diff >= 0 && diff <= 7;
    }
    return true;
  });

  const projId = (project && project.id) || form.id || 'current';
  const projTitle = form.title || 'Opération';

  const tasksByCol = useMemo(() => {
    const m = {};
    BOARD_COLS.forEach((c) => (m[c.id] = []));
    displayTasks.forEach((t) => {
      const col = t.done ? 'Terminé' : (t.status || 'À faire');
      const key = BOARD_COLS.some((c) => c.id === col) ? col : 'À faire';
      m[key].push({ ...t, _projId: projId, _projTitle: projTitle });
    });
    const sortByDueDate = (a, b) => {
      const da = a.dueDate || '9999-12-31';
      const db = b.dueDate || '9999-12-31';
      return da.localeCompare(db);
    };
    BOARD_COLS.forEach((c) => { if (m[c.id].length) m[c.id].sort(sortByDueDate); });
    return m;
  }, [displayTasks, projId, projTitle]);

  const isManager = managerAgentIds && managerAgentIds.length > 0;
  const canDragTask = (task) => !readOnly && (task.status !== 'À valider' || isManager);

  const moveTask = (task, newStatus, opts = {}) => {
    const isDone = newStatus === 'Terminé';
    const nowStr = new Date().toISOString();
    const clearValidation = opts.clearValidation === true;
    const updTask = (tt) => {
      let next = addTaskLog(
        { ...tt, status: newStatus, done: isDone, statusChangedAt: nowStr, ...(isDone ? { completedAt: nowStr } : {}) },
        'Statut → ' + newStatus,
        'Kanban'
      );
      if (clearValidation) next = { ...next, validation: undefined };
      return next;
    };
    upd({ tasks: tasks.map((t) => (t.id === task.id ? updTask(t) : t)) });
  };

  const onDragStart = (task) => { if (canDragTask(task)) setDragTask(task); };
  const onDragEnd = () => { setDragTask(null); setDragOver(null); };
  const onDrop = (colId) => {
    if (!dragTask) { setDragOver(null); return; }
    if (!canDragTask(dragTask)) { setDragOver(null); return; }
    if (dragTask.status === 'À valider' && colId !== 'À valider') moveTask(dragTask, colId, { clearValidation: true });
    else moveTask(dragTask, colId);
    setDragOver(null);
  };

  const currentProjectForDetail = { ...form, id: projId, title: projTitle, status: 'active', tasks };

  return (
    <div className="space-y-5 fi" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-slate-100 flex-wrap gap-2 flex-shrink-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Suivi des actions</p>
        <div className="flex gap-1 bg-slate-100/50 p-1 rounded-lg">
          {['all', 'late', 'week'].map((f) => (
            <button key={f} type="button" onClick={() => setTaskFilter(f)} className={`px-2 py-1 text-[9px] font-black uppercase rounded transition-all ${taskFilter === f ? (f === 'all' ? 'bg-white shadow text-slate-700' : f === 'late' ? 'bg-white shadow text-red-500' : 'bg-white shadow text-blue-500') : 'text-slate-400 hover:text-slate-600'}`}>
              {f === 'all' ? 'Tout' : f === 'late' ? 'En retard' : 'Cette semaine'}
            </button>
          ))}
        </div>
        {!readOnly && (
        <button type="button" onClick={() => { setNewTaskOp({ description: '', assignee: '', tag: '', dueDate: '', dueTime: '', priority: '', status: 'À faire', estimatedDuration: 0, interlocuteur: '', urgent: false }); setShowNewTaskModal(true); }} className="bg-[#007A78] text-white px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#006664] transition-all shadow-sm w-fit">
          <ic.Plus s={16} /> Nouvelle action
        </button>
      )}
      </div>
      {showNewTaskModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-white/20 backdrop-blur-md p-0 md:p-6" onClick={() => setShowNewTaskModal(false)}>
          <div className="w-full h-full min-h-screen max-h-screen md:w-auto md:max-w-2xl md:h-auto md:min-h-0 md:max-h-[calc(100vh-3rem)] flex flex-col shadow-2xl rounded-none md:rounded-[32px] overflow-hidden border-0 md:border border-white/60 relative bg-gradient-to-br from-white via-[rgba(255,245,250,0.98)] to-[rgba(245,255,250,0.98)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 px-4 md:px-8 py-6 border-b border-black/5 flex justify-between items-center">
              <div><h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">Nouvelle action</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dans cette opération</p></div>
              <button onClick={() => setShowNewTaskModal(false)} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors text-slate-500">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Description de la tâche</label><textarea autoFocus className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:border-[#007A78] focus:bg-white transition-all outline-none shadow-sm resize-none min-h-[80px]" placeholder="Que faut-il faire ?" value={newTaskOp.description} onChange={(e) => setNewTaskOp({ ...newTaskOp, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Responsable</label><input type="text" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" placeholder="Nom..." value={newTaskOp.assignee} onChange={(e) => setNewTaskOp({ ...newTaskOp, assignee: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Tag</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.tag} onChange={(e) => setNewTaskOp({ ...newTaskOp, tag: e.target.value })}><option value="">Aucun tag</option>{(config?.taskTags || []).map((tg) => <option key={tg} value={tg}>{tg}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Échéance</label><div className="flex gap-2 flex-wrap items-center"><input type="date" className="flex-1 min-w-0 bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.dueDate} onChange={(e) => setNewTaskOp({ ...newTaskOp, dueDate: e.target.value })} /><input type="time" className="w-28 bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.dueTime} onChange={(e) => setNewTaskOp({ ...newTaskOp, dueTime: e.target.value })} />{(newTaskOp.dueDate || newTaskOp.dueTime) && <button type="button" onClick={() => setNewTaskOp({ ...newTaskOp, dueDate: '', dueTime: '' })} className="text-[10px] font-bold text-slate-400 hover:text-red-600 px-2 py-1 rounded border border-slate-200 hover:border-red-200 transition-colors">Effacer</button>}</div></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Priorité</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.priority} onChange={(e) => setNewTaskOp({ ...newTaskOp, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Temps estimé</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.estimatedDuration !== undefined ? String(newTaskOp.estimatedDuration) : '0'} onChange={(e) => setNewTaskOp({ ...newTaskOp, estimatedDuration: parseFloat(e.target.value) })}>{ESTIMATED_DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Statut</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.status} onChange={(e) => setNewTaskOp({ ...newTaskOp, status: e.target.value })}>{BOARD_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Interlocuteur / Société concernée</label><textarea className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none focus:border-[#007A78] focus:bg-white resize-none min-h-[70px]" placeholder="Ex: Entreprise Dupont, Mairie, Chercheur..." value={newTaskOp.interlocuteur || ''} onChange={(e) => setNewTaskOp({ ...newTaskOp, interlocuteur: e.target.value })} rows={2} /></div>
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={!!newTaskOp.urgent} onChange={(e) => setNewTaskOp({ ...newTaskOp, urgent: e.target.checked })} className="w-4 h-4 rounded border-slate-200" />🔥 Urgent</label>
            </div>
            <div className="flex-shrink-0 px-4 md:px-8 py-6 bg-black/5 flex gap-4">
              <button onClick={() => setShowNewTaskModal(false)} className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white text-slate-400 hover:text-slate-600 border border-slate-100 transition-all shadow-sm">Annuler</button>
              <button onClick={() => { if (!newTaskOp.description.trim()) return; const nowStr = new Date().toISOString(); const isDone = newTaskOp.status === 'Terminé'; upd({ tasks: [...tasks, { id: Date.now().toString(), description: newTaskOp.description.trim(), status: newTaskOp.status, done: isDone, assignee: newTaskOp.assignee, tag: newTaskOp.tag, dueDate: newTaskOp.dueDate, dueTime: newTaskOp.dueTime, priority: newTaskOp.priority, estimatedDuration: newTaskOp.estimatedDuration !== undefined ? newTaskOp.estimatedDuration : 0, interlocuteur: newTaskOp.interlocuteur || '', urgent: !!newTaskOp.urgent, statusChangedAt: nowStr, completedAt: isDone ? nowStr : null, history: [{ ts: nowStr, action: 'Créée', detail: 'Via opération' }] }] }); setShowNewTaskModal(false); setNewTaskOp({ description: '', assignee: '', tag: '', dueDate: '', dueTime: '', priority: '', status: 'À faire', estimatedDuration: 0, interlocuteur: '', urgent: false }); }} className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-[#007A78] text-white hover:bg-teal-700 shadow-lg active:scale-95 transition-all">Enregistrer l&apos;action</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Vue Kanban — mêmes principes que Suivi des tâches, limitée à cette opération */}
      <div className="flex gap-2 flex-1 min-h-[320px] pb-2 flex-nowrap overflow-x-auto snap-x snap-mandatory md:overflow-hidden" style={{ minHeight: 0 }}>
        {BOARD_COLS.map((col) => {
          const cards = tasksByCol[col.id] || [];
          const isOver = dragOver === col.id;
          return (
            <div
              key={col.id}
              className="min-w-[85vw] max-w-[100vw] md:min-w-0 md:max-w-none snap-center flex-shrink-0 md:flex-1 flex flex-col rounded-2xl transition-all duration-150 overflow-hidden"
              style={{ background: isOver ? col.accent : 'rgba(255,255,255,0.4)', border: `2px solid ${isOver ? col.color : 'rgba(255,255,255,0.6)'}` }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDrop={() => onDrop(col.id)}
            >
              <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#334155', textTransform: 'uppercase' }}>{col.label}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-400">{cards.length}</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cards.map((task) => {
                  const prio = getPriority(task.priority);
                  const isPendingValidation = task.validation && task.validation.status === 'pending_manager';
                  const hasPrio = task.priority && prio.id;
                  const borderPrio = hasPrio ? prio.color : 'transparent';
                  const bgPrio = hasPrio ? prio.bg : 'white';
                  return (
                    <div
                      key={task.id}
                      draggable={canDragTask(task)}
                      onDragStart={() => canDragTask(task) && onDragStart(task)}
                      onDragEnd={onDragEnd}
                      onClick={() => setDetailTask({ projectId: projId, taskId: task.id })}
                      className="hover:shadow-md transition-shadow group relative overflow-hidden max-w-full w-full"
                      style={{
                        background: bgPrio,
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderLeftWidth: hasPrio ? 4 : 1,
                        borderLeftColor: borderPrio,
                        borderRadius: 10,
                        padding: 8,
                        cursor: canDragTask(task) ? 'grab' : 'default',
                      }}
                    >
                      {isPendingValidation && <div className="absolute top-1.5 right-1.5 flex items-center gap-1" style={{ fontSize: 8, fontWeight: 900, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 6 }}>⏳ En validation</div>}
                      <div className="flex justify-between items-start mb-1.5 min-w-0">
                        {hasPrio && (
                          <span className="text-[7px] font-black uppercase rounded px-1 py-0.5 shrink-0" style={{ color: prio.color, background: 'rgba(255,255,255,0.9)', border: `1px solid ${prio.color}` }} title={prio.label}>
                            {prio.label || '—'}
                          </span>
                        )}
                      </div>
                      <div className="whitespace-normal break-words overflow-hidden min-w-0" style={{ overflowWrap: 'anywhere' }}>
                        <p className="text-[10px] font-bold text-slate-800 leading-tight mb-1.5 line-clamp-3 block w-full" style={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{task.description}</p>
                      </div>
                      {task.interlocuteur && String(task.interlocuteur).trim() && <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1 min-w-0 truncate">🏢 {String(task.interlocuteur).trim()}</p>}
                      <div className="flex flex-wrap gap-1 items-center">
                        {task.assignee && <span className="text-[7px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded">👤 {task.assignee}</span>}
                        {task.tag && <TaskTagBadge tag={task.tag} config={config} size="sm" />}
                        {task.dueDate && <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">📅 {fmtDate(task.dueDate)}</span>}
                        {isManager && task.validation && ['approved', 'returned_for_info', 'rejected'].includes(task.validation.status) && (
                          <span className="text-[7px] font-bold ml-auto flex items-center gap-0.5" style={{ color: task.validation.readByAgent ? '#16a34a' : '#94a3b8' }} title={task.validation.readByAgent ? 'Lu par l\'agent' : 'Non lu par l\'agent'}>
                            {task.validation.readByAgent ? <>✓✓ Lu</> : <>⏳ Non lu</>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {detailTask && (
        <ItemDetailPanel
          projectId={detailTask.projectId}
          taskId={detailTask.taskId}
          projects={[currentProjectForDetail]}
          config={config}
          onClose={() => setDetailTask(null)}
          onSave={(updTask) => { upd({ tasks: tasks.map((t) => (t.id === updTask.id ? updTask : t)) }); }}
          onSilentSave={(updTask) => { upd({ tasks: tasks.map((t) => (t.id === updTask.id ? updTask : t)) }); }}
          onDelete={() => { upd({ tasks: tasks.filter((t) => t.id !== detailTask.taskId) }); setDetailTask(null); }}
          onArchive={() => { const task = tasks.find((t) => t.id === detailTask.taskId); if (!task) return; const nowStr = new Date().toISOString(); const updTask = addTaskLog({ ...task, status: 'Terminé', done: true, completedAt: nowStr }, 'Archivée', 'Via panneau détail'); upd({ tasks: tasks.map((t) => (t.id === detailTask.taskId ? updTask : t)) }); setDetailTask(null); }}
          onEditFull={() => setDetailTask(null)}
          managerAgentIds={managerAgentIds}
          currentUid={currentUid}
          managerAgentLabels={managerAgentLabels || {}}
        />
      )}
    </div>
  );
}

function FinancesTab({ form, upd, spent, ratio, budget, fmtAmt, fmtDate }) {
  const expenses = form.expenses || [];
  const resteAEngager = budget > 0 ? Math.max(0, budget - spent) : null;

  const addEngagement = () => upd({
    expenses: [...expenses, { id: Date.now().toString(), date: today(), entreprise: '', description: '', amount: '' }],
  });

  return (
    <div className="glass p-6 space-y-6">
      <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">Engagements (commandes)</h2>

      {/* Enveloppe globale (référence onglet Identification) + Reste à engager */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enveloppe globale HT</p>
          <p className="text-lg font-black text-slate-800 tabular-nums mt-0.5">{fmtAmt(budget)}</p>
          <p className="text-[10px] text-slate-500 mt-1">Saisie dans l&apos;onglet Identification</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total engagé</p>
          <p className={`text-lg font-black tabular-nums mt-0.5 ${ratio > 100 ? 'text-[#dd007e]' : 'text-slate-800'}`}>{fmtAmt(spent)}</p>
        </div>
        <div className="rounded-xl bg-teal-50 border border-teal-100 p-4">
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Reste à engager</p>
          <p className="text-lg font-black text-[#007A78] tabular-nums mt-0.5">
            {resteAEngager != null ? fmtAmt(resteAEngager) : '—'}
          </p>
        </div>
      </div>

      {/* Bouton de saisie d'engagement */}
      <button
        type="button"
        onClick={addEngagement}
        className="w-full py-4 rounded-2xl bg-[#007A78] text-white hover:bg-[#006664] transition-all flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest shadow-sm"
      >
        <ic.Plus s={18} /> Saisir un engagement (commande)
      </button>

      {/* Tableau des engagements */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        {expenses.length === 0 ? (
          <div className="py-12 text-center border-b border-slate-100">
            <ic.Euro s={32} c="text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-bold">Aucun engagement</p>
            <p className="text-slate-300 text-xs mt-1">Cliquez sur « Saisir un engagement » pour ajouter une commande</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-4 py-3">Date de l&apos;engagement</th>
                <th className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-4 py-3">Nom de l&apos;entreprise</th>
                <th className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-4 py-3">Objet de la commande</th>
                <th className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-4 py-3 text-right">Montant (€ HT)</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <input
                      type="date"
                      value={e.date || ''}
                      onChange={(ev) => upd({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, date: ev.target.value } : x)) })}
                      className="w-full min-w-[130px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#007A78]/30 focus:border-[#007A78] outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={e.entreprise ?? e.description ?? ''}
                      onChange={(ev) => upd({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, entreprise: ev.target.value } : x)) })}
                      placeholder="Entreprise"
                      className="w-full min-w-[140px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-[#007A78]/30 focus:border-[#007A78] outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={e.description ?? ''}
                      onChange={(ev) => upd({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, description: ev.target.value } : x)) })}
                      placeholder="Objet de la commande"
                      className="w-full min-w-[180px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-[#007A78]/30 focus:border-[#007A78] outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <AmtInput
                      value={e.amount}
                      onChange={(v) => upd({ expenses: expenses.map((x) => (x.id === e.id ? { ...x, amount: v } : x)) })}
                      placeholder="0,00"
                      className="w-full min-w-[100px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-black text-right text-slate-800 focus:ring-2 focus:ring-[#007A78]/30 focus:border-[#007A78] outline-none"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => upd({ expenses: expenses.filter((x) => x.id !== e.id) })}
                      className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <ic.Tr s={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={3} className="px-4 py-3 text-sm font-black text-slate-600 uppercase tracking-wider">
                  Total engagé
                </td>
                <td className="px-4 py-3 text-right font-black text-slate-800 tabular-nums">
                  {fmtAmt(spent)}
                </td>
                <td className="w-12" />
              </tr>
              {budget > 0 && (
                <tr className="bg-teal-50/50 border-t border-slate-200">
                  <td colSpan={3} className="px-4 py-3 text-sm font-black text-teal-700 uppercase tracking-wider">
                    Reste à engager
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#007A78] tabular-nums">
                    {fmtAmt(resteAEngager)}
                  </td>
                  <td className="w-12" />
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function IntervenantsTab({ form, upd, config }) {
  const [editingId, setEditingId] = useState(null);
  const existIds = new Set((form.intervenants || []).map((i) => (i.nom || '') + '|' + (i.email || '')));
  const importable = (config?.contacts || []).filter((c) => !existIds.has((c.nom || '') + '|' + (c.email || '')));
  const importContact = (c) => {
    upd({ intervenants: [...(form.intervenants || []), { id: Date.now().toString(), role: c.role || '', nom: c.nom || '', email: c.email || '', tel: c.tel || '', entreprise: c.entreprise || '', lot: c.lot || '' }] });
    setEditingId(null);
  };
  const intervenants = form.intervenants || [];
  const editingContact = editingId ? intervenants.find((x) => x.id === editingId) : null;

  return (
    <div className="glass p-6 space-y-6">
      <div className="flex justify-between flex-wrap gap-2 items-center">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacts de cette opération</p>
          <p className="text-[9px] text-slate-500 mt-0.5">Ces contacts concernent uniquement ce projet. L’annuaire global est géré dans Outils → Contacts.</p>
        </div>
        <button
          onClick={() => {
            const id = Date.now().toString();
            upd({ intervenants: [...intervenants, { id, role: '', nom: '', email: '', tel: '', entreprise: '', lot: '' }] });
            setEditingId(id);
          }}
          className="bg-[#007A78] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-[#006664] transition-all shadow-sm"
        >
          <ic.Plus s={12} /> Ajouter un contact
        </button>
      </div>

      {/* Importer depuis l'annuaire (Outils / Contacts) — séparé */}
      {importable.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Importer depuis l’annuaire</p>
          <p className="text-[9px] text-slate-400 mb-3">Contacts définis dans <span className="font-bold text-slate-500">Outils → Contacts</span>. Un clic ajoute le contact à cette opération uniquement.</p>
          <div className="flex flex-wrap gap-2">
            {importable.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => importContact(c)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border-2 border-slate-200 hover:border-[#007A78] hover:bg-teal-50/50 transition-all text-[10px] font-bold text-slate-700"
              >
                <ic.Addr s={12} c="text-slate-400" />
                <span>{c.entreprise || c.nom || 'Sans nom'}</span>
                {c.nom && c.entreprise && <span className="text-slate-400 font-normal">· {c.nom}</span>}
                {c.role && <span className="text-[8px] text-slate-400 font-normal px-1.5 py-0.5 rounded bg-slate-100">{c.role}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liste des contacts du projet en étiquettes */}
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
          {intervenants.length} contact{intervenants.length !== 1 ? 's' : ''} sur cette opération
        </p>
        {intervenants.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8 font-bold bg-white/30 rounded-xl border border-dashed border-slate-200">
            Aucun contact. Ajoutez-en un ou importez depuis l’annuaire ci-dessus.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {intervenants.map((i) => (
              <div key={i.id} className="flex flex-col gap-0 w-[260px] min-w-[260px]">
                <div
                  className={`group flex items-center gap-2 rounded-xl border-2 transition-all min-h-[72px] ${
                    editingId === i.id
                      ? 'bg-white border-[#007A78] shadow-md ring-2 ring-[#007A78]/20'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 py-2 pl-3 pr-1">
                    {i.role ? (
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-[#007A78]/10 text-[#007A78] shrink-0">
                        {i.role}
                      </span>
                    ) : (
                      <span className="text-[8px] text-slate-400 px-2 py-0.5 shrink-0">Rôle</span>
                    )}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="text-[11px] font-bold text-slate-800 block truncate">{i.nom || 'Sans nom'}</span>
                      {i.entreprise && <span className="text-[9px] text-slate-500 block truncate">🏢 {i.entreprise}</span>}
                      {i.lot && <span className="text-[8px] text-slate-500 block truncate">Lot : {i.lot}</span>}
                      {(i.email || i.tel) && (
                        <span className="text-[8px] text-slate-400 block truncate">{[i.email, i.tel].filter(Boolean).join(' · ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 pr-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(i.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#007A78] hover:bg-slate-100 transition-colors"
                      title="Modifier"
                    >
                      <ic.Ed s={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { upd({ intervenants: intervenants.filter((x) => x.id !== i.id) }); setEditingId((id) => (id === i.id ? null : id)); }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Retirer du projet"
                    >
                      <ic.Tr s={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fenêtre popup création / modification contact */}
      {editingId && editingContact && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setEditingId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingContact.nom || editingContact.entreprise ? 'Modifier le contact' : 'Nouveau contact'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Rôle</label>
                <select
                  value={editingContact.role || ''}
                  onChange={(e) => upd({ intervenants: intervenants.map((x) => (x.id === editingId ? { ...x, role: e.target.value } : x)) })}
                  className="inp w-full py-2.5 text-sm font-medium"
                >
                  <option value="">— Rôle —</option>
                  {ROLES_INTERV.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Lot</label>
                <input
                  type="text"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.lot || ''}
                  onChange={(e) => upd({ intervenants: intervenants.map((x) => (x.id === editingId ? { ...x, lot: e.target.value } : x)) })}
                  placeholder="Lot"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Entreprise</label>
                <input
                  type="text"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.entreprise || ''}
                  onChange={(e) => upd({ intervenants: intervenants.map((x) => (x.id === editingId ? { ...x, entreprise: e.target.value } : x)) })}
                  placeholder="Entreprise"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nom</label>
                <input
                  type="text"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.nom || ''}
                  onChange={(e) => upd({ intervenants: intervenants.map((x) => (x.id === editingId ? { ...x, nom: e.target.value } : x)) })}
                  placeholder="Nom"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
                <input
                  type="email"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.email || ''}
                  onChange={(e) => upd({ intervenants: intervenants.map((x) => (x.id === editingId ? { ...x, email: e.target.value } : x)) })}
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Téléphone</label>
                <input
                  type="tel"
                  className="inp w-full py-2.5 text-sm"
                  value={editingContact.tel || ''}
                  onChange={(e) => upd({ intervenants: intervenants.map((x) => (x.id === editingId ? { ...x, tel: e.target.value } : x)) })}
                  placeholder="Tél"
                />
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function TBtn({ id, label, Icon, tab, setTab }) {
  return (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${tab === id ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-700'}`}
    >
      <Icon s={12} />
      <span>{label}</span>
    </button>
  );
}

export default function ProjectForm({ project, onSave, onSilentSave, onCancel, config, initialTab, currentUid, managerAgentLabels, managerAgentIds }) {
  const readOnly = (project && project.status === 'archived') || (project && project.ownerId != null && (currentUid || 'local') !== 'local' && project.ownerId !== (currentUid || 'local'));
  const isArchivedProject = project && project.status === 'archived';
  const ownerDisplayName = readOnly && project && !isArchivedProject ? (formatAgentDisplayName((managerAgentLabels && project.ownerId && managerAgentLabels[project.ownerId]) || (project.ownerEmail || '')) || 'Un agent') : '';
  const [tab, setTab] = useState(initialTab || 'general');
  const [form, setForm] = useState(() => {
    const b = project ? { ...BLANK(), ...project } : BLANK();
    if (!b.dateOS && b.createdAt) b.dateOS = b.createdAt.indexOf('T') >= 0 ? b.createdAt.split('T')[0] : b.createdAt.slice(0, 10);
    return b;
  });
  useEffect(() => {
    if (!project || !project.id) return;
    const prevId = projectIdRef.current;
    if (prevId != null && prevId !== project.id && formRef.current && formRef.current.id === prevId) {
      const payload = { ...formRef.current };
      if (chantierEditorRef.current) payload.chantierCR = chantierEditorRef.current.innerHTML;
      if (onSilentSave) onSilentSave(payload);
    }
    projectIdRef.current = project.id;
    const b = { ...BLANK(), ...project };
    if (!b.dateOS && b.createdAt) b.dateOS = b.createdAt.indexOf('T') >= 0 ? b.createdAt.split('T')[0] : b.createdAt.slice(0, 10);
    setForm(b);
    // Ne dépendre que de project.id : pas de onSilentSave pour éviter de réinitialiser le formulaire à chaque rendu parent (annuler les saisies).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  // Synchroniser form.tasks quand project.tasks change (ex. après une action depuis les rappels : Terminer / Reporter)
  useEffect(() => {
    if (!project?.id || project.id !== form.id || !project.tasks) return;
    setForm((f) => (f.tasks === project.tasks ? f : { ...f, tasks: project.tasks }));
  }, [project?.id, project?.tasks, form.id]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const undoPushRef = useRef(null);
  const undoDebounceRef = useRef(null);
  const MAX_UNDO = 30;
  const upd = readOnly
    ? () => {}
    : (p) => {
        setForm((f) => {
          undoPushRef.current = f;
          return { ...f, ...p };
        });
        setRedoStack([]);
        if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current);
        undoDebounceRef.current = setTimeout(() => {
          const toPush = undoPushRef.current;
          if (toPush != null) {
            setUndoStack((prev) => {
              const next = [...prev, JSON.parse(JSON.stringify(toPush))];
              return next.slice(-MAX_UNDO);
            });
          }
          undoDebounceRef.current = null;
        }, 600);
      };
  const spent = (form.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const budget = projBudget(form);
  const ratio = budget > 0 ? (spent / budget) * 100 : 0;
  const [saveStatus, setSaveStatus] = useState('idle');
  const isNew = !project;
  const formRef = useRef(form);
  const projectIdRef = useRef(project?.id);
  const onSilentSaveRef = useRef(onSilentSave);
  onSilentSaveRef.current = onSilentSave;
  const isNewRef = useRef(isNew);
  isNewRef.current = isNew;
  const savingStartedAtRef = useRef(null);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current);
    undoDebounceRef.current = null;
  }, [project?.id]);
  useEffect(() => {
    if (isNew && !(form.title || '').trim()) return;
    if (readOnly) return;
    setSaveStatus('saving');
    savingStartedAtRef.current = Date.now();
    const t = setTimeout(() => {
      const payload = { ...formRef.current };
      if (chantierEditorRef.current) payload.chantierCR = chantierEditorRef.current.innerHTML;
      const saveFn = onSilentSaveRef.current;
      if (saveFn) saveFn(payload);
      const elapsed = Date.now() - (savingStartedAtRef.current || 0);
      const minSavingMs = 1000;
      const showSavedAfter = Math.max(0, minSavingMs - elapsed);
      if (showSavedAfter > 0) {
        setTimeout(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }, showSavedAfter);
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [form, isNew, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const payload = { ...formRef.current };
        if (isNewRef.current && !(payload.title || '').trim()) return;
        if (chantierEditorRef.current) payload.chantierCR = chantierEditorRef.current.innerHTML;
        const saveFn = onSilentSaveRef.current;
        if (saveFn) saveFn(payload);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [readOnly]);

  useEffect(() => {
    if (readOnly) return;
    return () => {
      const saveFn = onSilentSaveRef.current;
      if (!saveFn || !formRef.current?.id) return;
      const payload = { ...formRef.current };
      if (isNewRef.current && !(payload.title || '').trim()) return;
      if (chantierEditorRef.current) payload.chantierCR = chantierEditorRef.current.innerHTML;
      saveFn(payload);
    };
  }, [readOnly]);
  const [taskFilter, setTaskFilter] = useState('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskOp, setNewTaskOp] = useState({ description: '', assignee: '', tag: '', dueDate: '', dueTime: '', priority: '', status: 'À faire', estimatedDuration: 0, interlocuteur: '', urgent: false });
  const [sitesDropdownOpen, setSitesDropdownOpen] = useState(false);
  const [buildingsDropdownOpen, setBuildingsDropdownOpen] = useState(false);
  const sitesDropdownRef = useRef(null);
  const buildingsDropdownRef = useRef(null);
  const chantierEditorRef = useRef(null);
  const chantierUndoRedoRef = useRef(false);
  const chantierApplyUndoRedoRef = useRef(false);
  const [chantierUndoState, setChantierUndoState] = useState({ history: [], index: -1 });
  const [generalLeftColWidth, setGeneralLeftColWidth] = useState(380);
  const [isLg, setIsLg] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const fn = () => setIsLg(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const handleResizeMouseDown = (e) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startW = generalLeftColWidth;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      setGeneralLeftColWidth((prev) => Math.min(600, Math.max(260, startW + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const MAX_CHANTIER_HISTORY = 50;
  useEffect(() => {
    const close = (e) => {
      if (sitesDropdownRef.current && !sitesDropdownRef.current.contains(e.target)) setSitesDropdownOpen(false);
      if (buildingsDropdownRef.current && !buildingsDropdownRef.current.contains(e.target)) setBuildingsDropdownOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    if (!chantierEditorRef.current) return;
    const raw = (project?.chantierCR ?? form.chantierCR) || '';
    const html = raw.indexOf('<') !== -1 ? raw : raw.replace(/\n/g, '<br/>');
    chantierEditorRef.current.innerHTML = html;
    setChantierUndoState({ history: [html], index: 0 });
  }, [project?.id]);
  useEffect(() => {
    if (!chantierApplyUndoRedoRef.current || !chantierEditorRef.current) return;
    const { history, index } = chantierUndoState;
    if (index < 0 || index >= history.length) return;
    const html = history[index];
    chantierEditorRef.current.innerHTML = html;
    upd({ chantierCR: html });
    chantierUndoRedoRef.current = true;
    setTimeout(() => { chantierUndoRedoRef.current = false; }, 0);
    chantierApplyUndoRedoRef.current = false;
  }, [chantierUndoState]);
  const todayStr = today();
  const tasks = form.tasks || [];
  const logo = config?.customLogo ?? null;

  return (
    <div className="space-y-6 fi pb-20">
      {readOnly && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <span className="text-lg" title="Consultation seule">🔒</span>
          <span className="text-[11px] font-bold">
            {isArchivedProject ? 'Consultation seule — projet archivé. Aucune modification possible.' : `Consultation uniquement (Propriété de : ${ownerDisplayName})`}
          </span>
        </div>
      )}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase">{project ? 'Modifier Opération' : 'Nouvelle Opération'}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-black text-[#007A78] uppercase tracking-widest">{form.title || 'sans titre'}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {project && (
            <>
              <button
                type="button"
                onClick={() => exportWordBlob(genProjectRecap(form, logo), 'Fiche_' + (form.title || '').replace(/\s+/g, '_') + '_' + today() + '.doc')}
                className="px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1"
              >
                <ic.FileText s={12} /> Word
              </button>
              <button
                type="button"
                onClick={() => exportPdfHtml(genProjectRecap(form, logo), 'Fiche ' + (form.title || ''))}
                className="px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-slate-600 text-white hover:bg-slate-800 transition-all flex items-center gap-1"
              >
                <ic.Dl s={12} /> PDF
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              const payload = { ...formRef.current };
              if (chantierEditorRef.current) payload.chantierCR = chantierEditorRef.current.innerHTML;
              if (!readOnly && onSilentSave) {
                if (isNew && !(payload.title || '').trim()) {
                  onCancel();
                  return;
                }
                const savePromise = onSilentSave(payload);
                if (savePromise && typeof savePromise.then === 'function') {
                  savePromise.then(() => onCancel()).catch(() => {});
                } else onCancel();
              } else onCancel();
            }}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-white transition-all"
          >
            ← Retour
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                title="Annuler"
                disabled={undoStack.length === 0}
                onClick={() => {
                  if (undoStack.length === 0) return;
                  if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current);
                  undoDebounceRef.current = null;
                  const prev = undoStack[undoStack.length - 1];
                  setUndoStack((s) => s.slice(0, -1));
                  setRedoStack((s) => [...s, JSON.parse(JSON.stringify(formRef.current))]);
                  setForm(prev);
                  if (chantierEditorRef.current) {
                    const cr = (prev.chantierCR || '').indexOf('<') !== -1 ? prev.chantierCR : (prev.chantierCR || '').replace(/\n/g, '<br/>');
                    chantierEditorRef.current.innerHTML = cr;
                  }
                  setChantierUndoState({ history: [prev.chantierCR || ''], index: 0 });
                  if (onSilentSave) onSilentSave(prev);
                }}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ↶ Annuler
              </button>
              <button
                type="button"
                title="Rétablir"
                disabled={redoStack.length === 0}
                onClick={() => {
                  if (redoStack.length === 0) return;
                  if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current);
                  undoDebounceRef.current = null;
                  const next = redoStack[redoStack.length - 1];
                  setRedoStack((s) => s.slice(0, -1));
                  setUndoStack((s) => [...s, JSON.parse(JSON.stringify(formRef.current))]);
                  setForm(next);
                  if (chantierEditorRef.current) {
                    const cr = (next.chantierCR || '').indexOf('<') !== -1 ? next.chantierCR : (next.chantierCR || '').replace(/\n/g, '<br/>');
                    chantierEditorRef.current.innerHTML = cr;
                  }
                  setChantierUndoState({ history: [next.chantierCR || ''], index: 0 });
                  if (onSilentSave) onSilentSave(next);
                }}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ↷ Rétablir
              </button>
            </>
          )}
          {!readOnly && saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black text-amber-500 bg-amber-50">⏳ Sauvegarde…</span>
          )}
          {!readOnly && saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black text-[#007A78] bg-teal-50">✅ Sauvegardé</span>
          )}
          {saveStatus === 'idle' && project && !readOnly && (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-300">💾 Auto-save actif</span>
          )}
          {isNew && !form.title && (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-400 bg-slate-50">Entrez un titre pour sauvegarder</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 p-1 bg-slate-100/50 rounded-xl w-fit border border-slate-200/40 flex-wrap">
        <TBtn id="general" label="Général" Icon={ic.Inf} tab={tab} setTab={setTab} />
        <TBtn id="planning" label="Planning" Icon={ic.Gnt} tab={tab} setTab={setTab} />
        <TBtn id="tasks" label="Tâches" Icon={ic.Clip} tab={tab} setTab={setTab} />
        <TBtn id="finances" label="Engagements" Icon={ic.Euro} tab={tab} setTab={setTab} />
        <TBtn id="intervenants" label="Intervenants" Icon={ic.Usr} tab={tab} setTab={setTab} />
      </div>
      {tab === 'general' && (
        <div className="space-y-5">
          <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 min-h-0">
            <div
              className={`glass p-4 space-y-3 shrink-0 relative z-10 ${sitesDropdownOpen || buildingsDropdownOpen ? 'overflow-visible' : 'overflow-auto'}`}
              style={isLg ? { width: generalLeftColWidth, minWidth: 260, maxWidth: 600 } : { width: '100%' }}
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Identification</p>
              <div>
                <label className="lbl text-[11px]">Intitulé *</label>
                <input className="inp text-sm py-1.5" value={form.title} onChange={(e) => upd({ title: e.target.value })} placeholder="ex: Rénovation Bâtiment 4" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="relative" ref={sitesDropdownRef}>
                    <label className="lbl text-[11px]">Site(s)</label>
                    <button
                    type="button"
                    onClick={() => { setSitesDropdownOpen((o) => !o); setBuildingsDropdownOpen(false); }}
                    className="inp w-full text-left flex items-center justify-between gap-2 py-1.5 text-sm"
                  >
                    <span className="truncate">
                      {(form.locations && form.locations.length === LOCATIONS.length) || (!form.locations && !form.location)
                        ? 'Tous sites'
                        : (form.locations && form.locations.length > 0)
                          ? form.locations.length === 1
                            ? form.locations[0]
                            : `${form.locations.length} site(s)`
                          : '— Aucun —'}
                    </span>
                    <span className="text-slate-400 shrink-0">{sitesDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  {sitesDropdownOpen && (
                    <div className="absolute z-[100] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg py-2 max-h-48 overflow-y-auto">
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={(form.locations && form.locations.length === LOCATIONS.length) || (!form.locations && !form.location)}
                          onChange={(e) => {
                            if (e.target.checked) upd({ locations: [...LOCATIONS], location: LOCATIONS[0], subLocation: '', subLocations: [] });
                            else upd({ locations: [], location: '', subLocation: '', subLocations: [] });
                          }}
                          className="rounded border-slate-300 text-[#007A78] focus:ring-[#007A78] w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold text-slate-700">Tous sites</span>
                      </label>
                      {LOCATIONS.map((l) => {
                        const sel = (form.locations && form.locations.length > 0 ? form.locations : (form.location ? [form.location] : []));
                        const checked = sel.includes(l);
                        return (
                          <label key={l} className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked ? sel.filter((x) => x !== l) : [...sel, l];
                                upd({ locations: next, location: next[0] || '', subLocations: [], subLocation: '' });
                              }}
                              className="rounded border-slate-300 text-[#007A78] focus:ring-[#007A78] w-3 h-3"
                            />
                            <span className="text-[11px] text-slate-600">{l}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                  {(() => {
                    const selSites = (form.locations && form.locations.length > 0 ? form.locations : (form.location ? [form.location] : []));
                    return selSites.length > 1 ? <p className="text-[10px] text-slate-500 mt-1">{selSites.join(', ')}</p> : null;
                  })()}
                </div>
                <div>
                  <div className="relative" ref={buildingsDropdownRef}>
                  <label className="lbl text-[11px]">Bâtiment(s)</label>
                  {(() => {
                    const sites = (form.locations && form.locations.length > 0 ? form.locations : (form.location ? [form.location] : []));
                    const buildingsList = sites.length > 0 ? [...new Set((sites).flatMap((s) => SUB_MAP[s] || []))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : (SUB_MAP[form.location] || []);
                    const selSub = (form.subLocations && form.subLocations.length > 0 ? form.subLocations : (form.subLocation ? [form.subLocation] : []));
                    const allBuildingsChecked = buildingsList.length > 0 && selSub.length === buildingsList.length;
                    const summary = buildingsList.length === 0
                      ? '— Choisir un site —'
                      : allBuildingsChecked
                        ? 'Tous bâtiments'
                        : selSub.length === 0
                          ? '— Aucun —'
                          : selSub.length === 1
                            ? selSub[0]
                            : `${selSub.length} bâtiment(s)`;
                    return (
                      <>
                        <button
                          type="button"
                          disabled={buildingsList.length === 0}
                          onClick={() => { setBuildingsDropdownOpen((o) => !o); setSitesDropdownOpen(false); }}
                          className="inp w-full text-left flex items-center justify-between gap-2 py-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <span className="truncate">{summary}</span>
                          <span className="text-slate-400 shrink-0">{buildingsDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {buildingsDropdownOpen && buildingsList.length > 0 && (
                          <div className="absolute z-[100] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg py-2 max-h-48 overflow-y-auto">
                            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-slate-50">
                              <input
                                type="checkbox"
                                checked={allBuildingsChecked}
                                onChange={(e) => {
                                  if (e.target.checked) upd({ subLocations: [...buildingsList], subLocation: buildingsList[0] || '' });
                                  else upd({ subLocations: [], subLocation: '' });
                                }}
                                className="rounded border-slate-300 text-[#007A78] focus:ring-[#007A78] w-3.5 h-3.5"
                              />
                              <span className="text-[11px] font-bold text-slate-700">Tous bâtiments</span>
                            </label>
                            {buildingsList.map((b) => {
                              const checked = selSub.includes(b);
                              return (
                                <label key={b} className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-slate-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked ? selSub.filter((x) => x !== b) : [...selSub, b];
                                      upd({ subLocations: next, subLocation: next[0] || '' });
                                    }}
                                    className="rounded border-slate-300 text-[#007A78] focus:ring-[#007A78] w-3 h-3"
                                  />
                                  <span className="text-[11px] text-slate-600">{b}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {selSub.length > 1 && <p className="text-[10px] text-slate-500 mt-1">{selSub.join(', ')}</p>}
                      </>
                    );
                  })()}
                </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="lbl text-[11px]">Type de projet</label>
                  <select className="inp py-1.5 text-sm" value={form.typeTravaux} onChange={(e) => upd({ typeTravaux: e.target.value })}>
                    <option value="">— Sélectionner —</option>
                    {[...TYPES_PROJET, ...(form.typeTravaux && !TYPES_PROJET.includes(form.typeTravaux) ? [form.typeTravaux] : [])].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="lbl text-[11px]">Date de démarrage</label>
                  <input type="date" className="inp py-1.5 text-sm" value={form.dateOS || ''} onChange={(e) => upd({ dateOS: e.target.value })} />
                </div>
                <div>
                  <label className="lbl text-[11px]">Date livraison prévue</label>
                  <input type="date" className="inp py-1.5 text-sm" value={form.dateLivraisonPrev || ''} onChange={(e) => upd({ dateLivraisonPrev: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="lbl text-[11px]">Intensité de suivi</label>
                <select
                  className="inp py-1.5 text-sm"
                  value={form.intensity !== undefined && form.intensity !== null ? form.intensity : 2}
                  onChange={(e) => upd({ intensity: parseInt(e.target.value, 10) })}
                >
                  {INTENSITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lots & Budget</p>
                  <button
                    type="button"
                    onClick={() => upd({ lots: [...(form.lots || []), { id: Date.now().toString(), label: `Lot ${(form.lots || []).length + 1}`, entreprise: '', montant: '', pourcentage: '', avancement: 0 }] })}
                    className="flex items-center gap-1 px-2 py-1 bg-[#007A78] text-white rounded-lg text-[9px] font-black uppercase hover:bg-[#006664] transition-all"
                  >
                    <ic.Plus s={10} /> Lot
                  </button>
                </div>
                <div className="rounded-xl border-2 border-teal-100 bg-teal-50/40 p-4">
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-wider mb-1">Enveloppe globale HT (€)</p>
                  <p className="text-[10px] text-slate-500 mb-2">Utilisée pour le « Reste à engager » dans l&apos;onglet Engagements</p>
                  <div className="flex items-center gap-2">
                    <ic.Euro s={18} c="text-teal-400" />
                    <AmtInput value={form.budgetInitial} onChange={(v) => upd({ budgetInitial: v })} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800" placeholder="ex: 500 000 ou 50+25" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(form.lots || []).map((l) => (
                    <div key={l.id} className="flex items-center gap-1 bg-white/50 p-2 rounded-lg border border-slate-100">
                      <input
                        type="text"
                        value={l.label}
                        onChange={(e) => upd({ lots: (form.lots || []).map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })}
                        className="text-xs font-bold bg-transparent focus:outline-none w-14 shrink-0"
                        placeholder="Lot"
                      />
                      <input
                        type="text"
                        value={l.entreprise}
                        onChange={(e) => upd({ lots: (form.lots || []).map((x) => (x.id === l.id ? { ...x, entreprise: e.target.value } : x)) })}
                        placeholder="Entreprise"
                        className="text-xs bg-transparent focus:outline-none flex-1 min-w-0"
                      />
                      <AmtInput
                        value={l.montant}
                        onChange={(v) => upd({ lots: (form.lots || []).map((x) => (x.id === l.id ? { ...x, montant: v } : x)) })}
                        className="text-xs font-black text-right bg-slate-50 border border-slate-100 rounded px-1.5 py-1 w-20"
                        placeholder="ex: 50+25"
                      />
                      <button type="button" onClick={() => upd({ lots: (form.lots || []).filter((x) => x.id !== l.id) })} className="text-slate-300 hover:text-red-400 shrink-0"><ic.Tr s={12} /></button>
                    </div>
                  ))}
                  {(form.lots || []).length > 0 && (
                    <p className="text-[11px] font-black text-slate-600 pt-1 border-t border-slate-100 flex justify-between items-center">
                      <span>Total lots</span>
                      <span>{(form.lots || []).reduce((s, l) => s + (parseFloat(l.montant) || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="lbl text-[11px]">Notes</label>
                <textarea rows={2} className="inp text-sm py-1.5" value={form.notes} onChange={(e) => upd({ notes: e.target.value })} />
              </div>
            </div>
            {isLg && (
              <div
                role="separator"
                aria-label="Redimensionner"
                onMouseDown={handleResizeMouseDown}
                className="shrink-0 w-2 cursor-col-resize flex items-center justify-center group hover:bg-[#007A78]/10 transition-colors"
                title="Glisser pour redimensionner"
              >
                <span className="w-0.5 h-8 rounded-full bg-slate-200 group-hover:bg-[#007A78]/50" />
              </div>
            )}
            <div className="glass p-4 flex flex-col min-h-0 flex-1 min-w-0 relative z-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Journal de chantier</p>
              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 bg-slate-50 items-center">
                  <button type="button" className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed" title="Annuler" disabled={chantierUndoState.index <= 0} onClick={() => { chantierApplyUndoRedoRef.current = true; setChantierUndoState(prev => ({ ...prev, index: Math.max(0, prev.index - 1) })); }}>↶</button>
                  <button type="button" className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed" title="Rétablir" disabled={chantierUndoState.index >= chantierUndoState.history.length - 1} onClick={() => { chantierApplyUndoRedoRef.current = true; setChantierUndoState(prev => ({ ...prev, index: Math.min(prev.history.length - 1, prev.index + 1) })); }}>↷</button>
                  <span className="w-px h-4 bg-slate-200 mx-0.5" />
                  <button type="button" className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-xs font-bold" title="Gras" onClick={() => document.execCommand('bold', false, null)}>G</button>
                  <button type="button" className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-xs underline" title="Souligner" onClick={() => document.execCommand('underline', false, null)}>S</button>
                  <button type="button" className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-xs" title="Puces" onClick={() => document.execCommand('insertUnorderedList', false, null)}>•</button>
                  <button type="button" className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-sm" title="Case à cocher" onClick={() => document.execCommand('insertHTML', false, '☐ ')}>☐</button>
                  <span className="text-slate-400 text-[10px] uppercase ml-1">Couleur</span>
                  {['#000000','#c0392b','#2980b9','#27ae60'].map((hex) => (
                    <button key={hex} type="button" className="w-5 h-5 rounded border border-slate-300 hover:ring-2 hover:ring-[#007A78]" style={{ backgroundColor: hex }} title={hex} onClick={() => document.execCommand('foreColor', false, hex)} />
                  ))}
                </div>
                <div
                  ref={chantierEditorRef}
                  contentEditable
                  className="inp flex-1 min-h-[300px] p-3 border-0 focus:ring-0 focus:outline-none"
                  style={{ minHeight: 300 }}
                  data-placeholder="Comptes-rendus..."
                  onInput={(e) => {
                    if (chantierUndoRedoRef.current) return;
                    const newContent = e.currentTarget.innerHTML;
                    setChantierUndoState(prev => {
                      const arr = [...prev.history.slice(0, prev.index + 1), newContent];
                      const history = arr.length > MAX_CHANTIER_HISTORY ? arr.slice(-MAX_CHANTIER_HISTORY) : arr;
                      return { history, index: history.length - 1 };
                    });
                    upd({ chantierCR: newContent });
                  }}
                  onBlur={(e) => {
                    if (chantierUndoRedoRef.current) return;
                    upd({ chantierCR: e.currentTarget.innerHTML });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === 'planning' && <PlanningTab form={form} upd={upd} />}
      {tab === 'tasks' && <TasksTab form={form} upd={upd} project={project} tasks={tasks} todayStr={todayStr} config={config} setShowNewTaskModal={setShowNewTaskModal} showNewTaskModal={showNewTaskModal} newTaskOp={newTaskOp} setNewTaskOp={setNewTaskOp} taskFilter={taskFilter} setTaskFilter={setTaskFilter} readOnly={readOnly} showAllTasks={isArchivedProject} managerAgentIds={managerAgentIds} currentUid={currentUid} managerAgentLabels={managerAgentLabels} />}
      {tab === 'finances' && <FinancesTab form={form} upd={upd} spent={spent} ratio={ratio} budget={budget} fmtAmt={fmtAmt2Dec} fmtDate={fmtDate} />}
      {tab === 'intervenants' && <IntervenantsTab form={form} upd={upd} config={config} />}
    </div>
  );
}
