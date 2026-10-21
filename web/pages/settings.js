import { api, esc, icon, toast, fail, options, datetime, confirmBox } from "../lib.js";
import { readForm } from "./register.js";

export async function render(main, ctx) {
  const [org, users, log] = await Promise.all([api("/api/org"), api("/api/users"), api("/api/activity")]);
  main.innerHTML = `<div class="head"><div><h1>Paramètres</h1><p>Organisme, agent Windows et journal d’activité.</p></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Organisme</h3></div><div class="card-b"><div class="form cols" id="org">
        <div class="field full"><label>Nom</label><input name="name" value="${esc(org.name)}"></div>
        <div class="field"><label>Secteur</label><input name="sector" value="${esc(org.sector || "")}"></div>
        <div class="field"><label>Effectif</label><input name="size" value="${esc(org.size || "")}"></div>
        <div class="field"><label>Ville</label><input name="city" value="${esc(org.city || "")}"></div>
        <div class="field"><label>RSSI</label><select name="rssi_user_id" data-num>${options(users.filter((u) => u.active).map((u) => [u.id, u.name]), org.rssi_user_id)}</select></div>
        <div class="full"><button class="btn primary" id="saveOrg">Enregistrer</button></div></div></div></div>
      <div class="card"><div class="card-h"><h3>Agent Windows</h3></div><div class="card-b">
        <p class="small" style="margin-top:0">Le jeton authentifie les rapports envoyés par les agents. Renouvelez-le s’il a été divulgué : les postes devront réinstaller l’agent.</p>
        <pre class="cmd">${esc(org.agent_token)}</pre>
        <button class="btn danger" id="rotate">${icon("refresh")}Renouveler le jeton</button></div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Journal d’activité</h3><span class="muted small">300 derniers événements, conservés pour l’audit</span></div>
      <div class="table-wrap" style="max-height:480px;overflow:auto"><table class="t" style="margin-top:10px"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th></tr></thead><tbody>
      ${log.map((a) => `<tr><td class="small" style="white-space:nowrap">${datetime(a.at)}</td><td class="small">${esc(a.name || "Système")}</td><td>${esc(a.action)}</td><td class="small muted">${esc([a.entity, a.entity_id].filter(Boolean).join(" #"))}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  document.getElementById("saveOrg").onclick = async () => {
    try { await api("/api/org", { method: "PATCH", body: readForm(document.getElementById("org")) }); toast("Organisme enregistré"); } catch (e) { fail(e); }
  };
  document.getElementById("rotate").onclick = async () => {
    if (!(await confirmBox("Renouveler le jeton ?", "Les agents déjà installés cesseront de remonter des résultats jusqu’à leur réinstallation.", "Renouveler", true))) return;
    try { await api("/api/org/rotate-token", { method: "POST" }); toast("Jeton renouvelé"); ctx.refresh(); } catch (e) { fail(e); }
  };
}
