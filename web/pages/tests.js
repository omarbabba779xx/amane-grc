import { api, esc, icon, pill, TEST, toast, fail, ago } from "../lib.js";

export async function render(main, ctx) {
  const tests = await api("/api/tests");
  const ok = tests.filter((t) => t.status === "ok").length, bad = tests.filter((t) => t.status === "echec").length;
  const group = (source, title, sub) => {
    const ts = tests.filter((t) => t.source === source);
    return `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${title}</h3><span class="muted small">${sub}</span></div>
      <div class="card-b"><div class="list">${ts.map((t) => `<div style="align-items:flex-start">
        <div style="padding-top:2px">${pill(TEST, t.status)}</div>
        <div class="grow"><b>${esc(t.title)}</b><div class="small muted">${esc(t.description)}</div>
          ${detail(t)}
          ${t.status === "echec" ? `<div class="small" style="margin-top:6px"><b>Correction :</b> ${esc(t.remediation)}</div>` : ""}
          <div style="margin-top:6px">${t.controls.map((c) => `<a class="tag" href="#/mesures/${c.id}" title="${esc(c.title)}">${esc(c.code)}</a>`).join("")}</div></div>
        <span class="small muted" style="white-space:nowrap">${ago(t.last_run)}</span></div>`).join("")}</div></div></div>`;
  };
  main.innerHTML = `<div class="head"><div><h1>Tests automatisés</h1><p>Surveillance continue : ${ok} réussi${ok > 1 ? "s" : ""}, ${bad} en échec sur ${tests.length}. Les tests sont recalculés à chaque changement et toutes les 15 minutes.</p></div>
      <div class="actions">${ctx.user.role === "admin" ? `<button class="btn" id="run">${icon("refresh")}Relancer les tests</button>` : ""}<a class="btn primary" href="#/appareils">${icon("laptop")}Agent Windows</a></div></div>
    ${group("agent", "Postes de travail", "vérifiés par l’agent Amane sur chaque ordinateur")}
    ${group("platform", "Programme de conformité", "calculés à partir des données d’Amane")}`;
  document.getElementById("run")?.addEventListener("click", async () => {
    try { await api("/api/tests/run", { method: "POST" }); toast("Tests relancés"); ctx.refresh(); } catch (e) { fail(e); }
  });
}

function detail(t) {
  const d = t.details || {};
  if (d.message) return `<div class="small" style="margin-top:4px;color:${t.status === "echec" ? "var(--bad)" : "var(--fg-2)"}">${esc(d.message)}</div>`;
  if (d.failing?.length) {
    const shown = d.failing.slice(0, 6);
    return `<div class="small" style="margin-top:4px;color:var(--bad)">${d.failing.length} sur ${d.total} en échec : ${shown.map((f) => `<b>${esc(f.name)}</b>${f.info ? ` (${esc(f.info)})` : ""}`).join(", ")}${d.failing.length > 6 ? "…" : ""}</div>`;
  }
  if (d.total) return `<div class="small muted" style="margin-top:4px">${d.total} élément${d.total > 1 ? "s" : ""} vérifié${d.total > 1 ? "s" : ""}${d.unknown?.length ? `, ${d.unknown.length} sans résultat` : ""}.</div>`;
  return "";
}
