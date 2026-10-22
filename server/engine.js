// Compliance engine: evaluates automated tests, derives control health and framework scores.
const { EventEmitter } = require("events");
const { all, get, run, now, setting } = require("./db");

const events = new EventEmitter(); // "failing": tests that just went from another state to "echec"

const DAY = 864e5;
const ago = (iso, days) => !iso || Date.now() - new Date(iso).getTime() > days * DAY;
const AGENT_STALE_DAYS = 7;

// Each agent test passes when every active device reporting in the last 7 days passes it.
function agentTest(code) {
  const devices = all("SELECT hostname, results, last_seen FROM devices").filter((d) => !ago(d.last_seen, AGENT_STALE_DAYS));
  if (!devices.length) return { status: "en_attente", details: { message: "Aucun appareil n'a encore remonté de résultat." } };
  const failing = [], unknown = [];
  for (const d of devices) {
    const r = JSON.parse(d.results || "{}")[code];
    if (!r || r.status === "inconnu") unknown.push(d.hostname);
    else if (r.status !== "ok") failing.push({ name: d.hostname, info: r.info || "" });
  }
  return { status: failing.length ? "echec" : unknown.length === devices.length ? "en_attente" : "ok",
    details: { total: devices.length, failing, unknown } };
}

const PLATFORM = {
  "T-POL-ACCEPT": () => {
    const pols = all("SELECT id, title, version FROM policies WHERE status = 'publiee'");
    const users = all("SELECT id, name FROM users WHERE active = 1 AND role != 'auditeur'");
    if (!pols.length) return { status: "echec", details: { message: "Aucune politique publiée." } };
    const failing = [];
    for (const u of users) {
      const missing = pols.filter((p) => !get("SELECT 1 FROM policy_acceptances WHERE policy_id = ? AND version = ? AND user_id = ?", p.id, p.version, u.id));
      if (missing.length) failing.push({ name: u.name, info: `${missing.length} politique(s) à accepter` });
    }
    return { status: failing.length ? "echec" : "ok", details: { total: users.length, failing } };
  },
  "T-POL-REVIEW": () => {
    const pols = all("SELECT title, approved_at FROM policies WHERE status = 'publiee'");
    if (!pols.length) return { status: "echec", details: { message: "Aucune politique publiée." } };
    const failing = pols.filter((p) => ago(p.approved_at, 365)).map((p) => ({ name: p.title, info: "revue de plus d'un an" }));
    return { status: failing.length ? "echec" : "ok", details: { total: pols.length, failing } };
  },
  "T-TRAINING": () => {
    const users = all("SELECT name, training_at FROM users WHERE active = 1 AND role != 'auditeur'");
    const failing = users.filter((u) => ago(u.training_at, 365)).map((u) => ({ name: u.name, info: u.training_at ? "formation de plus d'un an" : "jamais formé" }));
    return { status: failing.length ? "echec" : "ok", details: { total: users.length, failing } };
  },
  "T-AGENT": () => {
    const users = all("SELECT id, name FROM users WHERE active = 1 AND role != 'auditeur'");
    const failing = users.filter((u) => {
      const d = get("SELECT MAX(last_seen) AS seen FROM devices WHERE user_id = ?", u.id);
      return ago(d?.seen, AGENT_STALE_DAYS);
    }).map((u) => ({ name: u.name, info: "aucun poste actif" }));
    return { status: failing.length ? "echec" : "ok", details: { total: users.length, failing } };
  },
  "T-RISK-REVIEW": () => {
    const risks = all("SELECT title, reviewed_at, created_at FROM risks");
    if (!risks.length) return { status: "echec", details: { message: "Le registre des risques est vide." } };
    const failing = risks.filter((r) => ago(r.reviewed_at || r.created_at, 365)).map((r) => ({ name: r.title, info: "à revoir" }));
    return { status: failing.length ? "echec" : "ok", details: { total: risks.length, failing } };
  },
  "T-VENDOR-REVIEW": () => {
    const vs = all("SELECT name, reviewed_at FROM vendors WHERE criticality = 'elevee'");
    const failing = vs.filter((v) => ago(v.reviewed_at, 365)).map((v) => ({ name: v.name, info: v.reviewed_at ? "revue de plus d'un an" : "jamais revu" }));
    return { status: failing.length ? "echec" : "ok", details: { total: vs.length, failing } };
  },
  "T-ACCESS-REVIEW": () => {
    const e = get(`SELECT MAX(e.created_at) AS last FROM evidence e JOIN controls c ON c.id = e.control_id WHERE c.code = 'IAM-05'`);
    return ago(e?.last, 183) ? { status: "echec", details: { message: e?.last ? "Dernière revue il y a plus de 6 mois." : "Aucune preuve de revue des accès." } }
      : { status: "ok", details: { message: `Dernière revue le ${e.last.slice(0, 10)}.` } };
  },
  "T-INC-DGSSI": () => {
    const hours = setting("incidents", { dgssi_hours: 24 }).dgssi_hours;
    const due = all("SELECT title, detected_at FROM incidents WHERE dgssi_required = 1 AND dgssi_notified_at IS NULL");
    if (!due.length) return { status: "ok", details: { message: "Aucun incident en attente de déclaration." } };
    const failing = due.map((i) => {
      const late = Date.now() - new Date(i.detected_at).getTime() - hours * 3600e3;
      return { name: i.title, info: late > 0 ? `déclaration en retard de ${Math.ceil(late / 3600e3)} h` : `à déclarer sous ${Math.ceil(-late / 3600e3)} h` };
    });
    return { status: "echec", details: { total: due.length, failing } };
  },
  "T-INC-REX": () => {
    const inc = all("SELECT title, root_cause, lessons FROM incidents WHERE status = 'clos' AND severity IN ('elevee', 'critique')");
    if (!inc.length) return { status: "ok", details: { message: "Aucun incident grave clos à analyser." } };
    const failing = inc.filter((i) => !i.root_cause || !i.lessons).map((i) => ({ name: i.title, info: "cause ou retour d'expérience manquant" }));
    return { status: failing.length ? "echec" : "ok", details: { total: inc.length, failing } };
  },
  "T-ACCESS-REMEDIATION": () => {
    const r = get("SELECT id, title FROM access_reviews WHERE status = 'cloturee' ORDER BY closed_at DESC LIMIT 1");
    if (!r) return { status: "en_attente", details: { message: "Aucune campagne de revue des accès clôturée." } };
    const todo = all("SELECT name, upn, decision FROM access_review_items WHERE review_id = ? AND decision IN ('retirer', 'modifier')", r.id);
    const failing = all("SELECT name, upn, decision FROM access_review_items WHERE review_id = ? AND decision IN ('retirer', 'modifier') AND remediated = 0", r.id)
      .map((i) => ({ name: i.name, info: `${i.decision === "retirer" ? "accès à retirer" : "accès à modifier"} · ${i.upn}` }));
    return { status: failing.length ? "echec" : "ok", details: failing.length ? { total: todo.length, failing } : { message: `« ${r.title} » : ${todo.length} correction(s), toutes faites.` } };
  },
  "T-0908-REG": () => {
    const ps = all("SELECT name, purpose, legal_basis, retention FROM processing");
    if (!ps.length) return { status: "echec", details: { message: "Le registre des traitements est vide." } };
    const failing = ps.filter((p) => !p.purpose || !p.legal_basis || !p.retention).map((p) => ({ name: p.name, info: "fiche incomplète" }));
    return { status: failing.length ? "echec" : "ok", details: { total: ps.length, failing } };
  },
  "T-0908-DECL": () => {
    const ps = all("SELECT name, cndp_status FROM processing");
    if (!ps.length) return { status: "echec", details: { message: "Le registre des traitements est vide." } };
    const failing = ps.filter((p) => !["declare", "autorise"].includes(p.cndp_status)).map((p) => ({ name: p.name, info: "non déclaré à la CNDP" }));
    return { status: failing.length ? "echec" : "ok", details: { total: ps.length, failing } };
  },
};

