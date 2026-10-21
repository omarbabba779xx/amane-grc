import { api, esc, icon, pill, HEALTH, TEST, drawer, toast, fail, options, date, confirmBox, empty } from "../lib.js";

const STATUS = [["a_faire", "À faire"], ["en_cours", "En cours"], ["en_place", "En place"], ["non_applicable", "Non applicable"]];

export async function render(main, ctx) {
  const [controls, users] = await Promise.all([api("/api/controls"), ctx.user.role === "admin" ? api("/api/users") : Promise.resolve([])]);
  const domains = [...new Set(controls.map((c) => c.domain))];
  const st = { q: "", domain: "", health: "", fw: "" };
  main.innerHTML = `<div class="head"><div><h1>Mesures</h1><p>${controls.length} mesures unifiées couvrant ISO 27001, la loi 09-08 et la DNSSI. Ouvrez une mesure pour la mettre en œuvre et y déposer vos preuves.</p></div></div>
    <div class="toolbar">
      <input class="search" id="q" placeholder="Rechercher (code, intitulé, exigence)…">
      <select class="search" style="min-width:180px" id="domain"><option value="">Tous les domaines</option>${domains.map((d) => `<option>${esc(d)}</option>`).join("")}</select>
      <select class="search" style="min-width:160px" id="health"><option value="">Tous les états</option>${Object.entries(HEALTH).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <select class="search" style="min-width:170px" id="fw"><option value="">Tous les référentiels</option><option value="ISO27001">ISO 27001</option><option value="LOI0908">Loi 09-08</option><option value="DNSSI">DNSSI / 05-20</option></select>
      <span class="muted small" id="count"></span></div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Mesure</th><th>Domaine</th><th>Référentiels</th><th>Responsable</th><th>Preuves</th><th>État</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;

  const draw = () => {
    const rows = controls.filter((c) => (!st.domain || c.domain === st.domain) && (!st.health || c.health === st.health) && (!st.fw || c.frameworks[st.fw])
      && (!st.q || `${c.code} ${c.title} ${c.description} ${Object.values(c.frameworks).flat().join(" ")}`.toLowerCase().includes(st.q)));
    document.getElementById("count").textContent = `${rows.length} mesure${rows.length > 1 ? "s" : ""}`;
    document.getElementById("rows").innerHTML = rows.map((c) => `<tr class="click" data-id="${c.id}">
      <td class="title"><span class="code">${esc(c.code)}</span><b>${esc(c.title)}</b></td>
      <td class="small">${esc(c.domain)}</td>
      <td>${Object.entries(c.frameworks).map(([fw, refs]) => `<span class="tag" title="${esc(refs.join(", "))}">${fw === "ISO27001" ? "ISO" : fw === "LOI0908" ? "09-08" : "DNSSI"} · ${refs.length}</span>`).join("")}</td>
      <td class="small">${esc(c.owner_name || "—")}</td>
      <td class="small">${c.evidence_count || "—"}${c.test_count ? ` <span class="muted">· ${c.test_count} test${c.test_count > 1 ? "s" : ""}</span>` : ""}</td>
      <td>${pill(HEALTH, c.health)}</td></tr>`).join("") || `<tr><td colspan="6">${empty("list", "Aucune mesure", "Modifiez les filtres.")}</td></tr>`;
  };
  draw();
  for (const k of ["q", "domain", "health", "fw"]) document.getElementById(k).oninput = (e) => { st[k] = k === "q" ? e.target.value.toLowerCase() : e.target.value; draw(); };
  document.getElementById("rows").onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) location.hash = `#/mesures/${tr.dataset.id}`; };
  if (ctx.param) openControl(Number(ctx.param), ctx, users);
}

