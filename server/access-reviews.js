// Access reviews (ISO 27001 A.5.18, measure IAM-05): a campaign takes a snapshot of the Microsoft 365 accounts
// (or of Amane's own accounts), reviewers keep, modify or remove each access, and closing the campaign files
// the decisions as evidence on IAM-05. Removals stay open until the administrator confirms they were done.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { all, get, run, tx, now, DATA } = require("./db");

const DECISIONS = ["conserver", "modifier", "retirer"];
const ROLE = { admin: "Administrateur Amane", membre: "Collaborateur Amane", auditeur: "Auditeur Amane" };
const fail = (msg, code = 400) => Object.assign(new Error(msg), { status: code });

function create({ title, scope, due_date, reviewer_id }, userId) {
  title = String(title || "").trim().slice(0, 160);
  if (!title) throw fail("Donnez un titre à la campagne.");
  if (!["m365", "amane"].includes(scope)) throw fail("Périmètre inconnu.");
  if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) throw fail("Échéance invalide.");
  const reviewer = reviewerOk(reviewer_id || userId);
  let accounts;
  if (scope === "m365") {
    const integ = get("SELECT status FROM integrations WHERE provider = 'm365'");
    if (integ?.status !== "ok") throw fail("Synchronisez d'abord Microsoft 365 (Organisation › Intégrations).");
    accounts = all("SELECT * FROM m365_users ORDER BY name").map((a) => ({ key: a.id, name: a.name, upn: a.upn, enabled: a.enabled, is_admin: a.is_admin,
      roles: a.admin_roles, mfa: a.mfa_registered, email: a.email }));
  } else {
    accounts = all("SELECT * FROM users ORDER BY name").map((a) => ({ key: `amane:${a.id}`, name: a.name, upn: a.email, enabled: a.active, is_admin: a.role === "admin" ? 1 : 0,
      roles: JSON.stringify([ROLE[a.role]]), mfa: null, email: a.email }));
  }
  if (!accounts.length) throw fail("Aucun compte à revoir.");
  return tx(() => {
    const id = Number(run("INSERT INTO access_reviews (title, scope, status, due_date, created_by, created_at) VALUES (?, ?, 'en_cours', ?, ?, ?)",
      title, scope, due_date || null, userId, now()).lastInsertRowid);
    for (const a of accounts) {
      run(`INSERT INTO access_review_items (review_id, account_key, name, upn, enabled, is_admin, admin_roles, mfa, reviewer_id, decision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')`, id, a.key, a.name, a.upn, a.enabled ? 1 : 0, a.is_admin ? 1 : 0, a.roles || "[]", a.mfa, reviewer.id);
    }
    return id;
  });
}

function reviewerOk(id) {
  const u = get("SELECT id, name, email FROM users WHERE id = ? AND active = 1 AND role != 'auditeur'", id);
  if (!u) throw fail("Le réviseur doit être un administrateur ou un collaborateur actif (un auditeur reste indépendant).");
  return u;
}

const summary = (reviewId, reviewerId = null) => get(`SELECT COUNT(*) AS total, SUM(decision != 'en_attente') AS decided, SUM(decision = 'retirer') AS to_remove,
    SUM(decision = 'modifier') AS to_modify, SUM(decision IN ('retirer', 'modifier') AND remediated = 1) AS remediated
    FROM access_review_items WHERE review_id = ? ${reviewerId ? "AND reviewer_id = ?" : ""}`, ...(reviewerId ? [reviewId, reviewerId] : [reviewId]));

// Collaborators only see the campaigns and accounts assigned to them.
function list(user) {
  const mine = user.role === "membre";
  return all(`SELECT r.*, u.name AS created_by_name FROM access_reviews r LEFT JOIN users u ON u.id = r.created_by
      ${mine ? "WHERE EXISTS (SELECT 1 FROM access_review_items i WHERE i.review_id = r.id AND i.reviewer_id = ?)" : ""} ORDER BY r.id DESC`, ...(mine ? [user.id] : []))
    .map((r) => ({ ...r, ...summary(r.id, mine ? user.id : null) }));
}

function detail(id, user) {
  const r = get("SELECT r.*, u.name AS created_by_name, c.name AS closed_by_name FROM access_reviews r LEFT JOIN users u ON u.id = r.created_by LEFT JOIN users c ON c.id = r.closed_by WHERE r.id = ?", id);
  if (!r) throw fail("Campagne introuvable", 404);
  const mine = user.role === "membre";
  const items = all(`SELECT i.*, v.name AS reviewer_name, d.name AS decided_by_name FROM access_review_items i
      LEFT JOIN users v ON v.id = i.reviewer_id LEFT JOIN users d ON d.id = i.decided_by
      WHERE i.review_id = ? ${mine ? "AND i.reviewer_id = ?" : ""} ORDER BY i.decision = 'en_attente' DESC, i.is_admin DESC, i.name`, ...(mine ? [id, user.id] : [id]))
    .map((i) => ({ ...i, admin_roles: JSON.parse(i.admin_roles || "[]") }));
  if (mine && !items.length) throw fail("Campagne introuvable", 404);
  return { ...r, ...summary(id, mine ? user.id : null), items };
}

