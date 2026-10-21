// Builds a demonstration database for a fictional company (Atlas Conseil SARL).
//   node scripts/demo.js   ->  demo-data/amane.db, then: AMANE_DATA=demo-data PORT=4871 npm start
// Login details are written to demo-data/IDENTIFIANTS-DEMO.txt.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const DIR = path.join(__dirname, "..", "demo-data");
fs.mkdirSync(DIR, { recursive: true });
for (const f of ["amane.db", "amane.db-wal", "amane.db-shm"]) fs.rmSync(path.join(DIR, f), { force: true });
process.env.AMANE_DATA = DIR;

const { all, get, run, tx, seedPolicies } = require("../server/db");
const { hashPassword } = require("../server/auth");
const engine = require("../server/engine");

const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
const password = `Demo-${crypto.randomBytes(6).toString("hex")}`;
const ctl = (code) => get("SELECT id FROM controls WHERE code = ?", code).id;

tx(() => {
  const people = [
    ["rssi@atlas-demo.test", "Salma Idrissi", "admin", "Responsable de la sécurité des SI", "Direction"],
    ["y.benali@atlas-demo.test", "Youssef Benali", "membre", "Directeur général", "Direction"],
    ["n.amrani@atlas-demo.test", "Nadia Amrani", "membre", "Responsable RH", "Ressources humaines"],
    ["k.tazi@atlas-demo.test", "Karim Tazi", "membre", "Consultant senior", "Conseil"],
    ["h.elfassi@atlas-demo.test", "Hind El Fassi", "membre", "Comptable", "Finance"],
    ["o.chraibi@atlas-demo.test", "Omar Chraibi", "membre", "Administrateur systèmes", "Informatique"],
    ["audit@cabinet-demo.test", "Cabinet Audit (externe)", "auditeur", "Auditeur ISO 27001", null],
  ];
  const ids = {};
  people.forEach(([email, name, role, title, dept], i) => {
    ids[email] = Number(run(`INSERT INTO users (email, name, role, title, department, pass_hash, start_date, training_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      email, name, role, title, dept, hashPassword(password), day(400 + i * 30).slice(0, 10), i === 3 ? null : day(40 + i * 20).slice(0, 10), day(120)).lastInsertRowid);
  });
  const rssi = ids["rssi@atlas-demo.test"];
  run("INSERT INTO org (id, name, sector, size, city, rssi_user_id, agent_token, created_at) VALUES (1, 'Atlas Conseil SARL (démo)', 'Services et conseil', '11 à 50', 'Casablanca', ?, ?, ?)",
    rssi, crypto.randomBytes(24).toString("base64url"), day(120));
  seedPolicies("Atlas Conseil SARL", "Salma Idrissi", rssi);

  // Published policies and acceptances
  const staff = Object.entries(ids).filter(([e]) => !e.startsWith("audit")).map(([, id]) => id);
  for (const code of ["POL-PSSI", "POL-ACCES", "POL-CHARTE", "POL-SAUV", "POL-INC", "POL-DCP", "POL-TELE"]) {
    const p = get("SELECT id, body FROM policies WHERE code = ?", code);
    run("INSERT INTO policy_versions VALUES (?, 1, ?, ?, ?)", p.id, p.body, rssi, day(60));
    run("UPDATE policies SET version = 1, status = 'publiee', approved_by = ?, approved_at = ? WHERE id = ?", rssi, day(60), p.id);
    staff.forEach((u, i) => { if (!(code === "POL-DCP" && i >= 4) && !(code === "POL-TELE" && i === 3)) run("INSERT INTO policy_acceptances VALUES (?, 1, ?, ?)", p.id, u, day(50 - i)); });
  }

  // Control progress
  const inPlace = ["GOV-01", "GOV-02", "GOV-03", "GOV-08", "GOV-10", "GOV-12", "RSK-01", "RSK-02", "RH-02", "RH-03", "RH-04", "RH-05", "RH-06", "RH-08", "AST-01", "AST-02",
    "IAM-01", "IAM-02", "IAM-03", "IAM-04", "IAM-05", "END-01", "END-02", "END-03", "END-04", "END-05", "OPS-01", "OPS-04", "OPS-07", "NET-01", "NET-02", "VEN-01", "VEN-02",
    "INC-01", "INC-03", "BCP-01", "PHY-01", "PHY-02", "PRV-01", "PRV-02", "PRV-03", "PRV-04"];
  const inProgress = ["GOV-04", "GOV-05", "GOV-06", "GOV-09", "OPS-02", "OPS-03", "VEN-03", "BCP-02", "PRV-05", "RH-01", "RH-07", "AST-03"];
  const na = { "IAM-06": "Atlas Conseil ne développe pas de logiciel : aucun dépôt de code source.", "DEV-01": "Aucune activité de développement logiciel.", "DEV-03": "Aucun développement externalisé.", "DEV-04": "Pas d'audit technique intrusif prévu sur la production." };
  const owners = [rssi, ids["o.chraibi@atlas-demo.test"], ids["n.amrani@atlas-demo.test"]];
  all("SELECT id, code FROM controls").forEach((c, i) => {
    const status = inPlace.includes(c.code) ? "en_place" : inProgress.includes(c.code) ? "en_cours" : na[c.code] ? "non_applicable" : "a_faire";
    run("UPDATE controls SET status = ?, owner_id = ?, justification = ?, due_date = ? WHERE id = ?", status, owners[i % 3], na[c.code] || null,
      status === "en_cours" ? day(i % 2 ? -30 : 10).slice(0, 10) : null, c.id);
  });
  for (const ref of ["A.8.4", "A.8.25", "A.8.28", "A.8.29", "A.8.30"]) {
    run("UPDATE requirements SET applicable = 0, justification = 'Aucune activité de développement logiciel dans le périmètre.' WHERE framework_code = 'ISO27001' AND ref = ?", ref);
  }

  // Evidence
  const ev = [
    ["GOV-01", "note", "PSSI v1 approuvée en comité de direction", "Compte rendu du comité de direction du 12/08 : PSSI approuvée à l'unanimité."],
    ["GOV-02", "note", "Note de nomination du RSSI", "Note de service DG-2026-014 désignant Salma Idrissi RSSI."],
    ["IAM-03", "lien", "Microsoft 365 · MFA obligatoire (accès conditionnel)", null, "https://entra.microsoft.com/"],
    ["IAM-05", "note", "Revue des accès semestrielle · septembre", "Revue des droits Sage, Microsoft 365 et serveur de fichiers : 3 comptes désactivés."],
    ["OPS-01", "note", "Test de restauration trimestriel", "Restauration complète du serveur de fichiers en 2 h 10 (RTO cible : 4 h)."],
    ["PRV-02", "note", "Récépissés CNDP", "Récépissés de déclaration D-RH-2025-xxx et D-CLI-2025-xxx."],
    ["INC-01", "note", "Exercice de gestion de crise", "Simulation d'hameçonnage ciblé, 9 juin : 2 clics, procédure suivie."],
  ];
  ev.forEach(([code, kind, title, note, url], i) => run("INSERT INTO evidence (control_id, kind, title, note, url, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ctl(code), kind, title, note || null, url || null, rssi, day(code === "IAM-05" ? 35 : 20 + i * 5)));

  // Risks (from the library) with treatment
  const risks = [
    ["Rançongiciel chiffrant les serveurs et sauvegardes", "Cyberattaque", "Serveurs, partages de fichiers", 3, 5, "reduire", 2, 3, "en_traitement", ["OPS-01", "END-02", "END-04", "IAM-03", "NET-02"]],
    ["Hameçonnage menant au vol d'identifiants", "Hameçonnage et fraude", "Messagerie, comptes utilisateurs", 4, 4, "reduire", 2, 3, "traite", ["RH-03", "IAM-03", "NET-02"]],
    ["Fraude au président (faux virement)", "Hameçonnage et fraude", "Trésorerie", 3, 4, "reduire", 2, 3, "en_traitement", ["RH-03", "INC-01"]],
    ["Perte d'un ordinateur portable de consultant", "Fuite de données", "Postes nomades", 3, 4, "reduire", 3, 1, "traite", ["END-01", "END-05", "RH-07"]],
    ["Fuite de données clients", "Fuite de données", "Dossiers clients", 2, 5, "reduire", 1, 4, "en_traitement", ["IAM-01", "IAM-05", "OPS-06", "PRV-01"]],
    ["Indisponibilité de Microsoft 365", "Fournisseur", "Messagerie, documents", 2, 3, "accepter", 2, 3, "accepte", ["VEN-03"]],
    ["Traitement de données non déclaré à la CNDP", "Conformité et juridique", "Traitements RH et clients", 2, 3, "reduire", 1, 2, "traite", ["PRV-01", "PRV-02"]],
    ["Départ de l'administrateur sans transmission", "Erreur humaine", "Comptes à privilèges", 2, 4, "reduire", null, null, "ouvert", ["RH-06", "IAM-04"]],
  ];
  risks.forEach(([title, category, asset, l, i, treatment, rl, ri, status, codes], n) => {
    const id = run(`INSERT INTO risks (title, category, asset, owner_id, likelihood, impact, treatment, residual_likelihood, residual_impact, status, reviewed_at, created_at, plan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, title, category, asset, owners[n % 3], l, i, treatment, rl, ri, status, day(30 + n * 10).slice(0, 10), day(100),
      treatment === "accepter" ? "Risque accepté par la direction : SLA de 99,9 % et plan de communication." : "Voir les mesures associées.").lastInsertRowid;
    codes.forEach((c) => run("INSERT INTO risk_controls VALUES (?, ?)", id, ctl(c)));
  });

  // Vendors
  [["Microsoft 365", "Messagerie et bureautique", "Logiciel (SaaS)", "elevee", "personnelles", "Union européenne", 1, day(90)],
   ["Sage Paie (éditeur)", "Logiciel de paie", "Logiciel (SaaS)", "elevee", "sensibles", "Maroc", 1, day(420)],
   ["Maroc Datacenter (démo)", "Hébergement du serveur de sauvegarde", "Hébergement et cloud", "elevee", "personnelles", "Maroc", 1, day(150)],
   ["Infogérance Atlas IT (démo)", "Support informatique", "Infogérance", "moyenne", "interne", "Maroc", 0, null],
   ["Imprimerie du Centre", "Impression de documents", "Autre", "faible", "aucune", "Maroc", 0, null]]
    .forEach(([name, service, category, crit, data, country, dpa, reviewed]) => run(`INSERT INTO vendors (name, service, category, criticality, data_access, country, dpa_signed, reviewed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, name, service, category, crit, data, country, dpa, reviewed?.slice(0, 10) || null, day(100)));

  // Processing activities (loi 09-08)
  [["Gestion du personnel et de la paie", "Gestion administrative des salariés, paie et déclarations sociales", "Obligation légale", "Identité, CIN, coordonnées, RIB, situation familiale, salaire", "Salariés", "Service RH, CNSS, DGI, banque", 0, 0, null, "Durée du contrat + 5 ans", "declare", "D-RH-2025-0142"],
   ["Gestion des clients et prospects", "Suivi commercial et facturation", "Exécution d'un contrat", "Identité, coordonnées professionnelles, historique des missions", "Clients, prospects", "Équipe commerciale", 0, 1, "Union européenne (Microsoft 365)", "3 ans après le dernier contact", "autorise", "A-CLI-2025-0077"],
   ["Recrutement", "Sélection des candidats", "Consentement de la personne", "CV, diplômes, coordonnées, entretiens", "Candidats", "Service RH, managers", 0, 0, null, "2 ans", "declare", "D-REC-2025-0098"],
   ["Vidéosurveillance des locaux", "Sécurité des biens et des personnes", "Intérêt légitime", "Images", "Salariés, visiteurs", "Direction, prestataire de sécurité", 0, 0, null, "30 jours", "en_cours", null]]
    .forEach(([name, purpose, basis, cats, subjects, recips, sensitive, abroad, country, retention, status, ref]) => run(`INSERT INTO processing
      (name, purpose, legal_basis, data_categories, data_subjects, recipients, sensitive, transfer_abroad, transfer_country, retention, security_measures, cndp_status, cndp_ref, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Accès restreint, chiffrement des postes, sauvegardes', ?, ?, ?, ?)`,
      name, purpose, basis, cats, subjects, recips, sensitive, abroad, country, retention, status, ref, rssi, day(90)));

  // Devices reported by the agent
  const R = (o) => Object.fromEntries(Object.entries({ "T-DISK": ["ok", "BitLocker actif sur C:"], "T-AV": ["ok", "Microsoft Defender actif, signatures de 0 jour(s)"], "T-FW": ["ok", "Domaine, privé et public actifs"],
    "T-UPD": ["ok", "KB5066835 installée il y a 6 jour(s)"], "T-LOCK": ["ok", "Écran éteint et verrouillé après 10 min"], "T-OS": ["ok", "Windows 11 25H2 (build 26200)"],
    "T-ADMIN": ["ok", "utilisateur standard"], "T-PWD": ["ok", "Poste géré par un annuaire (Entra ID / Active Directory)"], ...o }).map(([k, [status, info]]) => [k, { status, info }]));
  [["ATLAS-PC-001", "rssi@atlas-demo.test", {}], ["ATLAS-PC-004", "k.tazi@atlas-demo.test", { "T-DISK": ["echec", "BitLocker désactivé sur C:"], "T-UPD": ["echec", "Dernière mise à jour il y a 47 jours (KB5063878)"] }],
   ["ATLAS-PC-007", "n.amrani@atlas-demo.test", {}], ["ATLAS-PC-009", "h.elfassi@atlas-demo.test", { "T-LOCK": ["echec", "Délai avant verrouillage : jamais"] }],
   ["ATLAS-SRV-ADM", "o.chraibi@atlas-demo.test", { "T-ADMIN": ["echec", "o.chraibi est administrateur local"] }]]
    .forEach(([host, email, o], i) => run(`INSERT INTO devices (device_key, hostname, serial, user_email, user_id, os, os_version, agent_version, results, last_seen, first_seen)
      VALUES (?, ?, ?, ?, ?, 'Windows 11', '25H2 (build 26200)', '1.0.0', ?, ?, ?)`, crypto.randomUUID(), host, `PF3K${1000 + i * 137}`, email, ids[email], JSON.stringify(R(o)), day(i * 0.1), day(80)));

  const actions = [["connexion"], ["politique publiée (v1)", "policy"], ["preuve ajoutée", "control", "IAM-05"], ["risks modifié", "risks"], ["mesure modifiée", "control"]];
  actions.forEach(([a, e, id], i) => run("INSERT INTO audit_log (at, user_id, action, entity, entity_id) VALUES (?, ?, ?, ?, ?)", day(i * 0.4), rssi, a, e || null, id || null));
});
engine.runTests();
fs.writeFileSync(path.join(DIR, "IDENTIFIANTS-DEMO.txt"), `Instance de démonstration Amane (Atlas Conseil SARL, société fictive)
Lancement : AMANE_DATA=demo-data PORT=4871 npm start
Administrateur : rssi@atlas-demo.test
Auditeur       : audit@cabinet-demo.test
Collaborateur  : k.tazi@atlas-demo.test
Mot de passe (tous les comptes) : ${password}
`);
console.log("Base de démonstration créée · identifiants dans demo-data/IDENTIFIANTS-DEMO.txt");
