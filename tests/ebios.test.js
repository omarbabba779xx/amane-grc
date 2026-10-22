const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startAmane, seed } = require("./helpers");

let app, u;
before(async () => { app = await startAmane(); u = await seed(app.base); });
after(() => app.stop());

const mk = async (kind, data) => {
  const r = await u.admin.post("/api/ebios", { kind, data });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.id;
};

test("validation : type connu et champs obligatoires", async () => {
  assert.equal((await u.admin.post("/api/ebios", { kind: "inconnu", data: {} })).status, 400);
  const r = await u.admin.post("/api/ebios", { kind: "evenement", data: { description: "x" } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /valeur métier|gravité/);
  assert.equal((await u.auditor.post("/api/ebios", { kind: "valeur", data: { nom: "x" } })).status, 403);
});

test("les échelles sont bornées (gravité 1 à 4, motivation 1 à 3)", async () => {
  const v = await mk("valeur", { nom: "Données clients" });
  const e = await mk("evenement", { valeur_id: v, description: "Divulgation", gravite: 9 });
  const s = await mk("srov", { source: "Cybercriminel", objectif: "Rançon", motivation: 7 });
  const items = (await u.auditor.get("/api/ebios")).data;
  assert.equal(items.find((i) => i.id === e).data.gravite, 4);
  assert.equal(items.find((i) => i.id === s).data.motivation, 3);
});

let op, st, riskId;
test("un scénario opérationnel est envoyé au registre avec ses mesures", async () => {
  const v = await mk("valeur", { nom: "Missions de conseil" });
  const e = await mk("evenement", { valeur_id: v, description: "Arrêt des missions", gravite: 4 });
  const s = await mk("srov", { source: "Cybercriminel", objectif: "Rançon", retenu: 1 });
  st = await mk("strategique", { nom: "Rançongiciel via l'infogérant", srov_id: s, evenement_id: e });
  const ids = (await u.admin.get("/api/controls")).data.filter((c) => ["OPS-01", "IAM-03"].includes(c.code)).map((c) => c.id);
  op = await mk("operationnel", { strategique_id: st, mode: "Hameçonnage puis chiffrement", vraisemblance: 3, mesures: [...ids, 999999], decision: "reduire" });
  const r = await u.admin.post(`/api/ebios/${op}/to-risk`);
  assert.equal(r.status, 200);
  riskId = r.data.risk_id;
  const risk = (await u.admin.get("/api/risks")).data.find((x) => x.id === riskId);
  assert.equal(risk.likelihood, 4, "V3 -> 4");
  assert.equal(risk.impact, 5, "G4 -> 5");
  assert.deepEqual(risk.controls.map((c) => c.code).sort(), ["IAM-03", "OPS-01"], "une mesure inexistante est ignorée");
});

test("un nouvel envoi met à jour le même risque", async () => {
  await u.admin.patch(`/api/ebios/${op}`, { data: { vraisemblance: 1 } });
  const r = await u.admin.post(`/api/ebios/${op}/to-risk`);
  assert.equal(r.data.risk_id, riskId);
  assert.equal((await u.admin.get("/api/risks")).data.filter((x) => x.title === "Rançongiciel via l'infogérant").length, 1);
  assert.equal((await u.admin.get("/api/risks")).data.find((x) => x.id === riskId).likelihood, 1);
});

test("supprimer un élément parent garde l'enfant et vide le lien", async () => {
  await u.admin.del(`/api/ebios/${st}`);
  const child = (await u.admin.get("/api/ebios")).data.find((i) => i.id === op);
  assert.equal(child.data.strategique_id, null);
  assert.equal((await u.admin.post(`/api/ebios/${op}/to-risk`)).status, 400);
});
