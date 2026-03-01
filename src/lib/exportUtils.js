import { fmtDate, fmtAmt, projBudget, today } from './utils';

export function exportWordBlob(html, filename) {
  const pre =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>@page{size:A4;margin:2cm}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#333;line-height:1.5}h1{font-size:22pt;color:#007A78;border-bottom:3px solid #007A78;padding-bottom:8pt;margin-top:20pt}h2{font-size:14pt;color:#006664;border-bottom:1px solid #ccc;padding-bottom:4pt;margin-top:16pt}h3{font-size:12pt;color:#333;margin-top:12pt}table{border-collapse:collapse;width:100%;margin:8pt 0}td,th{border:1px solid #ccc;padding:5pt 8pt;font-size:10pt;text-align:left}th{background:#f0f7f0;font-weight:bold;color:#006664}.cover{page-break-after:always;text-align:center;padding-top:150pt}.cover h1{font-size:28pt;border:none;text-align:center}.cover p{font-size:13pt;color:#666}.badge{display:inline-block;padding:2pt 8pt;border-radius:4pt;font-size:9pt;font-weight:bold}.bg-red{background:#fee2e2;color:#dc2626}.bg-green{background:#d1fae5;color:#059669}.bg-amber{background:#fef3c7;color:#d97706}.bg-blue{background:#dbeafe;color:#2563eb}.section{margin-bottom:16pt}</style></head><body>';
  const post = '</body></html>';
  const blob = new Blob([pre + html + post], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportPdfHtml(html, title) {
  const w = window.open('', '_blank');
  w.document.write(
    '<html><head><title>' +
      title +
      '</title><style>@page{size:A4;margin:1.5cm}@media print{.no-print{display:none}}body{font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#333;line-height:1.4}h1{font-size:18pt;color:#007A78;border-bottom:2px solid #007A78;padding-bottom:6pt}h2{font-size:13pt;color:#006664;border-bottom:1px solid #ddd;padding-bottom:3pt}table{border-collapse:collapse;width:100%;margin:6pt 0;page-break-inside:avoid}td,th{border:1px solid #ccc;padding:4pt 6pt;font-size:9pt}th{background:#f0f7f0;font-weight:bold}.cover{page-break-after:always;text-align:center;padding-top:120pt}.cover h1{font-size:24pt;border:none}.badge{display:inline-block;padding:2pt 6pt;border-radius:3pt;font-size:8pt;font-weight:bold}.bg-red{background:#fee2e2;color:#dc2626}.bg-green{background:#d1fae5;color:#059669}.bg-amber{background:#fef3c7;color:#d97706}.bg-blue{background:#dbeafe;color:#2563eb}</style></head><body>' +
      html +
      '<script>setTimeout(()=>window.print(),400)<\/script></body></html>'
  );
  w.document.close();
}

export function genCoverPage(p, subtitle, logo) {
  const d = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<div class="cover">${logo ? `<img src="${logo}" style="max-width:200pt;margin-bottom:30pt"/><br/>` : '<div style="font-size:36pt;color:#007A78;font-weight:bold;margin-bottom:20pt">DITAM</div>'}<h1>${p.title || 'Opération sans titre'}</h1><p style="font-size:14pt;margin-top:12pt"><strong>${p.location || ''}${p.subLocation ? ' — ' + p.subLocation : ''}</strong></p><p>${p.typeTravaux || ''} — Phase : ${p.phaseActive || 'N/A'}</p><p style="margin-top:20pt;font-size:11pt;color:#888">${subtitle}</p><p style="margin-top:40pt;font-size:12pt">${d}</p></div>`;
}

export function genProjectRecap(p, logo) {
  const budget = projBudget(p);
  const spent = (p.expenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const ratio = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const todayStr = today();
  let html = genCoverPage(p, 'Fiche récapitulative du projet', logo);
  html += '<h1>Fiche projet : ' + (p.title || '') + '</h1>';
  html += '<h2>Informations générales</h2><table><tr><th>Champ</th><th>Valeur</th></tr>';
  html += `<tr><td>Site</td><td>${p.location || ''}${p.subLocation ? ' — ' + p.subLocation : ''}</td></tr>`;
  html += `<tr><td>Type de travaux</td><td>${p.typeTravaux || 'N/A'}</td></tr>`;
  html += `<tr><td>Phase courante</td><td><strong>${p.phaseActive || 'N/A'}</strong></td></tr>`;
  html += `<tr><td>Date OS</td><td>${p.dateOS ? fmtDate(p.dateOS) : '—'}</td></tr>`;
  html += `<tr><td>Livraison prévue</td><td>${p.dateLivraisonPrev ? fmtDate(p.dateLivraisonPrev) : '—'}</td></tr>`;
  html += `<tr><td>Avancement physique</td><td>${p.avancementPhysique || '0'}%</td></tr></table>`;
  html += '<h2>Planning</h2><table><tr><th>Tâche</th><th>Début prévu</th><th>Fin prévue</th><th>Début réel</th><th>Fin réelle</th><th>Statut</th></tr>';
  (p.timelineTasks || []).forEach((t) => {
    const st = t.done ? '✅ Terminé' : t.actualStart ? (t.planEnd && t.planEnd < todayStr ? '⚠️ En retard' : '🔄 En cours') : '⏳ Non démarré';
    html += `<tr><td>${t.label}</td><td>${t.planStart ? fmtDate(t.planStart) : '—'}</td><td>${t.planEnd ? fmtDate(t.planEnd) : '—'}</td><td>${t.actualStart ? fmtDate(t.actualStart) : '—'}</td><td>${t.actualEnd ? fmtDate(t.actualEnd) : '—'}</td><td>${st}</td></tr>`;
  });
  html += '</table>';
  html += '<h2>Budget & Engagements</h2><table><tr><th>Budget total</th><th>Total engagé</th><th>Taux</th><th>Reste</th></tr>';
  html += `<tr><td>${fmtAmt(budget)}</td><td>${fmtAmt(spent)}</td><td><strong>${ratio}%</strong>${ratio > 100 ? ' <span class="badge bg-red">DÉPASSEMENT</span>' : ''}</td><td>${fmtAmt(budget - spent)}</td></tr></table>`;
  if ((p.lots || []).length > 0) {
    html += '<table><tr><th>Lot</th><th>Entreprise</th><th>Montant HT</th></tr>';
    p.lots.forEach((l) => {
      html += `<tr><td>${l.label}</td><td>${l.entreprise || '—'}</td><td>${fmtAmt(parseFloat(l.montant) || 0)}</td></tr>`;
    });
    html += '</table>';
  }
  const tasks = (p.tasks || []).filter((t) => !t.done);
  if (tasks.length > 0) {
    html += '<h2>Tâches en cours (' + tasks.length + ')</h2><table><tr><th>Description</th><th>Responsable</th><th>Statut</th><th>Échéance</th><th>Urgent</th></tr>';
    tasks.forEach((t) => {
      const isLate = t.dueDate && t.dueDate < todayStr;
      html += `<tr><td>${t.description}</td><td>${t.assignee || '—'}</td><td>${t.status || 'À faire'}</td><td>${t.dueDate ? fmtDate(t.dueDate) + (t.dueTime ? ' ' + t.dueTime : '') : '—'}${isLate ? ' <span class="badge bg-red">RETARD</span>' : ''}</td><td>${t.urgent ? '🔥 OUI' : '—'}</td></tr>`;
    });
    html += '</table>';
  }
  if ((p.risques || []).length > 0) {
    html += '<h2>Risques identifiés</h2><table><tr><th>Description</th><th>Niveau</th></tr>';
    p.risques.forEach((r) => {
      const col = r.niveau === 'Critique' || r.niveau === 'Élevé' ? 'bg-red' : r.niveau === 'Moyen' ? 'bg-amber' : 'bg-green';
      html += `<tr><td>${r.description}</td><td><span class="badge ${col}">${r.niveau}</span></td></tr>`;
    });
    html += '</table>';
  }
  if ((p.intervenants || []).length > 0) {
    html += '<h2>Intervenants</h2><table><tr><th>Entreprise</th><th>Rôle</th><th>Nom</th><th>Email</th><th>Tél</th></tr>';
    p.intervenants.forEach((i) => {
      html += `<tr><td>${i.entreprise || ''}</td><td>${i.role || ''}</td><td>${i.nom || ''}</td><td>${i.email || ''}</td><td>${i.tel || ''}</td></tr>`;
    });
    html += '</table>';
  }
  if (p.notes) {
    html += '<h2>Notes</h2><p>' + p.notes.replace(/\n/g, '<br/>') + '</p>';
  }
  return html;
}

export function genAllProjectsRecap(projects, logo) {
  const active = (projects || []).filter((p) => p.status === 'active');
  const todayStr = today();
  const d = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  let html = `<div class="cover">${logo ? `<img src="${logo}" style="max-width:200pt;margin-bottom:30pt"/><br/>` : '<div style="font-size:36pt;color:#007A78;font-weight:bold;margin-bottom:20pt">DITAM</div>'}<h1>Tableau de bord des opérations</h1><p style="font-size:14pt;margin-top:12pt"><strong>${active.length} projet${active.length > 1 ? 's' : ''} actif${active.length > 1 ? 's' : ''}</strong></p><p style="margin-top:40pt;font-size:12pt">${d}</p></div>`;
  const totalBudget = active.reduce((s, p) => s + projBudget(p), 0);
  const totalSpent = active.reduce((s, p) => s + (p.expenses || []).reduce((es, e) => es + (parseFloat(e.amount) || 0), 0), 0);
  html += '<h1>Synthèse générale</h1>';
  html += '<table><tr><th>Indicateur</th><th>Valeur</th></tr>';
  html += `<tr><td>Projets actifs</td><td><strong>${active.length}</strong></td></tr>`;
  html += `<tr><td>Budget total</td><td>${fmtAmt(totalBudget)}</td></tr>`;
  html += `<tr><td>Total engagé</td><td>${fmtAmt(totalSpent)} (${totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%)</td></tr></table>`;
  html += "<h1>Vue d'ensemble des opérations</h1>";
  html += '<table><tr><th>Opération</th><th>Site</th><th>Phase</th><th>Budget</th><th>Engagé</th><th>Taux</th><th>Tâches</th></tr>';
  active.forEach((p) => {
    const b = projBudget(p);
    const s = (p.expenses || []).reduce((s2, e) => s2 + (parseFloat(e.amount) || 0), 0);
    const r = b > 0 ? Math.round((s / b) * 100) : 0;
    const tt = (p.tasks || []).length;
    const td = (p.tasks || []).filter((t) => t.done).length;
    const ratioCol = r > 100 ? 'bg-red' : r > 75 ? 'bg-amber' : 'bg-green';
    html += `<tr><td><strong>${p.title}</strong></td><td>${p.location || ''}</td><td>${p.phaseActive || '—'}</td><td>${fmtAmt(b)}</td><td>${fmtAmt(s)}</td><td><span class="badge ${ratioCol}">${r}%</span></td><td>${td}/${tt}</td></tr>`;
  });
  html += '</table>';
  active.forEach((p) => {
    const b = projBudget(p);
    const s = (p.expenses || []).reduce((s2, e) => s2 + (parseFloat(e.amount) || 0), 0);
    const r = b > 0 ? Math.round((s / b) * 100) : 0;
    const pendingTasks = (p.tasks || []).filter((t) => !t.done && t.status !== 'Terminé');
    const lateTasks = pendingTasks.filter((t) => t.dueDate && t.dueDate < todayStr);
    const lateGantt = (p.timelineTasks || []).filter((t) => t.planEnd && t.planEnd < todayStr && !t.done && t.actualStart);
    const risks = (p.risques || []).filter((r2) => r2.niveau === 'Critique' || r2.niveau === 'Élevé');
    const hasCritical = lateTasks.length > 0 || lateGantt.length > 0 || r > 100 || risks.length > 0;
    html += `<h2>${p.title || 'Sans titre'}${hasCritical ? ' ⚠️' : ''}</h2>`;
    html += `<p><strong>Site :</strong> ${p.location || ''} | <strong>Phase :</strong> ${p.phaseActive || '—'} | <strong>Budget :</strong> ${fmtAmt(b)} | <strong>Engagé :</strong> ${fmtAmt(s)} (${r}%)</p>`;
    if (hasCritical) {
      html += '<p style="color:#dc2626;font-weight:bold">Points critiques :</p><ul>';
      if (r > 100) html += `<li>Dépassement budgétaire de ${r - 100}%</li>`;
      if (lateGantt.length > 0) html += `<li>Planning : ${lateGantt.map((t) => t.label).join(', ')} en retard</li>`;
      if (lateTasks.length > 0) html += `<li>${lateTasks.length} tâche(s) en retard : ${lateTasks.slice(0, 3).map((t) => t.description).join(', ')}${lateTasks.length > 3 ? '...' : ''}</li>`;
      if (risks.length > 0) html += `<li>Risques : ${risks.map((r2) => r2.description).join(', ')}</li>`;
      html += '</ul>';
    }
    if (pendingTasks.length > 0) {
      html += `<p><strong>Tâches en cours (${pendingTasks.length}) :</strong></p><table><tr><th>Description</th><th>Resp.</th><th>Statut</th><th>Échéance</th></tr>`;
      pendingTasks.slice(0, 8).forEach((t) => {
        const isLate = t.dueDate && t.dueDate < todayStr;
        html += `<tr><td>${t.urgent ? '🔥 ' : ''}${t.description}</td><td>${t.assignee || '—'}</td><td>${t.status || 'À faire'}</td><td>${t.dueDate ? fmtDate(t.dueDate) : '—'}${isLate ? ' <span class="badge bg-red">RETARD</span>' : ''}</td></tr>`;
      });
      if (pendingTasks.length > 8) html += `<tr><td colspan="4"><em>... et ${pendingTasks.length - 8} autres</em></td></tr>`;
      html += '</table>';
    }
  });
  return html;
}
