import { api, esc, ring, icon, ago, empty } from "../lib.js";

export async function render(main) {
  const d = await api("/api/dashboard");
  const c = d.controls, inScope = c.total - c.non_applicable;
  const done = inScope ? Math.round((c.ok / inScope) * 100) : 0;
  main.innerHTML = `
    <div class="head"><div><h1>Bonjour 👋</h1><p>État du programme de conformité de <b>${esc(d.org.name)}</b>.</p></div>
      <div class="actions"><a class="btn" href="/api/reports/soa.csv">${icon("download")}Déclaration d’applicabilité</a><a class="btn primary" href="#/mesures">${icon("list")}Voir les mesures</a></div></div>

    <div class="grid g3">${d.frameworks.map((f) => `
      <a class="card fw-card" href="#/referentiels/${f.code}" style="color:inherit;text-decoration:none">
        ${ring(f.score, "prêt")}
        <div><h3>${esc(f.short)}</h3><p>${f.met} exigence${f.met > 1 ? "s" : ""} satisfaite${f.met > 1 ? "s" : ""} sur ${f.requirements}${f.partial ? ` · ${f.partial} en partie` : ""}</p>
          <div class="small muted">${f.controls_ok} / ${f.controls} mesures en place</div></div></a>`).join("")}</div>

    <div class="grid g4" style="margin-top:16px">
      ${stat("Mesures en place", `${c.ok}<span class="muted" style="font-size:16px"> / ${inScope}</span>`, `${done} % du périmètre`)}
      ${stat("Tests en échec", d.tests.echec, `${d.tests.ok} réussis sur ${d.tests.total}`, d.tests.echec ? "var(--bad)" : "var(--ok)")}
      ${stat("Risques élevés", d.risks.high, `${d.risks.total} risque${d.risks.total > 1 ? "s" : ""} au registre`, d.risks.high ? "var(--warn)" : "")}
      ${stat("Couverture", `${d.people} <span class="muted" style="font-size:16px">pers.</span>`, `${d.devices} appareil${d.devices > 1 ? "s" : ""} · ${d.processing} traitement${d.processing > 1 ? "s" : ""} 09-08`)}
    </div>

    <div class="grid g21" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>À traiter en priorité</h3><a class="more" href="#/tests">Tous les tests</a></div><div class="card-b">
        ${d.tests.failing.length || d.overdue.length ? `<div class="list">
          ${d.tests.failing.map((t) => `<div><span class="pill bad">Test</span><div class="grow"><b>${esc(t.title)}</b><div class="small muted">${t.source === "agent" ? "Vérifié sur les postes par l’agent" : "Calculé à partir des données Amane"}</div></div><a class="btn sm" href="#/tests">Corriger</a></div>`).join("")}
          ${d.overdue.map((o) => `<div><span class="pill warn">Échéance</span><div class="grow"><b>${esc(o.code)} · ${esc(o.title)}</b><div class="small muted">prévue le ${esc(o.due_date)}</div></div><a class="btn sm" href="#/mesures/${o.id}">Ouvrir</a></div>`).join("")}
        </div>` : empty("check", "Rien d’urgent", "Aucun test en échec et aucune échéance dépassée.")}
      </div></div>
      <div class="card"><div class="card-h"><h3>Carte des risques</h3><a class="more" href="#/risques">Registre</a></div><div class="card-b">${heat(d.risks.matrix)}</div></div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>Avancement des mesures</h3></div><div class="card-b">
        ${[["En place", c.ok, "ok"], ["Test en échec", c.attention, ""], ["En cours", c.en_cours, ""], ["À faire", c.a_faire, ""], ["Non applicables", c.non_applicable, ""]].map(([l, n, cls]) => `
          <div style="display:grid;grid-template-columns:130px 1fr 40px;gap:10px;align-items:center;margin:8px 0">
            <span class="small">${l}</span><div class="bar ${cls}"><i style="width:${c.total ? (n / c.total) * 100 : 0}%"></i></div><b style="text-align:right">${n}</b></div>`).join("")}
      </div></div>
      <div class="card"><div class="card-h"><h3>Activité récente</h3></div><div class="card-b">
        ${d.activity.length ? `<div class="list">${d.activity.map((a) => `<div><div class="grow"><b>${esc(a.name || "Système")}</b> <span class="muted">${esc(a.action)}</span></div><span class="small muted">${ago(a.at)}</span></div>`).join("")}</div>` : empty("pulse", "Pas encore d’activité", "")}
      </div></div>
    </div>`;
}

const stat = (k, v, s, color = "") => `<div class="card stat"><div class="k">${k}</div><div class="v" style="${color ? `color:${color}` : ""}">${v}</div><div class="s">${s}</div></div>`;

export function heat(risks, residual = false) {
  const cell = (l, i) => risks.filter((r) => (residual && r.residual_likelihood ? r.residual_likelihood : r.likelihood) === l && (residual && r.residual_impact ? r.residual_impact : r.impact) === i).length;
  const color = (s) => (s >= 15 ? "#ffb3ba" : s >= 8 ? "#ffd89a" : s >= 4 ? "#fff0b8" : "#d5f2e3");
  let html = '<div class="heat">';
  for (let l = 5; l >= 1; l--) {
    html += `<div class="ax">${l}</div>`;
    for (let i = 1; i <= 5; i++) { const n = cell(l, i); html += `<div class="c" style="background:${color(l * i)}" title="Vraisemblance ${l} · Impact ${i}">${n || ""}</div>`; }
  }
  html += `<div></div>${[1, 2, 3, 4, 5].map((i) => `<div class="ax">${i}</div>`).join("")}</div>
    <div class="small muted" style="display:flex;justify-content:space-between;margin-top:6px"><span>↑ Vraisemblance</span><span>Impact →</span></div>`;
  return html;
}
