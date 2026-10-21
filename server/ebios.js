// EBIOS Risk Manager (ANSSI method), 5 workshops. Items are stored as JSON by kind;
// operational scenarios can be sent to the risk register, where they are followed like any other risk.
const { all, get, run, tx, now } = require("./db");

const txt = (max = 2000) => (v) => (v == null || v === "" ? null : String(v).trim().slice(0, max));
const lvl = (max) => (v) => (v == null || v === "" ? null : Math.min(max, Math.max(1, Math.round(Number(v)) || 1)));
const ref = (v) => (v == null || v === "" ? null : Number(v) || null);
const bool = (v) => (v ? 1 : 0);
const ids = (v) => (Array.isArray(v) ? v.map(Number).filter(Boolean) : []);

// kind: { fields: {name: parser}, required: [names] }
const KINDS = {
  valeur: { fields: { nom: txt(200), nature: txt(40), description: txt(), responsable: txt(120) }, required: ["nom"] },
  bien: { fields: { nom: txt(200), valeur_id: ref, type: txt(60), responsable: txt(120) }, required: ["nom"] },
  evenement: { fields: { valeur_id: ref, description: txt(), impacts: txt(), gravite: lvl(4) }, required: ["valeur_id", "description", "gravite"] },
  ecart: { fields: { referentiel: txt(120), description: txt(), justification: txt() }, required: ["description"] },
  srov: { fields: { source: txt(200), objectif: txt(300), motivation: lvl(3), ressources: lvl(3), activite: lvl(3), retenu: bool }, required: ["source", "objectif"] },
  partie: { fields: { nom: txt(200), categorie: txt(60), dependance: lvl(4), penetration: lvl(4), maturite: lvl(4), confiance: lvl(4) }, required: ["nom"] },
  strategique: { fields: { nom: txt(200), srov_id: ref, evenement_id: ref, chemin: txt(), parties: txt(500) }, required: ["nom", "srov_id", "evenement_id"] },
  operationnel: { fields: { strategique_id: ref, mode: txt(3000), vraisemblance: lvl(4), mesures: ids, decision: txt(20), risk_id: ref }, required: ["strategique_id", "mode", "vraisemblance"] },
};
const LABEL = { nom: "nom", valeur_id: "valeur métier", description: "description", gravite: "gravité", source: "source de risque", objectif: "objectif visé",
  srov_id: "couple SR/OV", evenement_id: "événement redouté", strategique_id: "scénario stratégique", mode: "mode opératoire", vraisemblance: "vraisemblance" };

function parse(kind, input, prev = {}) {
  const k = KINDS[kind];
  if (!k) throw new Error("Type d'élément inconnu.");
  const data = { ...prev };
  for (const [name, p] of Object.entries(k.fields)) if (input[name] !== undefined) data[name] = p(input[name]);
  const missing = k.required.filter((f) => data[f] == null || data[f] === "");
  if (missing.length) throw new Error(`Champ obligatoire : ${missing.map((m) => LABEL[m] || m).join(", ")}.`);
  return data;
}

const list = () => all("SELECT id, kind, data, created_at, updated_at FROM ebios ORDER BY id").map((r) => ({ ...r, data: JSON.parse(r.data) }));
const item = (id) => { const r = get("SELECT * FROM ebios WHERE id = ?", id); return r ? { ...r, data: JSON.parse(r.data) } : null; };

function create(kind, input) {
  return Number(run("INSERT INTO ebios (kind, data, created_at, updated_at) VALUES (?, ?, ?, ?)", kind, JSON.stringify(parse(kind, input)), now(), now()).lastInsertRowid);
}
function update(id, input) {
  const it = item(id);
  if (!it) throw new Error("Élément introuvable");
  run("UPDATE ebios SET data = ?, updated_at = ? WHERE id = ?", JSON.stringify(parse(it.kind, input, it.data)), now(), id);
}
function remove(id) {
  const it = item(id);
  if (!it) return;
  // items that point to this one keep working, their link is simply emptied
  const links = { valeur: ["bien.valeur_id", "evenement.valeur_id"], evenement: ["strategique.evenement_id"], srov: ["strategique.srov_id"], strategique: ["operationnel.strategique_id"] }[it.kind] || [];
  tx(() => {
    for (const l of links) {
      const [kind, field] = l.split(".");
      for (const o of list().filter((x) => x.kind === kind && x.data[field] === id)) run("UPDATE ebios SET data = ? WHERE id = ?", JSON.stringify({ ...o.data, [field]: null }), o.id);
    }
    run("DELETE FROM ebios WHERE id = ?", id);
  });
}

// EBIOS scales (gravity and likelihood on 4 levels) mapped onto the 5-level register scale
const TO5 = { 1: 1, 2: 2, 3: 4, 4: 5 };

function toRisk(id) {
  const op = item(id);
  if (!op || op.kind !== "operationnel") throw new Error("Scénario opérationnel introuvable");
  const st = item(op.data.strategique_id), ev = st && item(st.data.evenement_id), sr = st && item(st.data.srov_id);
  if (!st || !ev) throw new Error("Le scénario stratégique ou l'événement redouté lié a été supprimé.");
  const valeur = item(ev.data.valeur_id);
  const f = {
    title: `${st.data.nom}`.slice(0, 200),
    description: `Analyse EBIOS RM.\nSource de risque : ${sr?.data.source || "—"} (objectif : ${sr?.data.objectif || "—"}).\nÉvénement redouté : ${ev.data.description}\nMode opératoire : ${op.data.mode}`,
    category: "Cyberattaque", asset: valeur?.data.nom || null,
    likelihood: TO5[op.data.vraisemblance], impact: TO5[ev.data.gravite], treatment: ["reduire", "accepter", "transferer", "eviter"].includes(op.data.decision) ? op.data.decision : "reduire",
  };
  return tx(() => {
    let riskId = op.data.risk_id && get("SELECT id FROM risks WHERE id = ?", op.data.risk_id)?.id;
    if (riskId) run("UPDATE risks SET title = ?, description = ?, category = ?, asset = ?, likelihood = ?, impact = ?, treatment = ? WHERE id = ?", ...Object.values(f), riskId);
    else riskId = Number(run("INSERT INTO risks (title, description, category, asset, likelihood, impact, treatment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", ...Object.values(f), now()).lastInsertRowid);
    for (const cid of op.data.mesures || []) if (get("SELECT 1 FROM controls WHERE id = ?", cid)) run("INSERT OR IGNORE INTO risk_controls VALUES (?, ?)", riskId, cid);
    run("UPDATE ebios SET data = ?, updated_at = ? WHERE id = ?", JSON.stringify({ ...op.data, risk_id: riskId }), now(), id);
    return riskId;
  });
}

module.exports = { KINDS, list, create, update, remove, toRisk };
