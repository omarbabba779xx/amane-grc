import { api, esc, icon, ago, empty } from "../lib.js";

const pct = (n, t) => (t ? (n / t) * 100 : 0);

export async function render(main) {
  const d = await api("/api/dashboard");
  const c = d.controls, inScope = c.total - c.non_applicable;
  const done = Math.round(pct(c.ok, inScope));
  const now = `${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  const prio = [
    ...d.tests.failing.map((t) => ({ cls: "bad", ic: "alert", title: t.title, sub: t.source === "agent" ? "Test sur les postes · agent Windows" : t.source === "m365" ? "Test Microsoft 365" : "Test du programme", href: "#/tests", cta: "Corriger" })),
    ...(d.incidents?.to_declare ? [{ cls: "bad", ic: "siren", title: `${d.incidents.to_declare} incident${d.incidents.to_declare > 1 ? "s" : ""} à déclarer à la DGSSI`, sub: "Loi 05-20 · déclaration au maCERT", href: "#/incidents", cta: "Ouvrir" }] : []),
    ...(d.access_reviews?.open ? [{ cls: d.access_reviews.overdue ? "bad" : "warn", ic: "key", title: `Revue des accès en cours : ${d.access_reviews.pending} compte${d.access_reviews.pending > 1 ? "s" : ""} à revoir`, sub: d.access_reviews.overdue ? "Échéance dépassée" : "Mesure IAM-05 · ISO 27001 A.5.18", href: "#/revues-acces", cta: "Ouvrir" }] : []),
    ...d.overdue.map((o) => ({ cls: "warn", ic: "clock", title: `${o.code} · ${o.title}`, sub: `Échéance dépassée le ${new Date(o.due_date).toLocaleDateString("fr-FR")}`, href: `#/mesures/${o.id}`, cta: "Ouvrir" })),
  ];

  main.innerHTML = `
    <div class="head"><div><h1>Vue d’ensemble</h1><p>${esc(d.org.name)} · ${esc(now)}</p></div>
      <div class="actions"><a class="btn" href="/api/reports/soa.csv">${icon("download")}Déclaration d’applicabilité</a><a class="btn primary" href="#/rapports">${icon("report")}Rapport d’audit</a></div></div>

    <div class="card split" style="margin-bottom:14px">${d.frameworks.map((f) => {
      const rest = Math.max(0, f.requirements - f.met - f.partial);
      return `<a class="fw" href="#/referentiels/${f.code}">
        <div class="top"><span class="name">${esc(f.short)}</span><span class="code2">${f.requirements} exig.</span></div>
        <div class="score">${f.score}<small>% prêt</small></div>
        <div class="seg" title="${f.met} satisfaites · ${f.partial} en partie · ${rest} à traiter"><i class="s-ok" style="width:${pct(f.met, f.requirements)}%"></i><i class="s-part" style="width:${pct(f.partial, f.requirements)}%"></i></div>
        <div class="meta"><span>${f.met} / ${f.requirements} exigences</span><span>${f.controls_ok} / ${f.controls} mesures</span></div></a>`;
    }).join("")}</div>

    <div class="card kpis" style="margin-bottom:14px">
      <div><div class="k">${icon("list")}Mesures en place</div><div class="v">${c.ok}<small> / ${inScope}</small></div><div class="s">${done} % du périmètre · ${c.en_cours} en cours</div></div>
      <div><div class="k">${icon("pulse")}Tests en échec</div><div class="v" style="${d.tests.echec ? "color:var(--bad)" : ""}">${d.tests.echec}<small> / ${d.tests.total}</small></div><div class="s">${d.tests.ok} réussis, recalculés en continu</div></div>
      <div><div class="k">${icon("risk")}Risques élevés</div><div class="v">${d.risks.high}<small> / ${d.risks.total}</small></div><div class="s">criticité ≥ 15 non traitée</div></div>
      <div><div class="k">${icon("siren")}Incidents ouverts</div><div class="v">${d.incidents?.open ?? 0}</div><div class="s">${d.incidents?.to_declare ? `<span style="color:var(--bad)">${d.incidents.to_declare} à déclarer à la DGSSI</span>` : "aucune déclaration en attente"}</div></div>
    </div>

    <div class="grid g21" style="margin-bottom:14px">
      <div class="card"><div class="card-h"><h3>À traiter en priorité</h3><span class="muted small">${prio.length}</span><a class="more" href="#/tests">Tous les tests</a></div>
        ${prio.length ? `<div class="prio">${prio.slice(0, 6).map((p) => `<div><span class="ico ${p.cls}">${icon(p.ic)}</span><div class="grow"><b>${esc(p.title)}</b><div class="small muted">${esc(p.sub)}</div></div><a class="btn sm" href="${p.href}">${p.cta}</a></div>`).join("")}${prio.length > 6 ? `<div><span class="muted small" style="padding-left:38px">et ${prio.length - 6} autre${prio.length > 7 ? "s" : ""} élément${prio.length > 7 ? "s" : ""} à traiter</span><a class="more small" style="margin-left:auto" href="#/tests">Tout voir</a></div>` : ""}</div>`
          : empty("check", "Rien d’urgent", "Aucun test en échec, aucune échéance dépassée.")}</div>
      <div class="card"><div class="card-h"><h3>Carte des risques</h3><span class="muted small">inhérents</span><a class="more" href="#/risques">Registre</a></div><div class="card-b">${heat(d.risks.matrix)}</div></div>
    </div>

    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Mise en œuvre des mesures</h3><span class="muted small">${c.total} mesures unifiées</span></div><div class="card-b">
        <div class="seg" style="height:10px"><i class="s-ok" style="width:${pct(c.ok, c.total)}%"></i><i class="s-bad" style="width:${pct(c.attention, c.total)}%"></i><i class="s-part" style="width:${pct(c.en_cours, c.total)}%"></i><i class="s-todo" style="width:${pct(c.a_faire, c.total)}%"></i></div>
        <table class="t" style="margin-top:12px"><tbody>
          ${[["s-ok", "En place", c.ok], ["s-bad", "En place, test en échec", c.attention], ["s-part", "En cours", c.en_cours], ["s-todo", "À faire", c.a_faire], ["s-na", "Non applicables", c.non_applicable]].map(([k, l, n]) => `
            <tr><td style="padding-left:0"><span class="seg" style="display:inline-flex;width:10px;height:10px;vertical-align:-1px;margin-right:8px"><i class="${k}" style="width:100%"></i></span>${l}</td>
              <td style="text-align:right" class="muted">${Math.round(pct(n, c.total))} %</td><td style="text-align:right;width:60px;padding-right:0"><b>${n}</b></td></tr>`).join("")}
        </tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Activité récente</h3><a class="more" href="#/parametres">Journal</a></div><div class="card-b">
        ${d.activity.length ? `<div class="feed">${d.activity.slice(0, 9).map((a) => `<div><span><b style="font-weight:550">${esc(a.name || "Système")}</b> <span class="muted">${esc(a.action)}</span></span><span class="small muted">${ago(a.at)}</span></div>`).join("")}</div>` : empty("pulse", "Pas encore d’activité", "")}
      </div></div>
    </div>`;
}

export function heat(risks, residual = false) {
  const cell = (l, i) => risks.filter((r) => (residual && r.residual_likelihood ? r.residual_likelihood : r.likelihood) === l && (residual && r.residual_impact ? r.residual_impact : r.impact) === i).length;
  const color = (s) => (s >= 15 ? "var(--heat-4)" : s >= 8 ? "var(--heat-3)" : s >= 4 ? "var(--heat-2)" : "var(--heat-1)");
  let html = '<div class="heat">';
  for (let l = 5; l >= 1; l--) {
    html += `<div class="ax">${l}</div>`;
    for (let i = 1; i <= 5; i++) { const n = cell(l, i); html += `<div class="c" style="background:${color(l * i)}" title="Vraisemblance ${l} · Impact ${i}">${n || ""}</div>`; }
  }
  html += `<div></div>${[1, 2, 3, 4, 5].map((i) => `<div class="ax">${i}</div>`).join("")}</div>
    <div class="small muted" style="display:flex;justify-content:space-between;margin-top:8px"><span>↑ vraisemblance</span><span>impact →</span></div>`;
  return html;
}
