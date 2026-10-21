import { api, esc, icon, md, toast, fail, date, confirmBox, empty } from "../lib.js";

export async function render(main, ctx) {
  if (ctx.param) return detail(main, ctx);
  const pols = await api("/api/policies");
  const staff = ctx.user.role !== "membre";
  main.innerHTML = `<div class="head"><div><h1>Politiques</h1><p>${staff ? "Rédigez, approuvez et publiez vos politiques ; chaque collaborateur accepte la version en vigueur." : "Les politiques de sécurité à lire et à accepter."}</p></div></div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Politique</th>${staff ? "<th>Responsable</th><th>Version</th><th>Acceptation</th>" : "<th>Version</th>"}<th>État</th></tr></thead><tbody>
    ${pols.map((p) => `<tr class="click" data-id="${p.id}"><td class="title"><b>${esc(p.title)}</b><span class="small muted">${esc(p.summary || "")}</span></td>
      ${staff ? `<td class="small">${esc(p.owner_name || "—")}</td>` : ""}
      <td class="small">${p.version ? `v${p.version} · ${date(p.approved_at)}` : "—"}</td>
      ${staff ? `<td style="width:170px">${p.acceptance ? `<div class="bar ok"><i style="width:${p.acceptance.total ? (p.acceptance.accepted / p.acceptance.total) * 100 : 0}%"></i></div><span class="small muted">${p.acceptance.accepted} / ${p.acceptance.total}</span>` : '<span class="muted small">—</span>'}</td>` : ""}
      <td>${p.status === "publiee" ? (staff ? '<span class="pill ok">Publiée</span>' : p.accepted_by_me ? '<span class="pill ok">Acceptée</span>' : '<span class="pill warn">À accepter</span>') : '<span class="pill">Brouillon</span>'}</td></tr>`).join("")
      || `<tr><td colspan="5">${empty("doc", "Aucune politique", "")}</td></tr>`}
    </tbody></table></div></div>`;
  main.querySelector("tbody").onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) location.hash = `#/politiques/${tr.dataset.id}`; };
}

async function detail(main, ctx) {
  const p = await api(`/api/policies/${ctx.param}`);
  const admin = ctx.user.role === "admin", member = ctx.user.role === "membre";
  const changed = p.version && p.published_body !== null && p.published_body !== p.body;
  main.innerHTML = `
    <div class="head"><div><div class="small"><a href="#/politiques">Politiques</a></div><h1>${esc(p.title)}</h1>
      <p>${p.status === "publiee" ? `Version ${p.version} approuvée le ${date(p.approved_at)} par ${esc(p.approved_by_name || "—")}` : "Brouillon, jamais publié"}${changed ? " · <b>modifications non publiées</b>" : ""}</p></div>
      <div class="actions">
        ${admin ? `<button class="btn" id="edit">${icon("edit")}Modifier</button><button class="btn primary" id="publish">${icon("check")}${p.version ? "Publier une nouvelle version" : "Approuver et publier"}</button>` : ""}
        ${p.status === "publiee" && !p.accepted_by_me ? `<button class="btn primary" id="accept">${icon("check")}J’ai lu et j’accepte</button>` : p.accepted_by_me ? '<span class="pill ok" style="height:36px;padding:0 14px">Vous avez accepté cette version</span>' : ""}
      </div></div>
    <div class="grid ${member ? "" : "g21"}">
      <div class="card card-b"><div class="policy-body" id="body">${md(member ? p.published_body || p.body : p.body)}</div></div>
      ${member ? "" : `<div>
        <div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Acceptation · v${p.version || "—"}</h3></div><div class="card-b">
          ${p.status !== "publiee" ? '<div class="muted small">Publiez la politique pour recueillir les acceptations.</div>' : `<div class="list">${p.acceptances.map((a) => `<div><div class="grow"><b class="small">${esc(a.name)}</b><div class="small muted">${esc(a.department || "")}</div></div>
            ${a.accepted_at ? `<span class="pill ok">${date(a.accepted_at)}</span>` : '<span class="pill warn">En attente</span>'}</div>`).join("")}</div>`}</div></div>
        <div class="card"><div class="card-h"><h3>Historique des versions</h3></div><div class="card-b">
          ${p.versions.length ? `<div class="list">${p.versions.map((v) => `<div><b>v${v.version}</b><div class="grow small muted">${date(v.approved_at)} · ${esc(v.approved_by_name || "")}</div></div>`).join("")}</div>` : '<div class="muted small">Aucune version publiée.</div>'}
        </div></div></div>`}
    </div>`;

  document.getElementById("accept")?.addEventListener("click", async () => {
    try { await api(`/api/policies/${p.id}/accept`, { method: "POST" }); toast("Merci, votre acceptation est enregistrée"); ctx.refresh(); } catch (e) { fail(e); }
  });
  if (!admin) return;
  document.getElementById("publish").onclick = async () => {
    if (!(await confirmBox("Publier cette politique ?", `La version ${p.version + 1} sera approuvée à votre nom. Tous les collaborateurs devront l’accepter à nouveau.`, "Publier"))) return;
    try { const r = await api(`/api/policies/${p.id}/publish`, { method: "POST" }); toast(`Version ${r.version} publiée`); ctx.refresh(); } catch (e) { fail(e); }
  };
  document.getElementById("edit").onclick = () => {
    const card = document.getElementById("body").parentElement;
    card.innerHTML = `<div class="form"><div class="field"><label>Titre</label><input id="t" value="${esc(p.title)}"></div>
      <div class="field"><label>Résumé</label><input id="s" value="${esc(p.summary || "")}"></div>
      <div class="grid g2"><div class="field"><label>Contenu (Markdown)</label><textarea class="md" id="b">${esc(p.body)}</textarea></div>
        <div class="field"><label>Aperçu</label><div class="policy-body card" style="padding:14px;max-height:520px;overflow:auto" id="pv">${md(p.body)}</div></div></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="cancel">Annuler</button><button class="btn primary" id="save">Enregistrer le brouillon</button></div></div>`;
    card.querySelector("#b").oninput = (e) => (card.querySelector("#pv").innerHTML = md(e.target.value));
    card.querySelector("#cancel").onclick = () => ctx.refresh();
    card.querySelector("#save").onclick = async () => {
      try {
        await api(`/api/policies/${p.id}`, { method: "PATCH", body: { title: card.querySelector("#t").value.trim(), summary: card.querySelector("#s").value.trim(), body: card.querySelector("#b").value } });
        toast("Brouillon enregistré · publiez-le pour le rendre applicable"); ctx.refresh();
      } catch (e) { fail(e); }
    };
  };
}
