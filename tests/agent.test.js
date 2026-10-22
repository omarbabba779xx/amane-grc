const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startAmane, client, seed, testStatus } = require("./helpers");

let app, u, token;
before(async () => { app = await startAmane(); u = await seed(app.base); token = (await u.admin.get("/api/org")).data.agent_token; });
after(() => app.stop());

const ok = (info = "") => ({ status: "ok", info });
const report = (device_key, user_email, results, t = token) => fetch(`${app.base}/api/agent/report`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-amane-token": t },
  body: JSON.stringify({ device_key, hostname: device_key.toUpperCase(), user_email, os: "Windows 11", os_version: "25H2", agent_version: "1.0.0", results }),
});
const all = (over = {}) => Object.fromEntries(["T-DISK", "T-AV", "T-FW", "T-UPD", "T-LOCK", "T-OS", "T-ADMIN", "T-PWD"].map((k) => [k, over[k] || ok()]));

test("le jeton de l'agent n'est visible que par un administrateur", async () => {
  assert.ok(token && token.length > 20);
  assert.equal((await u.auditor.get("/api/org")).data.agent_token, undefined);
});

test("le script d'installation exige le jeton et nettoie l'e-mail", async () => {
  assert.equal((await fetch(`${app.base}/agent/install.ps1?token=faux`)).status, 403);
  const r = await fetch(`${app.base}/agent/install.ps1?token=${token}&email=${encodeURIComponent("x@test.ma'; Remove-Item C:\\")}`);
  assert.equal(r.status, 200);
  const bytes = Buffer.from(await r.arrayBuffer()); // text() would strip the BOM
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "BOM pour Windows PowerShell 5.1");
  const script = bytes.toString("utf8");
  assert.ok(!script.includes("__TOKEN__") && !script.includes("__SERVER__") && script.includes(token));
  assert.ok(!script.includes("Remove-Item C:\\'"), "les caractères dangereux de l'e-mail sont retirés");
});

test("un rapport sans jeton valide ou incomplet est refusé", async () => {
  assert.equal((await report("pc-1", "admin@test.ma", all(), "faux")).status, 403);
  const r = await fetch(`${app.base}/api/agent/report`, { method: "POST", headers: { "Content-Type": "application/json", "x-amane-token": token }, body: "{}" });
  assert.equal(r.status, 400);
});

test("les rapports alimentent les tests des postes et l'inventaire", async () => {
  assert.equal((await testStatus(u.admin, "T-DISK")).status, "en_attente");
  assert.equal((await report("pc-admin", "admin@test.ma", all())).status, 200);
  assert.equal((await report("pc-membre", "membre@test.ma", all({ "T-DISK": { status: "echec", info: "BitLocker désactivé" } }))).status, 200);
  const disk = await testStatus(u.admin, "T-DISK");
  assert.equal(disk.status, "echec");
  assert.deepEqual(disk.details.failing.map((f) => f.name), ["PC-MEMBRE"]);
  assert.equal((await testStatus(u.admin, "T-FW")).status, "ok");
  assert.equal((await testStatus(u.admin, "T-AGENT")).status, "ok", "chaque collaborateur a un poste actif");
  const devices = (await u.auditor.get("/api/devices")).data;
  assert.equal(devices.length, 2);
  assert.equal(devices.find((d) => d.hostname === "PC-MEMBRE").user_name, "Membre Test");
  const me = (await u.member.get("/api/me/tasks")).data;
  assert.equal(me.devices[0].results["T-DISK"].status, "echec");
});

test("un nouveau rapport du même poste le met à jour au lieu de le dupliquer", async () => {
  await report("pc-membre", "membre@test.ma", all());
  assert.equal((await u.admin.get("/api/devices")).data.length, 2);
  assert.equal((await testStatus(u.admin, "T-DISK")).status, "ok");
});

test("renouveler le jeton invalide l'ancien", async () => {
  await u.admin.post("/api/org/rotate-token");
  assert.equal((await report("pc-admin", "admin@test.ma", all())).status, 403);
  token = (await u.admin.get("/api/org")).data.agent_token;
  assert.equal((await report("pc-admin", "admin@test.ma", all())).status, 200);
  assert.equal((await client(app.base).get("/api/devices")).status, 401);
});
