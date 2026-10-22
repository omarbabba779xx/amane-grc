const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { smtpSink } = require("./smtp-sink");
const { startAmane, client, seed, localNow, wait } = require("./helpers");

let app, u, smtp;
before(async () => { smtp = await smtpSink(); app = await startAmane(); u = await seed(app.base); });
after(async () => { await app.stop(); await smtp.close(); });

const until = async (pred, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (pred()) return true; await wait(50); } return false; };

test("configuration réservée à l'administrateur et validée", async () => {
  assert.equal((await u.auditor.get("/api/settings/mail")).status, 403);
  assert.equal((await u.admin.put("/api/settings/mail", { host: "serveur invalide;" })).status, 400);
  assert.equal((await u.admin.put("/api/settings/mail", { from: "pas-une-adresse" })).status, 400);
  assert.equal((await u.admin.post("/api/settings/mail/test")).status, 502, "rien n'est configuré");
});

test("le mot de passe SMTP est chiffré et jamais renvoyé", async () => {
  const r = await u.admin.put("/api/settings/mail", { host: "127.0.0.1", port: smtp.port, user: "amane", pass: "mot-de-passe-smtp", from: "amane@test.ma", base_url: "https://amane.test.ma/" });
  assert.equal(r.status, 200);
  const v = (await u.admin.get("/api/settings/mail")).data;
  assert.equal(v.has_password, true);
  assert.equal(v.base_url, "https://amane.test.ma", "barre finale retirée");
  assert.ok(!JSON.stringify(v).includes("mot-de-passe-smtp"));
});

test("e-mail de test et journal des envois", async () => {
  const r = await u.admin.post("/api/settings/mail/test");
  assert.equal(r.status, 200);
  assert.ok(smtp.mails.some((m) => m.subject === "Test des alertes Amane" && m.to.includes("admin@test.ma")));
  assert.equal((await u.admin.get("/api/settings/mail")).data.log[0].status, "envoye");
});

test("un test qui passe en échec alerte les administrateurs, une seule fois", async () => {
  const n = smtp.mails.length;
  await u.admin.post("/api/incidents", { title: "Incident", detected_at: localNow(48 * 3600e3), dgssi_required: 1 });
  assert.ok(await until(() => smtp.mails.slice(n).some((m) => m.subject.includes("Incidents déclarés à la DGSSI"))));
  const count = smtp.mails.length;
  await u.admin.post("/api/tests/run");
  await wait(300);
  assert.equal(smtp.mails.length, count, "pas de nouvelle alerte tant que le test reste en échec");
});

test("les relances listent les actions de chaque collaborateur", async () => {
  const n = smtp.mails.length;
  const r = await u.admin.post("/api/settings/mail/reminders");
  assert.equal(r.status, 200);
  assert.ok(await until(() => smtp.mails.length - n === r.data.sent));
  const toMember = smtp.mails.slice(n).find((m) => m.to.includes("membre@test.ma"));
  assert.match(toMember.body, /formation/);
  assert.match(toMember.body, /agent/);
  assert.match(toMember.body, /https:\/\/amane\.test\.ma\/#\/mon-espace/);
});

test("une demande d'accès au Trust Center prévient les administrateurs", async () => {
  await u.admin.put("/api/trust", { enabled: true });
  const n = smtp.mails.length;
  await client(app.base).post("/api/public/trust/requests", { name: "Client\r\nBcc: pirate@x.ma", email: "client@x.ma" });
  assert.ok(await until(() => smtp.mails.slice(n).some((m) => m.subject.includes("demande d'accès"))));
  assert.ok(smtp.mails.slice(n).every((m) => !m.to.includes("pirate@x.ma")), "pas d'injection d'en-tête");
});
