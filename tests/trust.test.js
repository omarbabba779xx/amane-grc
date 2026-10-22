const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startAmane, client, seed } = require("./helpers");

let app, u, pub;
before(async () => {
  app = await startAmane(); u = await seed(app.base); pub = client(app.base);
  const pols = (await u.admin.get("/api/policies")).data;
  for (const code of ["POL-PSSI", "POL-DCP"]) await u.admin.post(`/api/policies/${pols.find((p) => p.code === code).id}/publish`);
  const ctl = (await u.admin.get("/api/controls")).data.find((c) => c.code === "GOV-01");
  await u.admin.patch(`/api/controls/${ctl.id}`, { status: "en_place" });
  await u.admin.post("/api/vendors", { name: "Hébergeur Démo", service: "Hébergement", data_access: "personnelles", country: "Maroc" });
  await u.admin.post("/api/vendors", { name: "Imprimeur", data_access: "aucune" });
});
after(() => app.stop());

test("la page publique n'existe pas tant qu'elle n'est pas publiée", async () => {
  assert.equal((await pub.get("/api/public/trust")).status, 404);
  assert.equal((await pub.get("/trust")).status, 200, "la coquille HTML est servie, les données non");
});

test("seul l'administrateur publie", async () => {
  assert.equal((await u.auditor.put("/api/trust", { enabled: true })).status, 403);
  assert.equal((await u.admin.put("/api/trust", { contact_email: "pas-un-mail" })).status, 400);
  const r = await u.admin.put("/api/trust", { enabled: true, headline: "Sécurité chez Test", contact_email: "securite@test.ma", frameworks: ["ISO27001", "LOI0908"], policies: ["POL-PSSI", "POL-DCP"], show_scores: true, show_controls: true, show_tests: true, show_subprocessors: true });
  assert.equal(r.status, 200);
});

test("la vue publique ne montre que ce qui est choisi, et seulement les mesures en place", async () => {
  const v = (await pub.get("/api/public/trust")).data;
  assert.deepEqual(v.frameworks.map((f) => f.short), ["ISO 27001", "Loi 09-08"]);
  const items = v.domains.flatMap((d) => d.items);
  assert.deepEqual(items, ["Politique de sécurité approuvée par la direction"], "aucune mesure manquante n'est exposée");
  assert.deepEqual(v.subprocessors.map((s) => s.name), ["Hébergeur Démo"]);
  assert.equal(v.policies.length, 2);
  const raw = JSON.stringify(v);
  for (const secret of ["admin@test.ma", "agent_token", "Admin Test", "\"body\"", "risks"]) assert.ok(!raw.includes(secret), secret);
});

test("le texte des politiques est verrouillé sans accès accordé", async () => {
  assert.equal((await pub.get("/api/public/trust/policies/POL-PSSI")).status, 404);
  assert.equal((await pub.get("/api/public/trust/policies/POL-PSSI?acces=nimporte")).status, 404);
});

let token;
test("demande d'accès, validation par l'administrateur, lien personnel", async () => {
  assert.equal((await pub.post("/api/public/trust/requests", { name: "x", email: "invalide" })).status, 400);
  assert.equal((await pub.post("/api/public/trust/requests", { name: "Leila Client", email: "leila@client.ma", company: "Banque", reason: "Audit fournisseur" })).status, 200);
  assert.equal((await pub.post("/api/public/trust/requests", { name: "Leila Client", email: "leila@client.ma" })).status, 400, "pas de doublon en attente");
  const req = (await u.admin.get("/api/trust")).data.requests.find((r) => r.email === "leila@client.ma");
  assert.equal((await u.auditor.get("/api/trust")).data.requests.length, 0, "l'auditeur ne voit pas les demandes");
  assert.equal((await u.auditor.post(`/api/trust/requests/${req.id}/approve`)).status, 403);
  const ok = await u.admin.post(`/api/trust/requests/${req.id}/approve`);
  assert.equal(ok.status, 200);
  token = new URL(ok.data.url).searchParams.get("acces");
  assert.ok(token.length > 20);
});

test("avec le lien : accès affiché et politiques publiées lisibles, rien d'autre", async () => {
  const v = (await pub.get(`/api/public/trust?acces=${token}`)).data;
  assert.equal(v.access.name, "Leila Client");
  const p = await pub.get(`/api/public/trust/policies/POL-PSSI?acces=${token}`);
  assert.equal(p.status, 200);
  assert.ok(p.data.body.length > 200);
  assert.equal((await pub.get(`/api/public/trust/policies/POL-ACCES?acces=${token}`)).status, 404, "politique non choisie");
});

test("les demandes publiques sont limitées par adresse IP", async () => {
  let limited = 0;
  for (let i = 0; i < 6; i++) if ((await pub.post("/api/public/trust/requests", { name: "Spam", email: `spam${i}@x.ma` })).status === 429) limited++;
  assert.ok(limited > 0);
});

test("dépublier ferme la page et les liens", async () => {
  await u.admin.put("/api/trust", { enabled: false });
  assert.equal((await pub.get(`/api/public/trust?acces=${token}`)).status, 404);
  assert.equal((await pub.get(`/api/public/trust/policies/POL-PSSI?acces=${token}`)).status, 404);
});
