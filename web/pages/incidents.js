import { api, esc, icon, toast, fail, datetime, date } from "../lib.js";
import { registerPage } from "./register.js";

const SEV = [["faible", "Faible"], ["moyenne", "Moyenne"], ["elevee", "Élevée"], ["critique", "Critique"]];
const SEV_CLS = { faible: "ok", moyenne: "info", elevee: "warn", critique: "bad" };
const STATUS = [["ouvert", "Ouvert"], ["en_cours", "En cours de traitement"], ["clos", "Clos"]];
const CATS = ["Rançongiciel", "Hameçonnage", "Compromission de compte", "Fuite ou vol de données", "Intrusion", "Déni de service", "Logiciel malveillant",
  "Perte ou vol de matériel", "Indisponibilité d'un service", "Fraude", "Autre"].map((x) => [x, x]);
const label = (list, v) => list.find((x) => x[0] === v)?.[1] || v || "—";

// Deadline for the DGSSI declaration, from the detection time and the internal delay
export function dgssiState(i, hours) {
  if (!i.dgssi_required) return null;
  if (i.dgssi_notified_at) return { done: true, text: `Déclaré le ${datetime(i.dgssi_notified_at)}${i.dgssi_ref ? ` · réf. ${i.dgssi_ref}` : ""}` };
  const deadline = new Date(new Date(i.detected_at).getTime() + hours * 3600e3), late = Date.now() > deadline;
  return { late, deadline, text: `${late ? "En retard depuis le" : "À déclarer avant le"} ${datetime(deadline.toISOString())}` };
}

export async function render(main, ctx) {
  const [users, org, cfg] = await Promise.all([api("/api/users"), api("/api/org"), api("/api/settings/incidents")]);
  const hours = cfg.dgssi_hours;
  await registerPage(main, ctx, {
    table: "incidents", title: "Incidents de sécurité", icon: "siren", nameField: "title", addLabel: "Déclarer un incident",
    subtitle: `Registre des incidents, déclaration à la DGSSI (maCERT) au titre de la loi 05-20 et suivi des violations de données personnelles (loi 09-08). Délai interne de déclaration : ${hours} h après la détection.`,
    emptyTitle: "Aucun incident enregistré", emptyText: "Enregistrez chaque incident, même mineur : le registre et les retours d’expérience sont demandés en audit.",
    top: (rows) => {
      const open = rows.filter((r) => r.status !== "clos").length;
      const due = rows.map((r) => dgssiState(r, hours)).filter((s) => s && !s.done);
      return `<div class="grid g4" style="margin-bottom:16px">
        <div class="card stat"><div class="k">Incidents ouverts</div><div class="v">${open}</div></div>
        <div class="card stat"><div class="k">À déclarer à la DGSSI</div><div class="v" style="${due.length ? "color:var(--bad)" : ""}">${due.length}</div><div class="s">${due.filter((d) => d.late).length} en retard</div></div>
        <div class="card stat"><div class="k">Avec données personnelles</div><div class="v">${rows.filter((r) => r.personal_data).length}</div><div class="s">notification CNDP à évaluer</div></div>
        <div class="card stat"><div class="k">Clos cette année</div><div class="v">${rows.filter((r) => r.status === "clos" && (r.closed_at || "").slice(0, 4) === String(new Date().getFullYear())).length}</div></div></div>`;
    },
    columns: [
      ["Incident", (r) => `<b>${esc(r.title)}</b><div class="small muted">${esc(r.category || "")} · détecté le ${datetime(r.detected_at)}</div>`],
      ["Gravité", (r) => `<span class="pill ${SEV_CLS[r.severity]}">${esc(label(SEV, r.severity))}</span>`],
      ["Statut", (r) => `<span class="pill ${r.status === "clos" ? "ok" : r.status === "en_cours" ? "info" : "warn"}">${esc(label(STATUS, r.status))}</span>`],
      ["DGSSI", (r) => { const s = dgssiState(r, hours); return !s ? '<span class="muted small">Non requise</span>' : `<span class="small" style="${s.done ? "" : `color:var(--${s.late ? "bad" : "warn"});font-weight:600`}">${esc(s.text)}</span>`; }],
      ["Données personnelles", (r) => (r.personal_data ? `<span class="pill ${r.cndp_notified_at ? "ok" : "warn"}">${r.cndp_notified_at ? "CNDP informée" : "CNDP à évaluer"}</span>` : '<span class="muted small">—</span>')],
    ],
    fields: [
      { name: "title", label: "Titre", required: true, full: true, placeholder: "Ex. Hameçonnage ayant compromis la messagerie de la comptabilité" },
      { name: "category", label: "Type d'incident", type: "select", blank: true, options: CATS },
      { name: "severity", label: "Gravité", type: "select", options: SEV, default: "moyenne" },
      { name: "occurred_at", label: "Survenu le", type: "datetime-local" },
      { name: "detected_at", label: "Détecté le", type: "datetime-local", required: true, default: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) },
      { name: "status", label: "Statut", type: "select", options: STATUS },
      { name: "owner_id", label: "Responsable", type: "select", num: true, blank: true, options: users.filter((u) => u.active && u.role !== "auditeur").map((u) => [u.id, u.name]) },
      { name: "systems", label: "Systèmes et services touchés", full: true },
      { name: "description", label: "Description et chronologie", type: "textarea", full: true },
      { name: "dgssi_required", label: "Incident à déclarer à la DGSSI (maCERT)", type: "check", full: true,
        hint: "La loi 05-20 impose la déclaration sans délai des incidents affectant la sécurité ou le fonctionnement des systèmes des entités concernées (administrations, IIV, opérateurs). Fixez votre délai interne dans Paramètres." },
      { name: "dgssi_notified_at", label: "Déclaré à la DGSSI le", type: "datetime-local" },
      { name: "dgssi_ref", label: "Référence de la déclaration" },
      { name: "personal_data", label: "Des données personnelles sont concernées (violation de données)", type: "check", full: true,
        hint: "Évaluez l'information de la CNDP et des personnes concernées, et tracez votre décision (loi 09-08, obligation de sécurité des traitements)." },
      { name: "cndp_notified_at", label: "CNDP informée le", type: "datetime-local" },
      { name: "actions", label: "Mesures de confinement et de correction", type: "textarea", full: true },
      { name: "root_cause", label: "Cause racine", type: "textarea", full: true },
      { name: "lessons", label: "Retour d'expérience et actions d'amélioration", type: "textarea", full: true },
      { name: "closed_at", label: "Clos le", type: "datetime-local" },
    ],
    sub: (r) => `${esc(label(SEV, r.severity))} · ${esc(label(STATUS, r.status))}`,
    extra: (r) => {
      if (!r) return "";
      const s = dgssiState(r, hours);
      return `<div class="card card-b" style="margin-top:16px;background:var(--bg)">
        ${s ? `<div style="margin-bottom:8px"><b>DGSSI :</b> <span style="${s.done ? "" : `color:var(--${s.late ? "bad" : "warn"})`}">${esc(s.text)}</span></div>` : ""}
        ${r.personal_data && !r.cndp_notified_at ? `<div class="small" style="margin-bottom:8px">Données personnelles concernées : décidez de l’information de la CNDP et des personnes, puis notez la date ci-dessus.</div>` : ""}
        <button class="btn" id="print">${icon("report")}Fiche de déclaration DGSSI (imprimer / PDF)</button></div>`;
    },
    wire: (el, r) => el.querySelector("#print")?.addEventListener("click", () => printSheet(r, org, users)),
  });
}

