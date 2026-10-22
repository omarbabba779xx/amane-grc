const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startAmane, seed, testStatus, localNow } = require("./helpers");

let app, u;
before(async () => { app = await startAmane(); u = await seed(app.base); });
after(() => app.stop());

test("sans incident, les deux tests d'incidents sont conformes", async () => {
  assert.equal((await testStatus(u.admin, "T-INC-DGSSI")).status, "ok");
  assert.equal((await testStatus(u.admin, "T-INC-REX")).status, "ok");
});

test("titre et date de détection obligatoires, valeurs contrôlées", async () => {
  assert.equal((await u.admin.post("/api/incidents", { title: "x" })).status, 400);
  assert.equal((await u.admin.post("/api/incidents", { title: "x", detected_at: localNow(), severity: "apocalyptique" })).status, 400);
  assert.equal((await u.member.get("/api/incidents")).status, 403);
  assert.equal((await u.auditor.post("/api/incidents", { title: "x", detected_at: localNow() })).status, 403);
});

let id;
test("un incident à déclarer en retard fait échouer T-INC-DGSSI", async () => {
  const r = await u.admin.post("/api/incidents", { title: "Rançongiciel sur le serveur", severity: "critique", detected_at: localNow(30 * 3600e3), dgssi_required: 1, personal_data: 1 });
  assert.equal(r.status, 200);
  id = r.data.id;
  const t = await testStatus(u.admin, "T-INC-DGSSI");
  assert.equal(t.status, "echec");
  assert.match(t.details.failing[0].info, /retard de \d+ h/);
});

test("le délai interne est paramétrable et recalcule l'échéance", async () => {
  assert.equal((await u.admin.put("/api/settings/incidents", { dgssi_hours: 0 })).status, 400);
  assert.equal((await u.admin.put("/api/settings/incidents", { dgssi_hours: 72 })).status, 200);
  assert.match((await testStatus(u.admin, "T-INC-DGSSI")).details.failing[0].info, /à déclarer sous \d+ h/);
  await u.admin.put("/api/settings/incidents", { dgssi_hours: 24 });
});

test("la déclaration enregistrée rend T-INC-DGSSI conforme", async () => {
  await u.admin.patch(`/api/incidents/${id}`, { dgssi_notified_at: localNow(), dgssi_ref: "MACERT-2026-001" });
  assert.equal((await testStatus(u.admin, "T-INC-DGSSI")).status, "ok");
});

test("clore un incident grave exige cause et retour d'expérience", async () => {
  await u.admin.patch(`/api/incidents/${id}`, { status: "clos" });
  const inc = (await u.admin.get("/api/incidents")).data.find((x) => x.id === id);
  assert.match(inc.closed_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "date de clôture renseignée automatiquement");
  assert.equal((await testStatus(u.admin, "T-INC-REX")).status, "echec");
  await u.admin.patch(`/api/incidents/${id}`, { root_cause: "VPN sans MFA", lessons: "MFA imposée sur le VPN" });
  assert.equal((await testStatus(u.admin, "T-INC-REX")).status, "ok");
});

test("le tableau de bord compte les incidents ouverts et à déclarer", async () => {
  await u.admin.post("/api/incidents", { title: "Compte compromis", detected_at: localNow(), dgssi_required: 1 });
  const d = (await u.admin.get("/api/dashboard")).data;
  assert.deepEqual(d.incidents, { open: 1, to_declare: 1 });
});
