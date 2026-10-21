import { esc, date } from "../lib.js";
import { registerPage } from "./register.js";

const CRIT = [["faible", "Faible"], ["moyenne", "Moyenne"], ["elevee", "Élevée"]];
const ACCESS = [["aucune", "Aucune donnée"], ["interne", "Données internes"], ["personnelles", "Données personnelles"], ["sensibles", "Données sensibles"]];
const old = (d) => !d || Date.now() - new Date(d) > 365 * 864e5;

export const render = (main, ctx) => registerPage(main, ctx, {
  table: "vendors", title: "Fournisseurs", csv: "fournisseurs", icon: "vendor", nameField: "name", addLabel: "Nouveau fournisseur",
  subtitle: "Prestataires et services cloud ayant accès à vos informations : criticité, clauses de protection des données, revue annuelle (ISO 27001 A.5.19 à A.5.23, loi 09-08 art. 24).",
  emptyTitle: "Aucun fournisseur", emptyText: "Recensez vos prestataires : hébergeur, messagerie, logiciel de paie, comptable, infogérant…",
  columns: [
    ["Fournisseur", (v) => `<b>${esc(v.name)}</b><div class="small muted">${esc(v.service || "")}</div>`],
    ["Criticité", (v) => `<span class="pill ${v.criticality === "elevee" ? "bad" : v.criticality === "moyenne" ? "warn" : "ok"}">${esc(CRIT.find((c) => c[0] === v.criticality)?.[1])}</span>`],
    ["Données", (v) => `<span class="small">${esc(ACCESS.find((a) => a[0] === v.data_access)?.[1])}</span>`],
    ["Pays", (v) => `<span class="small">${esc(v.country || "—")}</span>`],
    ["Clauses données", (v) => (v.dpa_signed ? '<span class="pill ok">Signées</span>' : v.data_access === "personnelles" || v.data_access === "sensibles" ? '<span class="pill bad">Manquantes</span>' : '<span class="muted small">—</span>')],
    ["Dernière revue", (v) => `<span class="small ${v.criticality === "elevee" && old(v.reviewed_at) ? "" : "muted"}" style="${v.criticality === "elevee" && old(v.reviewed_at) ? "color:var(--bad);font-weight:600" : ""}">${date(v.reviewed_at)}</span>`],
  ],
  fields: [
    { name: "name", label: "Nom", required: true },
    { name: "service", label: "Service fourni", placeholder: "Ex. Messagerie et bureautique" },
    { name: "category", label: "Catégorie", type: "select", blank: true, options: ["Hébergement et cloud", "Logiciel (SaaS)", "Infogérance", "Télécoms", "Conseil", "Comptabilité et paie", "Sécurité", "Autre"].map((x) => [x, x]) },
    { name: "criticality", label: "Criticité", type: "select", options: CRIT },
    { name: "data_access", label: "Accès aux données", type: "select", options: ACCESS },
    { name: "country", label: "Pays de traitement des données", hint: "Hors Maroc : vérifier les conditions de transfert (loi 09-08, art. 43)." },
    { name: "contract_end", label: "Fin de contrat", type: "date" },
    { name: "reviewed_at", label: "Dernière revue de sécurité", type: "date" },
    { name: "dpa_signed", label: "Clauses de sécurité et de protection des données signées", type: "check", full: true },
    { name: "contact", label: "Contact" },
    { name: "website", label: "Site web" },
    { name: "notes", label: "Notes (certifications, résultats de questionnaire…)", type: "textarea", full: true },
  ],
});
