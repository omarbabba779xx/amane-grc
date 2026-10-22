import { api, esc, icon, HEALTH, TEST, pill, date } from "../lib.js";

export async function render(main) {
  const [d, controls, tests, risks, log] = await Promise.all([api("/api/dashboard"), api("/api/controls"), api("/api/tests"), api("/api/risks"), api("/api/audit/verify")]);
  const exp = (href, title, text) => `<a class="card task" href="${href}" style="color:inherit;text-decoration:none"><div class="ic">${icon("download")}</div><div><b>${title}</b><div class="small muted">${text}</div></div></a>`;
  const byDomain = {};
  controls.forEach((c) => (byDomain[c.domain] ??= []).push(c));
  main.innerHTML = `<div class="head"><div><h1>Rapports</h1><p>Exports pour l’auditeur et rapport de préparation imprimable.</p></div>
      <div class="actions"><button class="btn primary" id="print">${icon("report")}Imprimer le rapport / PDF</button></div></div>
    <div class="grid g4">
      ${exp("/api/reports/soa.csv", "Déclaration d’applicabilité", "93 mesures de l’Annexe A, justification et état")}
      ${exp("/api/reports/risques.csv", "Registre des risques", "Appréciation, traitement et risque résiduel")}
      ${exp("/api/reports/traitements.csv", "Registre 09-08", "Traitements, bases légales et statut CNDP")}
      ${exp("/api/reports/fournisseurs.csv", "Fournisseurs", "Criticité, clauses et revues")}
      ${exp("/api/reports/journal.csv", "Journal d’activité", `${log.entries} entrées chaînées, avec leurs empreintes`)}
    </div>

    <div class="card card-b" style="margin-top:18px" id="report">
      <h2 style="font-size:20px">Rapport de préparation à l’audit · ${esc(d.org.name)}</h2>
      <p class="muted">Généré le ${date(new Date().toISOString())} par Amane GRC.</p>
      <p class="small" style="margin:-6px 0 16px">Journal d’activité : <b>${log.ok ? "intègre" : "altération détectée"}</b> · ${log.entries} entrées vérifiées${log.head ? ` · empreinte de la chaîne <span class="code">${esc(log.head.hash)}</span>` : ""}</p>
      <table class="t" style="margin:10px 0 22px"><thead><tr><th>Référentiel</th><th>Score</th><th>Exigences satisfaites</th><th>Mesures en place</th></tr></thead><tbody>
        ${d.frameworks.map((f) => `<tr><td><b>${esc(f.name)}</b></td><td><b>${f.score} %</b></td><td>${f.met} / ${f.requirements}${f.partial ? ` (${f.partial} en partie)` : ""}</td><td>${f.controls_ok} / ${f.controls}</td></tr>`).join("")}
      </tbody></table>
      <h3 style="font-size:16px;margin:8px 0">Tests automatisés</h3>
      <table class="t" style="margin-bottom:22px"><tbody>${tests.map((t) => `<tr><td>${esc(t.title)}</td><td style="width:130px">${pill(TEST, t.status)}</td></tr>`).join("")}</tbody></table>
      <h3 style="font-size:16px;margin:8px 0">Risques prioritaires</h3>
      <table class="t" style="margin-bottom:22px"><thead><tr><th>Risque</th><th>Criticité</th><th>Traitement</th><th>Statut</th></tr></thead><tbody>
        ${risks.sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact).slice(0, 10).map((r) => `<tr><td>${esc(r.title)}</td><td>${r.likelihood * r.impact}</td><td>${esc(r.treatment)}</td><td>${esc(r.status)}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">Registre vide</td></tr>'}
      </tbody></table>
      <h3 style="font-size:16px;margin:8px 0">Mesures par domaine</h3>
      ${Object.entries(byDomain).map(([dom, cs]) => `<h4 style="margin:14px 0 6px">${esc(dom)}</h4><table class="t"><tbody>${cs.map((c) => `<tr><td style="width:80px" class="code">${esc(c.code)}</td><td>${esc(c.title)}</td><td style="width:60px" class="small">${c.evidence_count} preuve${c.evidence_count > 1 ? "s" : ""}</td><td style="width:150px">${pill(HEALTH, c.health)}</td></tr>`).join("")}</tbody></table>`).join("")}
    </div>`;
  document.getElementById("print").onclick = () => window.print();
}
