// Tamper-evident activity log. Each entry is chained to the previous one with an HMAC-SHA256 keyed by the
// server secret: editing, deleting or reordering an entry breaks the chain, and the chain cannot be recomputed
// without the key. SQLite triggers make the table append-only; daily anchors (also e-mailed when alerts are
// configured) make the removal of the most recent entries detectable.
const crypto = require("crypto");
const { db, all, get, run, now } = require("./db");
const { macKey } = require("./secrets");

const GENESIS = "0".repeat(64);
const fields = (r) => JSON.stringify([r.id, r.at, r.user_id ?? null, r.action, r.entity ?? null, r.entity_id ?? null, r.details ?? null, r.prev_hash]);
const mac = (r) => crypto.createHmac("sha256", macKey()).update(fields(r)).digest("hex");

db.exec(`
CREATE TABLE IF NOT EXISTS audit_anchors (id INTEGER PRIMARY KEY, at TEXT NOT NULL, entry_id INTEGER NOT NULL, hash TEXT NOT NULL, sent_to TEXT);
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'journal en ajout seul'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log WHEN OLD.hash IS NOT NULL BEGIN SELECT RAISE(ABORT, 'journal en ajout seul'); END;
CREATE TRIGGER IF NOT EXISTS audit_anchors_no_delete BEFORE DELETE ON audit_anchors BEGIN SELECT RAISE(ABORT, 'ancrages en ajout seul'); END;
CREATE TRIGGER IF NOT EXISTS audit_anchors_no_update BEFORE UPDATE ON audit_anchors BEGIN SELECT RAISE(ABORT, 'ancrages en ajout seul'); END;
`);

// Seals entries written without a hash (older versions, the demo script) in id order.
function seal() {
  const pending = all("SELECT * FROM audit_log WHERE hash IS NULL ORDER BY id");
  if (!pending.length) return 0;
  let prev = get("SELECT hash FROM audit_log WHERE hash IS NOT NULL AND id < ? ORDER BY id DESC LIMIT 1", pending[0].id)?.hash || GENESIS;
  for (const r of pending) {
    const row = { ...r, prev_hash: prev };
    prev = mac(row);
    run("UPDATE audit_log SET prev_hash = ?, hash = ? WHERE id = ?", row.prev_hash, prev, r.id);
  }
  return pending.length;
}

function append(userId, action, entity, entityId, details) {
  const id = Number(run("INSERT INTO audit_log (at, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)",
    now(), userId ?? null, action, entity ?? null, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null).lastInsertRowid);
  seal(); // the new row is the only unsealed one
  return id;
}

const head = () => get("SELECT id, at, hash FROM audit_log WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1") || null;

// Recomputes the whole chain and checks every anchor still matches its entry.
function verify() {
  let prev = GENESIS, count = 0, broken = null;
  for (const r of db.prepare("SELECT * FROM audit_log ORDER BY id").iterate()) {
    count++;
    if (!r.hash) { broken = { id: r.id, reason: "entrée non scellée" }; break; }
    if (r.prev_hash !== prev) { broken = { id: r.id, reason: "chaînage rompu : une entrée précédente a été supprimée ou modifiée" }; break; }
    if (mac(r) !== r.hash) { broken = { id: r.id, reason: "contenu modifié après écriture" }; break; }
    prev = r.hash;
  }
  const anchors = all("SELECT * FROM audit_anchors ORDER BY id");
  if (!broken) {
    for (const a of anchors) {
      const e = get("SELECT hash FROM audit_log WHERE id = ?", a.entry_id);
      if (!e || e.hash !== a.hash) { broken = { id: a.entry_id, reason: `l'ancrage du ${a.at.slice(0, 10)} ne correspond plus : des entrées ont été supprimées` }; break; }
    }
  }
  return { ok: !broken, entries: count, broken, head: head(), anchors: anchors.length, last_anchor: anchors.at(-1) || null, checked_at: now() };
}

// Records the current head (once a day); the caller may send it outside the server.
function anchor(sentTo = null) {
  const h = head();
  if (!h) return null;
  const last = get("SELECT * FROM audit_anchors ORDER BY id DESC LIMIT 1");
  if (last && last.entry_id === h.id) return null;
  run("INSERT INTO audit_anchors (at, entry_id, hash, sent_to) VALUES (?, ?, ?, ?)", now(), h.id, h.hash, sentTo);
  return h;
}
const anchoredToday = () => !!get("SELECT 1 FROM audit_anchors WHERE substr(at, 1, 10) = ?", now().slice(0, 10));

module.exports = { append, seal, verify, anchor, anchoredToday, head };
