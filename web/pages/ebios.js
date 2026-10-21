// EBIOS Risk Manager: the five workshops of the ANSSI method, then the risks go to the register.
import { api, esc, icon, drawer, toast, fail, confirmBox, empty, ring } from "../lib.js";
import { fieldHtml, readForm } from "./register.js";

const GRAV = [[1, "G1 · Mineure"], [2, "G2 · Significative"], [3, "G3 · Grave"], [4, "G4 · Critique"]];
const VRAIS = [[1, "V1 · Peu vraisemblable"], [2, "V2 · Vraisemblable"], [3, "V3 · Très vraisemblable"], [4, "V4 · Quasi certain"]];
const L3 = [[1, "1 · Faible"], [2, "2 · Moyenne"], [3, "3 · Forte"]];
const L4 = [[1, "1"], [2, "2"], [3, "3"], [4, "4"]];
const DECISION = [["reduire", "Réduire"], ["accepter", "Accepter"], ["transferer", "Transférer"], ["eviter", "Éviter"]];
const WORKSHOPS = [
  ["Cadrage et socle", "Valeurs métier, biens supports, événements redoutés et socle de sécurité"],
  ["Sources de risque", "Qui pourrait attaquer, et pour quoi faire"],
  ["Scénarios stratégiques", "Écosystème et chemins d’attaque vers les valeurs métier"],
  ["Scénarios opérationnels", "Modes opératoires techniques et vraisemblance"],
  ["Traitement du risque", "Cartographie, décision, mesures et envoi au registre"],
];
const lvl = (g, v) => { const s = g * v; return s >= 9 ? ["Élevé", "bad"] : s >= 4 ? ["Modéré", "warn"] : ["Faible", "ok"]; };
const short = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n)}…` : s || "");

export async function render(main, ctx) {
  const step = Math.min(5, Math.max(1, Number(ctx.param) || 1));
  const admin = ctx.user.role === "admin";
  const [items, controls, frameworks] = await Promise.all([api("/api/ebios"), api("/api/controls"), api("/api/frameworks")]);
  const of = (k) => items.filter((i) => i.kind === k);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const name = (id, f = "nom") => esc(byId[id]?.data[f] || "—");
  const opts = (k, f = "nom", filter = () => true) => of(k).filter(filter).map((i) => [i.id, short(i.data[f], 70)]);
  const gravOf = (st) => byId[st?.data.evenement_id]?.data.gravite || 1;

  const SECTIONS = {
    valeur: { title: "Valeurs métier", hint: "Ce qui a de la valeur pour l’organisme : processus (facturation, conseil client) ou informations (données clients, paie).",
      fields: () => [{ name: "nom", label: "Valeur métier", required: true, full: true }, { name: "nature", label: "Nature", type: "select", options: [["Processus", "Processus"], ["Information", "Information"]] },
        { name: "responsable", label: "Responsable" }, { name: "description", label: "Description", type: "textarea", full: true }],
      cols: [["Valeur métier", (d) => `<b>${esc(d.nom)}</b><div class="small muted">${esc(short(d.description))}</div>`], ["Nature", (d) => esc(d.nature || "—")], ["Responsable", (d) => esc(d.responsable || "—")]] },
    bien: { title: "Biens supports", hint: "Les systèmes, locaux, personnes et prestataires sur lesquels reposent les valeurs métier.",
      fields: () => [{ name: "nom", label: "Bien support", required: true, full: true }, { name: "valeur_id", label: "Valeur métier soutenue", type: "select", num: true, blank: true, options: opts("valeur") },
        { name: "type", label: "Type", type: "select", options: ["Matériel", "Logiciel / SaaS", "Réseau", "Personne", "Site", "Prestataire"].map((x) => [x, x]) }, { name: "responsable", label: "Responsable" }],
      cols: [["Bien support", (d) => `<b>${esc(d.nom)}</b>`], ["Type", (d) => esc(d.type || "—")], ["Valeur métier", (d) => name(d.valeur_id)]] },
    evenement: { title: "Événements redoutés", hint: "Ce qui peut arriver à une valeur métier (indisponibilité, divulgation, altération) et sa gravité.",
      fields: () => [{ name: "valeur_id", label: "Valeur métier", type: "select", num: true, options: opts("valeur") }, { name: "gravite", label: "Gravité", type: "select", num: true, options: GRAV },
        { name: "description", label: "Événement redouté", type: "textarea", required: true, full: true, placeholder: "Ex. Divulgation des dossiers clients à un concurrent" },
        { name: "impacts", label: "Impacts (missions, juridique, financier, image…)", type: "textarea", full: true }],
      cols: [["Événement redouté", (d) => `<b>${esc(short(d.description, 120))}</b><div class="small muted">${esc(short(d.impacts))}</div>`], ["Valeur métier", (d) => name(d.valeur_id)],
        ["Gravité", (d) => `<span class="pill ${d.gravite >= 4 ? "bad" : d.gravite >= 3 ? "warn" : "info"}">G${d.gravite}</span>`]] },
    ecart: { title: "Écarts au socle de sécurité", hint: "Les exigences des référentiels non respectées, et leur justification.",
      fields: () => [{ name: "referentiel", label: "Référentiel", type: "select", blank: true, options: frameworks.map((f) => [f.short, f.short]) },
        { name: "description", label: "Écart constaté", type: "textarea", required: true, full: true }, { name: "justification", label: "Justification ou action prévue", type: "textarea", full: true }],
      cols: [["Écart", (d) => `<b>${esc(short(d.description, 120))}</b><div class="small muted">${esc(short(d.justification))}</div>`], ["Référentiel", (d) => esc(d.referentiel || "—")]] },
    srov: { title: "Couples source de risque / objectif visé", hint: "Pertinence = motivation + ressources + activité (3 à 9). Retenez les couples les plus pertinents pour la suite de l’analyse.",
      fields: () => [{ name: "source", label: "Source de risque", required: true, placeholder: "Ex. Cybercriminel, concurrent, salarié mécontent, hacktiviste" },
        { name: "objectif", label: "Objectif visé", required: true, placeholder: "Ex. Gain financier par rançon" },
        { name: "motivation", label: "Motivation", type: "select", num: true, options: L3 }, { name: "ressources", label: "Ressources", type: "select", num: true, options: L3 },
        { name: "activite", label: "Activité constatée", type: "select", num: true, options: L3 }, { name: "retenu", label: "Couple retenu pour l’analyse", type: "check", full: true }],
      cols: [["Source de risque", (d) => `<b>${esc(d.source)}</b>`], ["Objectif visé", (d) => esc(d.objectif)],
        ["Pertinence", (d) => { const p = (d.motivation || 1) + (d.ressources || 1) + (d.activite || 1); return `<span class="pill ${p >= 7 ? "bad" : p >= 5 ? "warn" : "ok"}">${p} · ${p >= 7 ? "Élevée" : p >= 5 ? "Moyenne" : "Faible"}</span>`; }],
        ["Retenu", (d) => (d.retenu ? '<span class="pill ok">Retenu</span>' : '<span class="muted small">Écarté</span>')]] },
    partie: { title: "Parties prenantes de l’écosystème", hint: "Menace = (dépendance × pénétration) / (maturité cyber × confiance), chaque critère de 1 à 4. Zone de danger à partir de 2,5, de contrôle à partir de 0,9 (seuils indicatifs).",
      fields: () => [{ name: "nom", label: "Partie prenante", required: true }, { name: "categorie", label: "Catégorie", type: "select", options: ["Client", "Partenaire", "Prestataire", "Fournisseur cloud", "Infogérant", "Autre"].map((x) => [x, x]) },
        { name: "dependance", label: "Dépendance", type: "select", num: true, options: L4 }, { name: "penetration", label: "Pénétration (accès au SI)", type: "select", num: true, options: L4 },
        { name: "maturite", label: "Maturité cyber", type: "select", num: true, options: L4 }, { name: "confiance", label: "Confiance", type: "select", num: true, options: L4 }],
      cols: [["Partie prenante", (d) => `<b>${esc(d.nom)}</b><div class="small muted">${esc(d.categorie || "")}</div>`],
        ["Menace", (d) => { const m = ((d.dependance || 1) * (d.penetration || 1)) / ((d.maturite || 1) * (d.confiance || 1)); return `<span class="pill ${m >= 2.5 ? "bad" : m >= 0.9 ? "warn" : "ok"}">${m.toFixed(2).replace(".", ",")} · ${m >= 2.5 ? "Danger" : m >= 0.9 ? "Contrôle" : "Veille"}</span>`; }]] },
    strategique: { title: "Scénarios stratégiques", hint: "Comment une source de risque atteint un événement redouté, directement ou par l’écosystème. La gravité est celle de l’événement redouté.",
      fields: () => [{ name: "nom", label: "Scénario stratégique", required: true, full: true, placeholder: "Ex. Un cybercriminel chiffre les serveurs via l’infogérant" },
        { name: "srov_id", label: "Couple SR/OV (retenus)", type: "select", num: true, options: opts("srov", "source", (i) => i.data.retenu).map(([id]) => [id, `${byId[id].data.source} → ${short(byId[id].data.objectif, 50)}`]) },
        { name: "evenement_id", label: "Événement redouté", type: "select", num: true, options: opts("evenement", "description") },
        { name: "parties", label: "Parties prenantes empruntées", placeholder: "Ex. Infogérant, éditeur du logiciel de paie" }, { name: "chemin", label: "Chemin d’attaque", type: "textarea", full: true }],
      cols: [["Scénario", (d) => `<b>${esc(d.nom)}</b><div class="small muted">${esc(short(d.chemin))}</div>`], ["Source", (d) => name(d.srov_id, "source")],
        ["Événement redouté", (d) => esc(short(byId[d.evenement_id]?.data.description, 60) || "—")], ["Gravité", (d) => `<span class="pill">G${byId[d.evenement_id]?.data.gravite || "?"}</span>`]] },
    operationnel: { title: "Scénarios opérationnels", hint: "Le mode opératoire technique (reconnaissance, intrusion, propagation, action) et sa vraisemblance.",
      fields: () => [{ name: "strategique_id", label: "Scénario stratégique", type: "select", num: true, options: opts("strategique") },
        { name: "vraisemblance", label: "Vraisemblance", type: "select", num: true, options: VRAIS },
        { name: "mode", label: "Mode opératoire", type: "textarea", required: true, full: true, placeholder: "Ex. Hameçonnage d’un compte de l’infogérant, accès VPN sans MFA, élévation de privilèges, chiffrement des partages" },
        { name: "decision", label: "Décision de traitement", type: "select", options: DECISION }],
      cols: [["Mode opératoire", (d) => `<b>${name(d.strategique_id)}</b><div class="small muted">${esc(short(d.mode, 140))}</div>`],
        ["Vraisemblance", (d) => `<span class="pill">V${d.vraisemblance}</span>`]] },
  };

  const section = (kind) => {
    const s = SECTIONS[kind], rows = of(kind);
    return `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${s.title}</h3><span class="muted small">${rows.length}</span>
        ${admin ? `<button class="btn sm" style="margin-left:auto" data-add="${kind}">${icon("plus")}Ajouter</button>` : ""}</div>
      <div class="card-b" style="padding-top:0"><p class="small muted" style="margin-top:0">${s.hint}</p>
      ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr>${s.cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>
        ${rows.map((r) => `<tr class="click" data-id="${r.id}">${s.cols.map((c) => `<td>${c[1](r.data)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
        : `<div class="muted small" style="padding:8px 0">Aucun élément.</div>`}</div></div>`;
  };

  const socle = () => `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Socle de sécurité</h3><span class="muted small">calculé à partir des référentiels suivis dans Amane</span></div>
    <div class="card-b"><div class="grid g3">${frameworks.map((f) => `<div style="display:flex;gap:12px;align-items:center">${ring(f.score, "prêt", 84, 8)}<div><b>${esc(f.short)}</b><div class="small muted">${f.met} / ${f.requirements} exigences satisfaites</div></div></div>`).join("")}</div></div></div>`;

  const treatment = () => {
    const ops = of("operationnel");
    const cell = (g, v) => {
      const here = ops.filter((o) => gravOf(byId[o.data.strategique_id]) === g && o.data.vraisemblance === v);
      const [, c] = lvl(g, v);
      return `<div class="hm ${c}" title="G${g} × V${v}">${here.map((o) => `<span class="dot" title="${esc(byId[o.data.strategique_id]?.data.nom || "")}">${ops.indexOf(o) + 1}</span>`).join("")}</div>`;
    };
    const counts = ops.map((o) => lvl(gravOf(byId[o.data.strategique_id]), o.data.vraisemblance)[0]);
    return `<div class="grid g2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h3>Cartographie des risques</h3><span class="muted small">gravité × vraisemblance</span></div><div class="card-b">
        <div class="heat4">${[4, 3, 2, 1].map((g) => `<div class="ax">G${g}</div>${[1, 2, 3, 4].map((v) => cell(g, v)).join("")}`).join("")}<div></div>${[1, 2, 3, 4].map((v) => `<div class="ax">V${v}</div>`).join("")}</div></div></div>
      <div class="card"><div class="card-h"><h3>Synthèse</h3></div><div class="card-b">
        <div class="grid g3" style="margin-bottom:14px">${[["Élevé", "bad"], ["Modéré", "warn"], ["Faible", "ok"]].map(([l, c]) => `<div><span class="pill ${c}">${l}</span><div style="font:700 26px var(--display);margin-top:6px">${counts.filter((x) => x === l).length}</div></div>`).join("")}</div>
        <p class="small" style="margin:0 0 6px"><b>${ops.filter((o) => o.data.risk_id).length}</b> scénario(s) sur ${ops.length} suivis dans le <a href="#/risques">registre des risques</a>.</p>
        <p class="small muted" style="margin:0">Au registre, la vraisemblance et la gravité sont converties sur l’échelle de 1 à 5 (V1→1, V2→2, V3→4, V4→5) et les mesures choisies sont associées au risque.</p></div></div></div>
      <div class="card"><div class="card-h"><h3>Risques résultants</h3><span class="muted small">${ops.length} scénario${ops.length > 1 ? "s" : ""}</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Risque</th><th>Niveau</th><th>Décision</th><th>Mesures</th><th></th></tr></thead><tbody>
        ${ops.map((o, n) => {
          const st = byId[o.data.strategique_id], g = gravOf(st), [l, c] = lvl(g, o.data.vraisemblance);
          return `<tr><td class="small muted">${n + 1}</td><td class="title" style="min-width:320px"><b>${esc(st?.data.nom || "Scénario stratégique supprimé")}</b><div class="small muted">${esc(short(o.data.mode, 120))}</div></td>
            <td style="white-space:nowrap"><span class="pill ${c}">G${g} × V${o.data.vraisemblance} · ${l}</span></td>
            <td class="small">${esc(DECISION.find((d) => d[0] === o.data.decision)?.[1] || "À décider")}</td>
            <td style="min-width:150px">${(o.data.mesures || []).map((id) => controls.find((x) => x.id === id)).filter(Boolean).map((x) => `<a class="tag" href="#/mesures/${x.id}" title="${esc(x.title)}">${esc(x.code)}</a>`).join("") || '<span class="muted small">—</span>'}</td>
            <td style="white-space:nowrap;text-align:right">${admin ? `<button class="btn sm" data-measures="${o.id}">${icon("edit")}Mesures</button> <button class="btn sm ${o.data.risk_id ? "" : "primary"}" data-risk="${o.id}">${o.data.risk_id ? `${icon("refresh")}Risque n° ${o.data.risk_id}` : "Envoyer au registre"}</button>` : o.data.risk_id ? '<a class="small" href="#/risques">Au registre</a>' : ""}</td></tr>`;
        }).join("") || `<tr><td colspan="6">${empty("risk", "Aucun scénario opérationnel", "Construisez les scénarios aux ateliers 3 et 4.")}</td></tr>`}</tbody></table></div></div>`;
  };

  const body = [
    () => socle() + section("valeur") + section("bien") + section("evenement") + section("ecart"),
    () => section("srov"),
    () => section("partie") + section("strategique"),
    () => section("operationnel"),
    () => treatment(),
  ][step - 1]();

  main.innerHTML = `<div class="head"><div><h1>Analyse de risques EBIOS RM</h1><p>Méthode EBIOS Risk Manager (ANSSI) en cinq ateliers. Les scénarios retenus alimentent le registre des risques et ses mesures.</p></div></div>
    <div class="steps">${WORKSHOPS.map(([t, s], i) => `<a href="#/ebios/${i + 1}" class="step ${i + 1 === step ? "on" : ""}"><span class="n">${i + 1}</span><span><b>${t}</b><span class="small muted">${s}</span></span></a>`).join("")}</div>
    ${body}
    <div style="display:flex;justify-content:space-between;margin-top:8px">${step > 1 ? `<a class="btn" href="#/ebios/${step - 1}">← Atelier ${step - 1}</a>` : "<span></span>"}${step < 5 ? `<a class="btn primary" href="#/ebios/${step + 1}">Atelier ${step + 1} →</a>` : ""}</div>`;

  const open = (kind, it) => {
    const s = SECTIONS[kind];
    const d = drawer(it ? s.title : `Ajouter · ${s.title}`, "", `<div class="form cols" id="frm">${s.fields().map((f) => fieldHtml(f, it?.data[f.name])).join("")}</div><div class="err" id="err" style="margin-top:10px"></div>`,
      admin ? `${it ? `<button class="btn danger" id="del" style="margin-right:auto">${icon("trash")}Supprimer</button>` : ""}<button class="btn" data-x>Annuler</button><button class="btn primary" id="save">Enregistrer</button>` : "");
    if (!admin) return d.el.querySelectorAll("input, select, textarea").forEach((x) => (x.disabled = true));
    d.el.querySelector("[data-x]").onclick = d.close;
    d.el.querySelector("#save").onclick = async () => {
      const data = readForm(d.el.querySelector("#frm"));
      try { await api(it ? `/api/ebios/${it.id}` : "/api/ebios", { method: it ? "PATCH" : "POST", body: it ? { data } : { kind, data } }); toast("Enregistré"); d.close(); ctx.refresh(); }
      catch (e) { d.el.querySelector("#err").textContent = e.message; }
    };
    d.el.querySelector("#del")?.addEventListener("click", async () => {
      if (!(await confirmBox("Supprimer", "Supprimer cet élément de l’analyse ? Les éléments qui s’y rattachent seront conservés sans ce lien.", "Supprimer", true))) return;
      try { await api(`/api/ebios/${it.id}`, { method: "DELETE" }); toast("Supprimé"); d.close(); ctx.refresh(); } catch (e) { fail(e); }
    });
  };

  const measures = (it) => {
    const byDomain = {};
    controls.forEach((c) => (byDomain[c.domain] ??= []).push(c));
    const sel = new Set(it.data.mesures || []);
    const d = drawer("Mesures de traitement", esc(byId[it.data.strategique_id]?.data.nom || ""), Object.entries(byDomain).map(([dom, cs]) => `<div style="margin-bottom:12px"><b class="small">${esc(dom)}</b>
      ${cs.map((c) => `<label class="check small" style="margin:4px 0"><input type="checkbox" value="${c.id}" ${sel.has(c.id) ? "checked" : ""}> <span class="code">${esc(c.code)}</span> ${esc(c.title)}</label>`).join("")}</div>`).join(""),
      `<button class="btn" data-x>Annuler</button><button class="btn primary" id="save">Enregistrer</button>`);
    d.el.querySelector("[data-x]").onclick = d.close;
    d.el.querySelector("#save").onclick = async () => {
      const mesures = [...d.el.querySelectorAll("input:checked")].map((x) => Number(x.value));
      try { await api(`/api/ebios/${it.id}`, { method: "PATCH", body: { data: { mesures } } }); toast("Mesures enregistrées"); d.close(); ctx.refresh(); } catch (e) { fail(e); }
    };
  };

  main.onclick = async (e) => {
    const add = e.target.closest("[data-add]"), row = e.target.closest("tr[data-id]"), m = e.target.closest("[data-measures]"), r = e.target.closest("[data-risk]");
    if (add) return open(add.dataset.add);
    if (row) { const it = byId[row.dataset.id]; return open(it.kind, it); }
    if (m) return measures(byId[m.dataset.measures]);
    if (r) {
      try { const res = await api(`/api/ebios/${r.dataset.risk}/to-risk`, { method: "POST" }); toast(`Risque n° ${res.risk_id} enregistré au registre`); ctx.refresh(); } catch (err) { fail(err); }
    }
  };
}
