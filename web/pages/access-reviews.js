// Access reviews: campaigns over the Microsoft 365 (or Amane) accounts, decisions by reviewer, evidence on IAM-05.
import { api, esc, icon, toast, fail, date, datetime, modal, options, empty } from "../lib.js";

const DECISION = { en_attente: ["En attente", "warn"], conserver: ["Conserver", "ok"], modifier: ["Modifier", "info"], retirer: ["Retirer", "bad"] };
const SCOPE = { m365: "Microsoft 365", amane: "Comptes Amane" };
const pct = (n, t) => (t ? (n / t) * 100 : 0);

// Keep / modify / remove buttons, shared with "Mon espace".
export const decisionButtons = (i) => `<div class="chips" style="display:inline-flex">${["conserver", "modifier", "retirer"].map((d) =>
  `<button class="chip ${i.decision === d ? "on" : ""}" data-dec="${d}" data-item="${i.id}">${DECISION[d][0]}</button>`).join("")}</div>`;

export function wireDecisions(container, done) {
  container.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-dec]");
    if (!b) return;
    const decision = b.dataset.dec, id = b.dataset.item;
    const send = async (comment) => {
      try { await api(`/api/access-reviews/items/${id}`, { method: "PATCH", body: { decision, comment } }); toast(`Décision enregistrée : ${DECISION[decision][0].toLowerCase()}`); done(); }
      catch (err) { fail(err); }
    };
    if (decision === "conserver") return send("");
    const m = modal(decision === "retirer" ? "Retirer l’accès" : "Modifier l’accès", `<div class="field"><label>${decision === "retirer" ? "Que faut-il retirer ?" : "Que faut-il modifier ?"}</label>
      <textarea id="why" placeholder="${decision === "retirer" ? "Ex. Départ le 30 septembre : désactiver le compte et la licence" : "Ex. Retirer le rôle Administrateur Exchange, inutile pour son poste"}"></textarea></div><div class="err" id="err"></div>`,
      `<button class="btn" data-c>Annuler</button><button class="btn primary" data-s>Enregistrer</button>`);
    m.el.querySelector("textarea").focus();
    m.el.querySelector("[data-c]").onclick = m.close;
    m.el.querySelector("[data-s]").onclick = () => {
      const why = m.el.querySelector("#why").value.trim();
      if (!why) { m.el.querySelector("#err").textContent = "Précisez ce qui doit changer : la personne qui corrige s’appuiera dessus."; return; }
      m.close(); send(why);
    };
  });
}

const account = (i) => `<b>${esc(i.name || i.upn)}</b><span class="small muted">${esc(i.upn || "")}${i.enabled ? "" : " · <b>compte désactivé</b>"}</span>`;
const roles = (i) => (i.admin_roles.length ? i.admin_roles.map((r) => `<span class="tag" style="${i.is_admin ? "border-color:var(--warn-line);color:var(--warn)" : ""}">${esc(r)}</span>`).join("") : '<span class="muted small">—</span>');
const mfa = (i) => (i.mfa == null ? '<span class="muted small">—</span>' : i.mfa ? '<span class="pill ok">MFA</span>' : '<span class="pill bad">Sans MFA</span>');

export async function render(main, ctx) {
  if (ctx.param) return detail(main, ctx, Number(ctx.param));
  const admin = ctx.user.role === "admin";
  const list = await api("/api/access-reviews");
  main.innerHTML = `<div class="head"><div><h1>Revue des accès</h1><p>Chaque responsable confirme qui doit garder ses accès. La clôture d’une campagne dépose automatiquement la preuve sur la mesure IAM-05 (ISO 27001 A.5.18, loi 09-08, DNSSI ACC-1).</p></div>
      ${admin ? `<div class="actions"><button class="btn primary" id="new">${icon("plus")}Nouvelle campagne</button></div>` : ""}</div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Campagne</th><th>Périmètre</th><th>Échéance</th><th style="width:30%">Avancement</th><th>À corriger</th><th>Statut</th></tr></thead><tbody id="rows">
      ${list.map((r) => {
        const late = r.status === "en_cours" && r.due_date && r.due_date < new Date().toISOString().slice(0, 10);
        const fix = (r.to_remove || 0) + (r.to_modify || 0);
        return `<tr class="click" data-id="${r.id}"><td class="title"><b>${esc(r.title)}</b><span class="small muted">lancée le ${date(r.created_at)} par ${esc(r.created_by_name || "—")}</span></td>
          <td class="small">${SCOPE[r.scope]}</td><td class="small" style="${late ? "color:var(--bad);font-weight:550" : ""}">${r.due_date ? date(r.due_date) : "—"}${late ? " · dépassée" : ""}</td>
          <td><div class="seg"><i class="s-ok" style="width:${pct(r.decided, r.total)}%"></i></div><div class="small muted" style="margin-top:4px">${r.decided} / ${r.total} comptes revus</div></td>
          <td class="small">${fix ? `${r.remediated || 0} / ${fix} faites` : '<span class="muted">—</span>'}</td>
          <td>${r.status === "en_cours" ? '<span class="pill info">En cours</span>' : '<span class="pill ok">Clôturée</span>'}</td></tr>`;
      }).join("") || `<tr><td colspan="6">${empty("key", "Aucune campagne", admin ? "Lancez une première revue : Amane fige la liste des comptes et la répartit entre les réviseurs." : "Aucune revue ne vous est confiée.")}</td></tr>`}
    </tbody></table></div></div>`;
  main.querySelector("#rows").onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) location.hash = `#/revues-acces/${tr.dataset.id}`; };
  main.querySelector("#new")?.addEventListener("click", () => newCampaign(ctx));
}

