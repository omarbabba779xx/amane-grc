// Compliance engine: evaluates automated tests, derives control health and framework scores.
const { all, get, run, now } = require("./db");

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

function runTests() {
  const at = now();
  for (const t of all("SELECT code, source FROM tests")) {
    const r = t.source === "agent" ? agentTest(t.code) : (PLATFORM[t.code] || (() => ({ status: "en_attente", details: {} })))();
    run("UPDATE tests SET status = ?, details = ?, last_run = ? WHERE code = ?", r.status, JSON.stringify(r.details), at, t.code);
  }
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

module.exports = { runTests, controlsWithHealth, frameworkScores, controlHealth };
