import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  LOCATIONS,
  SUB_MAP,
  TYPES_TRAVAUX,
  PHASES,
  INTENSITY_OPTIONS,
  JOURNAL_TAGS,
  RISK_NIVEAUX,
  ROLES_INTERV,
  BOARD_COLS,
  PRIORITIES,
} from '../lib/constants';
import { BLANK, today, daysBetween, addTaskLog, projBudget, fmtDate, fmtAmt, formatAgentDisplayName } from '../lib/utils';
import { exportWordBlob, exportPdfHtml, genProjectRecap, genCoverPage } from '../lib/exportUtils';
import ic from './icons';
import GanttChart from './GanttChart';
import * as XLSX from 'xlsx';

// ——— Composant champ montant ———
function AmtInput({ value, onChange, className = '', placeholder = '', style = {} }) {
  const [raw, setRaw] = useState(value === 0 || value === '' ? '' : String(value));
  useEffect(() => {
    setRaw(value === 0 || value === '' ? '' : String(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder || 'ex: 45 000'}
      className={className}
      style={style}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        setRaw(v);
        const n = parseFloat(v);
        if (!isNaN(n)) onChange(n);
        else if (v === '' || v === '-') onChange('');
      }}
      onBlur={() => {
        const n = parseFloat(String(raw).replace(',', '.'));
        if (isNaN(n)) {
          setRaw('');
          onChange('');
        } else {
          setRaw(String(n));
          onChange(n);
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
    html += '<h2>Intervenants</h2><table><tr><th>Entreprise</th><th>Rôle</th><th>Nom</th><th>Email</th><th>Tél</th></tr>';
    p.intervenants.forEach((i) => {
      html += `<tr><td>${i.entreprise || ''}</td><td>${i.role || ''}</td><td><strong>${i.nom || ''}</strong></td><td>${i.email || ''}</td><td>${i.tel || ''}</td></tr>`;
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
    html += '<h2>Notes générales</h2><p>' + p.chantierCR.replace(/\n/g, '<br/>') + '</p>';
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
function downloadGanttTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = [['Tâche', 'Date début prévu', 'Date fin prévue', 'Date début réel', 'Date fin réelle', '% avancement (0-100)', 'Terminé (OUI/NON)']];
  const sample = [
    ['Études', '2025-01-06', '2025-02-28', '2025-01-06', '2025-03-07', '100', 'OUI'],
    ["DCE / Appel d'offres", '2025-02-01', '2025-04-30', '2025-02-05', '', '60', 'NON'],
    ['Consultation / Attribution', '2025-04-01', '2025-05-31', '', '', '0', 'NON'],
    ['Préparation chantier', '2025-05-15', '2025-06-30', '', '', '0', 'NON'],
    ['Travaux', '2025-07-01', '2025-12-31', '', '', '0', 'NON'],
    ['Réception', '2025-12-15', '2026-01-15', '', '', '0', 'NON'],
    ['Levée de réserves', '2026-01-16', '2026-02-28', '', '', '0', 'NON'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Planning Gantt');
  XLSX.writeFile(wb, 'Template_Planning_Gantt.xlsx');
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
    ['N°', 'Tâche', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle', '% Avancement', 'Terminé', 'Retard (j)', 'Statut'],
  ];
  tasks.forEach((t, i) => {
    const delayed = t.planEnd && (t.actualEnd ? t.actualEnd > t.planEnd : todayStr > t.planEnd && !t.done);
    const delayDays = t.planEnd && t.actualEnd ? daysBetween(t.planEnd, t.actualEnd) : t.planEnd && !t.done && todayStr > t.planEnd ? daysBetween(t.planEnd, todayStr) : 0;
    const statut = t.done ? 'Terminé' : delayed ? 'En retard' : t.actualStart && !t.actualEnd ? 'En cours' : 'Planifié';
    rows.push([i + 1, t.label, t.planStart || '', t.planEnd || '', t.actualStart || '', t.actualEnd || '', parseInt(t.progress) || 0, t.done ? 'OUI' : 'NON', delayDays > 0 ? delayDays : 0, statut]);
  });
  rows.push([]);
  rows.push(['', '', '', '', '', '', '', '', '', 'Généré par DITAM Travaux Manager']);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
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
      const idxPlanStart = headers.findIndex((h) => h && (h.includes('début prévu') || h.includes('date début')));
      const idxPlanEnd = headers.findIndex((h) => h && (h.includes('fin prévue') || h.includes('date fin')));
      const idxActualStart = headers.findIndex((h) => h && h.includes('début réel'));
      const idxActualEnd = headers.findIndex((h) => h && h.includes('fin réelle'));
      const idxProgress = headers.findIndex((h) => h && (h.includes('avancement') || h.includes('%')));
      const idxDone = headers.findIndex((h) => h && (h.includes('terminé') || h.includes('oui') || h.includes('non')));
      const imported = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const label = (idxLabel >= 0 ? row[idxLabel] : row[0]) || '';
        if (!String(label).trim()) continue;
        const planStart = idxPlanStart >= 0 ? row[idxPlanStart] : '';
        const planEnd = idxPlanEnd >= 0 ? row[idxPlanEnd] : '';
        const actualStart = idxActualStart >= 0 ? row[idxActualStart] : '';
        const actualEnd = idxActualEnd >= 0 ? row[idxActualEnd] : '';
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
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tâches du planning</p>
          <button
            type="button"
            onClick={addTask}
            className="bg-[#007A78] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"
          >
            <ic.Plus s={12} /> Ajouter une tâche
          </button>
        </div>
        <div className="grid gap-2 mb-1 px-2" style={{ gridTemplateColumns: '2fr 110px 110px 110px 110px 70px 36px 36px' }}>
          {['Tâche', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle', 'Avancement', 'OK', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              {h}
            </span>
          ))}
        </div>
        <div className="space-y-1.5">
          {(form.timelineTasks || []).map((t) => (
            <div
              key={t.id}
              className="grid gap-2 items-center p-2 rounded-xl border bg-white/40 border-slate-100 hover:bg-white/60 transition-all"
              style={{ gridTemplateColumns: '2fr 110px 110px 110px 110px 70px 36px 36px' }}
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
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={t.progress || 0}
                  onChange={(e) => updTask(t.id, { progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
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
          ))}
          {(form.timelineTasks || []).length === 0 && (
            <div className="text-center py-8 text-slate-300">
              <p className="text-[10px] font-black uppercase tracking-widest">Aucune tâche — cliquez sur &quot;Ajouter&quot; ou importez un fichier Excel</p>
            </div>
          )}
        </div>
      </div>
      <div className="glass p-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Diagramme de Gantt</p>
        <GanttChart
          tasks={form.timelineTasks || []}
          projectTitle={form.title}
          onExportXlsx={() => exportGanttXlsx(form.timelineTasks || [], form.title)}
          onDownloadTemplate={downloadGanttTemplate}
          onImportRef={planImportRef}
        />
      </div>
    </div>
  );
}

function TasksTab({ form, upd, tasks, todayStr, config, showNewTaskModal, setShowNewTaskModal, newTaskOp, setNewTaskOp, taskFilter, setTaskFilter, readOnly }) {
  const displayTasks = tasks.filter((t) => {
    const isDone = t.status === 'Terminé' || t.done === true;
    if (taskFilter === 'late') return t.dueDate && t.dueDate < todayStr && !isDone;
    if (taskFilter === 'week') {
      if (!t.dueDate || isDone) return false;
      const diff = daysBetween(todayStr, t.dueDate);
      return diff >= 0 && diff <= 7;
    }
    return true;
  });
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white/50 p-3 rounded-xl border border-slate-100 flex-wrap gap-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Suivi des actions</p>
        <div className="flex gap-1 bg-slate-100/50 p-1 rounded-lg">
          {['all', 'late', 'week'].map((f) => (
            <button key={f} type="button" onClick={() => setTaskFilter(f)} className={`px-2 py-1 text-[9px] font-black uppercase rounded transition-all ${taskFilter === f ? (f === 'all' ? 'bg-white shadow text-slate-700' : f === 'late' ? 'bg-white shadow text-red-500' : 'bg-white shadow text-blue-500') : 'text-slate-400 hover:text-slate-600'}`}>
              {f === 'all' ? 'Tout' : f === 'late' ? 'En retard' : 'Cette semaine'}
            </button>
          ))}
        </div>
        {!readOnly && (
        <button type="button" onClick={() => { setNewTaskOp({ description: '', assignee: '', tag: '', dueDate: '', dueTime: '', priority: '', status: 'À faire' }); setShowNewTaskModal(true); }} className="bg-[#007A78] text-white px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#006664] transition-all shadow-sm w-fit">
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
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Description de la tâche</label><input autoFocus type="text" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:border-[#007A78] focus:bg-white transition-all outline-none shadow-sm" placeholder="Que faut-il faire ?" value={newTaskOp.description} onChange={(e) => setNewTaskOp({ ...newTaskOp, description: e.target.value })} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Responsable</label><input type="text" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" placeholder="Nom..." value={newTaskOp.assignee} onChange={(e) => setNewTaskOp({ ...newTaskOp, assignee: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Tag</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.tag} onChange={(e) => setNewTaskOp({ ...newTaskOp, tag: e.target.value })}><option value="">Aucun tag</option>{(config?.taskTags || []).map((tg) => <option key={tg} value={tg}>{tg}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Échéance</label><input type="date" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.dueDate} onChange={(e) => setNewTaskOp({ ...newTaskOp, dueDate: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Heure</label><input type="time" className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.dueTime} onChange={(e) => setNewTaskOp({ ...newTaskOp, dueTime: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Priorité</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.priority} onChange={(e) => setNewTaskOp({ ...newTaskOp, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase block px-1">Statut</label><select className="w-full bg-white/50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[12px] font-bold text-slate-800 outline-none" value={newTaskOp.status} onChange={(e) => setNewTaskOp({ ...newTaskOp, status: e.target.value })}>{BOARD_COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              </div>
            </div>
            <div className="flex-shrink-0 px-4 md:px-8 py-6 bg-black/5 flex gap-4">
              <button onClick={() => setShowNewTaskModal(false)} className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white text-slate-400 hover:text-slate-600 border border-slate-100 transition-all shadow-sm">Annuler</button>
              <button onClick={() => { if (!newTaskOp.description.trim()) return; const nowStr = new Date().toISOString(); const isDone = newTaskOp.status === 'Terminé'; upd({ tasks: [...tasks, { id: Date.now().toString(), description: newTaskOp.description.trim(), status: newTaskOp.status, done: isDone, assignee: newTaskOp.assignee, tag: newTaskOp.tag, dueDate: newTaskOp.dueDate, dueTime: newTaskOp.dueTime, priority: newTaskOp.priority, statusChangedAt: nowStr, completedAt: isDone ? nowStr : null, history: [{ ts: nowStr, action: 'Créée', detail: 'Via opération' }] }] }); setShowNewTaskModal(false); setNewTaskOp({ description: '', assignee: '', tag: '', dueDate: '', dueTime: '', priority: '', status: 'À faire' }); }} className="flex-1 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-[#007A78] text-white hover:bg-teal-700 shadow-lg active:scale-95 transition-all">Enregistrer l&apos;action</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <div className="space-y-2">
        {displayTasks.length === 0 && <p className="text-center text-xs text-slate-400 py-6 font-bold bg-white/30 rounded-xl border border-dashed border-slate-200">Aucune tâche.</p>}
        {displayTasks.map((t) => {
          const currentStatus = t.status || (t.done ? 'Terminé' : 'À faire');
          const nextStatus = currentStatus === 'À faire' ? 'En cours' : currentStatus === 'En cours' ? 'En attente' : currentStatus === 'En attente' ? 'À valider' : currentStatus === 'À valider' ? 'Validé' : currentStatus === 'Validé' ? 'Terminé' : currentStatus === 'Terminé' ? 'À faire' : currentStatus === 'À retravailler' ? 'En cours' : currentStatus === 'Refusé' ? 'À faire' : 'À faire';
          let sColor = 'text-slate-500 border-slate-200', sBg = 'bg-white/50 border-slate-100';
          if (currentStatus === 'En cours') { sColor = 'text-blue-500 border-blue-200'; sBg = 'bg-blue-50 border-blue-100'; }
          if (currentStatus === 'En attente') { sColor = 'text-amber-600 border-amber-200'; sBg = 'bg-amber-50 border-amber-100'; }
          if (currentStatus === 'À valider') { sColor = 'text-indigo-600 border-indigo-200'; sBg = 'bg-indigo-50 border-indigo-100'; }
          if (currentStatus === 'À retravailler') { sColor = 'text-red-600 border-red-200'; sBg = 'bg-red-50 border-red-100'; }
          if (currentStatus === 'Refusé') { sColor = 'text-slate-700 border-slate-400'; sBg = 'bg-slate-100 border-slate-200'; }
          if (currentStatus === 'Validé') { sColor = 'text-teal-600 border-teal-200'; sBg = 'bg-teal-50 border-teal-100'; }
          if (currentStatus === 'Terminé') { sColor = 'text-teal-600 border-teal-200'; sBg = 'bg-teal-50 border-teal-100 opacity-60'; }
          const isLate = t.dueDate && t.dueDate < todayStr && currentStatus !== 'Terminé';
          const handleStatusClick = () => {
            const nowStr = new Date().toISOString();
            const nTasks = tasks.map((x) =>
              x.id === t.id
                ? addTaskLog(
                    { ...x, status: nextStatus, done: nextStatus === 'Terminé', statusChangedAt: nowStr, completedAt: nextStatus === 'Terminé' ? nowStr : (x.completedAt || null) },
                    'Statut → ' + nextStatus
                  )
                : x
            );
            upd({ tasks: nTasks });
          };
          const taskTags = config?.taskTags || [];
          const descInputClass = currentStatus === 'Terminé' ? 'line-through text-slate-400' : 'text-slate-700';
          const dateInputClass = isLate ? 'text-red-600 font-black border-red-300 bg-red-50/50' : 'text-slate-500';
          const timeInputClass = isLate ? 'text-red-600 font-black border-red-300 bg-red-50/50' : 'text-slate-500';
          const handleAssigneeChange = (e) => upd({ tasks: tasks.map((x) => (x.id === t.id ? { ...x, assignee: e.target.value } : x)) });
          const handleTagChange = (e) => upd({ tasks: tasks.map((x) => (x.id === t.id ? { ...x, tag: e.target.value } : x)) });
          const handleDueDateChange = (e) => upd({ tasks: tasks.map((x) => (x.id === t.id ? { ...x, dueDate: e.target.value } : x)) });
          const handleDueTimeChange = (e) => upd({ tasks: tasks.map((x) => (x.id === t.id ? { ...x, dueTime: e.target.value } : x)) });
          return (
            <div key={t.id} className={`p-3 rounded-xl border flex flex-col gap-2 transition-all hover:shadow-sm ${sBg}`}>
              <div className="flex gap-2 items-center">
                <button type="button" onClick={handleStatusClick} className={`w-24 text-[9px] font-black uppercase py-1.5 rounded border bg-white flex-shrink-0 transition-all hover:scale-105 ${sColor}`}>{currentStatus}</button>
                <input value={t.description} onChange={(e) => upd({ tasks: tasks.map((x) => (x.id === t.id ? { ...x, description: e.target.value } : x)) })} className={'bg-transparent text-sm font-bold flex-1 focus:outline-none ' + descInputClass} />
                <button type="button" onClick={() => upd({ tasks: tasks.filter((x) => x.id !== t.id) })} className="text-slate-300 hover:text-red-500 ml-1 flex-shrink-0 transition-colors p-1"><ic.Tr s={16} /></button>
              </div>
              <div className="flex gap-2 items-center flex-wrap" style={{ marginLeft: '104px' }}>
                <input className="inp py-1 px-2 text-[10px] w-32 bg-white/50 font-medium text-slate-600" placeholder="Qui ?" value={t.assignee || ''} onChange={handleAssigneeChange} />
                <select className="inp py-1 px-1 text-[10px] w-28 bg-white/50 font-medium text-slate-500" value={t.tag || ''} onChange={handleTagChange}>
                  <option value="">- Tag -</option>
                  {taskTags.map((tg) => (
                    <option key={tg} value={tg}>{tg}</option>
                  ))}
                </select>
                <input type="date" className={'inp py-1 px-1 text-[9px] w-24 bg-white/50 font-medium ' + dateInputClass} value={t.dueDate || ''} onChange={handleDueDateChange} />
                <input type="time" className={'inp py-1 px-1 text-[9px] w-16 bg-white/50 font-medium ' + timeInputClass} value={t.dueTime || ''} onChange={handleDueTimeChange} />
                {isLate && <ic.Warn s={14} c="text-red-500" />}
              </div>
              {(t.history || []).length > 0 && (
                <details className="ml-[104px] mt-1">
                  <summary className="text-[8px] text-slate-400 font-bold cursor-pointer">
                    <ic.Hist s={10} /> Historique ({(t.history || []).length})
                  </summary>
                  <div className="mt-1 pl-2 border-l-2 border-slate-100">
                    {(t.history || []).slice().reverse().map((h, hi) => (
                      <p key={hi} className="text-[8px] text-slate-400">
                        <span className="text-slate-500 font-bold">
                          {new Date(h.ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{' '}
                          {new Date(h.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {' — '}
                        <span className="font-bold">{h.action}</span>
                        {h.detail ? ' : ' + h.detail : ''}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JournalTab({ form, upd, config, logo, jDate, setJDate, jTag, setJTag, jText, setJText, jPresents, setJPresents, showCrPanel, setShowCrPanel, crNextReunion, setCrNextReunion }) {
  const journal = (form.journal || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const addEntry = () => { if (!jText.trim()) return; upd({ journal: [...(form.journal || []), { id: Date.now().toString(), date: jDate, tag: jTag, text: jText.trim(), presents: jPresents.trim() }] }); setJText(''); setJPresents(''); };
  return (
    <div className="glass p-6 space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal de chantier ({journal.length} entrée{journal.length > 1 ? 's' : ''})</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setShowCrPanel(!showCrPanel)} className={`${showCrPanel ? 'bg-[#006664] ring-2 ring-[#007A78]/30' : 'bg-[#007A78]'} hover:bg-[#006664] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all`}><ic.Book s={12} /> CR Chantier</button>
          <button type="button" onClick={() => exportWordBlob(genJournalWord(form, logo), 'CR_' + (form.title || '').replace(/\s+/g, '_') + '_' + today() + '.doc')} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"><ic.FileText s={12} /> Export Word</button>
          <button type="button" onClick={() => exportPdfHtml(genJournalWord(form, logo), 'CR ' + (form.title || ''))} className="bg-slate-700 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"><ic.Dl s={12} /> Export PDF</button>
        </div>
      </div>
      {showCrPanel && (
        <div className="p-5 bg-teal-50/60 border-2 border-[#007A78]/20 rounded-xl space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#007A78]" />
            <p className="text-[10px] font-black text-[#007A78] uppercase tracking-widest">Générer un Compte-Rendu de visite de Chantier</p>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Page de garde, tableau de présence P/A/E/C (intervenants du projet), planning Gantt, sections par lot (entreprises), entrées du journal du jour, tâches en cours.</p>
          <div className="flex gap-3 items-end flex-wrap">
            <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Date du CR</label><input type="date" value={jDate} onChange={(e) => setJDate(e.target.value)} className="inp py-1.5 text-[10px] w-32" /></div>
            <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Prochaine réunion</label><input type="date" value={crNextReunion} onChange={(e) => setCrNextReunion(e.target.value)} className="inp py-1.5 text-[10px] w-32" /></div>
            <div className="flex-1" style={{ minWidth: 180 }}><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Présents (noms/sociétés séparés par virgule)</label><input value={jPresents} onChange={(e) => setJPresents(e.target.value)} className="inp py-1.5 text-[10px] w-full" placeholder="Jamet, SODAC, Maraine, Nicolas..." /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => exportWordBlob(genCRChantier(form, logo, jDate, crNextReunion, jPresents), 'CR_Chantier_' + (form.title || '').replace(/\s+/g, '_') + '_' + jDate + '.doc')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm"><ic.FileText s={13} /> Générer Word</button>
            <button type="button" onClick={() => exportPdfHtml(genCRChantier(form, logo, jDate, crNextReunion, jPresents), 'CR Chantier ' + (form.title || ''))} className="bg-slate-700 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm"><ic.Dl s={13} /> Générer PDF</button>
          </div>
        </div>
      )}
      <div className="p-4 bg-[#007A78]/5 border border-[#007A78]/20 rounded-xl space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={jDate} onChange={(e) => setJDate(e.target.value)} className="inp py-1.5 text-[10px] w-32 border-white" />
          <select value={jTag} onChange={(e) => setJTag(e.target.value)} className="inp py-1.5 text-[10px] w-44 border-white">{JOURNAL_TAGS.map((t) => <option key={t}>{t}</option>)}</select>
          <input placeholder="Présents (optionnel)" value={jPresents} onChange={(e) => setJPresents(e.target.value)} className="inp py-1.5 text-[10px] flex-1 border-white" style={{ minWidth: 140 }} />
        </div>
        <textarea rows={3} value={jText} onChange={(e) => setJText(e.target.value)} className="inp text-xs border-white w-full" placeholder="Saisir le compte-rendu, observation, décision..." onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && addEntry()} />
        <div className="flex justify-between items-center">
          <span className="text-[8px] text-slate-400">Ctrl+Entrée pour ajouter rapidement</span>
          <button type="button" onClick={addEntry} className="bg-[#007A78] text-white px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-[#006664] transition-all"><ic.Plus s={14} /> Ajouter l&apos;entrée</button>
        </div>
      </div>
      <div className="space-y-2">
        {journal.length === 0 && <p className="text-center text-xs text-slate-400 py-6 font-bold bg-white/30 rounded-xl border border-dashed border-slate-200">Aucune entrée dans le journal.</p>}
        {journal.map((e) => {
          const tagColors = { 'Réunion de chantier': 'bg-blue-100 text-blue-700', 'Visite': 'bg-teal-100 text-teal-700', 'Problème': 'bg-red-100 text-red-700', 'Décision': 'bg-purple-100 text-purple-700', 'Réception': 'bg-[#007A78]/10 text-[#007A78]', 'Observation': 'bg-amber-100 text-amber-700', 'Information': 'bg-slate-100 text-slate-600' };
          return (
            <div key={e.id} className="bg-white/60 p-4 rounded-xl border border-slate-100 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-700">{fmtDate(e.date)}</span>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${tagColors[e.tag] || 'bg-slate-100 text-slate-600'}`}>{e.tag}</span>
                  {e.presents && <span className="text-[8px] text-slate-400 italic">👥 {e.presents}</span>}
                </div>
                <button type="button" onClick={() => upd({ journal: (form.journal || []).filter((x) => x.id !== e.id) })} className="text-slate-300 hover:text-red-400 transition-colors"><ic.Tr s={13} /></button>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{renderHashtags(e.text, config)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FinancesTab({ form, upd, spent, ratio, fmtAmt }) {
  return (
    <div className="glass p-6 space-y-5">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suivi Engagements</p>
        <div className="text-right">
          <span className="text-[8px] font-black text-slate-300 uppercase block">Total engagé</span>
          <span className={`text-xl font-black ${ratio > 100 ? 'text-[#dd007e]' : 'text-slate-800'}`}>{fmtAmt(spent)}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {(form.expenses || []).map((e) => (
          <div key={e.id} className="grid gap-2 items-center bg-white/50 p-2.5 rounded-xl border border-slate-100" style={{ gridTemplateColumns: '120px 1fr 100px 28px' }}>
            <input type="date" value={e.date} onChange={(ev) => upd({ expenses: (form.expenses || []).map((x) => (x.id === e.id ? { ...x, date: ev.target.value } : x)) })} className="text-[9px] p-1 rounded border" />
            <input type="text" value={e.description} onChange={(ev) => upd({ expenses: (form.expenses || []).map((x) => (x.id === e.id ? { ...x, description: ev.target.value } : x)) })} className="bg-transparent text-xs font-bold" />
            <AmtInput value={e.amount} onChange={(v) => upd({ expenses: (form.expenses || []).map((x) => (x.id === e.id ? { ...x, amount: v } : x)) })} className="text-xs font-black text-right w-full" />
            <button onClick={() => upd({ expenses: (form.expenses || []).filter((x) => x.id !== e.id) })} className="text-slate-300 hover:text-red-400"><ic.Tr s={13} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => upd({ expenses: [...(form.expenses || []), { id: Date.now().toString(), date: today(), amount: '', description: '' }] })} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:bg-white/40"><ic.Plus s={13} /> Ajouter</button>
    </div>
  );
}

function IntervenantsTab({ form, upd, config }) {
  const existIds = new Set((form.intervenants || []).map((i) => (i.nom || '') + '|' + (i.email || '')));
  const importable = (config?.contacts || []).filter((c) => !existIds.has((c.nom || '') + '|' + (c.email || '')));
  const importContact = (c) => upd({ intervenants: [...(form.intervenants || []), { id: Date.now().toString(), role: c.role || '', nom: c.nom || '', email: c.email || '', tel: c.tel || '', entreprise: c.entreprise || '' }] });
  return (
    <div className="glass p-6 space-y-5">
      <div className="flex justify-between flex-wrap gap-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annuaire projet</p>
        <button onClick={() => upd({ intervenants: [...(form.intervenants || []), { id: Date.now().toString(), role: '', nom: '', email: '', tel: '', entreprise: '' }] })} className="bg-[#007A78] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"><ic.Plus s={12} /> Ajouter</button>
      </div>
      {importable.length > 0 && (
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">Importer depuis carnet global</p>
          <div className="flex flex-wrap gap-1.5">
            {importable.map((c) => (
              <button key={c.id} type="button" onClick={() => importContact(c)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 hover:border-[#007A78] hover:bg-teal-50 transition-all text-[9px] font-bold text-slate-600">
                <ic.Addr s={11} c="text-indigo-400" />
                <span className="font-black">{c.entreprise || c.nom}</span>
                {c.nom && c.entreprise && <span className="text-slate-400">— {c.nom}</span>}
                {(c.role && <span className="text-[7px] text-slate-300"> {c.role}</span>)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3">
        {(form.intervenants || []).map((i) => (
          <div key={i.id} className="bg-white/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <select value={i.role} onChange={(e) => upd({ intervenants: (form.intervenants || []).map((x) => (x.id === i.id ? { ...x, role: e.target.value } : x)) })} className="text-[10px] font-black text-slate-600 bg-transparent">
                  <option value="">— Rôle —</option>
                  {ROLES_INTERV.map((r) => <option key={r}>{r}</option>)}
                </select>
                {i.entreprise && <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">🏢 {i.entreprise}</span>}
              </div>
              <button onClick={() => upd({ intervenants: (form.intervenants || []).filter((x) => x.id !== i.id) })} className="text-slate-300 hover:text-red-400"><ic.Tr s={14} /></button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <input className="inp" value={i.entreprise || ''} onChange={(e) => upd({ intervenants: (form.intervenants || []).map((x) => (x.id === i.id ? { ...x, entreprise: e.target.value } : x)) })} placeholder="Entreprise" />
              <input className="inp" value={i.nom} onChange={(e) => upd({ intervenants: (form.intervenants || []).map((x) => (x.id === i.id ? { ...x, nom: e.target.value } : x)) })} placeholder="Nom" />
              <input className="inp" value={i.email} onChange={(e) => upd({ intervenants: (form.intervenants || []).map((x) => (x.id === i.id ? { ...x, email: e.target.value } : x)) })} placeholder="Email" />
              <input className="inp" value={i.tel} onChange={(e) => upd({ intervenants: (form.intervenants || []).map((x) => (x.id === i.id ? { ...x, tel: e.target.value } : x)) })} placeholder="Tél" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RisquesTab({ form, upd }) {
  return (
    <div className="glass p-6 space-y-5">
      <div className="flex justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risques</p>
        <button onClick={() => upd({ risques: [...(form.risques || []), { id: Date.now().toString(), description: '', niveau: 'Moyen', statut: 'Identifié' }] })} className="bg-[#007A78] text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase"><ic.Plus s={12} /> Ajouter</button>
      </div>
      <div className="space-y-3">
        {(form.risques || []).map((r) => (
          <div key={r.id} className="bg-white/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex gap-3">
              <input value={r.description} onChange={(e) => upd({ risques: (form.risques || []).map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)) })} className="inp flex-1" placeholder="Description" />
              <select value={r.niveau} onChange={(e) => upd({ risques: (form.risques || []).map((x) => (x.id === r.id ? { ...x, niveau: e.target.value } : x)) })} className="text-[8px] font-black px-2 py-1 rounded-full border">
                {RISK_NIVEAUX.map((n) => <option key={n}>{n}</option>)}
              </select>
              <button onClick={() => upd({ risques: (form.risques || []).filter((x) => x.id !== r.id) })} className="text-slate-300 hover:text-red-400"><ic.Tr s={14} /></button>
            </div>
          </div>
        ))}
      </div>
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

export default function ProjectForm({ project, onSave, onSilentSave, onCancel, config, initialTab, currentUid, managerAgentLabels }) {
  const readOnly = project && project.ownerId != null && project.ownerId !== (currentUid || 'local');
  const ownerDisplayName = readOnly && project ? (formatAgentDisplayName((managerAgentLabels && project.ownerId && managerAgentLabels[project.ownerId]) || (project.ownerEmail || '')) || 'Un agent') : '';
  const [tab, setTab] = useState(initialTab || 'general');
  const [form, setForm] = useState(() => (project ? { ...BLANK(), ...project } : BLANK()));
  const upd = readOnly ? () => {} : (p) => setForm((f) => ({ ...f, ...p }));
  const spent = (form.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const budget = projBudget(form);
  const ratio = budget > 0 ? (spent / budget) * 100 : 0;
  const [saveStatus, setSaveStatus] = useState('idle');
  const isNew = !project;
  const formRef = useRef(form);
  const savingStartedAtRef = useRef(null);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    if (isNew && !form.title) return;
    if (readOnly) return;
    setSaveStatus('saving');
    savingStartedAtRef.current = Date.now();
    const t = setTimeout(() => {
      if (onSilentSave) onSilentSave(formRef.current);
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
  }, [form, isNew, onSilentSave, readOnly]);
  const [taskFilter, setTaskFilter] = useState('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskOp, setNewTaskOp] = useState({ description: '', assignee: '', tag: '', dueDate: '', dueTime: '', priority: '', status: 'À faire' });
  const [jDate, setJDate] = useState(today());
  const [jTag, setJTag] = useState('Réunion de chantier');
  const [jText, setJText] = useState('');
  const [jPresents, setJPresents] = useState('');
  const [crNextReunion, setCrNextReunion] = useState('');
  const [showCrPanel, setShowCrPanel] = useState(false);
  const todayStr = today();
  const tasks = form.tasks || [];
  const logo = config?.customLogo ?? null;

  return (
    <div className="space-y-6 fi pb-20">
      {readOnly && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <span className="text-lg" title="Consultation uniquement">🔒</span>
          <span className="text-[11px] font-bold">
            Consultation uniquement (Propriété de : {ownerDisplayName})
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
              if (!readOnly && onSilentSave) onSilentSave(formRef.current);
              onCancel();
            }}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-white transition-all"
          >
            ← Retour
          </button>
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
        <TBtn id="journal" label="Journal" Icon={ic.Book} tab={tab} setTab={setTab} />
        <TBtn id="finances" label="Engagements" Icon={ic.Euro} tab={tab} setTab={setTab} />
        <TBtn id="intervenants" label="Intervenants" Icon={ic.Usr} tab={tab} setTab={setTab} />
        <TBtn id="risques" label="Risques" Icon={ic.Risk} tab={tab} setTab={setTab} />
      </div>
      {tab === 'general' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="glass p-6 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Identification</p>
              <div>
                <label className="lbl">Intitulé *</label>
                <input className="inp" value={form.title} onChange={(e) => upd({ title: e.target.value })} placeholder="ex: Rénovation Bâtiment 4" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Site</label>
                  <select className="inp" value={form.location} onChange={(e) => upd({ location: e.target.value, subLocation: '' })}>
                    {LOCATIONS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Bâtiment / Zone</label>
                  <select className="inp" value={form.subLocation} onChange={(e) => upd({ subLocation: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {(SUB_MAP[form.location] || []).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Type de travaux</label>
                  <select className="inp" value={form.typeTravaux} onChange={(e) => upd({ typeTravaux: e.target.value })}>
                    <option value="">— Sélectionner —</option>
                    {TYPES_TRAVAUX.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Phase courante</label>
                  <select className="inp" value={form.phaseActive} onChange={(e) => upd({ phaseActive: e.target.value })}>
                    {PHASES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Date Ordre de Service</label>
                  <input type="date" className="inp" value={form.dateOS || ''} onChange={(e) => upd({ dateOS: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Date livraison prévue</label>
                  <input type="date" className="inp" value={form.dateLivraisonPrev || ''} onChange={(e) => upd({ dateLivraisonPrev: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="lbl">Intensité de suivi</label>
                <select
                  className="inp"
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
              <div>
                <label className="lbl">Notes</label>
                <textarea rows={4} className="inp" value={form.notes} onChange={(e) => upd({ notes: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isGlobalOp"
                  checked={!!form.isGlobalOperation}
                  onChange={(e) => upd({ isGlobalOperation: e.target.checked })}
                  className="rounded border-slate-300 text-[#007A78] focus:ring-[#007A78] w-3.5 h-3.5"
                />
                <label htmlFor="isGlobalOp" className="text-[10px] font-bold text-slate-500">
                  Opération globale — tâches sans projet dédié (non visible dans Suivi Opérations, Ma charge et Vue Manager)
                </label>
              </div>
            </div>
            <div className="glass p-6 flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">Journal de chantier</p>
              <textarea
                className="inp flex-1"
                style={{ minHeight: 300, resize: 'vertical' }}
                value={form.chantierCR}
                onChange={(e) => upd({ chantierCR: e.target.value })}
                placeholder="Comptes-rendus..."
              />
            </div>
          </div>
          <div className="glass p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lots & Budget</p>
              <button
                type="button"
                onClick={() => upd({ lots: [...(form.lots || []), { id: Date.now().toString(), label: `Lot ${(form.lots || []).length + 1}`, entreprise: '', montant: '', pourcentage: '', avancement: 0 }] })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007A78] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#006664] transition-all"
              >
                <ic.Plus s={12} /> Ajouter un lot
              </button>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl border bg-slate-50/50 border-slate-100">
              <ic.Euro s={18} c="text-slate-300" />
              <div className="flex-1">
                <label className="lbl mb-1">Enveloppe globale HT (€)</label>
                <AmtInput value={form.budgetInitial} onChange={(v) => upd({ budgetInitial: v })} className="inp" placeholder="ex: 500 000" />
              </div>
              <div className="space-y-1.5">
                {(form.lots || []).map((l) => (
                  <div key={l.id} className="flex items-center gap-2 bg-white/50 p-2.5 rounded-xl border border-slate-100">
                    <input
                      type="text"
                      value={l.label}
                      onChange={(e) => upd({ lots: (form.lots || []).map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })}
                      className="text-xs font-bold bg-transparent focus:outline-none flex-1"
                    />
                    <input
                      type="text"
                      value={l.entreprise}
                      onChange={(e) => upd({ lots: (form.lots || []).map((x) => (x.id === l.id ? { ...x, entreprise: e.target.value } : x)) })}
                      placeholder="Entreprise"
                      className="text-xs bg-transparent focus:outline-none flex-1"
                    />
                    <AmtInput
                      value={l.montant}
                      onChange={(v) => upd({ lots: (form.lots || []).map((x) => (x.id === l.id ? { ...x, montant: v } : x)) })}
                      className="text-xs font-black text-right bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 w-24"
                    />
                    <button type="button" onClick={() => upd({ lots: (form.lots || []).filter((x) => x.id !== l.id) })} className="text-slate-300 hover:text-red-400">
                      <ic.Tr s={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === 'planning' && <PlanningTab form={form} upd={upd} />}
      {tab === 'tasks' && <TasksTab form={form} upd={upd} tasks={tasks} todayStr={todayStr} config={config} setShowNewTaskModal={setShowNewTaskModal} showNewTaskModal={showNewTaskModal} newTaskOp={newTaskOp} setNewTaskOp={setNewTaskOp} taskFilter={taskFilter} setTaskFilter={setTaskFilter} readOnly={readOnly} />}
      {tab === 'journal' && <JournalTab form={form} upd={upd} config={config} logo={logo} jDate={jDate} setJDate={setJDate} jTag={jTag} setJTag={setJTag} jText={jText} setJText={setJText} jPresents={jPresents} setJPresents={setJPresents} showCrPanel={showCrPanel} setShowCrPanel={setShowCrPanel} crNextReunion={crNextReunion} setCrNextReunion={setCrNextReunion} />}
      {tab === 'finances' && <FinancesTab form={form} upd={upd} spent={spent} ratio={ratio} fmtAmt={fmtAmt} />}
      {tab === 'intervenants' && <IntervenantsTab form={form} upd={upd} config={config} />}
      {tab === 'risques' && <RisquesTab form={form} upd={upd} />}
    </div>
  );
}
