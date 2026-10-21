// Microsoft 365 / Entra ID integration (read-only, client-credentials flow).
// Collects accounts, registered authentication methods, admin roles and how MFA is enforced.
// Graph permissions (application): User.Read.All, UserAuthenticationMethod.Read.All,
// RoleManagement.Read.Directory, Policy.Read.All, and optionally AuditLog.Read.All (P1/P2 report).
const { all, get, run, tx, now } = require("../db");
const { encrypt, decrypt } = require("../secrets");

const LOGIN = process.env.AMANE_M365_LOGIN || "https://login.microsoftonline.com";
const GRAPH = process.env.AMANE_M365_GRAPH || "https://graph.microsoft.com";
const MFA_METHODS = new Set([
  "#microsoft.graph.microsoftAuthenticatorAuthenticationMethod", "#microsoft.graph.phoneAuthenticationMethod",
  "#microsoft.graph.fido2AuthenticationMethod", "#microsoft.graph.softwareOathAuthenticationMethod",
  "#microsoft.graph.windowsHelloForBusinessAuthenticationMethod", "#microsoft.graph.platformCredentialAuthenticationMethod",
]);
const METHOD_LABEL = {
  microsoftAuthenticator: "Authenticator", phone: "Téléphone", mobilePhone: "Téléphone", fido2: "Clé FIDO2", softwareOneTimePasscode: "Code TOTP",
  softwareOath: "Code TOTP", windowsHelloForBusiness: "Windows Hello", platformCredential: "Passkey", email: "E-mail", password: "Mot de passe",
};

const label = (t) => METHOD_LABEL[String(t).replace("#microsoft.graph.", "").replace("AuthenticationMethod", "")] || String(t).replace("#microsoft.graph.", "");

function config() {
  const row = get("SELECT * FROM integrations WHERE provider = 'm365'");
  return row ? { ...row, config: JSON.parse(row.config || "{}"), details: JSON.parse(row.details || "{}") } : null;
}

function saveConfig({ tenant_id, client_id, client_secret }) {
  const prev = config();
  const secret = client_secret ? encrypt(client_secret) : prev?.config.secret;
  if (!tenant_id || !client_id || !secret) throw new Error("Identifiant du locataire, identifiant d'application et secret sont obligatoires.");
  if (!/^[0-9a-f-]{36}$/i.test(client_id) || !/^([0-9a-f-]{36}|[\w.-]+\.[a-z]{2,})$/i.test(tenant_id))
    throw new Error("L'identifiant du locataire (GUID ou domaine) ou de l'application (GUID) est invalide.");
  run(`INSERT INTO integrations (provider, config, status, message) VALUES ('m365', ?, 'non_synchronise', 'Configuration enregistrée, synchronisation à lancer')
       ON CONFLICT(provider) DO UPDATE SET config = excluded.config, status = excluded.status, message = excluded.message`,
    JSON.stringify({ tenant_id: tenant_id.trim(), client_id: client_id.trim(), secret }));
}

function remove() {
  tx(() => { run("DELETE FROM integrations WHERE provider = 'm365'"); run("DELETE FROM m365_users"); });
}

async function token(cfg) {
  const r = await fetch(`${LOGIN}/${encodeURIComponent(cfg.tenant_id)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.client_id, client_secret: decrypt(cfg.secret), scope: `${GRAPH}/.default`, grant_type: "client_credentials" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Authentification Microsoft refusée : ${j.error_description?.split("\r\n")[0] || j.error || r.status}`);
  return j.access_token;
}

async function graph(tok, path) {
  const out = [];
  let url = path.startsWith("http") ? path : `${GRAPH}/v1.0${path}`;
  while (url) {
    let r;
    for (let attempt = 0; attempt < 4; attempt++) {
      r = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, ConsistencyLevel: "eventual" } });
      if (r.status !== 429 && r.status < 500) break;
      await new Promise((ok) => setTimeout(ok, Number(r.headers.get("retry-after") || 2) * 1000)); // throttled: wait as asked
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error?.message || `Erreur Graph ${r.status}`); e.status = r.status; throw e; }
    if (!Array.isArray(j.value)) return j;
    out.push(...j.value);
    url = j["@odata.nextLink"] || null;
  }
  return out;
}

