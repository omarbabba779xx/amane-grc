// Amane GRC — HTTP server: JSON API, agent endpoint and the web app.
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { all, get, run, tx, now, audit, seedPolicies, setting, saveSetting, DATA } = require("./db");
const auth = require("./auth");
const engine = require("./engine");

const PORT = Number(process.env.PORT || 4870);
const HOST = process.env.HOST || "127.0.0.1"; // set HOST=0.0.0.0 so agents on other PCs can report
const UPLOADS = path.join(DATA, "uploads");
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'" });
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(auth.loadUser);

const admin = auth.requireRole("admin");
const reader = auth.requireRole("admin", "auditeur");
const anyUser = auth.requireUser;
const org = () => get("SELECT * FROM org WHERE id = 1");
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k] === "" ? null : o[k]]));
const tempPassword = () => crypto.randomBytes(9).toString("base64url") + "A9!";

/* ------------------------------------------------------------ setup & session */
app.get("/api/status", (req, res) => {
  const o = org();
  res.json({ setup: !!o, org: o ? { name: o.name } : null, user: req.user || null });
});

app.post("/api/setup", (req, res) => {
  if (org()) return bad(res, "Amane est déjà configuré.", 409);
  const { orgName, sector, size, city, name, email, password } = req.body || {};
  if (!orgName || !name || !email) return bad(res, "Nom de l'organisme, nom et e-mail sont obligatoires.");
  if (!auth.strongEnough(password)) return bad(res, "Le mot de passe doit contenir au moins 12 caractères.");
  const userId = tx(() => {
    const u = run("INSERT INTO users (email, name, role, title, pass_hash, start_date, created_at) VALUES (?, ?, 'admin', 'Responsable de la sécurité des SI', ?, ?, ?)",
      email.trim(), name.trim(), auth.hashPassword(password), now().slice(0, 10), now());
    run("INSERT INTO org (id, name, sector, size, city, rssi_user_id, agent_token, created_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)",
      orgName.trim(), sector || null, size || null, city || null, u.lastInsertRowid, crypto.randomBytes(24).toString("base64url"), now());
    seedPolicies(orgName.trim(), name.trim(), u.lastInsertRowid);
    return Number(u.lastInsertRowid);
  });
  audit(userId, "configuration initiale");
  engine.runTests();
  auth.createSession(res, userId);
  res.json({ ok: true });
});

