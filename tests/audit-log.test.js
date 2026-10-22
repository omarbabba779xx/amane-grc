// The activity log must reveal any modification, deletion, reordering or truncation.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startAmane, seed } = require("./helpers");

let app, u, db, ledger;
before(async () => {
  app = await startAmane(); u = await seed(app.base);
  ({ db } = require("../server/db"));
  ledger = require("../server/ledger");
  for (let i = 0; i < 5; i++) await u.admin.post("/api/risks", { title: `Risque ${i}`, likelihood: 2, impact: 3 });
});
after(() => app.stop());

const verify = async () => (await u.auditor.get("/api/audit/verify")).data;
const rows = () => db.prepare("SELECT * FROM audit_log ORDER BY id").all();
// What an attacker with the database file (but not the server key) could do: drop the protections first.
const unprotect = () => db.exec("DROP TRIGGER IF EXISTS audit_log_no_update; DROP TRIGGER IF EXISTS audit_log_no_delete; DROP TRIGGER IF EXISTS audit_anchors_no_delete;");

test("chaque action est scellée et la chaîne est intègre", async () => {
  const v = await verify();
  assert.equal(v.ok, true);
  assert.ok(v.entries >= 8, `${v.entries} entrées`);
  const r = rows();
  assert.equal(r[0].prev_hash, "0".repeat(64));
  for (let i = 1; i < r.length; i++) assert.equal(r[i].prev_hash, r[i - 1].hash);
  assert.equal(v.head.hash, r.at(-1).hash);
});

test("la vérification est accessible à l'auditeur, pas au collaborateur", async () => {
  assert.equal((await u.member.get("/api/audit/verify")).status, 403);
  const csv = await u.auditor.get("/api/reports/journal.csv");
  assert.equal(csv.status, 200);
  assert.ok(csv.data.includes(rows().at(-1).hash), "l'export contient les empreintes");
});

test("la base refuse de modifier ou supprimer une entrée", () => {
  assert.throws(() => db.exec("UPDATE audit_log SET action = 'falsifié' WHERE id = 1"), /ajout seul/);
  assert.throws(() => db.exec("DELETE FROM audit_log WHERE id = 1"), /ajout seul/);
});

test("des entrées écrites sans empreinte sont scellées après coup", async () => {
  db.prepare("INSERT INTO audit_log (at, user_id, action) VALUES (?, NULL, 'import ancien')").run(new Date().toISOString());
  assert.equal((await verify()).ok, false);
  assert.equal(ledger.seal(), 1);
  assert.equal((await verify()).ok, true);
});

test("une entrée modifiée est détectée, même si son empreinte est recalculée sans la clé", async () => {
  unprotect();
  const target = rows()[3];
  db.prepare("UPDATE audit_log SET action = ? WHERE id = ?").run("action falsifiée", target.id);
  let v = await verify();
  assert.equal(v.ok, false);
  assert.equal(v.broken.id, target.id);
  assert.match(v.broken.reason, /modifié/);
  const forged = crypto.createHash("sha256").update(JSON.stringify([target.id, target.at, target.user_id, "action falsifiée", target.entity, target.entity_id, target.details, target.prev_hash])).digest("hex");
  db.prepare("UPDATE audit_log SET hash = ? WHERE id = ?").run(forged, target.id);
  assert.equal((await verify()).ok, false, "sans la clé du serveur, l'empreinte ne peut pas être reconstruite");
  db.prepare("UPDATE audit_log SET action = ?, hash = ? WHERE id = ?").run(target.action, target.hash, target.id); // restore
  assert.equal((await verify()).ok, true);
});

test("une entrée supprimée au milieu rompt la chaîne", async () => {
  const r = rows(), victim = r[4];
  db.prepare("DELETE FROM audit_log WHERE id = ?").run(victim.id);
  const v = await verify();
  assert.equal(v.ok, false);
  assert.equal(v.broken.id, r[5].id);
  assert.match(v.broken.reason, /chaînage rompu/);
  const cols = Object.keys(victim);
  db.prepare(`INSERT INTO audit_log (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...Object.values(victim)); // restore
  assert.equal((await verify()).ok, true);
});

test("la suppression des dernières entrées est détectée grâce à l'ancrage", async () => {
  const anchored = ledger.anchor();
  assert.ok(anchored);
  assert.equal(ledger.anchor(), null, "pas de second ancrage tant que le journal n'a pas bougé");
  assert.equal(ledger.anchoredToday(), true);
  await u.admin.post("/api/risks", { title: "Après ancrage", likelihood: 1, impact: 1 });
  // Truncating the tail keeps a valid chain on its own...
  db.prepare("DELETE FROM audit_log WHERE id >= ?").run(anchored.id);
  const v = await verify();
  assert.equal(v.ok, false, "...but the anchor no longer matches");
  assert.match(v.broken.reason, /ancrage/);
});
