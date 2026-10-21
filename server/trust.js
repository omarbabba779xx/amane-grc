// Trust Center: a public page showing the organisation's security posture, and access requests for the full documents.
const crypto = require("crypto");
const { all, get, run, now, setting, saveSetting } = require("./db");
const engine = require("./engine");

const DEFAULTS = {
  enabled: 0, headline: "Sécurité et conformité", intro: "", contact_email: "",
  frameworks: ["ISO27001", "LOI0908", "DNSSI"], show_scores: 1, show_controls: 1, show_tests: 1, show_subprocessors: 1, policies: [],
};
const config = () => setting("trust", DEFAULTS);
const ACCESS_DAYS = 30;

function save(input) {
  const c = { ...config() };
  for (const k of ["headline", "intro", "contact_email"]) if (input[k] !== undefined) c[k] = String(input[k] || "").trim().slice(0, k === "intro" ? 2000 : 200);
  for (const k of ["enabled", "show_scores", "show_controls", "show_tests", "show_subprocessors"]) if (input[k] !== undefined) c[k] = input[k] ? 1 : 0;
  if (Array.isArray(input.frameworks)) c.frameworks = input.frameworks.map(String);
  if (Array.isArray(input.policies)) c.policies = input.policies.map(String);
  if (c.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact_email)) throw new Error("Adresse de contact invalide.");
  saveSetting("trust", c);
}

// A valid access token (approved request, not expired) unlocks the full text of the published policies.
function grant(token) {
  if (!token || typeof token !== "string") return null;
  return get("SELECT id, name, company, expires_at FROM trust_requests WHERE token = ? AND status = 'approuvee' AND expires_at > ?", token, now()) || null;
}

// Everything the public page shows; only what the administrator chose to publish.
function publicView(token) {
  const c = config();
  if (!c.enabled) return null;
  const org = get("SELECT name, sector, city FROM org WHERE id = 1");
  const access = grant(token);
  const scores = engine.frameworkScores().filter((f) => c.frameworks.includes(f.code));
  const controls = engine.controlsWithHealth();
  // only measures in place are published: listing the gaps would show an attacker where to look
  const byDomain = {};
  for (const ctl of controls.filter((x) => x.health === "ok")) (byDomain[ctl.domain] ||= { domain: ctl.domain, items: [] }).items.push(ctl.title);
  const passing = get("SELECT COUNT(*) AS n FROM tests WHERE status = 'ok'").n;
  return {
    org: { name: org.name, sector: org.sector, city: org.city },
    headline: c.headline, intro: c.intro, contact_email: c.contact_email, updated_at: now(),
    frameworks: scores.map((f) => ({ name: f.name, short: f.short, description: f.description, score: c.show_scores ? f.score : null,
      state: f.score >= 90 ? "conforme" : f.score >= 40 ? "en_cours" : "demarre" })),
    domains: c.show_controls ? Object.values(byDomain) : null,
    tests: c.show_tests ? { ok: passing } : null,
    subprocessors: c.show_subprocessors ? all("SELECT name, service, country FROM vendors WHERE data_access IN ('personnelles', 'sensibles') ORDER BY name") : null,
    policies: all("SELECT code, title, summary, version, approved_at FROM policies WHERE status = 'publiee' ORDER BY title").filter((p) => c.policies.includes(p.code)),
    access: access ? { name: access.name, company: access.company, expires_at: access.expires_at } : null,
  };
}

function policyText(code, token) {
  const c = config();
  if (!c.enabled || !c.policies.includes(code) || !grant(token)) return null;
  const p = get("SELECT p.id, p.title, p.version, p.approved_at FROM policies p WHERE p.code = ? AND p.status = 'publiee'", code);
  if (!p) return null;
  return { title: p.title, version: p.version, approved_at: p.approved_at, body: get("SELECT body FROM policy_versions WHERE policy_id = ? AND version = ?", p.id, p.version).body };
}

function request({ name, email, company, reason }) {
  if (!config().enabled) throw new Error("Le Trust Center n'est pas publié.");
  name = String(name || "").trim().slice(0, 120); email = String(email || "").trim().slice(0, 200);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Nom et e-mail professionnel valides obligatoires.");
  if (get("SELECT 1 FROM trust_requests WHERE lower(email) = lower(?) AND status = 'en_attente'", email)) throw new Error("Une demande est déjà en cours pour cette adresse.");
  return Number(run("INSERT INTO trust_requests (name, email, company, reason, created_at) VALUES (?, ?, ?, ?, ?)",
    name, email, String(company || "").trim().slice(0, 160) || null, String(reason || "").trim().slice(0, 1000) || null, now()).lastInsertRowid);
}

function decide(id, approve, userId) {
  const r = get("SELECT * FROM trust_requests WHERE id = ?", id);
  if (!r) throw new Error("Demande introuvable");
  const token = approve ? crypto.randomBytes(24).toString("base64url") : null;
  run("UPDATE trust_requests SET status = ?, token = ?, expires_at = ?, decided_by = ?, decided_at = ? WHERE id = ?",
    approve ? "approuvee" : "refusee", token, approve ? new Date(Date.now() + ACCESS_DAYS * 864e5).toISOString() : null, userId, now(), id);
  return { ...r, token };
}

const requests = () => all("SELECT r.*, u.name AS decided_by_name FROM trust_requests r LEFT JOIN users u ON u.id = r.decided_by ORDER BY r.id DESC");

module.exports = { config, save, publicView, policyText, request, decide, requests, ACCESS_DAYS };
