import { api, esc, icon, toast, fail, date } from "../lib.js";
import { registerPage } from "./register.js";
import { heat } from "./dashboard.js";

const SCALE = [[1, "1 · Très faible"], [2, "2 · Faible"], [3, "3 · Moyen"], [4, "4 · Élevé"], [5, "5 · Très élevé"]];
const TREAT = [["reduire", "Réduire"], ["accepter", "Accepter"], ["transferer", "Transférer (assurance, prestataire)"], ["eviter", "Éviter"]];
const STATUS = [["ouvert", "Ouvert"], ["en_traitement", "En traitement"], ["traite", "Traité"], ["accepte", "Accepté"]];
const CATS = ["Cyberattaque", "Hameçonnage et fraude", "Fuite de données", "Erreur humaine", "Défaillance technique", "Fournisseur", "Physique et environnemental", "Conformité et juridique"];

// Typical SME risks, with the controls that usually reduce them
const LIBRARY = [
  ["Rançongiciel chiffrant les serveurs et sauvegardes", "Cyberattaque", "Serveurs, partages de fichiers", 3, 5, ["OPS-01", "END-02", "END-04", "IAM-03", "NET-02"]],
  ["Hameçonnage menant au vol d'identifiants", "Hameçonnage et fraude", "Messagerie, comptes utilisateurs", 4, 4, ["RH-03", "IAM-03", "NET-02"]],
  ["Fraude au président ou au faux fournisseur (virement)", "Hameçonnage et fraude", "Comptabilité, trésorerie", 3, 4, ["RH-03", "INC-01"]],
  ["Perte ou vol d'un ordinateur portable non chiffré", "Fuite de données", "Postes nomades", 3, 4, ["END-01", "END-05", "RH-07"]],
  ["Fuite de données clients (exposition, export non autorisé)", "Fuite de données", "CRM, bases clients", 2, 5, ["IAM-01", "IAM-05", "OPS-06", "PRV-01"]],
  ["Panne du serveur ou du stockage principal", "Défaillance technique", "Infrastructure", 3, 4, ["OPS-01", "OPS-05", "BCP-01"]],
  ["Défaillance ou indisponibilité d'un fournisseur cloud critique", "Fournisseur", "Services SaaS / hébergement", 2, 4, ["VEN-01", "VEN-03", "BCP-01"]],
  ["Non-conformité à la loi 09-08 (traitement non déclaré)", "Conformité et juridique", "Traitements de données personnelles", 3, 3, ["PRV-01", "PRV-02", "PRV-03"]],
  ["Compromission du site web ou de l'application exposée", "Cyberattaque", "Site web, applications", 3, 4, ["OPS-02", "DEV-01", "OPS-03"]],
  ["Départ d'un administrateur sans révocation des accès", "Erreur humaine", "Comptes à privilèges", 2, 4, ["RH-06", "IAM-04", "IAM-05"]],
];

