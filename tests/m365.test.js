const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("../scripts/mock-graph");
const { startAmane, seed, testStatus } = require("./helpers");

let app, u, graph;
const ids = { tenant_id: "test.onmicrosoft.com", client_id: "11111111-2222-3333-4444-555555555555" };
before(async () => {
  graph = await new Promise((ok) => { const s = start(0, { noReport: false }); s.on("listening", () => ok(s)); });
  const url = `http://127.0.0.1:${graph.address().port}`;
  app = await startAmane({ AMANE_M365_LOGIN: url, AMANE_M365_GRAPH: url });
  u = await seed(app.base);
});
after(async () => { await app.stop(); graph.close(); });

test("sans intégration, les tests Microsoft 365 restent en attente", async () => {
  for (const code of ["T-M365-MFA", "T-M365-ADMIN-MFA", "T-M365-ENFORCE"]) assert.equal((await testStatus(u.admin, code)).status, "en_attente");
});

test("configuration : droits, identifiants validés", async () => {
  assert.equal((await u.member.get("/api/integrations/m365")).status, 403);
  assert.equal((await u.auditor.put("/api/integrations/m365", {})).status, 403);
  assert.equal((await u.admin.put("/api/integrations/m365", { tenant_id: "x", client_id: "y", client_secret: "z" })).status, 400);
});

test("un secret invalide est rapporté clairement", async () => {
  await u.admin.put("/api/integrations/m365", { ...ids, client_secret: "faux" });
  const r = await u.admin.post("/api/integrations/m365/sync");
  assert.equal(r.status, 502);
  assert.match(r.data.error, /Invalid client secret/);
  assert.equal((await u.admin.get("/api/integrations/m365")).data.status, "erreur");
});

test("synchronisation (rapport P1/P2) : comptes, MFA, administrateurs, accès conditionnel", async () => {
  await u.admin.put("/api/integrations/m365", { ...ids, client_secret: "mock-secret" });
  const v = (await u.admin.post("/api/integrations/m365/sync")).data;
  assert.equal(v.status, "ok");
  assert.equal(v.details.source, "rapport");
  assert.equal(v.details.users, 7, "invité exclu, compte désactivé non compté");
  assert.equal(v.details.mfa, 4);
  assert.ok(!JSON.stringify(v).includes("mock-secret") && !JSON.stringify(v).includes("v1:"), "le secret n'est jamais renvoyé");
  assert.equal((await testStatus(u.admin, "T-M365-ENFORCE")).status, "ok");
  const admins = await testStatus(u.admin, "T-M365-ADMIN-MFA");
  assert.equal(admins.status, "echec");
  assert.deepEqual(admins.details.failing.map((f) => f.info), ["o.chraibi@atlas-demo.test"]);
  assert.equal((await testStatus(u.admin, "T-M365-MFA")).details.failing.length, 3);
});

test("même résultat sur un locataire sans P1/P2 (méthodes lues compte par compte)", async () => {
  graph.options.noReport = true;
  const v = (await u.admin.post("/api/integrations/m365/sync")).data;
  assert.equal(v.details.source, "methodes");
  assert.equal(v.details.mfa, 4);
  graph.options.noReport = false;
});

test("le secret peut être conservé lors d'un nouvel enregistrement", async () => {
  assert.equal((await u.admin.put("/api/integrations/m365", ids)).status, 200);
  assert.equal((await u.admin.post("/api/integrations/m365/sync")).status, 200);
});

test("déconnecter supprime les comptes et remet les tests en attente", async () => {
  await u.admin.del("/api/integrations/m365");
  assert.equal((await u.admin.get("/api/integrations/m365")).data.configured, false);
  assert.equal((await testStatus(u.admin, "T-M365-MFA")).status, "en_attente");
});