// Microsoft 365 tests read the last synchronisation; without the integration they stay pending.
function m365Test(code) {
  const integ = get("SELECT status, details, last_sync FROM integrations WHERE provider = 'm365'");
  if (!integ) return { status: "en_attente", details: { message: "Intégration Microsoft 365 non configurée (Organisation › Intégrations)." } };
  if (integ.status !== "ok") return { status: "en_attente", details: { message: "Synchronisation Microsoft 365 en erreur ou non lancée." } };
  if (ago(integ.last_sync, 2)) return { status: "en_attente", details: { message: "Dernière synchronisation Microsoft 365 de plus de 48 heures." } };
  const users = all("SELECT name, upn, mfa_registered, is_admin FROM m365_users WHERE enabled = 1");
  if (code === "T-M365-ENFORCE") {
    const e = JSON.parse(integ.details || "{}").enforcement || {};
    const ca = (e.conditionalAccess || []).find((p) => p.allUsers);
    if (e.securityDefaults) return { status: "ok", details: { message: "Paramètres de sécurité par défaut activés." } };
    if (ca) return { status: "ok", details: { message: `Accès conditionnel « ${ca.name} »${ca.excluded ? ` (${ca.excluded} exclusion(s) à justifier)` : ""}.` } };
    return { status: "echec", details: { message: "Ni les paramètres de sécurité par défaut, ni une stratégie d'accès conditionnel n'imposent la MFA à tous." } };
  }
  const scope = code === "T-M365-ADMIN-MFA" ? users.filter((u) => u.is_admin) : users;
  const failing = scope.filter((u) => !u.mfa_registered).map((u) => ({ name: u.name, info: u.upn }));
  return { status: failing.length ? "echec" : "ok", details: { total: scope.length, failing } };
}