async function openControl(id, ctx, users) {
  const c = await api(`/api/controls/${id}`);
  const admin = ctx.user.role === "admin";
  const byFw = {};
  c.requirements.forEach((r) => (byFw[r.short] ??= []).push(r));
  const body = `
    <p style="margin-top:0">${esc(c.description)}</p>
    <div class="card" style="padding:12px 14px;background:#fafaff"><b class="small">Preuves attendues</b><div class="small">${esc(c.evidence_hint)}</div>
      <div class="small muted" style="margin-top:4px">Fréquence de revue : ${esc(c.frequency)}</div></div>

    <div class="section"><h4>Mise en œuvre</h4>
      <div class="form cols" id="ctlForm">
        <div class="field"><label>État</label><select name="status" ${admin ? "" : "disabled"}>${options(STATUS, c.status)}</select></div>
        <div class="field"><label>Responsable</label><select name="owner_id" data-num ${admin ? "" : "disabled"}><option value="">—</option>${options(users.filter((u) => u.active).map((u) => [u.id, u.name]), c.owner_id)}</select></div>
        <div class="field"><label>Échéance</label><input type="date" name="due_date" value="${esc(c.due_date || "")}" ${admin ? "" : "disabled"}></div>
        <div class="field"><label>Justification d’exclusion</label><input name="justification" value="${esc(c.justification || "")}" placeholder="Si non applicable" ${admin ? "" : "disabled"}></div>
        <div class="field full"><label>Notes de mise en œuvre</label><textarea name="notes" ${admin ? "" : "disabled"}>${esc(c.notes || "")}</textarea></div>
      </div></div>

    <div class="section"><h4>Exigences couvertes</h4>${Object.entries(byFw).map(([fw, rs]) => `<div style="margin-bottom:10px"><b class="small">${esc(fw)}</b><div class="list" style="margin-top:6px">${rs.map((r) =>
      `<div><span class="code" style="width:70px">${esc(r.ref)}</span><div class="grow small">${esc(r.title)}</div></div>`).join("")}</div></div>`).join("")}</div>

    ${c.tests.length ? `<div class="section"><h4>Tests automatisés</h4><div class="list">${c.tests.map((t) => `<div><div class="grow"><b>${esc(t.title)}</b>
      ${t.status === "echec" ? `<div class="small" style="color:var(--bad)">${esc(t.details.message || (t.details.failing || []).map((f) => `${f.name} : ${f.info}`).slice(0, 4).join(" · "))}</div><div class="small muted">${esc(t.remediation)}</div>` : ""}</div>${pill(TEST, t.status)}</div>`).join("")}</div></div>` : ""}

    ${c.policies.length ? `<div class="section"><h4>Politiques</h4><div class="list">${c.policies.map((p) => `<div><div class="grow"><a href="#/politiques/${p.id}">${esc(p.title)}</a></div>${p.status === "publiee" ? `<span class="pill ok">Publiée v${p.version}</span>` : '<span class="pill warn">Brouillon</span>'}</div>`).join("")}</div></div>` : ""}

    <div class="section"><h4>Preuves</h4>
      ${admin ? `<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <label class="btn sm">${icon("upload")}Déposer un fichier<input type="file" id="file" hidden></label>
        <button class="btn sm" id="addLink">${icon("link")}Ajouter un lien</button><button class="btn sm" id="addNote">${icon("doc")}Ajouter une note</button></div>
        <div id="evForm"></div>` : ""}
      <div id="evList">${evidenceList(c.evidence, admin)}</div></div>

    ${c.risks.length ? `<div class="section"><h4>Risques traités</h4><div class="list">${c.risks.map((r) => `<div><div class="grow">${esc(r.title)}</div><span class="tag">${r.likelihood * r.impact}</span></div>`).join("")}</div></div>` : ""}`;

  const d = drawer(`<span class="code">${esc(c.code)}</span> ${esc(c.title)}`, `${esc(c.domain)} · ${pill(HEALTH, c.health)}`, body,
    admin ? `<button class="btn" data-x>Fermer</button><button class="btn primary" id="save">Enregistrer</button>` : "", () => { if (location.hash !== "#/mesures") history.replaceState(null, "", "#/mesures"); });
  d.el.querySelector("[data-x]")?.addEventListener("click", d.close);
  if (!admin) return;

  d.el.querySelector("#save").onclick = async () => {
    const f = {};
    d.el.querySelectorAll("#ctlForm [name]").forEach((el) => (f[el.name] = el.dataset.num !== undefined ? (el.value ? Number(el.value) : null) : el.value.trim() || null));
    try { await api(`/api/controls/${id}`, { method: "PATCH", body: f }); toast("Mesure enregistrée"); d.close(); ctx.refresh(); } catch (e) { fail(e); }
  };
  const reloadEvidence = async () => { const x = await api(`/api/controls/${id}`); d.el.querySelector("#evList").innerHTML = evidenceList(x.evidence, true); };
  d.el.querySelector("#file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api(`/api/controls/${id}/evidence`, { method: "POST", raw: { body: file, headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-Title": encodeURIComponent(file.name) } } });
      toast("Preuve déposée"); reloadEvidence();
    } catch (err) { fail(err); }
    e.target.value = "";
  };
  const evForm = (kind) => {
    const box = d.el.querySelector("#evForm");
    box.innerHTML = `<div class="card" style="padding:12px;margin-bottom:10px"><div class="form">
      <div class="field"><label>Titre</label><input id="evTitle" placeholder="${kind === "lien" ? "Ex. Console Microsoft 365 · MFA activée" : "Ex. Compte rendu de revue des accès"}"></div>
      ${kind === "lien" ? '<div class="field"><label>Adresse</label><input id="evUrl" placeholder="https://"></div>' : '<div class="field"><label>Contenu</label><textarea id="evNote"></textarea></div>'}
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn sm" id="evCancel">Annuler</button><button class="btn sm primary" id="evSave">Ajouter</button></div></div></div>`;
    box.querySelector("#evCancel").onclick = () => (box.innerHTML = "");
    box.querySelector("#evSave").onclick = async () => {
      try {
        await api(`/api/controls/${id}/evidence`, { method: "POST", body: { kind, title: box.querySelector("#evTitle").value.trim(), url: box.querySelector("#evUrl")?.value.trim(), note: box.querySelector("#evNote")?.value.trim() } });
        box.innerHTML = ""; toast("Preuve ajoutée"); reloadEvidence();
      } catch (err) { fail(err); }
    };
  };
  d.el.querySelector("#addLink").onclick = () => evForm("lien");
  d.el.querySelector("#addNote").onclick = () => evForm("note");
  d.el.querySelector("#evList").onclick = async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b || !(await confirmBox("Supprimer la preuve", "Cette preuve sera définitivement supprimée.", "Supprimer", true))) return;
    try { await api(`/api/evidence/${b.dataset.del}`, { method: "DELETE" }); reloadEvidence(); } catch (err) { fail(err); }
  };
}

function evidenceList(list, admin) {
  if (!list.length) return '<div class="muted small">Aucune preuve pour l’instant.</div>';
  return `<div class="list">${list.map((e) => `<div>${icon(e.kind === "fichier" ? "doc" : e.kind === "lien" ? "link" : "edit")}<div class="grow">
    ${e.kind === "fichier" ? `<a href="/api/evidence/${e.id}/download">${esc(e.title)}</a> <span class="small muted">${Math.max(1, Math.round(e.size / 1024))} Ko</span>`
      : e.kind === "lien" ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : `<b>${esc(e.title)}</b><div class="small">${esc(e.note || "")}</div>`}
    <div class="small muted">${esc(e.uploaded_by_name || "")} · ${date(e.created_at)}</div></div>
    ${admin ? `<button class="btn sm" data-del="${e.id}" title="Supprimer">${icon("trash")}</button>` : ""}</div>`).join("")}</div>`;
}
