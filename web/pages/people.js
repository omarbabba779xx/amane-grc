import { api, esc, icon, drawer, modal, toast, fail, options, date, today, ago, empty } from "../lib.js";
import { fieldHtml, readForm } from "./register.js";

const ROLES = [["membre", "Collaborateur"], ["admin", "Administrateur"], ["auditeur", "Auditeur (lecture seule)"]];
const old = (d) => !d || Date.now() - new Date(d) > 365 * 864e5;

export async function render(main, ctx) {
  const users = await api("/api/users");
  const admin = ctx.user.role === "admin";
  const staff = users.filter((u) => u.active && u.role !== "auditeur");
  const complete = staff.filter((u) => u.policies_accepted === u.policies_total && !old(u.training_at) && u.devices.length).length;
  main.innerHTML = `<div class="head"><div><h1>Personnes</h1><p>Intégration sécurité de chaque collaborateur : politiques acceptées, formation et poste équipé de l’agent.</p></div>
      <div class="actions">${admin ? `<button class="btn primary" id="add">${icon("plus")}Ajouter une personne</button>` : ""}</div></div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="k">Collaborateurs actifs</div><div class="v">${staff.length}</div></div>
      <div class="card stat"><div class="k">Intégration complète</div><div class="v" style="color:${complete === staff.length ? "var(--ok)" : "var(--warn)"}">${complete}</div><div class="s">politiques, formation et agent</div></div>
      <div class="card stat"><div class="k">Formation à jour</div><div class="v">${staff.filter((u) => !old(u.training_at)).length}</div><div class="s">moins de 12 mois</div></div>
      <div class="card stat"><div class="k">Avec un poste équipé</div><div class="v">${staff.filter((u) => u.devices.length).length}</div></div></div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Personne</th><th>Rôle</th><th>Politiques</th><th>Formation</th><th>Appareils</th><th>Statut</th></tr></thead><tbody id="rows">
    ${users.map((u) => `<tr class="click" data-id="${u.id}">
      <td class="title"><b>${esc(u.name)}</b><span class="small muted">${esc(u.email)}${u.department ? ` · ${esc(u.department)}` : ""}</span></td>
      <td class="small">${esc(ROLES.find((r) => r[0] === u.role)?.[1])}</td>
      <td>${u.role === "auditeur" ? '<span class="muted small">—</span>' : `<span class="pill ${u.policies_accepted === u.policies_total && u.policies_total ? "ok" : "warn"}">${u.policies_accepted} / ${u.policies_total}</span>`}</td>
      <td>${u.role === "auditeur" ? '<span class="muted small">—</span>' : old(u.training_at) ? `<span class="pill bad">${u.training_at ? "À renouveler" : "Non formé"}</span>` : `<span class="pill ok">${date(u.training_at)}</span>`}</td>
      <td class="small">${u.devices.length ? u.devices.map((d) => `${esc(d.hostname)} <span class="muted">${ago(d.last_seen)}</span>`).join("<br>") : '<span class="muted">aucun</span>'}</td>
      <td>${u.active ? '<span class="pill ok">Actif</span>' : '<span class="pill">Désactivé</span>'}</td></tr>`).join("") || `<tr><td colspan="6">${empty("people", "Personne", "")}</td></tr>`}
    </tbody></table></div></div>`;
  if (!admin) return;

  const FIELDS = (u) => [
    { name: "name", label: "Nom complet", required: true },
    ...(u ? [] : [{ name: "email", label: "E-mail professionnel", type: "email", required: true }]),
    { name: "role", label: "Rôle dans Amane", type: "select", options: ROLES },
    { name: "title", label: "Fonction" },
    { name: "department", label: "Service" },
    { name: "start_date", label: "Date d’arrivée", type: "date", default: today() },
    ...(u ? [{ name: "training_at", label: "Dernière formation sécurité", type: "date" }, { name: "active", label: "Compte actif", type: "check" }] : []),
  ];
  const showPassword = (name, pw) => {
    const m = modal("Mot de passe provisoire", `<p style="margin-top:0">Transmettez ce mot de passe à <b>${esc(name)}</b> par un canal sûr. Il ne sera plus affiché.</p>
      <pre class="cmd">${esc(pw)}</pre><p class="small muted">La personne pourra le changer depuis « Mon espace ».</p>`, `<button class="btn primary" data-ok>J’ai noté le mot de passe</button>`);
    m.el.querySelector("[data-ok]").onclick = m.close;
  };
  const open = (u) => {
    const d = drawer(u ? esc(u.name) : "Ajouter une personne", u ? esc(u.email) : "Un compte est créé avec un mot de passe provisoire.",
      `<div class="form cols" id="frm">${FIELDS(u).map((f) => fieldHtml(f, u?.[f.name])).join("")}</div>
       ${u ? `<div class="section"><h4>Actions</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="trained">${icon("check")}Formation suivie aujourd’hui</button>
       <button class="btn sm" id="reset">${icon("key")}Réinitialiser le mot de passe</button></div></div>` : ""}<div class="err" id="err" style="margin-top:10px"></div>`,
      `<button class="btn" data-x>Annuler</button><button class="btn primary" id="save">Enregistrer</button>`);
    d.el.querySelector("[data-x]").onclick = d.close;
    d.el.querySelector("#save").onclick = async () => {
      try {
        const r = await api(`/api/users${u ? `/${u.id}` : ""}`, { method: u ? "PATCH" : "POST", body: readForm(d.el.querySelector("#frm")) });
        d.close(); toast("Enregistré");
        if (r.temporary_password) showPassword(readForm(d.el.querySelector("#frm")).name, r.temporary_password);
        ctx.refresh();
      } catch (e) { d.el.querySelector("#err").textContent = e.message; }
    };
    d.el.querySelector("#trained")?.addEventListener("click", async () => {
      try { await api(`/api/users/${u.id}`, { method: "PATCH", body: { training_at: today() } }); toast("Formation enregistrée"); d.close(); ctx.refresh(); } catch (e) { fail(e); }
    });
    d.el.querySelector("#reset")?.addEventListener("click", async () => {
      try { const r = await api(`/api/users/${u.id}/reset-password`, { method: "POST" }); showPassword(u.name, r.temporary_password); } catch (e) { fail(e); }
    });
  };
  document.getElementById("add").onclick = () => open(null);
  document.getElementById("rows").onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) open(users.find((u) => u.id === Number(tr.dataset.id))); };
}
