const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startAmane, seed, testStatus } = require("./helpers");

let app, u;
before(async () => { app = await startAmane(); u = await seed(app.base); });
after(() => app.stop());

const control = async (code) => (await u.admin.get("/api/controls")).data.find((c) => c.code === code);

test("contenu réglementaire chargé : 66 mesures, 5 référentiels dont 2 optionnels", async () => {
  const controls = (await u.admin.get("/api/controls")).data;
  assert.equal(controls.length, 66);
  const all = (await u.admin.get("/api/frameworks-all")).data;
  assert.deepEqual(all.map((f) => f.code), ["ISO27001", "LOI0908", "DNSSI", "NIST_CSF", "COBIT"]);
  assert.deepEqual(all.filter((f) => !f.enabled).map((f) => f.code), ["NIST_CSF", "COBIT"]);
  const iso = (await u.admin.get("/api/frameworks/ISO27001")).data;
  assert.equal(iso.requirements_list.length, 116); // clauses 4 to 10 + 93 Annex A controls
});

test("chaque exigence des référentiels activés est couverte par au moins une mesure", async () => {
  for (const fw of ["ISO27001", "LOI0908", "DNSSI"]) {
    const f = (await u.admin.get(`/api/frameworks/${fw}`)).data;
    const orphans = f.requirements_list.filter((r) => r.applicable && !r.controls.length).map((r) => r.ref);
    assert.deepEqual(orphans, [], fw);
  }
});

test("activer NIST CSF et COBIT : 22 catégories couvertes, 8 objectifs COBIT exclus avec justification", async () => {
  assert.equal((await u.auditor.patch("/api/frameworks/NIST_CSF", { enabled: true })).status, 403);
  for (const fw of ["NIST_CSF", "COBIT"]) assert.equal((await u.admin.patch(`/api/frameworks/${fw}`, { enabled: true })).status, 200);
  const nist = (await u.admin.get("/api/frameworks/NIST_CSF")).data;
  assert.equal(nist.requirements_list.length, 22);
  assert.ok(nist.requirements_list.every((r) => r.controls.length));
  const cobit = (await u.admin.get("/api/frameworks/COBIT")).data;
  const excluded = cobit.requirements_list.filter((r) => !r.applicable);
  assert.equal(excluded.length, 8);
  assert.ok(excluded.every((r) => r.justification && !r.controls.length));
  await u.admin.patch("/api/frameworks/COBIT", { enabled: false });
  assert.equal((await u.admin.get("/api/frameworks/COBIT")).status, 404);
  assert.ok(!(await control("GOV-01")).frameworks.COBIT, "les étiquettes d'un référentiel désactivé disparaissent");
});

test("une mesure exclue exige une justification", async () => {
  const c = await control("DEV-01");
  assert.equal((await u.admin.patch(`/api/controls/${c.id}`, { status: "non_applicable" })).status, 400);
  assert.equal((await u.admin.patch(`/api/controls/${c.id}`, { status: "non_applicable", justification: "Aucun développement" })).status, 200);
  assert.equal((await control("DEV-01")).health, "non_applicable");
});

test("le score d'un référentiel progresse quand une mesure passe en place", async () => {
  const before = (await u.admin.get("/api/frameworks")).data.find((f) => f.code === "LOI0908").score;
  const c = await control("PRV-03");
  await u.admin.patch(`/api/controls/${c.id}`, { status: "en_place" });
  const after = (await u.admin.get("/api/frameworks")).data.find((f) => f.code === "LOI0908").score;
  assert.ok(after > before, `${before} -> ${after}`);
});