async function newCampaign(ctx) {
  const [users, m365] = await Promise.all([api("/api/users"), api("/api/integrations/m365").catch(() => ({}))]);
  const q = Math.floor(new Date().getMonth() / 3) + 1;
  const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const m = modal("Nouvelle campagne de revue", `<div class="form">
      <div class="field"><label>Titre</label><input id="title" value="Revue des accès T${q} ${new Date().getFullYear()}"></div>
      <div class="field"><label>Périmètre</label><select id="scope">
        <option value="m365" ${m365.status === "ok" ? "selected" : "disabled"}>Comptes Microsoft 365${m365.status === "ok" ? ` (${m365.details?.users ?? ""} actifs)` : " · synchronisation requise"}</option>
        <option value="amane" ${m365.status === "ok" ? "" : "selected"}>Comptes Amane</option></select></div>
      <div class="field"><label>Échéance</label><input type="date" id="due" value="${due}"></div>
      <div class="field"><label>Réviseur par défaut</label><select id="rev">${options(users.filter((u) => u.active && u.role !== "auditeur").map((u) => [u.id, u.name]), ctx.user.id)}</select>
        <span class="hint">Vous pourrez ensuite confier des comptes à d’autres responsables. Un auditeur ne peut pas être réviseur.</span></div>
      <div class="err" id="err"></div></div>`, `<button class="btn" data-c>Annuler</button><button class="btn primary" data-s>Lancer la campagne</button>`);
  m.el.querySelector("[data-c]").onclick = m.close;
  m.el.querySelector("[data-s]").onclick = async () => {
    const body = { title: m.el.querySelector("#title").value, scope: m.el.querySelector("#scope").value, due_date: m.el.querySelector("#due").value || null, reviewer_id: Number(m.el.querySelector("#rev").value) };
    try { const r = await api("/api/access-reviews", { method: "POST", body }); m.close(); toast("Campagne lancée"); location.hash = `#/revues-acces/${r.id}`; }
    catch (err) { m.el.querySelector("#err").textContent = err.message; }
  };
}