async function sync() {
  const cfg = config();
  if (!cfg) throw new Error("L'intégration Microsoft 365 n'est pas configurée.");
  try {
    const tok = await token(cfg.config);
    const users = (await graph(tok, "/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType&$top=999"))
      .filter((u) => u.userType !== "Guest");

    // Admin roles (Global, Security, Exchange, User administrators…)
    const admins = new Map();
    for (const role of await graph(tok, "/directoryRoles?$expand=members")) {
      for (const m of role.members || []) admins.set(m.id, [...(admins.get(m.id) || []), role.displayName]);
    }

    // MFA registration: one call with the P1/P2 report, otherwise one call per user
    let source = "rapport";
    const methods = new Map();
    try {
      for (const d of await graph(tok, "/reports/authenticationMethods/userRegistrationDetails?$top=999"))
        methods.set(d.id, { mfa: !!d.isMfaRegistered, list: (d.methodsRegistered || []).map(label) });
    } catch (e) {
      if (e.status !== 403 && e.status !== 400) throw e;
      source = "methodes";
      for (const u of users) {
        try {
          const ms = await graph(tok, `/users/${u.id}/authentication/methods`);
          methods.set(u.id, { mfa: ms.some((m) => MFA_METHODS.has(m["@odata.type"])), list: [...new Set(ms.map((m) => label(m["@odata.type"])))] });
        } catch (err) { if (err.status !== 404) throw err; }
      }
    }

    // How MFA is enforced: Security Defaults, or an enabled Conditional Access policy requiring MFA for all users
    let enforcement = { securityDefaults: null, conditionalAccess: [] };
    try { enforcement.securityDefaults = !!(await graph(tok, "/policies/identitySecurityDefaultsEnforcementPolicy")).isEnabled; } catch {}
    try {
      enforcement.conditionalAccess = (await graph(tok, "/identity/conditionalAccess/policies"))
        .filter((p) => p.state === "enabled" && (p.grantControls?.builtInControls || []).includes("mfa"))
        .map((p) => ({ name: p.displayName, allUsers: (p.conditions?.users?.includeUsers || []).includes("All"), excluded: (p.conditions?.users?.excludeUsers || []).length }));
    } catch {}

    const at = now();
    tx(() => {
      run("DELETE FROM m365_users");
      for (const u of users) {
        const m = methods.get(u.id) || { mfa: false, list: [] };
        run(`INSERT INTO m365_users (id, upn, name, email, enabled, is_admin, admin_roles, mfa_registered, methods, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          u.id, u.userPrincipalName, u.displayName, (u.mail || u.userPrincipalName || "").toLowerCase(), u.accountEnabled === false ? 0 : 1,
          admins.has(u.id) ? 1 : 0, JSON.stringify(admins.get(u.id) || []), m.mfa ? 1 : 0, JSON.stringify(m.list), at);
      }
      const enabled = users.filter((u) => u.accountEnabled !== false);
      const withMfa = enabled.filter((u) => methods.get(u.id)?.mfa).length;
      run("UPDATE integrations SET status = 'ok', message = ?, details = ?, last_sync = ? WHERE provider = 'm365'",
        `${enabled.length} comptes actifs, ${withMfa} avec MFA`, JSON.stringify({ source, enforcement, users: enabled.length, mfa: withMfa }), at);
    });
    return config();
  } catch (e) {
    run("UPDATE integrations SET status = 'erreur', message = ?, last_sync = ? WHERE provider = 'm365'", e.message, now());
    throw e;
  }
}

// Read model for the API (never exposes the secret)
function view() {
  const c = config();
  if (!c) return { configured: false };
  return {
    configured: true, status: c.status, message: c.message, last_sync: c.last_sync, tenant_id: c.config.tenant_id, client_id: c.config.client_id,
    details: c.details,
    users: all("SELECT * FROM m365_users ORDER BY enabled DESC, mfa_registered, is_admin DESC, name").map((u) => ({ ...u, methods: JSON.parse(u.methods || "[]"), admin_roles: JSON.parse(u.admin_roles || "[]") })),
  };
}

module.exports = { config, saveConfig, remove, sync, view };