test("preuves : note, lien (http obligatoire) et fichier téléchargeable", async () => {
  const c = await control("GOV-02");
  const base = `/api/controls/${c.id}/evidence`;
  assert.equal((await u.admin.post(base, { kind: "note", title: "Nomination du RSSI", note: "Note DG-2026-01" })).status, 200);
  assert.equal((await u.admin.post(base, { kind: "lien", title: "Lien", url: "javascript:alert(1)" })).status, 400);
  const up = await u.admin.call("POST", base, Buffer.from("contenu de la preuve"), { "Content-Type": "text/plain", "X-File-Name": encodeURIComponent("nomination.txt") });
  assert.equal(up.status, 200);
  const detail = (await u.admin.get(`/api/controls/${c.id}`)).data;
  assert.equal(detail.evidence.length, 2);
  const file = detail.evidence.find((e) => e.kind === "fichier");
  const dl = await u.auditor.get(`/api/evidence/${file.id}/download`);
  assert.equal(dl.status, 200);
  assert.equal(dl.data, "contenu de la preuve");
  assert.equal((await u.member.get(`/api/evidence/${file.id}/download`)).status, 403);
});

test("politiques : publication, acceptation par le collaborateur et test T-POL-ACCEPT", async () => {
  assert.equal((await testStatus(u.admin, "T-POL-ACCEPT")).status, "echec"); // nothing published yet
  const pols = (await u.admin.get("/api/policies")).data;
  assert.equal(pols.length, 12);
  assert.equal((await u.member.get("/api/policies")).data.length, 0, "un collaborateur ne voit pas les brouillons");
  const pssi = pols.find((p) => p.code === "POL-PSSI");
  assert.equal((await u.admin.post(`/api/policies/${pssi.id}/publish`)).data.version, 1);
  assert.equal((await u.member.get("/api/policies")).data.length, 1);
  await u.admin.post(`/api/policies/${pssi.id}/accept`);
  assert.equal((await testStatus(u.admin, "T-POL-ACCEPT")).status, "echec", "le collaborateur n'a pas encore accepté");
  await u.member.post(`/api/policies/${pssi.id}/accept`);
  assert.equal((await testStatus(u.admin, "T-POL-ACCEPT")).status, "ok");
  await u.admin.post(`/api/policies/${pssi.id}/publish`); // v2: acceptances must be renewed
  assert.equal((await testStatus(u.admin, "T-POL-ACCEPT")).status, "echec");
});

test("registres : risques (échelles 1 à 5), fournisseurs, traitements 09-08", async () => {
  assert.equal((await u.admin.post("/api/risks", { title: "x", likelihood: 7, impact: 2 })).status, 400);
  const ids = (await u.admin.get("/api/controls")).data.filter((c) => ["OPS-01", "IAM-03"].includes(c.code)).map((c) => c.id);
  const r = await u.admin.post("/api/risks", { title: "Rançongiciel", likelihood: 3, impact: 5, control_ids: ids });
  assert.equal(r.status, 200);
  assert.equal((await u.admin.get("/api/risks")).data.find((x) => x.id === r.data.id).controls.length, 2);
  assert.equal((await testStatus(u.admin, "T-RISK-REVIEW")).status, "ok");
  await u.admin.post("/api/vendors", { name: "Hébergeur", criticality: "elevee", data_access: "personnelles" });
  assert.equal((await testStatus(u.admin, "T-VENDOR-REVIEW")).status, "echec");
  await u.admin.post("/api/processing", { name: "Paie", purpose: "Salaires", legal_basis: "Obligation légale", retention: "5 ans", cndp_status: "non_declare" });
  assert.equal((await testStatus(u.admin, "T-0908-REG")).status, "ok");
  assert.equal((await testStatus(u.admin, "T-0908-DECL")).status, "echec");
});

test("exports : déclaration d'applicabilité (93 mesures de l'Annexe A) et registres CSV", async () => {
  const soa = await u.auditor.get("/api/reports/soa.csv");
  assert.equal(soa.status, 200);
  assert.equal(soa.data.trim().split("\r\n").length, 94);
  for (const k of ["risques", "traitements", "fournisseurs"]) assert.equal((await u.auditor.get(`/api/reports/${k}.csv`)).status, 200, k);
  assert.equal((await u.auditor.get("/api/reports/inconnu.csv")).status, 404);
});

test("le tableau de bord résume le programme", async () => {
  const d = (await u.auditor.get("/api/dashboard")).data;
  assert.equal(d.frameworks.length, 4); // ISO, 09-08, DNSSI, NIST (enabled above)
  assert.equal(d.controls.total, 66);
  assert.ok(d.tests.total >= 22);
  assert.equal(d.people, 2);
});
