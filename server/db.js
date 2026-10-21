// SQLite storage (node:sqlite, built into Node ≥ 22.13) + loading of the regulatory content.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DATA = process.env.AMANE_DATA || path.join(__dirname, "..", "data");
fs.mkdirSync(path.join(DATA, "uploads"), { recursive: true });
const db = new DatabaseSync(path.join(DATA, "amane.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const now = () => new Date().toISOString();
function tx(fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

db.exec(`
CREATE TABLE IF NOT EXISTS org (
  id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, sector TEXT, size TEXT, city TEXT,
  rssi_user_id INTEGER, agent_token TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','membre','auditeur')), title TEXT, department TEXT,
  pass_hash TEXT, active INTEGER NOT NULL DEFAULT 1, start_date TEXT, training_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS frameworks (code TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, description TEXT, enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY, framework_code TEXT NOT NULL REFERENCES frameworks(code), ref TEXT NOT NULL, section TEXT, title TEXT NOT NULL,
  description TEXT, applicable INTEGER NOT NULL DEFAULT 1, justification TEXT, UNIQUE (framework_code, ref));
CREATE TABLE IF NOT EXISTS controls (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, title TEXT NOT NULL, description TEXT, evidence_hint TEXT,
  frequency TEXT, status TEXT NOT NULL DEFAULT 'a_faire' CHECK (status IN ('a_faire','en_cours','en_place','non_applicable')),
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, notes TEXT, due_date TEXT, justification TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS control_requirements (control_id INTEGER NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE, PRIMARY KEY (control_id, requirement_id));
CREATE TABLE IF NOT EXISTS tests (code TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL, description TEXT, remediation TEXT,
  status TEXT NOT NULL DEFAULT 'en_attente', details TEXT, last_run TEXT);
CREATE TABLE IF NOT EXISTS control_tests (control_id INTEGER NOT NULL REFERENCES controls(id) ON DELETE CASCADE, test_code TEXT NOT NULL REFERENCES tests(code),
  PRIMARY KEY (control_id, test_code));
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT, body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','publiee')), owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS policy_versions (policy_id INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE, version INTEGER NOT NULL,
  body TEXT NOT NULL, approved_by INTEGER, approved_at TEXT NOT NULL, PRIMARY KEY (policy_id, version));
CREATE TABLE IF NOT EXISTS policy_acceptances (policy_id INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE, version INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, accepted_at TEXT NOT NULL, PRIMARY KEY (policy_id, version, user_id));
CREATE TABLE IF NOT EXISTS control_policies (control_id INTEGER NOT NULL REFERENCES controls(id) ON DELETE CASCADE, policy_code TEXT NOT NULL,
  PRIMARY KEY (control_id, policy_code));
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY, control_id INTEGER NOT NULL REFERENCES controls(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('fichier','lien','note')),
  title TEXT NOT NULL, file_name TEXT, stored_name TEXT, mime TEXT, size INTEGER, url TEXT, note TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL, valid_until TEXT);
CREATE TABLE IF NOT EXISTS risks (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT, asset TEXT, owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5), impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  treatment TEXT NOT NULL DEFAULT 'reduire' CHECK (treatment IN ('reduire','accepter','transferer','eviter')), plan TEXT,
  residual_likelihood INTEGER, residual_impact INTEGER, status TEXT NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert','en_traitement','traite','accepte')),
  due_date TEXT, reviewed_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS risk_controls (risk_id INTEGER NOT NULL REFERENCES risks(id) ON DELETE CASCADE, control_id INTEGER NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  PRIMARY KEY (risk_id, control_id));
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, service TEXT, category TEXT, criticality TEXT NOT NULL DEFAULT 'moyenne' CHECK (criticality IN ('faible','moyenne','elevee')),
  data_access TEXT NOT NULL DEFAULT 'aucune' CHECK (data_access IN ('aucune','interne','personnelles','sensibles')), country TEXT, contract_end TEXT,
  dpa_signed INTEGER NOT NULL DEFAULT 0, reviewed_at TEXT, contact TEXT, website TEXT, notes TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS processing (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, purpose TEXT, legal_basis TEXT, data_categories TEXT, data_subjects TEXT, recipients TEXT,
  sensitive INTEGER NOT NULL DEFAULT 0, transfer_abroad INTEGER NOT NULL DEFAULT 0, transfer_country TEXT, retention TEXT, security_measures TEXT,
  cndp_status TEXT NOT NULL DEFAULT 'non_declare' CHECK (cndp_status IN ('non_declare','en_cours','declare','autorise')), cndp_ref TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY, device_key TEXT NOT NULL UNIQUE, hostname TEXT, serial TEXT, user_email TEXT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  os TEXT, os_version TEXT, agent_version TEXT, results TEXT, last_seen TEXT NOT NULL, first_seen TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS integrations (provider TEXT PRIMARY KEY, config TEXT NOT NULL, status TEXT NOT NULL, message TEXT, details TEXT, last_sync TEXT);
CREATE TABLE IF NOT EXISTS m365_users (id TEXT PRIMARY KEY, upn TEXT, name TEXT, email TEXT, enabled INTEGER NOT NULL DEFAULT 1, is_admin INTEGER NOT NULL DEFAULT 0,
  admin_roles TEXT, mfa_registered INTEGER NOT NULL DEFAULT 0, methods TEXT, synced_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id INTEGER, action TEXT NOT NULL, entity TEXT, entity_id TEXT, details TEXT);
`);

// Regulatory content: idempotent, so library updates reach existing installations.
function loadContent() {
  const frameworks = [require("./content/iso27001"), require("./content/loi0908"), require("./content/dnssi")];
  const controls = require("./content/controls");
  const tests = require("./content/tests");
  tx(() => {
    for (const f of frameworks) {
      run(`INSERT INTO frameworks (code, name, short, description) VALUES (?, ?, ?, ?)
           ON CONFLICT(code) DO UPDATE SET name = excluded.name, short = excluded.short, description = excluded.description`, f.code, f.name, f.short, f.description);
      for (const r of f.requirements) {
        run(`INSERT INTO requirements (framework_code, ref, section, title, description) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(framework_code, ref) DO UPDATE SET section = excluded.section, title = excluded.title, description = excluded.description`,
          f.code, r.ref, r.section, r.title, r.description);
      }
    }
    for (const t of tests) {
      run(`INSERT INTO tests (code, source, title, description, remediation) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(code) DO UPDATE SET source = excluded.source, title = excluded.title, description = excluded.description, remediation = excluded.remediation`,
        t.code, t.source, t.title, t.description, t.remediation);
    }
    for (const c of controls) {
      run(`INSERT INTO controls (code, domain, title, description, evidence_hint, frequency, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(code) DO UPDATE SET domain = excluded.domain, title = excluded.title, description = excluded.description,
           evidence_hint = excluded.evidence_hint, frequency = excluded.frequency`, c.code, c.domain, c.title, c.description, c.evidence, c.frequency, now());
      const { id } = get("SELECT id FROM controls WHERE code = ?", c.code);
      run("DELETE FROM control_requirements WHERE control_id = ?", id);
      for (const [fw, refs] of Object.entries(c.maps)) {
        for (const ref of refs) {
          const r = get("SELECT id FROM requirements WHERE framework_code = ? AND ref = ?", fw, ref);
          if (r) run("INSERT OR IGNORE INTO control_requirements VALUES (?, ?)", id, r.id);
        }
      }
      run("DELETE FROM control_tests WHERE control_id = ?", id);
      for (const tc of c.tests) run("INSERT OR IGNORE INTO control_tests VALUES (?, ?)", id, tc);
      run("DELETE FROM control_policies WHERE control_id = ?", id);
      for (const pc of c.policies) run("INSERT OR IGNORE INTO control_policies VALUES (?, ?)", id, pc);
    }
  });
}

// Draft policies from the templates, personalised with the organisation's name.
function seedPolicies(orgName, rssiName, ownerId) {
  const templates = require("./content/policies");
  for (const t of templates) {
    if (get("SELECT 1 FROM policies WHERE code = ?", t.code)) continue;
    const body = t.body.replaceAll("{{organisation}}", orgName).replaceAll("{{rssi}}", rssiName);
    run("INSERT INTO policies (code, title, summary, body, owner_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)", t.code, t.title, t.summary, body, ownerId, now());
  }
}

function audit(userId, action, entity = null, entityId = null, details = null) {
  run("INSERT INTO audit_log (at, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)",
    now(), userId, action, entity, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null);
}

loadContent();

module.exports = { db, all, get, run, tx, now, audit, seedPolicies, DATA };
