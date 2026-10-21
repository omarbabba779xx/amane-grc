import { api, esc, icon, toast, fail, ago, datetime, confirmBox, formData, empty } from "../lib.js";

const PERMS = [
  ["User.Read.All", "lister les comptes"],
  ["UserAuthenticationMethod.Read.All", "lire les méthodes MFA enregistrées"],
  ["RoleManagement.Read.Directory", "repérer les administrateurs"],
  ["Policy.Read.All", "lire les paramètres de sécurité par défaut et l’accès conditionnel"],
  ["AuditLog.Read.All", "facultatif, rapport d’inscription (Entra ID P1/P2) : synchronisation plus rapide"],
];
const STATUS = { ok: ["Synchronisé", "ok"], erreur: ["Erreur", "bad"], non_synchronise: ["À synchroniser", "warn"] };

export async function render(main, ctx) {
  const v = await api("/api/integrations/m365");
  const admin = ctx.user.role === "admin";
  const users = v.users || [];
  const noMfa = users.filter((u) => u.enabled && !u.mfa_registered);
  const adminsNoMfa = noMfa.filter((u) => u.is_admin);
  const e = v.details?.enforcement || {};
  const ca = (e.conditionalAccess || []).find((p) => p.allUsers);
  const [stLabel, stCls] = STATUS[v.status] || ["Non configuré", ""];

  main.innerHTML = `<div class="head"><div><h1>Intégrations</h1><p>Connectez Microsoft 365 pour vérifier en continu que chaque compte est protégé par l’authentification multifacteur (MFA). Accès en lecture seule.</p></div>
      ${admin && v.configured ? `<div class="actions"><button class="btn primary" id="sync">${icon("refresh")}Synchroniser</button></div>` : ""}</div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>${icon("cloud")} Microsoft 365 / Entra ID</h3><span class="pill ${stCls}">${stLabel}</span></div><div class="card-b">
        ${v.configured ? `<p class="small" style="margin-top:0">${esc(v.message || "")}${v.last_sync ? ` · ${ago(v.last_sync)} <span class="muted">(${datetime(v.last_sync)})</span>` : ""}</p>` : ""}
        ${admin ? `<div class="form cols" id="cfg">
          <div class="field full"><label>ID du locataire (tenant)</label><input name="tenant_id" placeholder="xxxxxxxx-xxxx-… ou entreprise.onmicrosoft.com" value="${esc(v.tenant_id || "")}"></div>
          <div class="field full"><label>ID d’application (client)</label><input name="client_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${esc(v.client_id || "")}"></div>
          <div class="field full"><label>Secret client</label><input name="client_secret" type="password" autocomplete="new-password" placeholder="${v.configured ? "•••••••• (laisser vide pour conserver)" : "Valeur du secret"}"></div>
          <div class="full" style="display:flex;gap:8px"><button class="btn primary" id="save">Enregistrer et synchroniser</button>
            ${v.configured ? `<button class="btn danger" id="del" style="margin-left:auto">${icon("trash")}Déconnecter</button>` : ""}</div></div>
          <p class="small muted" style="margin-bottom:0">Le secret est chiffré (AES-256-GCM) dans la base et n’est jamais renvoyé au navigateur.</p>`
        : `<p class="small muted">${v.configured ? `Locataire <span class="code">${esc(v.tenant_id)}</span>` : "Seul un administrateur peut configurer l’intégration."}</p>`}
      </div></div>
      <div class="card"><div class="card-h"><h3>Créer l’application dans Entra ID</h3><span class="muted small">5 minutes, administrateur général</span></div><div class="card-b small">
        <ol style="margin:0;padding-left:18px;line-height:1.7">
          <li>Ouvrir <b>entra.microsoft.com</b> › Applications › <b>Inscriptions d’applications</b> › Nouvelle inscription (nom : « Amane GRC », comptes de cet annuaire uniquement).</li>
          <li>Copier l’<b>ID d’application (client)</b> et l’<b>ID de l’annuaire (locataire)</b>.</li>
          <li><b>API autorisées</b> › Ajouter › Microsoft Graph › <b>Autorisations d’application</b> :
            <ul style="margin:4px 0;padding-left:16px">${PERMS.map(([p, d]) => `<li><span class="code">${p}</span> <span class="muted">${d}</span></li>`).join("")}</ul></li>
          <li>Cliquer sur <b>Accorder un consentement d’administrateur</b>.</li>
          <li><b>Certificats et secrets</b> › Nouveau secret client, puis copier sa <b>valeur</b> (pas son ID) ici.</li>
        </ol></div></div>
    </div>
    ${v.status === "ok" ? `
    <div class="grid g4" style="margin-top:16px">
      <div class="card stat"><div class="k">Comptes actifs</div><div class="v">${v.details.users}</div></div>
      <div class="card stat"><div class="k">Avec MFA</div><div class="v">${v.details.mfa}<span class="small muted"> / ${v.details.users}</span></div></div>
      <div class="card stat"><div class="k">Administrateurs sans MFA</div><div class="v" style="${adminsNoMfa.length ? "color:var(--bad)" : ""}">${adminsNoMfa.length}</div></div>
      <div class="card stat"><div class="k">MFA imposée</div><div class="v" style="font-size:16px;padding-top:6px">${e.securityDefaults ? '<span class="pill ok">Sécurité par défaut</span>' : ca ? `<span class="pill ok">Accès conditionnel</span>` : '<span class="pill bad">Non imposée</span>'}</div></div>
    </div>
    ${(e.conditionalAccess || []).length ? `<div class="card" style="margin-top:16px"><div class="card-h"><h3>Stratégies d’accès conditionnel exigeant la MFA</h3></div><div class="card-b"><div class="list">
      ${e.conditionalAccess.map((p) => `<div><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${p.allUsers ? "Tous les utilisateurs" : "Utilisateurs ciblés"}${p.excluded ? ` · ${p.excluded} exclusion(s)` : ""}</div></div></div>`).join("")}</div></div></div>` : ""}
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Comptes Microsoft 365</h3><span class="muted small">${v.details.source === "rapport" ? "rapport d’inscription Entra ID" : "méthodes lues compte par compte"}</span></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Compte</th><th>MFA</th><th>Méthodes enregistrées</th><th>Rôles d’administration</th></tr></thead><tbody>
      ${users.map((u) => `<tr${u.enabled ? "" : ' style="opacity:.55"'}><td class="title"><b>${esc(u.name || u.upn)}</b><span class="small muted">${esc(u.upn)}${u.enabled ? "" : " · désactivé"}</span></td>
        <td>${u.mfa_registered ? '<span class="pill ok">Enregistrée</span>' : `<span class="pill ${u.enabled ? "bad" : ""}">Absente</span>`}</td>
        <td class="small">${u.methods.length ? u.methods.map((m) => `<span class="tag">${esc(m)}</span>`).join("") : '<span class="muted">aucune</span>'}</td>
        <td class="small">${u.admin_roles.length ? u.admin_roles.map((r) => `<span class="tag">${esc(r)}</span>`).join("") : '<span class="muted">—</span>'}</td></tr>`).join("")
        || `<tr><td colspan="4">${empty("people", "Aucun compte", "")}</td></tr>`}
      </tbody></table></div></div>` : ""}`;

  const doSync = async (btn) => {
    btn.disabled = true; btn.textContent = "Synchronisation…";
    try { const r = await api("/api/integrations/m365/sync", { method: "POST" }); toast(r.message || "Synchronisé"); } catch (err) { fail(err); }
    ctx.refresh();
  };
  document.getElementById("sync")?.addEventListener("click", (ev) => doSync(ev.currentTarget));
  document.getElementById("save")?.addEventListener("click", async (ev) => {
    try { await api("/api/integrations/m365", { method: "PUT", body: formData(document.getElementById("cfg")) }); } catch (err) { return fail(err); }
    doSync(ev.currentTarget);
  });
  document.getElementById("del")?.addEventListener("click", async () => {
    if (!(await confirmBox("Déconnecter Microsoft 365 ?", "La configuration et les comptes synchronisés seront supprimés. Les tests MFA repasseront en attente.", "Déconnecter", true))) return;
    try { await api("/api/integrations/m365", { method: "DELETE" }); toast("Intégration supprimée"); ctx.refresh(); } catch (err) { fail(err); }
  });
}