async function detail(main, ctx, id) {
  const admin = ctx.user.role === "admin";
  const [r, users] = await Promise.all([api(`/api/access-reviews/${id}`), admin ? api("/api/users") : Promise.resolve([])]);
  const open = r.status === "en_cours";
  let filter = "tous";
  const FILTERS = [["tous", "Tous"], ["attente", "En attente"], ["corriger", "À retirer ou modifier"], ["admins", "Administrateurs"], ["sansmfa", "Sans MFA"], ["inactifs", "Désactivés"]];
  const match = (i) => ({ tous: true, attente: i.decision === "en_attente", corriger: ["retirer", "modifier"].includes(i.decision), admins: !!i.is_admin, sansmfa: i.mfa === 0, inactifs: !i.enabled })[filter];
  const fix = (r.to_remove || 0) + (r.to_modify || 0);

  main.innerHTML = `<div class="head"><div><div class="small"><a href="#/revues-acces">Revue des accès</a> › ${SCOPE[r.scope]}</div><h1>${esc(r.title)}</h1>
      <p>${open ? `En cours${r.due_date ? ` · à terminer avant le ${date(r.due_date)}` : ""}` : `Clôturée le ${datetime(r.closed_at)} par ${esc(r.closed_by_name || "—")} · preuve déposée sur <a href="#/mesures">IAM-05</a>`}</p></div>
      <div class="actions"><a class="btn" href="/api/access-reviews/${id}/export.csv">${icon("download")}Exporter (CSV)</a>
        ${admin && open ? `<button class="btn primary" id="close" ${r.decided < r.total ? "disabled title=\"Tous les comptes doivent être revus\"" : ""}>${icon("check")}Clôturer et déposer la preuve</button>` : ""}</div></div>
    <div class="card kpis" style="margin-bottom:14px">
      <div><div class="k">${icon("people")}Comptes ${ctx.user.role === "membre" ? "qui vous sont confiés" : "revus"}</div><div class="v">${r.decided}<small> / ${r.total}</small></div><div class="seg" style="margin-top:10px"><i class="s-ok" style="width:${pct(r.decided, r.total)}%"></i></div></div>
      <div><div class="k">${icon("x")}À retirer</div><div class="v" style="${r.to_remove ? "color:var(--bad)" : ""}">${r.to_remove || 0}</div><div class="s">${r.to_modify || 0} à modifier</div></div>
      <div><div class="k">${icon("check")}Corrections faites</div><div class="v">${r.remediated || 0}<small> / ${fix}</small></div><div class="s">${fix && r.remediated < fix ? `à confirmer une fois faites dans ${r.scope === "m365" ? "Microsoft 365" : "Amane"}` : "rien en attente"}</div></div>
      <div><div class="k">${icon("alert")}Administrateurs</div><div class="v">${r.items.filter((i) => i.is_admin).length}</div><div class="s">${r.items.filter((i) => i.is_admin && i.mfa === 0).length} sans MFA</div></div>
    </div>
    <div class="toolbar"><div class="chips" id="filters">${FILTERS.map(([k, l]) => `<button class="chip ${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      ${admin && open ? `<span style="margin-left:auto" class="small muted" id="selcount">0 sélectionné</span><select class="search" id="assignTo" style="min-width:190px">${options(users.filter((u) => u.active && u.role !== "auditeur").map((u) => [u.id, u.name]))}</select>
        <button class="btn" id="assign">Confier la sélection</button>` : ""}</div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr>${admin && open ? '<th style="width:30px"><input type="checkbox" id="all"></th>' : ""}<th>Compte</th><th>Rôles</th><th>MFA</th><th>Réviseur</th><th>Décision</th>${open ? "" : "<th>Correction</th>"}</tr></thead><tbody id="rows"></tbody></table></div></div>`;

  const draw = () => {
    const rows = r.items.filter(match);
    main.querySelector("#rows").innerHTML = rows.map((i) => `<tr>${admin && open ? `<td><input type="checkbox" class="sel" value="${i.id}"></td>` : ""}
      <td class="title">${account(i)}</td><td>${roles(i)}</td><td>${mfa(i)}</td><td class="small">${esc(i.reviewer_name || "—")}</td>
      <td>${open && (admin || i.reviewer_id === ctx.user.id) ? decisionButtons(i) : `<span class="pill ${DECISION[i.decision][1]}">${DECISION[i.decision][0]}</span>`}
        ${i.comment ? `<div class="small muted" style="margin-top:4px;max-width:360px">${esc(i.comment)}</div>` : ""}</td>
      ${open ? "" : `<td>${["retirer", "modifier"].includes(i.decision) ? (admin ? `<label class="check small"><input type="checkbox" data-fix="${i.id}" ${i.remediated ? "checked" : ""}> Fait</label>` : i.remediated ? '<span class="pill ok">Fait</span>' : '<span class="pill warn">À faire</span>') : '<span class="muted small">—</span>'}</td>`}</tr>`).join("")
      || `<tr><td colspan="7">${empty("check", "Aucun compte", "Aucun compte ne correspond à ce filtre.")}</td></tr>`;
  };
  draw();
  main.querySelector("#filters").onclick = (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    main.querySelectorAll("#filters .chip").forEach((x) => x.classList.toggle("on", x === b));
    draw();
  };
  wireDecisions(main.querySelector("#rows"), () => ctx.refresh());
  const count = () => { const el = main.querySelector("#selcount"); if (el) el.textContent = `${main.querySelectorAll(".sel:checked").length} sélectionné(s)`; };
  main.querySelector("#rows").addEventListener("change", async (e) => {
    if (e.target.classList.contains("sel")) return count();
    const f = e.target.closest("[data-fix]");
    if (!f) return;
    try { await api(`/api/access-reviews/items/${f.dataset.fix}/remediation`, { method: "PATCH", body: { remediated: f.checked } }); toast(f.checked ? "Correction confirmée" : "Correction annulée"); ctx.refresh(); }
    catch (err) { fail(err); }
  });
  main.querySelector("#all")?.addEventListener("change", (e) => { main.querySelectorAll(".sel").forEach((x) => (x.checked = e.target.checked)); count(); });
  main.querySelector("#assign")?.addEventListener("click", async () => {
    const ids = [...main.querySelectorAll(".sel:checked")].map((x) => Number(x.value));
    try { const res = await api(`/api/access-reviews/${id}/assign`, { method: "POST", body: { item_ids: ids, reviewer_id: Number(main.querySelector("#assignTo").value) } }); toast(`${res.count} compte(s) confiés`); ctx.refresh(); }
    catch (err) { fail(err); }
  });
  main.querySelector("#close")?.addEventListener("click", async () => {
    try { const res = await api(`/api/access-reviews/${id}/close`, { method: "POST" }); toast(`Campagne clôturée · preuve déposée sur IAM-05${res.to_remove ? ` · ${res.to_remove} accès à retirer` : ""}`); ctx.refresh(); }
    catch (err) { fail(err); }
  });
}
