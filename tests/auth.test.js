const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startAmane, client, seed, PASSWORD } = require("./helpers");

let app, users;
before(async () => { app = await startAmane(); users = await seed(app.base); });
after(() => app.stop());

test("l'installation initiale ne peut se faire qu'une fois", async () => {
  const r = await client(app.base).post("/api/setup", { orgName: "Autre", name: "X", email: "x@test.ma", password: PASSWORD });
  assert.equal(r.status, 409);
});

test("un mot de passe de moins de 12 caractères est refusé", async () => {
  const r = await users.admin.post("/api/me/password", { current: PASSWORD, password: "court" });
  assert.equal(r.status, 400);
});

test("connexion : mauvais mot de passe refusé, compte inconnu refusé", async () => {
  assert.equal((await client(app.base).login("admin@test.ma", "mauvais-mot-de-passe")).status, 401);
  assert.equal((await client(app.base).login("inconnu@test.ma")).status, 401);
});

test("le cookie de session est HttpOnly et SameSite=Strict", async () => {
  const r = await client(app.base).login("admin@test.ma");
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
});

test("sans session, l'API répond 401", async () => {
  for (const p of ["/api/dashboard", "/api/controls", "/api/users", "/api/incidents", "/api/ebios", "/api/trust"]) {
    assert.equal((await client(app.base).get(p)).status, 401, p);
  }
});

test("un collaborateur n'accède qu'à son espace et aux politiques", async () => {
  for (const p of ["/api/dashboard", "/api/controls", "/api/users", "/api/risks", "/api/incidents", "/api/devices", "/api/activity"]) {
    assert.equal((await users.member.get(p)).status, 403, p);
  }
  assert.equal((await users.member.get("/api/me/tasks")).status, 200);
  assert.equal((await users.member.get("/api/policies")).status, 200);
});

test("un auditeur lit tout mais ne modifie rien", async () => {
  assert.equal((await users.auditor.get("/api/dashboard")).status, 200);
  assert.equal((await users.auditor.get("/api/controls")).status, 200);
  const ctl = (await users.auditor.get("/api/controls")).data[0];
  assert.equal((await users.auditor.patch(`/api/controls/${ctl.id}`, { status: "en_place" })).status, 403);
  assert.equal((await users.auditor.post("/api/risks", { title: "x", likelihood: 2, impact: 2 })).status, 403);
  assert.equal((await users.auditor.get("/api/settings/mail")).status, 403);
});

test("un administrateur ne peut pas retirer ses propres droits", async () => {
  const me = (await users.admin.get("/api/users")).data.find((u) => u.email === "admin@test.ma");
  assert.equal((await users.admin.patch(`/api/users/${me.id}`, { role: "membre" })).status, 400);
});

test("désactiver un compte ferme ses sessions", async () => {
  const u = await users.admin.post("/api/users", { email: "depart@test.ma", name: "Départ", role: "membre" });
  const c = client(app.base);
  await c.login("depart@test.ma", u.data.temporary_password);
  assert.equal((await c.get("/api/me/tasks")).status, 200);
  await users.admin.patch(`/api/users/${u.data.id}`, { active: 0 });
  assert.equal((await c.get("/api/me/tasks")).status, 401);
});

test("la déconnexion invalide la session", async () => {
  const c = client(app.base);
  await c.login("admin@test.ma");
  await c.post("/api/logout");
  assert.equal((await c.get("/api/dashboard")).status, 401);
});

test("les en-têtes de sécurité sont présents", async () => {
  const r = await fetch(app.base + "/");
  assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-powered-by"), null);
});

test("dix échecs de connexion bloquent l'adresse IP", async () => {
  const c = client(app.base);
  let last;
  for (let i = 0; i < 11; i++) last = await c.login("admin@test.ma", "toujours-faux-" + i);
  assert.equal(last.status, 429);
});