export async function render(main, ctx) {
  const [users, controls] = await Promise.all([ctx.user.role === "admin" ? api("/api/users") : Promise.resolve([]), api("/api/controls")]);
  const level = (s) => (s >= 15 ? ["Critique", "bad"] : s >= 8 ? ["Élevé", "warn"] : s >= 4 ? ["Modéré", "info"] : ["Faible", "ok"]);
  const score = (l, i) => { const s = l * i, [lab, c] = level(s); return `<span class="pill ${c}">${s} · ${lab}</span>`; };
  await registerPage(main, ctx, {
    table: "risks", title: "Registre des risques", csv: "risques", icon: "risk", nameField: "title", addLabel: "Nouveau risque",
    subtitle: "Appréciation (vraisemblance × impact sur 5), traitement, mesures associées et risque résiduel (ISO 27001, clauses 6.1 et 8.2).",
    emptyTitle: "Registre vide", emptyText: "Ajoutez vos risques ou importez les risques types d’une PME.",
    top: (rows) => `<div class="grid g3" style="margin-bottom:16px">
        <div class="card"><div class="card-h"><h3>Risque inhérent</h3></div><div class="card-b">${heat(rows)}</div></div>
        <div class="card"><div class="card-h"><h3>Risque résiduel</h3></div><div class="card-b">${heat(rows, true)}</div></div>
        <div class="card"><div class="card-h"><h3>Bibliothèque de risques</h3></div><div class="card-b">
          <p class="small muted" style="margin-top:0">10 risques fréquents pour une PME marocaine, déjà reliés aux mesures qui les réduisent.</p>
          ${ctx.user.role === "admin" ? `<button class="btn" id="lib">${icon("book")}Importer les risques types</button>` : ""}</div></div></div>`,
    columns: [
      ["Risque", (r) => `<b>${esc(r.title)}</b><div class="small muted">${esc(r.category || "")}${r.asset ? ` · ${esc(r.asset)}` : ""}</div>`],
      ["Inhérent", (r) => score(r.likelihood, r.impact)],
      ["Traitement", (r) => `<span class="small">${esc(TREAT.find((t) => t[0] === r.treatment)?.[1] || "")}</span><div>${(r.controls || []).map((c) => `<span class="tag">${esc(c.code)}</span>`).join("")}</div>`],
      ["Résiduel", (r) => (r.residual_likelihood && r.residual_impact ? score(r.residual_likelihood, r.residual_impact) : '<span class="muted small">—</span>')],
      ["Responsable", (r) => `<span class="small">${esc(r.owner_name || "—")}</span>`],
      ["Statut", (r) => `<span class="pill ${r.status === "traite" ? "ok" : r.status === "accepte" ? "" : "warn"}">${esc(STATUS.find((s) => s[0] === r.status)?.[1])}</span><div class="small muted">revu ${date(r.reviewed_at || r.created_at)}</div>`],
    ],
    fields: [
      { name: "title", label: "Intitulé du risque", full: true, required: true },
      { name: "description", label: "Scénario", type: "textarea", full: true, placeholder: "Menace, vulnérabilité exploitée et conséquences" },
      { name: "category", label: "Catégorie", type: "select", blank: true, options: CATS.map((c) => [c, c]) },
      { name: "asset", label: "Actifs concernés" },
      { name: "likelihood", label: "Vraisemblance", type: "select", num: true, options: SCALE, default: 3 },
      { name: "impact", label: "Impact", type: "select", num: true, options: SCALE, default: 3 },
      { name: "treatment", label: "Traitement", type: "select", options: TREAT },
      { name: "owner_id", label: "Propriétaire du risque", type: "select", num: true, blank: true, options: users.filter((u) => u.active).map((u) => [u.id, u.name]) },
      { name: "plan", label: "Plan de traitement", type: "textarea", full: true },
      { name: "residual_likelihood", label: "Vraisemblance résiduelle", type: "select", num: true, blank: true, options: SCALE },
      { name: "residual_impact", label: "Impact résiduel", type: "select", num: true, blank: true, options: SCALE },
      { name: "status", label: "Statut", type: "select", options: STATUS },
      { name: "due_date", label: "Échéance du plan", type: "date" },
      { name: "reviewed_at", label: "Dernière revue", type: "date", default: new Date().toISOString().slice(0, 10) },
    ],
    extra: async (row) => `<div class="section"><h4>Mesures qui réduisent ce risque</h4>
      <input class="search" id="cq" placeholder="Filtrer les mesures…" style="width:100%;margin-bottom:8px">
      <div class="list" style="max-height:260px;overflow:auto" id="clist">${controls.map((c) => `<div data-txt="${esc(`${c.code} ${c.title}`.toLowerCase())}">
        <label class="check" style="width:100%"><input type="checkbox" value="${c.id}" ${(row?.controls || []).some((x) => x.id === c.id) ? "checked" : ""}>
        <span class="code">${esc(c.code)}</span> <span class="small">${esc(c.title)}</span></label></div>`).join("")}</div></div>`,
    wire: (el) => {
      el.querySelector("#cq").oninput = (e) => el.querySelectorAll("#clist > div").forEach((d) => (d.style.display = d.dataset.txt.includes(e.target.value.toLowerCase()) ? "" : "none"));
    },
    collect: (el) => ({ control_ids: [...el.querySelectorAll("#clist input:checked")].map((i) => Number(i.value)) }),
  });

  document.getElementById("lib")?.addEventListener("click", async () => {
    const existing = new Set((await api("/api/risks")).map((r) => r.title));
    const byCode = Object.fromEntries(controls.map((c) => [c.code, c.id]));
    let n = 0;
    try {
      for (const [title, category, asset, likelihood, impact, codes] of LIBRARY) {
        if (existing.has(title)) continue;
        await api("/api/risks", { method: "POST", body: { title, category, asset, likelihood, impact, treatment: "reduire", status: "ouvert",
          reviewed_at: new Date().toISOString().slice(0, 10), control_ids: codes.map((c) => byCode[c]).filter(Boolean) } });
        n++;
      }
      toast(n ? `${n} risques importés · ajustez les cotations à votre contexte` : "Les risques types sont déjà dans le registre");
      ctx.refresh();
    } catch (e) { fail(e); }
  });
}
