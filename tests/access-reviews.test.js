const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("../scripts/mock-graph");
const { startAmane, seed, testStatus } = require("./helpers");

let app, u, graph;
before(async () => {
  graph = await new Promise((ok) => { const s = start(0, { noReport: false }); s.on("listening", () => ok(s)); });
  const url = `http://127.0.0.1:${graph.address().port}`;
  app = await startAmane({ AMANE_M365_LOGIN: url, AMANE_M365_GRAPH: url });
  u = await seed(app.base);
});
after(async () => { await app.stop(); graph.close(); });

const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

test("une campagne Microsoft 365 exige une synchronisation réussie", async () => {
  const r = await u.admin.post("/api/access-reviews", { title: "Revue T4", scope: "m365", due_date: due });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /Synchronisez/);
  assert.equal((await u.auditor.post("/api/access-reviews", { title: "x", scope: "amane" })).status, 403);
});

let id, items;
test("lancer une campagne fige la liste des comptes Microsoft 365", async () => {
  await u.admin.put("/api/integrations/m365", { tenant_id: "test.onmicrosoft.com", client_id: "11111111-2222-3333-4444-555555555555", client_secret: "mock-secret" });
  await u.admin.post("/api/integrations/m365/sync");
  assert.equal((await u.admin.post("/api/access-reviews", { title: "Revue T4", scope: "m365", reviewer_id: u.auditor.id })).status, 400, "un auditeur ne peut pas être réviseur");
  const r = await u.admin.post("/api/access-reviews", { title: "Revue T4", scope: "m365", due_date: due });
  assert.equal(r.status, 200);
  id = r.data.id;
  const d = (await u.admin.get(`/api/access-reviews/${id}`)).data;
  items = d.items;
  assert.equal(d.total, 8, "comptes actifs et désactivés, invité exclu");
  assert.equal(d.decided, 0);
  const admin = items.find((i) => i.upn === "o.chraibi@atlas-demo.test");
  assert.equal(admin.is_admin, 1);
  assert.deepEqual(admin.admin_roles.sort(), ["Exchange Administrator", "User Administrator"]);
  assert.equal(admin.mfa, 0);
  assert.equal(items.find((i) => i.upn === "stagiaire@atlas-demo.test").enabled, 0);
});

test("assignation à un collaborateur, qui ne voit que ses comptes", async () => {
  const mine = items.filter((i) => ["k.tazi@atlas-demo.test", "h.elfassi@atlas-demo.test"].includes(i.upn)).map((i) => i.id);
  assert.equal((await u.member.post(`/api/access-reviews/${id}/assign`, { item_ids: mine, reviewer_id: u.member.id })).status, 403);
  const r = await u.admin.post(`/api/access-reviews/${id}/assign`, { item_ids: mine, reviewer_id: u.member.id });
  assert.equal(r.data.count, 2);
  const seen = (await u.member.get(`/api/access-reviews/${id}`)).data;
  assert.equal(seen.items.length, 2);
  assert.equal((await u.member.get("/api/access-reviews")).data.length, 1);
  const tasks = (await u.member.get("/api/me/tasks")).data.access_reviews;
  assert.equal(tasks.length, 2);
  const other = items.find((i) => i.upn === "rssi@atlas-demo.test");
  assert.equal((await u.member.patch(`/api/access-reviews/items/${other.id}`, { decision: "conserver" })).status, 404, "pas de décision sur un compte d'un autre réviseur");
});

test("retirer ou modifier exige une précision", async () => {
  const k = items.find((i) => i.upn === "k.tazi@atlas-demo.test");
  assert.equal((await u.member.patch(`/api/access-reviews/items/${k.id}`, { decision: "retirer" })).status, 400);
  assert.equal((await u.member.patch(`/api/access-reviews/items/${k.id}`, { decision: "inventée", comment: "x" })).status, 400);
  assert.equal((await u.member.patch(`/api/access-reviews/items/${k.id}`, { decision: "modifier", comment: "Retirer l'accès au SharePoint Finance" })).status, 200);
  const h = items.find((i) => i.upn === "h.elfassi@atlas-demo.test");
  assert.equal((await u.member.patch(`/api/access-reviews/items/${h.id}`, { decision: "conserver" })).status, 200);
  assert.equal((await u.member.get("/api/me/tasks")).data.access_reviews.length, 0);
});