const full = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "");

function printSheet(i, org, users) {
  if (!i) return;
  const rssi = users.find((u) => u.id === org.rssi_user_id);
  const row = (k, v) => `<tr><th style="width:36%;text-align:left;vertical-align:top">${k}</th><td>${esc(v || "—").replace(/\n/g, "<br>")}</td></tr>`;
  const sheet = document.createElement("div");
  sheet.className = "print-sheet";
  sheet.innerHTML = `<h1 style="font-size:20px;margin:0">Fiche de déclaration d’incident de sécurité</h1>
    <p style="margin:4px 0 16px">Destinataire : Direction Générale de la Sécurité des Systèmes d’Information (DGSSI) · maCERT — loi n° 05-20 relative à la cybersécurité</p>
    <h2>1. Entité déclarante</h2><table class="sheet">${row("Organisme", org.name)}${row("Secteur", org.sector)}${row("Ville", org.city)}
      ${row("Responsable de la sécurité (contact)", rssi ? `${rssi.name} · ${rssi.email}` : "")}</table>
    <h2>2. Description de l’incident</h2><table class="sheet">${row("Intitulé", i.title)}${row("Type", i.category)}${row("Gravité estimée", label(SEV, i.severity))}
      ${row("Date et heure de survenue", i.occurred_at ? full(i.occurred_at) : "")}${row("Date et heure de détection", full(i.detected_at))}
      ${row("Systèmes et services touchés", i.systems)}${row("Description et chronologie", i.description)}</table>
    <h2>3. Impacts</h2><table class="sheet">${row("Données à caractère personnel concernées", i.personal_data ? "Oui" : "Non")}
      ${row("Information de la CNDP", i.cndp_notified_at ? `Le ${full(i.cndp_notified_at)}` : i.personal_data ? "À évaluer" : "Sans objet")}</table>
    <h2>4. Mesures prises</h2><table class="sheet">${row("Confinement et correction", i.actions)}${row("Cause identifiée", i.root_cause)}${row("Statut actuel", label(STATUS, i.status))}</table>
    <h2>5. Déclaration</h2><table class="sheet">${row("Date de la déclaration", i.dgssi_notified_at ? full(i.dgssi_notified_at) : "")}${row("Référence attribuée", i.dgssi_ref)}
      ${row("Fait à / le", `${org.city || ""}, le ${date(new Date().toISOString())}`)}${row("Nom, fonction et signature", "")}</table>
    <p style="font-size:11px;margin-top:18px">Fiche préparée avec Amane GRC à partir du registre des incidents. Vérifiez le formulaire et le canal de déclaration en vigueur auprès de la DGSSI (maCERT) avant l’envoi.</p>`;
  document.body.append(sheet);
  document.body.classList.add("printing");
  const done = () => { sheet.remove(); document.body.classList.remove("printing"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 1000);
}