const attempts = new Map(); // ip -> [timestamps]: 10 tries per 15 minutes
app.post("/api/login", (req, res) => {
  const ip = req.ip, t = Date.now();
  const recent = (attempts.get(ip) || []).filter((x) => t - x < 15 * 60e3);
  if (recent.length >= 10) return bad(res, "Trop de tentatives. Réessayez dans quelques minutes.", 429);
  const { email, password } = req.body || {};
  const u = get("SELECT id, pass_hash FROM users WHERE email = ? AND active = 1", String(email || "").trim());
  if (!u || !auth.verifyPassword(String(password || ""), u.pass_hash)) {
    attempts.set(ip, [...recent, t]);
    return bad(res, "E-mail ou mot de passe incorrect.", 401);
  }
  attempts.delete(ip);
  auth.createSession(res, u.id);
  audit(u.id, "connexion");
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => { auth.destroySession(req, res); res.json({ ok: true }); });
app.post("/api/me/password", anyUser, (req, res) => {
  const { current, password } = req.body || {};
  const u = get("SELECT pass_hash FROM users WHERE id = ?", req.user.id);
  if (!auth.verifyPassword(String(current || ""), u.pass_hash)) return bad(res, "Mot de passe actuel incorrect.");
  if (!auth.strongEnough(password)) return bad(res, "Le nouveau mot de passe doit contenir au moins 12 caractères.");
  run("UPDATE users SET pass_hash = ? WHERE id = ?", auth.hashPassword(password), req.user.id);
  audit(req.user.id, "changement de mot de passe");
  res.json({ ok: true });
});

/* ------------------------------------------------------------ dashboard */
app.get("/api/dashboard", reader, (req, res) => {
  const controls = engine.controlsWithHealth();
  const count = (h) => controls.filter((c) => c.health === h).length;
  const tests = all("SELECT code, title, source, status FROM tests");
  const risks = all("SELECT likelihood, impact, residual_likelihood, residual_impact, status FROM risks");
  const today = now().slice(0, 10);
  res.json({
    org: org(),
    frameworks: engine.frameworkScores(),
    controls: { total: controls.length, ok: count("ok"), attention: count("attention"), en_cours: count("en_cours"), a_faire: count("a_faire"), non_applicable: count("non_applicable") },
    tests: { total: tests.length, ok: tests.filter((t) => t.status === "ok").length, echec: tests.filter((t) => t.status === "echec").length, failing: tests.filter((t) => t.status === "echec") },
    risks: { total: risks.length, high: risks.filter((r) => r.likelihood * r.impact >= 15 && r.status !== "traite").length, matrix: risks },
    overdue: controls.filter((c) => c.due_date && c.due_date < today && c.health !== "ok" && c.health !== "non_applicable").map((c) => ({ id: c.id, code: c.code, title: c.title, due_date: c.due_date })),
    people: get("SELECT COUNT(*) AS n FROM users WHERE active = 1 AND role != 'auditeur'").n,
    devices: get("SELECT COUNT(*) AS n FROM devices").n,
    processing: get("SELECT COUNT(*) AS n FROM processing").n,
    incidents: { open: get("SELECT COUNT(*) AS n FROM incidents WHERE status != 'clos'").n, to_declare: get("SELECT COUNT(*) AS n FROM incidents WHERE dgssi_required = 1 AND dgssi_notified_at IS NULL").n },
    activity: all(`SELECT a.at, a.action, a.entity, a.entity_id, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 12`),
  });
});

/* ------------------------------------------------------------ frameworks & requirements */
app.get("/api/frameworks", reader, (req, res) => res.json(engine.frameworkScores()));
app.get("/api/frameworks/:code", reader, (req, res) => {
  const f = engine.frameworkScores().find((x) => x.code === req.params.code);
  if (!f) return bad(res, "Référentiel introuvable", 404);
  const health = Object.fromEntries(engine.controlsWithHealth().map((c) => [c.id, c]));
  const reqs = all("SELECT * FROM requirements WHERE framework_code = ? ORDER BY id", f.code).map((r) => ({
    ...r,
    controls: all("SELECT control_id FROM control_requirements WHERE requirement_id = ?", r.id).map((x) => {
      const c = health[x.control_id];
      return { id: c.id, code: c.code, title: c.title, health: c.health };
    }),
  }));
  res.json({ ...f, requirements_list: reqs });
});
app.get("/api/frameworks-all", reader, (req, res) => res.json(all("SELECT code, name, short, description, enabled FROM frameworks ORDER BY rowid")));
app.patch("/api/frameworks/:code", admin, (req, res) => {
  const f = get("SELECT code, name FROM frameworks WHERE code = ?", req.params.code);
  if (!f) return bad(res, "Référentiel introuvable", 404);
  run("UPDATE frameworks SET enabled = ? WHERE code = ?", req.body?.enabled ? 1 : 0, f.code);
  audit(req.user.id, req.body?.enabled ? "référentiel activé" : "référentiel désactivé", "framework", f.code);
  res.json({ ok: true });
});
app.patch("/api/requirements/:id", admin, (req, res) => {
  const { applicable, justification } = req.body || {};
  run("UPDATE requirements SET applicable = ?, justification = ? WHERE id = ?", applicable ? 1 : 0, justification || null, req.params.id);
  audit(req.user.id, applicable ? "exigence applicable" : "exigence exclue", "requirement", req.params.id, { justification });
  res.json({ ok: true });
});

/* ------------------------------------------------------------ controls */
app.get("/api/controls", reader, (req, res) => {
  const fw = all(`SELECT cr.control_id, r.framework_code, r.ref FROM control_requirements cr JOIN requirements r ON r.id = cr.requirement_id`);
  const byCtl = {};
  const on = new Set(all("SELECT code FROM frameworks WHERE enabled = 1").map((f) => f.code));
  fw.filter((x) => on.has(x.framework_code)).forEach((x) => ((byCtl[x.control_id] ??= {})[x.framework_code] ??= []).push(x.ref));
  res.json(engine.controlsWithHealth().map((c) => ({ ...c, frameworks: byCtl[c.id] || {} })));
});
app.get("/api/controls/:id", reader, (req, res) => {
  const c = engine.controlsWithHealth().find((x) => x.id === Number(req.params.id));
  if (!c) return bad(res, "Mesure introuvable", 404);
  res.json({
    ...c,
    requirements: all(`SELECT r.id, r.framework_code, r.ref, r.title, f.short FROM control_requirements cr JOIN requirements r ON r.id = cr.requirement_id
                       JOIN frameworks f ON f.code = r.framework_code WHERE cr.control_id = ? ORDER BY r.framework_code, r.id`, c.id),
    tests: all("SELECT t.* FROM control_tests ct JOIN tests t ON t.code = ct.test_code WHERE ct.control_id = ?", c.id).map((t) => ({ ...t, details: JSON.parse(t.details || "{}") })),
    policies: all("SELECT p.id, p.code, p.title, p.status, p.version FROM control_policies cp JOIN policies p ON p.code = cp.policy_code WHERE cp.control_id = ?", c.id),
    evidence: all("SELECT e.*, u.name AS uploaded_by_name FROM evidence e LEFT JOIN users u ON u.id = e.uploaded_by WHERE e.control_id = ? ORDER BY e.id DESC", c.id),
    risks: all("SELECT r.id, r.title, r.likelihood, r.impact FROM risk_controls rc JOIN risks r ON r.id = rc.risk_id WHERE rc.control_id = ?", c.id),
  });
});
app.patch("/api/controls/:id", admin, (req, res) => {
  const f = pick(req.body || {}, ["status", "owner_id", "notes", "due_date", "justification"]);
  if (!Object.keys(f).length) return bad(res, "Rien à modifier");
  if (f.status === "non_applicable" && !(f.justification ?? get("SELECT justification FROM controls WHERE id = ?", req.params.id)?.justification))
    return bad(res, "Une justification est obligatoire pour exclure une mesure (déclaration d'applicabilité).");
  run(`UPDATE controls SET ${Object.keys(f).map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...Object.values(f), now(), req.params.id);
  audit(req.user.id, "mesure modifiée", "control", req.params.id, f);
  res.json({ ok: true });
});

/* ------------------------------------------------------------ evidence */
app.post("/api/controls/:id/evidence", admin, express.raw({ type: () => true, limit: "25mb" }), (req, res) => {
  const ctl = get("SELECT id, code FROM controls WHERE id = ?", req.params.id);
  if (!ctl) return bad(res, "Mesure introuvable", 404);
  const validUntil = req.query.valid_until || null;
  if (Buffer.isBuffer(req.body) && req.headers["x-file-name"]) { // file upload
    const fileName = decodeURIComponent(String(req.headers["x-file-name"])).replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
    const stored = crypto.randomBytes(16).toString("hex");
    fs.writeFileSync(path.join(UPLOADS, stored), req.body);
    run(`INSERT INTO evidence (control_id, kind, title, file_name, stored_name, mime, size, uploaded_by, created_at, valid_until)
         VALUES (?, 'fichier', ?, ?, ?, ?, ?, ?, ?, ?)`, ctl.id, decodeURIComponent(String(req.headers["x-title"] || fileName)), fileName, stored,
      String(req.headers["content-type"] || "application/octet-stream"), req.body.length, req.user.id, now(), validUntil);
  } else {
    let body = req.body;
    if (Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString("utf8")); } catch { return bad(res, "Requête invalide"); } }
    const { kind, title, url, note } = body || {};
    if (!title || !["lien", "note"].includes(kind)) return bad(res, "Titre et type (lien ou note) obligatoires.");
    if (kind === "lien" && !/^https?:\/\//i.test(url || "")) return bad(res, "Le lien doit commencer par http:// ou https://");
    run("INSERT INTO evidence (control_id, kind, title, url, note, uploaded_by, created_at, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ctl.id, kind, title, url || null, note || null, req.user.id, now(), validUntil);
  }
  audit(req.user.id, "preuve ajoutée", "control", ctl.code);
  engine.runTests();
  res.json({ ok: true });
});
app.get("/api/evidence/:id/download", reader, (req, res) => {
  const e = get("SELECT * FROM evidence WHERE id = ? AND kind = 'fichier'", req.params.id);
  if (!e) return bad(res, "Preuve introuvable", 404);
  res.set("Content-Type", "application/octet-stream");
  res.download(path.join(UPLOADS, e.stored_name), e.file_name);
});
app.delete("/api/evidence/:id", admin, (req, res) => {
  const e = get("SELECT * FROM evidence WHERE id = ?", req.params.id);
  if (!e) return bad(res, "Preuve introuvable", 404);
  if (e.stored_name) fs.rm(path.join(UPLOADS, e.stored_name), { force: true }, () => {});
  run("DELETE FROM evidence WHERE id = ?", e.id);
  audit(req.user.id, "preuve supprimée", "evidence", e.id, { title: e.title });
  engine.runTests();
  res.json({ ok: true });
});

/* ------------------------------------------------------------ automated tests */
app.get("/api/tests", reader, (req, res) => {
  res.json(all("SELECT * FROM tests ORDER BY source DESC, code").map((t) => ({
    ...t, details: JSON.parse(t.details || "{}"),
    controls: all("SELECT c.id, c.code, c.title FROM control_tests ct JOIN controls c ON c.id = ct.control_id WHERE ct.test_code = ?", t.code),
  })));
});
app.post("/api/tests/run", admin, (req, res) => { engine.runTests(); res.json({ ok: true }); });

/* ------------------------------------------------------------ policies */
app.get("/api/policies", anyUser, (req, res) => {
  const staff = req.user.role !== "membre";
  const rows = all(`SELECT p.id, p.code, p.title, p.summary, p.status, p.version, p.approved_at, p.updated_at, u.name AS owner_name
                    FROM policies p LEFT JOIN users u ON u.id = p.owner_id ${staff ? "" : "WHERE p.status = 'publiee'"} ORDER BY p.title`);
  const active = get("SELECT COUNT(*) AS n FROM users WHERE active = 1 AND role != 'auditeur'").n;
  res.json(rows.map((p) => ({
    ...p,
    accepted_by_me: !!get("SELECT 1 FROM policy_acceptances WHERE policy_id = ? AND version = ? AND user_id = ?", p.id, p.version, req.user.id),
    acceptance: staff && p.status === "publiee" ? { accepted: get("SELECT COUNT(*) AS n FROM policy_acceptances WHERE policy_id = ? AND version = ?", p.id, p.version).n, total: active } : null,
  })));
});
app.get("/api/policies/:id", anyUser, (req, res) => {
  const p = get("SELECT p.*, u.name AS owner_name, a.name AS approved_by_name FROM policies p LEFT JOIN users u ON u.id = p.owner_id LEFT JOIN users a ON a.id = p.approved_by WHERE p.id = ?", req.params.id);
  if (!p || (req.user.role === "membre" && p.status !== "publiee")) return bad(res, "Politique introuvable", 404);
  const published = p.version ? get("SELECT body FROM policy_versions WHERE policy_id = ? AND version = ?", p.id, p.version) : null;
  res.json({
    ...p,
    published_body: published?.body || null,
    accepted_by_me: !!get("SELECT 1 FROM policy_acceptances WHERE policy_id = ? AND version = ? AND user_id = ?", p.id, p.version, req.user.id),
    versions: all("SELECT v.version, v.approved_at, u.name AS approved_by_name FROM policy_versions v LEFT JOIN users u ON u.id = v.approved_by WHERE v.policy_id = ? ORDER BY v.version DESC", p.id),
    acceptances: req.user.role === "membre" ? [] : all(`SELECT u.id, u.name, u.department, a.accepted_at FROM users u
        LEFT JOIN policy_acceptances a ON a.user_id = u.id AND a.policy_id = ? AND a.version = ? WHERE u.active = 1 AND u.role != 'auditeur' ORDER BY u.name`, p.id, p.version),
  });
});
app.patch("/api/policies/:id", admin, (req, res) => {
  const f = pick(req.body || {}, ["title", "summary", "body", "owner_id"]);
  run(`UPDATE policies SET ${Object.keys(f).map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...Object.values(f), now(), req.params.id);
  audit(req.user.id, "politique modifiée", "policy", req.params.id);
  res.json({ ok: true });
});
app.post("/api/policies/:id/publish", admin, (req, res) => {
  const p = get("SELECT * FROM policies WHERE id = ?", req.params.id);
  if (!p) return bad(res, "Politique introuvable", 404);
  const v = p.version + 1, at = now();
  tx(() => {
    run("INSERT INTO policy_versions (policy_id, version, body, approved_by, approved_at) VALUES (?, ?, ?, ?, ?)", p.id, v, p.body, req.user.id, at);
    run("UPDATE policies SET version = ?, status = 'publiee', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?", v, req.user.id, at, at, p.id);
  });
  audit(req.user.id, `politique publiée (v${v})`, "policy", p.id, { title: p.title });
  engine.runTests();
  res.json({ ok: true, version: v });
});
app.post("/api/policies/:id/accept", anyUser, (req, res) => {
  const p = get("SELECT id, version, title FROM policies WHERE id = ? AND status = 'publiee'", req.params.id);
  if (!p) return bad(res, "Politique introuvable", 404);
  run("INSERT OR IGNORE INTO policy_acceptances (policy_id, version, user_id, accepted_at) VALUES (?, ?, ?, ?)", p.id, p.version, req.user.id, now());
  audit(req.user.id, "politique acceptée", "policy", p.id, { title: p.title, version: p.version });
  engine.runTests();
  res.json({ ok: true });
});

/* ------------------------------------------------------------ registers: risks, vendors, processing (09-08) */
function register(table, fields, { validate, links, updatedAt = false } = {}) {
  app.get(`/api/${table}`, reader, (req, res) => {
    const rows = all(`SELECT t.*, u.name AS owner_name FROM ${table} t LEFT JOIN users u ON u.id = ${fields.includes("owner_id") ? "t.owner_id" : "NULL"} ORDER BY t.id DESC`);
    res.json(links ? rows.map((r) => ({ ...r, ...links.load(r.id) })) : rows);
  });
  const save = (req, res, id) => {
    const f = pick(req.body || {}, fields);
    const err = validate?.(f, !id);
    if (err) return bad(res, err);
    if (id) {
      if (Object.keys(f).length) run(`UPDATE ${table} SET ${Object.keys(f).map((k) => `${k} = ?`).join(", ")}${updatedAt ? ", updated_at = ?" : ""} WHERE id = ?`,
        ...Object.values(f), ...(updatedAt ? [now()] : []), id);
    } else {
      const keys = [...Object.keys(f), "created_at"];
      id = Number(run(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, ...Object.values(f), now()).lastInsertRowid);
    }
    if (links && req.body) links.save(id, req.body);
    audit(req.user.id, `${table} ${req.params.id ? "modifié" : "créé"}`, table, id, { name: f.name || f.title });
    engine.runTests();
    res.json({ ok: true, id });
  };
  app.post(`/api/${table}`, admin, (req, res) => save(req, res, null));
  app.patch(`/api/${table}/:id`, admin, (req, res) => save(req, res, Number(req.params.id)));
  app.delete(`/api/${table}/:id`, admin, (req, res) => {
    run(`DELETE FROM ${table} WHERE id = ?`, req.params.id);
    audit(req.user.id, `${table} supprimé`, table, req.params.id);
    engine.runTests();
    res.json({ ok: true });
  });
}
const scale = (v) => v == null || (Number.isInteger(v) && v >= 1 && v <= 5);
register("risks", ["title", "description", "category", "asset", "owner_id", "likelihood", "impact", "treatment", "plan", "residual_likelihood", "residual_impact", "status", "due_date", "reviewed_at"], {
  validate: (f, creating) => (creating && !f.title ? "Le titre est obligatoire." : ![f.likelihood, f.impact, f.residual_likelihood, f.residual_impact].every(scale) ? "Les échelles vont de 1 à 5." : creating && (!f.likelihood || !f.impact) ? "Vraisemblance et impact sont obligatoires." : null),
  links: {
    load: (id) => ({ controls: all("SELECT c.id, c.code, c.title FROM risk_controls rc JOIN controls c ON c.id = rc.control_id WHERE rc.risk_id = ?", id) }),
    save: (id, body) => {
      if (!Array.isArray(body.control_ids)) return;
      run("DELETE FROM risk_controls WHERE risk_id = ?", id);
      body.control_ids.forEach((cid) => run("INSERT OR IGNORE INTO risk_controls VALUES (?, ?)", id, cid));
    },
  },
});
register("vendors", ["name", "service", "category", "criticality", "data_access", "country", "contract_end", "dpa_signed", "reviewed_at", "contact", "website", "notes"], {
  validate: (f, creating) => (creating && !f.name ? "Le nom est obligatoire." : null),
});
register("processing", ["name", "purpose", "legal_basis", "data_categories", "data_subjects", "recipients", "sensitive", "transfer_abroad", "transfer_country",
  "retention", "security_measures", "cndp_status", "cndp_ref", "owner_id"], {
  updatedAt: true,
  validate: (f, creating) => (creating && !f.name ? "Le nom du traitement est obligatoire." : null),
});

/* ------------------------------------------------------------ people */
app.get("/api/users", reader, (req, res) => {
  const pols = all("SELECT id, version FROM policies WHERE status = 'publiee'");
  res.json(all("SELECT id, email, name, role, title, department, active, start_date, training_at, created_at FROM users ORDER BY active DESC, name").map((u) => ({
    ...u,
    policies_accepted: pols.filter((p) => get("SELECT 1 FROM policy_acceptances WHERE policy_id = ? AND version = ? AND user_id = ?", p.id, p.version, u.id)).length,
    policies_total: pols.length,
    devices: all("SELECT hostname, last_seen FROM devices WHERE user_id = ?", u.id),
    m365: get("SELECT mfa_registered, is_admin, methods FROM m365_users WHERE email = ? OR lower(upn) = ?", u.email.toLowerCase(), u.email.toLowerCase()) || null,
  })));
});
app.post("/api/users", admin, (req, res) => {
  const f = pick(req.body || {}, ["email", "name", "role", "title", "department", "start_date"]);
  if (!f.email || !f.name) return bad(res, "Nom et e-mail obligatoires.");
  if (!["admin", "membre", "auditeur"].includes(f.role || "membre")) return bad(res, "Rôle inconnu.");
  if (get("SELECT 1 FROM users WHERE email = ?", f.email)) return bad(res, "Cet e-mail existe déjà.");
  const pw = tempPassword();
  const id = run("INSERT INTO users (email, name, role, title, department, start_date, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    f.email.trim(), f.name.trim(), f.role || "membre", f.title || null, f.department || null, f.start_date || now().slice(0, 10), auth.hashPassword(pw), now()).lastInsertRowid;
  audit(req.user.id, "personne ajoutée", "user", id, { name: f.name });
  engine.runTests();
  res.json({ ok: true, id: Number(id), temporary_password: pw });
});
app.patch("/api/users/:id", admin, (req, res) => {
  const f = pick(req.body || {}, ["name", "role", "title", "department", "active", "start_date", "training_at"]);
  if (Number(req.params.id) === req.user.id && (f.active === 0 || (f.role && f.role !== "admin"))) return bad(res, "Vous ne pouvez pas retirer vos propres droits d'administrateur.");
  run(`UPDATE users SET ${Object.keys(f).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, ...Object.values(f), req.params.id);
  if (f.active === 0) run("DELETE FROM sessions WHERE user_id = ?", req.params.id);
  audit(req.user.id, "personne modifiée", "user", req.params.id, f);
  engine.runTests();
  res.json({ ok: true });
});
app.post("/api/users/:id/reset-password", admin, (req, res) => {
  const pw = tempPassword();
  run("UPDATE users SET pass_hash = ? WHERE id = ?", auth.hashPassword(pw), req.params.id);
  run("DELETE FROM sessions WHERE user_id = ?", req.params.id);
  audit(req.user.id, "mot de passe réinitialisé", "user", req.params.id);
  res.json({ ok: true, temporary_password: pw });
});

/* ------------------------------------------------------------ my space (every user) */
app.get("/api/me/tasks", anyUser, (req, res) => {
  const pols = all("SELECT id, title, summary, version FROM policies WHERE status = 'publiee' ORDER BY title");
  const me = get("SELECT training_at FROM users WHERE id = ?", req.user.id);
  res.json({
    policies: pols.map((p) => ({ ...p, accepted: !!get("SELECT 1 FROM policy_acceptances WHERE policy_id = ? AND version = ? AND user_id = ?", p.id, p.version, req.user.id) })),
    training_at: me.training_at,
    devices: all("SELECT hostname, os, last_seen, results FROM devices WHERE user_id = ?", req.user.id).map((d) => ({ ...d, results: JSON.parse(d.results || "{}") })),
    agent_url: `/agent/install.ps1?token=${org().agent_token}&email=${encodeURIComponent(req.user.email)}`,
  });
});

/* ------------------------------------------------------------ devices & Windows agent */
app.get("/api/devices", reader, (req, res) => {
  res.json(all("SELECT d.*, u.name AS user_name FROM devices d LEFT JOIN users u ON u.id = d.user_id ORDER BY d.last_seen DESC")
    .map((d) => ({ ...d, results: JSON.parse(d.results || "{}") })));
});
app.delete("/api/devices/:id", admin, (req, res) => { run("DELETE FROM devices WHERE id = ?", req.params.id); engine.runTests(); res.json({ ok: true }); });

app.get("/agent/install.ps1", (req, res) => {
  const o = org();
  if (!o || req.query.token !== o.agent_token) return res.status(403).type("text").send("Jeton invalide.");
  const server = `${req.protocol}://${req.get("host")}`;
  const script = fs.readFileSync(path.join(__dirname, "..", "agent", "amane-agent.ps1"), "utf8")
    .replace("__SERVER__", server).replace("__TOKEN__", o.agent_token).replace("__EMAIL__", String(req.query.email || "").replace(/[^\w.@+-]/g, ""));
  // the BOM makes Windows PowerShell 5.1 read the accented messages as UTF-8
  res.type("text/plain; charset=utf-8").set("Content-Disposition", 'attachment; filename="amane-agent.ps1"').send("﻿" + script);
});
app.post("/api/agent/report", (req, res) => {
  const o = org();
  if (!o || req.headers["x-amane-token"] !== o.agent_token) return bad(res, "Jeton invalide", 403);
  const b = req.body || {};
  if (!b.device_key || typeof b.results !== "object") return bad(res, "Rapport incomplet");
  const user = b.user_email ? get("SELECT id FROM users WHERE email = ?", b.user_email) : null;
  const t = now();
  run(`INSERT INTO devices (device_key, hostname, serial, user_email, user_id, os, os_version, agent_version, results, last_seen, first_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(device_key) DO UPDATE SET hostname = excluded.hostname, serial = excluded.serial,
       user_email = excluded.user_email, user_id = excluded.user_id, os = excluded.os, os_version = excluded.os_version,
       agent_version = excluded.agent_version, results = excluded.results, last_seen = excluded.last_seen`,
    String(b.device_key).slice(0, 100), b.hostname || null, b.serial || null, b.user_email || null, user?.id || null, b.os || null, b.os_version || null,
    b.agent_version || null, JSON.stringify(b.results), t, t);
  engine.runTests();
  res.json({ ok: true });
});

/* ------------------------------------------------------------ integrations: Microsoft 365 */
const m365 = require("./integrations/m365");
app.get("/api/integrations/m365", reader, (req, res) => res.json(m365.view()));
app.put("/api/integrations/m365", admin, (req, res) => {
  try { m365.saveConfig(req.body || {}); } catch (e) { return bad(res, e.message); }
  audit(req.user.id, "intégration Microsoft 365 configurée");
  res.json({ ok: true });
});
app.post("/api/integrations/m365/sync", admin, async (req, res) => {
  try {
    await m365.sync();
    audit(req.user.id, "synchronisation Microsoft 365");
    engine.runTests();
    res.json(m365.view());
  } catch (e) { engine.runTests(); bad(res, e.message, 502); }
});
app.delete("/api/integrations/m365", admin, (req, res) => {
  m365.remove();
  audit(req.user.id, "intégration Microsoft 365 supprimée");
  engine.runTests();
  res.json({ ok: true });
});
setInterval(() => { if (m365.config()?.status === "ok") m365.sync().then(() => engine.runTests()).catch(() => engine.runTests()); }, 6 * 3600e3);

/* ------------------------------------------------------------ incidents (loi 05-20: declaration to the DGSSI) */
const SEVERITY = ["faible", "moyenne", "elevee", "critique"], INC_STATUS = ["ouvert", "en_cours", "clos"];
register("incidents", ["title", "description", "category", "severity", "status", "detected_at", "occurred_at", "systems", "personal_data", "dgssi_required",
  "dgssi_notified_at", "dgssi_ref", "cndp_notified_at", "actions", "root_cause", "lessons", "closed_at", "owner_id"], {
  updatedAt: true,
  validate: (f, creating) => (creating && (!f.title || !f.detected_at) ? "Le titre et la date de détection sont obligatoires."
    : f.severity && !SEVERITY.includes(f.severity) ? "Gravité inconnue." : f.status && !INC_STATUS.includes(f.status) ? "Statut inconnu."
    : f.status === "clos" && !f.closed_at ? ((f.closed_at = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)), null) : null),
});
app.get("/api/settings/incidents", reader, (req, res) => res.json(setting("incidents", { dgssi_hours: 24 })));
app.put("/api/settings/incidents", admin, (req, res) => {
  const h = Number(req.body?.dgssi_hours);
  if (!(h >= 1 && h <= 720)) return bad(res, "Le délai doit être compris entre 1 et 720 heures.");
  saveSetting("incidents", { dgssi_hours: Math.round(h) });
  audit(req.user.id, "délai de déclaration DGSSI modifié", null, null, { heures: h });
  engine.runTests();
  res.json({ ok: true });
});

/* ------------------------------------------------------------ e-mail alerts */
const mailer = require("./mailer");
app.get("/api/settings/mail", admin, (req, res) => res.json({ ...mailer.view(), log: mailer.log() }));
app.put("/api/settings/mail", admin, (req, res) => {
  try { mailer.save(req.body || {}); } catch (e) { return bad(res, e.message); }
  audit(req.user.id, "configuration des alertes e-mail");
  res.json({ ok: true });
});
app.post("/api/settings/mail/test", admin, async (req, res) => {
  try {
    await mailer.send(req.user.email, "Test des alertes Amane", `Bonjour ${req.user.name},\n\nLes alertes e-mail d'Amane fonctionnent.`, "test-envoi");
    res.json({ ok: true, to: req.user.email });
  } catch (e) { bad(res, `Échec de l'envoi : ${e.message}`, 502); }
});
app.post("/api/settings/mail/reminders", admin, (req, res) => {
  if (!mailer.configured()) return bad(res, "Configurez d'abord le serveur d'envoi.");
  audit(req.user.id, "relances envoyées aux collaborateurs");
  res.json({ ok: true, sent: mailer.weeklyReminders() });
});
engine.events.on("failing", (list) => mailer.testsFailed(list));
setInterval(() => mailer.tick(), 3600e3);
setTimeout(() => mailer.tick(), 30e3);

/* ------------------------------------------------------------ Trust Center */
const trust = require("./trust");
const appUrl = (req) => mailer.view().base_url || `${req.protocol}://${req.get("host")}`;
app.get("/api/trust", reader, (req, res) => res.json({ config: trust.config(), requests: req.user.role === "admin" ? trust.requests() : [], access_days: trust.ACCESS_DAYS }));
app.put("/api/trust", admin, (req, res) => {
  try { trust.save(req.body || {}); } catch (e) { return bad(res, e.message); }
  audit(req.user.id, "Trust Center modifié", null, null, { publie: !!trust.config().enabled });
  res.json({ ok: true });
});
app.post("/api/trust/requests/:id/:decision(approve|reject)", admin, (req, res) => {
  let r;
  try { r = trust.decide(Number(req.params.id), req.params.decision === "approve", req.user.id); } catch (e) { return bad(res, e.message, 404); }
  const url = r.token ? `${appUrl(req)}/trust?acces=${r.token}` : null;
  audit(req.user.id, r.token ? "accès Trust Center accordé" : "accès Trust Center refusé", "trust_request", r.id, { email: r.email });
  if (r.token && mailer.configured()) mailer.send(r.email, "Accès aux documents de sécurité", `Bonjour ${r.name},\n\nVotre demande d'accès aux documents de sécurité a été acceptée. Ce lien personnel est valable ${trust.ACCESS_DAYS} jours :\n\n${url}`, "trust").catch(() => {});
  res.json({ ok: true, url, emailed: !!(r.token && mailer.configured()) });
});
// public endpoints (no session)
const trustHits = new Map(); // ip -> timestamps: 5 requests per hour
app.get("/api/public/trust", (req, res) => {
  const v = trust.publicView(String(req.query.acces || ""));
  v ? res.json(v) : bad(res, "Trust Center non publié", 404);
});
app.get("/api/public/trust/policies/:code", (req, res) => {
  const p = trust.policyText(req.params.code, String(req.query.acces || ""));
  p ? res.json(p) : bad(res, "Document non disponible", 404);
});
app.post("/api/public/trust/requests", (req, res) => {
  const t = Date.now(), recent = (trustHits.get(req.ip) || []).filter((x) => t - x < 3600e3);
  if (recent.length >= 5) return bad(res, "Trop de demandes. Réessayez plus tard.", 429);
  trustHits.set(req.ip, [...recent, t]);
  let id;
  try { id = trust.request(req.body || {}); } catch (e) { return bad(res, e.message); }
  audit(null, "demande d'accès Trust Center", "trust_request", id, { email: req.body.email });
  if (mailer.configured()) for (const a of all("SELECT email, name FROM users WHERE role = 'admin' AND active = 1"))
    mailer.send(a.email, "Nouvelle demande d'accès au Trust Center", `Bonjour ${a.name},\n\n${req.body.name} (${req.body.email}${req.body.company ? `, ${req.body.company}` : ""}) demande l'accès aux documents de sécurité.\n\nMotif : ${req.body.reason || "—"}\n\n${appUrl(req)}/#/trust-center`, "trust").catch(() => {});
  res.json({ ok: true });
});

/* ------------------------------------------------------------ EBIOS Risk Manager */
const ebios = require("./ebios");
app.get("/api/ebios", reader, (req, res) => res.json(ebios.list()));
app.post("/api/ebios", admin, (req, res) => {
  try { const id = ebios.create(String(req.body?.kind), req.body?.data || {}); audit(req.user.id, "EBIOS RM : élément ajouté", "ebios", id, { kind: req.body.kind }); res.json({ ok: true, id }); }
  catch (e) { bad(res, e.message); }
});
app.patch("/api/ebios/:id", admin, (req, res) => {
  try { ebios.update(Number(req.params.id), req.body?.data || {}); audit(req.user.id, "EBIOS RM : élément modifié", "ebios", req.params.id); res.json({ ok: true }); }
  catch (e) { bad(res, e.message); }
});
app.delete("/api/ebios/:id", admin, (req, res) => { ebios.remove(Number(req.params.id)); audit(req.user.id, "EBIOS RM : élément supprimé", "ebios", req.params.id); res.json({ ok: true }); });
app.post("/api/ebios/:id/to-risk", admin, (req, res) => {
  try { const id = ebios.toRisk(Number(req.params.id)); audit(req.user.id, "EBIOS RM : risque envoyé au registre", "risks", id); engine.runTests(); res.json({ ok: true, risk_id: id }); }
  catch (e) { bad(res, e.message); }
});

/* ------------------------------------------------------------ organisation */
app.get("/api/org", reader, (req, res) => { const o = org(); res.json({ ...o, agent_token: req.user.role === "admin" ? o.agent_token : undefined }); });
app.patch("/api/org", admin, (req, res) => {
  const f = pick(req.body || {}, ["name", "sector", "size", "city", "rssi_user_id"]);
  run(`UPDATE org SET ${Object.keys(f).map((k) => `${k} = ?`).join(", ")} WHERE id = 1`, ...Object.values(f));
  audit(req.user.id, "organisme modifié");
  res.json({ ok: true });
});
app.post("/api/org/rotate-token", admin, (req, res) => {
  run("UPDATE org SET agent_token = ? WHERE id = 1", crypto.randomBytes(24).toString("base64url"));
  audit(req.user.id, "jeton de l'agent renouvelé");
  res.json({ ok: true });
});
app.get("/api/activity", reader, (req, res) => res.json(all(`SELECT a.*, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300`)));

/* ------------------------------------------------------------ reports */
const csv = (rows) => "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");
app.get("/api/reports/soa.csv", reader, (req, res) => {
  const health = Object.fromEntries(engine.controlsWithHealth().map((c) => [c.id, c]));
  const LABEL = { ok: "En place", attention: "En place (test en échec)", en_cours: "En cours", a_faire: "À faire", non_applicable: "Non applicable" };
  const rows = [["Mesure Annexe A", "Intitulé", "Applicable", "Justification", "Mesures Amane", "État de mise en œuvre", "Preuves"]];
  for (const r of all("SELECT * FROM requirements WHERE framework_code = 'ISO27001' AND ref LIKE 'A.%' ORDER BY id")) {
    const cs = all("SELECT control_id FROM control_requirements WHERE requirement_id = ?", r.id).map((x) => health[x.control_id]);
    const states = [...new Set(cs.map((c) => LABEL[c.health]))];
    rows.push([r.ref, r.title, r.applicable ? "Oui" : "Non", r.justification || (r.applicable ? "Exigence retenue suite à l'appréciation des risques" : ""),
      cs.map((c) => `${c.code} ${c.title}`).join(" | "), states.join(" / "), cs.reduce((n, c) => n + c.evidence_count, 0)]);
  }
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="declaration-applicabilite-${now().slice(0, 10)}.csv"` });
  res.send(csv(rows));
});
app.get("/api/reports/:kind.csv", reader, (req, res) => {
  const sets = {
    risques: [["Risque", "Catégorie", "Actif", "Vraisemblance", "Impact", "Criticité", "Traitement", "Plan", "Criticité résiduelle", "Statut", "Échéance"],
      all("SELECT * FROM risks ORDER BY likelihood * impact DESC").map((r) => [r.title, r.category, r.asset, r.likelihood, r.impact, r.likelihood * r.impact, r.treatment, r.plan,
        r.residual_likelihood && r.residual_impact ? r.residual_likelihood * r.residual_impact : "", r.status, r.due_date])],
    traitements: [["Traitement", "Finalité", "Base légale", "Catégories de données", "Personnes concernées", "Destinataires", "Données sensibles", "Transfert hors Maroc", "Pays", "Durée de conservation", "Mesures de sécurité", "Statut CNDP", "Référence CNDP"],
      all("SELECT * FROM processing ORDER BY name").map((p) => [p.name, p.purpose, p.legal_basis, p.data_categories, p.data_subjects, p.recipients, p.sensitive ? "Oui" : "Non",
        p.transfer_abroad ? "Oui" : "Non", p.transfer_country, p.retention, p.security_measures, p.cndp_status, p.cndp_ref])],
    fournisseurs: [["Fournisseur", "Service", "Criticité", "Accès aux données", "Pays", "Fin de contrat", "Clauses données signées", "Dernière revue", "Contact"],
      all("SELECT * FROM vendors ORDER BY name").map((v) => [v.name, v.service, v.criticality, v.data_access, v.country, v.contract_end, v.dpa_signed ? "Oui" : "Non", v.reviewed_at, v.contact])],
  };
  const s = sets[req.params.kind];
  if (!s) return bad(res, "Rapport inconnu", 404);
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${req.params.kind}-${now().slice(0, 10)}.csv"` });
  res.send(csv([s[0], ...s[1]]));
});

/* ------------------------------------------------------------ web app */
app.use(express.static(path.join(__dirname, "..", "web"), { index: "index.html", extensions: ["html"] }));
app.get(/^\/(?!api\/|agent\/).*/, (req, res) => res.sendFile(path.join(__dirname, "..", "web", "index.html")));
app.use((err, req, res, _next) => { console.error(err); res.status(500).json({ error: "Erreur interne du serveur" }); });

engine.runTests();
setInterval(() => engine.runTests(), 15 * 60e3); // keep time-based tests (reviews, stale agents) fresh

app.listen(PORT, HOST, () => console.log(`Amane GRC · http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`));