function decide(itemId, { decision, comment }, user) {
  const i = get("SELECT i.*, r.status FROM access_review_items i JOIN access_reviews r ON r.id = i.review_id WHERE i.id = ?", itemId);
  if (!i || (user.role !== "admin" && i.reviewer_id !== user.id)) throw fail("Compte introuvable", 404);
  if (i.status !== "en_cours") throw fail("La campagne est clôturée.");
  if (!DECISIONS.includes(decision)) throw fail("Décision inconnue.");
  comment = String(comment || "").trim().slice(0, 500);
  if (decision !== "conserver" && !comment) throw fail("Précisez ce qui doit être retiré ou modifié.");
  run("UPDATE access_review_items SET decision = ?, comment = ?, decided_by = ?, decided_at = ?, remediated = 0 WHERE id = ?", decision, comment || null, user.id, now(), itemId);
  return i;
}

function assign(reviewId, itemIds, reviewerId) {
  const r = get("SELECT status FROM access_reviews WHERE id = ?", reviewId);
  if (!r) throw fail("Campagne introuvable", 404);
  if (r.status !== "en_cours") throw fail("La campagne est clôturée.");
  const reviewer = reviewerOk(reviewerId);
  const ids = (Array.isArray(itemIds) ? itemIds : []).map(Number).filter(Boolean);
  if (!ids.length) throw fail("Sélectionnez au moins un compte.");
  let n = 0;
  tx(() => { for (const id of ids) n += Number(run("UPDATE access_review_items SET reviewer_id = ? WHERE id = ? AND review_id = ?", reviewer.id, id, reviewId).changes); });
  return { reviewer, count: n };
}

function remediate(itemId, done) {
  const i = get("SELECT decision FROM access_review_items WHERE id = ?", itemId);
  if (!i) throw fail("Compte introuvable", 404);
  if (!["retirer", "modifier"].includes(i.decision)) throw fail("Seuls les accès à retirer ou modifier se suivent.");
  run("UPDATE access_review_items SET remediated = ?, remediated_at = ? WHERE id = ?", done ? 1 : 0, done ? now() : null, itemId);
}

const csvCell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
function csv(id) {
  const r = get("SELECT * FROM access_reviews WHERE id = ?", id);
  if (!r) throw fail("Campagne introuvable", 404);
  const LABEL = { en_attente: "En attente", conserver: "Conserver", modifier: "Modifier", retirer: "Retirer" };
  const rows = [["Compte", "Identifiant", "Actif", "Administrateur", "Rôles", "MFA", "Réviseur", "Décision", "Commentaire", "Décidé par", "Décidé le", "Correction faite"],
    ...all(`SELECT i.*, v.name AS reviewer, d.name AS decider FROM access_review_items i LEFT JOIN users v ON v.id = i.reviewer_id
        LEFT JOIN users d ON d.id = i.decided_by WHERE i.review_id = ? ORDER BY i.name`, id).map((i) => [i.name, i.upn, i.enabled ? "Oui" : "Non", i.is_admin ? "Oui" : "Non",
      JSON.parse(i.admin_roles || "[]").join(", "), i.mfa == null ? "—" : i.mfa ? "Oui" : "Non", i.reviewer, LABEL[i.decision], i.comment, i.decider, i.decided_at,
      ["retirer", "modifier"].includes(i.decision) ? (i.remediated ? "Oui" : "Non") : ""])];
  return { name: `revue-acces-${r.id}-${(r.closed_at || now()).slice(0, 10)}.csv`, body: "﻿" + rows.map((x) => x.map(csvCell).join(";")).join("\r\n") };
}

// Closing files the campaign as evidence on IAM-05, which the T-ACCESS-REVIEW test reads.
function close(id, user) {
  const r = get("SELECT * FROM access_reviews WHERE id = ?", id);
  if (!r) throw fail("Campagne introuvable", 404);
  if (r.status !== "en_cours") throw fail("La campagne est déjà clôturée.");
  const s = summary(id);
  if (s.decided < s.total) throw fail(`${s.total - s.decided} compte(s) restent à revoir.`);
  const ctl = get("SELECT id FROM controls WHERE code = 'IAM-05'");
  return tx(() => {
    run("UPDATE access_reviews SET status = 'cloturee', closed_by = ?, closed_at = ? WHERE id = ?", user.id, now(), id);
    const file = csv(id), stored = crypto.randomBytes(16).toString("hex");
    fs.writeFileSync(path.join(DATA, "uploads", stored), file.body);
    const note = `${s.total} comptes revus : ${s.total - s.to_remove - s.to_modify} conservés, ${s.to_modify} à modifier, ${s.to_remove} à retirer. Campagne clôturée par ${user.name}.`;
    const ev = Number(run(`INSERT INTO evidence (control_id, kind, title, file_name, stored_name, mime, size, note, uploaded_by, created_at)
        VALUES (?, 'fichier', ?, ?, ?, 'text/csv', ?, ?, ?, ?)`, ctl.id, `Revue des accès · ${r.title}`, file.name, stored, Buffer.byteLength(file.body), note, user.id, now()).lastInsertRowid);
    run("UPDATE access_reviews SET evidence_id = ? WHERE id = ?", ev, id);
    return { evidence_id: ev, ...s };
  });
}

// Pending decisions of one reviewer, for "Mon espace" and the weekly reminder.
const pendingFor = (userId) => all(`SELECT i.id, i.name, i.upn, i.is_admin, i.admin_roles, i.mfa, i.enabled, r.id AS review_id, r.title, r.due_date
    FROM access_review_items i JOIN access_reviews r ON r.id = i.review_id
    WHERE i.reviewer_id = ? AND i.decision = 'en_attente' AND r.status = 'en_cours' ORDER BY r.due_date, i.name`, userId)
  .map((i) => ({ ...i, admin_roles: JSON.parse(i.admin_roles || "[]") }));

module.exports = { create, list, detail, decide, assign, remediate, close, csv, pendingFor };