function runTests() {
  const at = now(), failing = [];
  for (const t of all("SELECT code, source, title, status FROM tests")) {
    const r = t.source === "agent" ? agentTest(t.code) : t.source === "m365" ? m365Test(t.code) : (PLATFORM[t.code] || (() => ({ status: "en_attente", details: {} })))();
    run("UPDATE tests SET status = ?, details = ?, last_run = ? WHERE code = ?", r.status, JSON.stringify(r.details), at, t.code);
    if (r.status === "echec" && t.status !== "echec") failing.push({ code: t.code, title: t.title, details: r.details });
  }
  if (failing.length) events.emit("failing", failing);
}

// Control health: "en_place" but with a failing test is flagged as needing attention.
function controlHealth(c, failingTests) {
  if (c.status === "non_applicable") return "non_applicable";
  if (c.status === "en_place") return failingTests > 0 ? "attention" : "ok";
  return c.status;
}

function controlsWithHealth() {
  const rows = all(`SELECT c.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM control_tests ct JOIN tests t ON t.code = ct.test_code WHERE ct.control_id = c.id AND t.status = 'echec') AS failing_tests,
      (SELECT COUNT(*) FROM control_tests ct WHERE ct.control_id = c.id) AS test_count,
      (SELECT COUNT(*) FROM evidence e WHERE e.control_id = c.id) AS evidence_count
    FROM controls c LEFT JOIN users u ON u.id = c.owner_id ORDER BY c.code`);
  return rows.map((c) => ({ ...c, health: controlHealth(c, c.failing_tests) }));
}

// Score per framework: share of applicable mapped controls in place and healthy;
// a requirement is met when all of its applicable controls are healthy.
function frameworkScores() {
  const controls = Object.fromEntries(controlsWithHealth().map((c) => [c.id, c]));
  const out = [];
  for (const f of all("SELECT * FROM frameworks WHERE enabled = 1 ORDER BY rowid")) {
    const reqs = all("SELECT id, applicable FROM requirements WHERE framework_code = ?", f.code);
    let met = 0, partial = 0, applicable = 0;
    const ctlIds = new Set();
    for (const r of reqs) {
      if (!r.applicable) continue;
      applicable++;
      const cs = all("SELECT control_id FROM control_requirements WHERE requirement_id = ?", r.id).map((x) => controls[x.control_id]).filter((c) => c && c.health !== "non_applicable");
      cs.forEach((c) => ctlIds.add(c.id));
      const ok = cs.filter((c) => c.health === "ok").length;
      if (cs.length && ok === cs.length) met++; else if (ok > 0 || cs.some((c) => c.health === "en_cours" || c.health === "attention")) partial++;
    }
    const ctl = [...ctlIds].map((id) => controls[id]);
    const ctlOk = ctl.filter((c) => c.health === "ok").length;
    out.push({ ...f, requirements: applicable, met, partial, controls: ctl.length, controls_ok: ctlOk,
      score: ctl.length ? Math.round((ctlOk / ctl.length) * 100) : 0 });
  }
  return out;
}

module.exports = { runTests, controlsWithHealth, frameworkScores, controlHealth, events };
