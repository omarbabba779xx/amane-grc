import { api, esc, icon, drawer, toast, fail, ago, confirmBox, empty } from "../lib.js";

export const CHECKS = [
  ["T-DISK", "Chiffrement"], ["T-AV", "Antivirus"], ["T-FW", "Pare-feu"], ["T-UPD", "Mises à jour"],
  ["T-LOCK", "Verrouillage"], ["T-OS", "Windows supporté"], ["T-ADMIN", "Sans droits admin"], ["T-PWD", "Mots de passe"],
];
const dot = (s) => `<span title="${s}" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${s === "ok" ? "var(--ok)" : s === "echec" ? "var(--bad)" : "var(--line-2)"}"></span>`;

export function agentCommand(path) {
  const url = `${location.origin}${path}`;
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr '${url}' -OutFile $env:TEMP\\amane-agent.ps1; & $env:TEMP\\amane-agent.ps1 -Install"`;
}

export async function render(main, ctx) {
  const [devices, orgInfo] = await Promise.all([api("/api/devices"), api("/api/org")]);
  const admin = ctx.user.role === "admin";
  main.innerHTML = `<div class="head"><div><h1>Appareils</h1><p>Ordinateurs surveillés par l’agent Amane. L’agent vérifie 8 points de sécurité toutes les 4 heures, sans droits administrateur.</p></div></div>
    ${admin ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Installer l’agent sur un poste Windows</h3></div><div class="card-b">
      <p class="small" style="margin-top:0">Chaque collaborateur trouve sa commande personnalisée dans <b>Mon espace</b>. Pour un poste partagé, ouvrez PowerShell et exécutez :</p>
      <pre class="cmd">${esc(agentCommand(`/agent/install.ps1?token=${orgInfo.agent_token}&email=`))}</pre>
      <p class="small muted" style="margin-bottom:0">Le serveur doit être joignable depuis le poste : lancez Amane avec <span class="code">HOST=0.0.0.0</span> et utilisez son adresse sur le réseau local.</p>
    </div></div>` : ""}
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Poste</th><th>Utilisateur</th><th>Système</th><th>Contrôles</th><th>Dernier rapport</th></tr></thead><tbody id="rows">
    ${devices.map((d) => {
      const r = d.results || {}, bad = CHECKS.filter(([k]) => r[k]?.status === "echec").length;
      return `<tr class="click" data-id="${d.id}"><td class="title"><b>${esc(d.hostname)}</b><span class="small muted">${esc(d.serial || "")}</span></td>
        <td class="small">${esc(d.user_name || d.user_email || "—")}</td><td class="small">${esc(d.os || "")} ${esc(d.os_version || "")}</td>
        <td>${CHECKS.map(([k]) => dot(r[k]?.status)).join("")} <span class="small ${bad ? "" : "muted"}" style="${bad ? "color:var(--bad);font-weight:600" : ""}">${bad ? `${bad} en échec` : "conforme"}</span></td>
        <td class="small">${ago(d.last_seen)}</td></tr>`;
    }).join("") || `<tr><td colspan="5">${empty("laptop", "Aucun appareil", "Installez l’agent sur un premier poste pour activer les tests automatiques.")}</td></tr>`}
    </tbody></table></div></div>`;

  document.getElementById("rows").onclick = (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const dv = devices.find((x) => x.id === Number(tr.dataset.id));
    const r = dv.results || {};
    const d = drawer(esc(dv.hostname), `${esc(dv.os || "")} ${esc(dv.os_version || "")} · agent ${esc(dv.agent_version || "")} · ${ago(dv.last_seen)}`,
      `<div class="list">${CHECKS.map(([k, l]) => `<div>${dot(r[k]?.status)}<div class="grow"><b>${l}</b><div class="small muted">${esc(r[k]?.info || "aucun résultat")}</div></div>
        <span class="pill ${r[k]?.status === "ok" ? "ok" : r[k]?.status === "echec" ? "bad" : "warn"}">${r[k]?.status === "ok" ? "Conforme" : r[k]?.status === "echec" ? "En échec" : "Inconnu"}</span></div>`).join("")}</div>`,
      admin ? `<button class="btn danger" id="del" style="margin-right:auto">${icon("trash")}Retirer l’appareil</button><button class="btn" data-x>Fermer</button>` : "");
    d.el.querySelector("[data-x]")?.addEventListener("click", d.close);
    d.el.querySelector("#del")?.addEventListener("click", async () => {
      if (!(await confirmBox("Retirer l’appareil", `${esc(dv.hostname)} ne sera plus suivi jusqu’à son prochain rapport.`, "Retirer", true))) return;
      try { await api(`/api/devices/${dv.id}`, { method: "DELETE" }); toast("Appareil retiré"); d.close(); ctx.refresh(); } catch (err) { fail(err); }
    });
  };
}