test("la clôture exige que tous les comptes soient revus", async () => {
  const r = await u.admin.post(`/api/access-reviews/${id}/close`);
  assert.equal(r.status, 400);
  assert.match(r.data.error, /6 compte\(s\) restent/);
});

test("clôturer dépose la preuve sur IAM-05 et ouvre le suivi des retraits", async () => {
  const pending = (await u.admin.get(`/api/access-reviews/${id}`)).data.items.filter((i) => i.decision === "en_attente");
  for (const i of pending) {
    const remove = i.upn === "stagiaire@atlas-demo.test";
    assert.equal((await u.admin.patch(`/api/access-reviews/items/${i.id}`, remove ? { decision: "retirer", comment: "Stage terminé : supprimer le compte" } : { decision: "conserver" })).status, 200);
  }
  assert.equal((await testStatus(u.admin, "T-ACCESS-REVIEW")).status, "echec");
  const c = await u.admin.post(`/api/access-reviews/${id}/close`);
  assert.equal(c.status, 200);
  assert.equal(c.data.to_remove, 1);
  assert.equal((await testStatus(u.admin, "T-ACCESS-REVIEW")).status, "ok");
  const iam05 = (await u.admin.get("/api/controls")).data.find((x) => x.code === "IAM-05");
  const ev = (await u.admin.get(`/api/controls/${iam05.id}`)).data.evidence.find((e) => e.id === c.data.evidence_id);
  assert.equal(ev.kind, "fichier");
  const file = await u.auditor.get(`/api/evidence/${ev.id}/download`);
  assert.match(file.data, /stagiaire@atlas-demo\.test/);
  assert.match(file.data, /Stage terminé/);
  const rem = await testStatus(u.admin, "T-ACCESS-REMEDIATION");
  assert.equal(rem.status, "echec");
  assert.equal(rem.details.failing.length, 2, "un accès à retirer et un à modifier");
});

test("une campagne clôturée est figée", async () => {
  const any = items[0];
  assert.equal((await u.admin.patch(`/api/access-reviews/items/${any.id}`, { decision: "retirer", comment: "x" })).status, 400);
  assert.equal((await u.admin.post(`/api/access-reviews/${id}/close`)).status, 400);
});

test("confirmer les corrections rend T-ACCESS-REMEDIATION conforme", async () => {
  const d = (await u.admin.get(`/api/access-reviews/${id}`)).data;
  const keep = d.items.find((i) => i.decision === "conserver");
  assert.equal((await u.admin.patch(`/api/access-reviews/items/${keep.id}/remediation`, { remediated: true })).status, 400);
  for (const i of d.items.filter((x) => ["retirer", "modifier"].includes(x.decision))) {
    assert.equal((await u.member.patch(`/api/access-reviews/items/${i.id}/remediation`, { remediated: true })).status, 403);
    assert.equal((await u.admin.patch(`/api/access-reviews/items/${i.id}/remediation`, { remediated: true })).status, 200);
  }
  assert.equal((await testStatus(u.admin, "T-ACCESS-REMEDIATION")).status, "ok");
});

test("export CSV et campagne sur les comptes Amane", async () => {
  const csv = await u.auditor.get(`/api/access-reviews/${id}/export.csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-disposition"), /revue-acces-/);
  const r = await u.admin.post("/api/access-reviews", { title: "Comptes Amane", scope: "amane" });
  const d = (await u.admin.get(`/api/access-reviews/${r.data.id}`)).data;
  assert.equal(d.total, 3);
  assert.ok(d.items.every((i) => i.mfa === null));
  const dash = (await u.admin.get("/api/dashboard")).data.access_reviews;
  assert.equal(dash.open, 1);
  assert.equal(dash.pending, 3);
});
