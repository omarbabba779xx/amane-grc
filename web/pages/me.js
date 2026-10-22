import { api, esc, icon, toast, date, ago } from "../lib.js";
import { CHECKS, agentCommand } from "./devices.js";
import { decisionButtons, wireDecisions } from "./access-reviews.js";

export async function render(main, ctx) {
  const t = await api("/api/me/tasks");
  const pending = t.policies.filter((p) => !p.accepted);
  const trained = t.training_at && Date.now() - new Date(t.training_at) < 365 * 864e5;
  const reviews = t.access_reviews || [];
  const total = t.policies.length + 2, done = t.policies.length - pending.length + (trained ? 1 : 0) + (t.devices.length ? 1 : 0);
  main.innerHTML = `<div class="head"><div><h1>Mon espace</h1><p>Vos tâches de sécurité : ${done} sur ${total} terminées.</p></div></div>
    <div class="bar ok" style="margin-bottom:18px;height:10px"><i style="width:${(done / total) * 100}%"></i></div>
    ${reviews.length ? `<div class="card" style="margin-bottom:16px" id="reviews"><div class="card-h"><h3>${icon("key")}Revue des accès · ${esc(reviews[0].title)}</h3>
        <span class="muted small">${reviews.length} compte${reviews.length > 1 ? "s" : ""} à revoir${reviews[0].due_date ? ` avant le ${date(reviews[0].due_date)}` : ""}</span><a class="more" href="#/revues-acces/${reviews[0].review_id}">Tout voir</a></div>
      <div class="table-wrap"><table class="t"><tbody>${reviews.map((i) => `<tr><td class="title"><b>${esc(i.name || i.upn)}</b><span class="small muted">${esc(i.upn || "")}${i.enabled ? "" : " · compte désactivé"}</span></td>
        <td>${i.admin_roles.map((r) => `<span class="tag">${esc(r)}</span>`).join("")}</td><td>${i.mfa == null ? "" : i.mfa ? '<span class="pill ok">MFA</span>' : '<span class="pill bad">Sans MFA</span>'}</td>
        <td style="text-align:right">${decisionButtons(i)}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Politiques à accepter</h3></div><div class="card-b" style="padding:6px 6px 10px">
        ${t.policies.length ? t.policies.map((p) => `<a class="task ${p.accepted ? "done" : ""}" href="#/politiques/${p.id}" style="color:inherit;text-decoration:none">
          <div class="ic">${icon(p.accepted ? "check" : "doc")}</div><div style="flex:1"><b>${esc(p.title)}</b><div class="small muted">${esc(p.summary || "")}</div></div>
          ${p.accepted ? '<span class="pill ok">Acceptée</span>' : '<span class="btn sm primary">Lire et accepter</span>'}</a>`).join("") : '<div class="muted small" style="padding:12px">Aucune politique publiée pour l’instant.</div>'}
      </div></div>
      <div>
        <div class="card" style="margin-bottom:16px"><div class="task ${trained ? "done" : ""}"><div class="ic">${icon(trained ? "check" : "book")}</div>
          <div style="flex:1"><b>Formation de sensibilisation</b><div class="small muted">${trained ? `Suivie le ${date(t.training_at)}` : "À suivre chaque année : contactez votre responsable sécurité."}</div></div></div></div>
        <div class="card"><div class="card-h"><h3>Mon ordinateur</h3></div><div class="card-b">
          ${t.devices.length ? t.devices.map((d) => `<div style="margin-bottom:12px"><b>${esc(d.hostname)}</b> <span class="small muted">${esc(d.os || "")} · ${ago(d.last_seen)}</span>
            <div class="list" style="margin-top:8px">${CHECKS.map(([k, l]) => `<div><div class="grow small"><b>${l}</b> <span class="muted">${esc(d.results[k]?.info || "")}</span></div>
              <span class="pill ${d.results[k]?.status === "ok" ? "ok" : d.results[k]?.status === "echec" ? "bad" : "warn"}">${d.results[k]?.status === "ok" ? "OK" : d.results[k]?.status === "echec" ? "À corriger" : "?"}</span></div>`).join("")}</div></div>`).join("")
            : '<p class="small" style="margin-top:0">Installez l’agent Amane : ouvrez <b>PowerShell</b> (pas besoin d’être administrateur) et collez cette commande.</p>'}
          <pre class="cmd" id="cmd">${esc(agentCommand(t.agent_url))}</pre>
          <button class="btn sm" id="copy">Copier la commande</button>
        </div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px;max-width:560px"><div class="card-h"><h3>Changer mon mot de passe</h3></div><div class="card-b">
      <form class="form" id="pw"><div class="field"><label>Mot de passe actuel</label><input type="password" name="current" autocomplete="current-password" required></div>
      <div class="field"><label>Nouveau mot de passe (12 caractères minimum)</label><input type="password" name="password" minlength="12" autocomplete="new-password" required></div>
      <div class="err" id="err"></div><div><button class="btn primary">Mettre à jour</button></div></form></div></div>`;
  if (reviews.length) wireDecisions(document.getElementById("reviews"), () => ctx.refresh());
  document.getElementById("copy").onclick = async () => { await navigator.clipboard.writeText(document.getElementById("cmd").textContent); toast("Commande copiée"); };
  document.getElementById("pw").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api("/api/me/password", { method: "POST", body: f }); e.target.reset(); toast("Mot de passe mis à jour"); document.getElementById("err").textContent = ""; }
    catch (err) { document.getElementById("err").textContent = err.message; }
  };
}
