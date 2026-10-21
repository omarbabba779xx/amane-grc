import { esc } from "../lib.js";
import { registerPage } from "./register.js";

const CNDP = [["non_declare", "Non déclaré"], ["en_cours", "Déclaration en cours"], ["declare", "Déclaré (récépissé)"], ["autorise", "Autorisé"]];
const BASES = ["Consentement de la personne", "Exécution d'un contrat", "Obligation légale", "Sauvegarde d'intérêts vitaux", "Mission d'intérêt public", "Intérêt légitime"];
// Common processing activities of a Moroccan company, to start the register quickly
const SUGGEST = ["Gestion du personnel et de la paie", "Recrutement", "Gestion des clients et prospects", "Vidéosurveillance des locaux", "Contrôle d'accès par badge", "Site web et formulaires de contact"];

export const render = (main, ctx) => registerPage(main, ctx, {
  table: "processing", title: "Registre des traitements · loi 09-08", csv: "traitements", icon: "data", nameField: "name", addLabel: "Nouveau traitement",
  subtitle: "Inventaire des traitements de données personnelles, bases légales, durées de conservation, transferts et formalités auprès de la CNDP.",
  emptyTitle: "Registre vide", emptyText: `Commencez par vos traitements courants : ${SUGGEST.join(", ")}.`,
  top: (rows) => {
    const declared = rows.filter((r) => ["declare", "autorise"].includes(r.cndp_status)).length;
    return `<div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="k">Traitements</div><div class="v">${rows.length}</div></div>
      <div class="card stat"><div class="k">Déclarés ou autorisés</div><div class="v" style="color:${declared === rows.length && rows.length ? "var(--ok)" : "var(--warn)"}">${declared}</div><div class="s">auprès de la CNDP</div></div>
      <div class="card stat"><div class="k">Données sensibles</div><div class="v">${rows.filter((r) => r.sensitive).length}</div><div class="s">autorisation préalable requise</div></div>
      <div class="card stat"><div class="k">Transferts hors Maroc</div><div class="v">${rows.filter((r) => r.transfer_abroad).length}</div><div class="s">art. 43 et 44</div></div></div>`;
  },
  columns: [
    ["Traitement", (p) => `<b>${esc(p.name)}</b><div class="small muted">${esc(p.purpose || "finalité à préciser")}</div>`],
    ["Base légale", (p) => `<span class="small">${esc(p.legal_basis || "—")}</span>`],
    ["Personnes", (p) => `<span class="small">${esc(p.data_subjects || "—")}</span>`],
    ["Conservation", (p) => `<span class="small">${esc(p.retention || "—")}</span>`],
    ["Particularités", (p) => `${p.sensitive ? '<span class="tag">Données sensibles</span>' : ""}${p.transfer_abroad ? `<span class="tag">Transfert ${esc(p.transfer_country || "")}</span>` : ""}`],
    ["CNDP", (p) => `<span class="pill ${["declare", "autorise"].includes(p.cndp_status) ? "ok" : p.cndp_status === "en_cours" ? "info" : "bad"}">${esc(CNDP.find((c) => c[0] === p.cndp_status)?.[1])}</span>${p.cndp_ref ? `<div class="small muted">${esc(p.cndp_ref)}</div>` : ""}`],
  ],
  fields: [
    { name: "name", label: "Nom du traitement", full: true, required: true, placeholder: SUGGEST[0] },
    { name: "purpose", label: "Finalité", type: "textarea", full: true, placeholder: "Pourquoi ces données sont-elles traitées ?" },
    { name: "legal_basis", label: "Base légale", type: "select", blank: true, options: BASES.map((b) => [b, b]) },
    { name: "data_subjects", label: "Personnes concernées", placeholder: "Salariés, clients, candidats…" },
    { name: "data_categories", label: "Catégories de données", type: "textarea", full: true, placeholder: "Identité, coordonnées, CIN, RIB, données de santé…" },
    { name: "recipients", label: "Destinataires", placeholder: "Service RH, CNSS, banque…" },
    { name: "retention", label: "Durée de conservation", placeholder: "Ex. durée du contrat + 5 ans" },
    { name: "sensitive", label: "Données sensibles (santé, origine, opinions, biométrie, infractions…)", type: "check", full: true },
    { name: "transfer_abroad", label: "Transfert de données hors du Maroc", type: "check" },
    { name: "transfer_country", label: "Pays destinataire" },
    { name: "security_measures", label: "Mesures de sécurité", type: "textarea", full: true, placeholder: "Accès restreint, chiffrement, sauvegardes…" },
    { name: "cndp_status", label: "Statut auprès de la CNDP", type: "select", options: CNDP },
    { name: "cndp_ref", label: "Référence du récépissé ou de l'autorisation" },
  ],
});
