import { api, esc, icon, toast, fail, datetime, date, empty, modal } from "../lib.js";

const STATUS = { en_attente: ["En attente", "warn"], approuvee: ["Accordé", "ok"], refusee: ["Refusé", ""] };

export async function render(main, ctx) {
  const admin = ctx.user.role === "admin";
  const [t, frameworks, policies] = await Promise.all([api("/api/trust"), api("/api/frameworks"), api("/api/policies")]);
  const c = t.config, published = policies.filter((p) => p.status === "publiee");
  const pending = t.requests.filter((r) => r.status === "en_attente").length;
  const check = (name, label, on, hint = "") => `<label class="check" style="margin:6px 0"><input type="checkbox" name="${name}" ${on ? "checked" : ""}> ${label}${hint ? ` <span class="muted small">${hint}</span>` : ""}</label>`;

  main.innerHTML = `<div class="head"><div><h1>Trust Center</h1><p>Une page publique pour montrer à vos clients et partenaires votre niveau de sécurité, avec un accès contrôlé aux documents. Elle se met à jour toute seule à partir d’Amane.</p></div>
      <div class="actions">${c.enabled ? `<a class="btn primary" href="/trust" target="_blank" rel="noopener">${icon("globe")}Voir la page publique</a>` : '<span class="pill">Non publiée</span>'}</div></div>
    <div class="grid g21">
      <div class="card"><div class="card-h"><h3>Contenu publié</h3></div><div class="card-b"><div class="form" id="cfg">
        ${check("enabled", "<b>Publier le Trust Center</b>", c.enabled, "accessible sans compte à l’adresse /trust")}
        <div class="field"><label>Titre</label><input name="headline" value="${esc(c.headline)}"></div>
        <div class="field"><label>Présentation</label><textarea name="intro" placeholder="Ex. La protection des données de nos clients est au cœur de notre métier. Notre programme de sécurité suit l’ISO 27001 et la loi 09-08…">${esc(c.intro)}</textarea></div>
        <div class="field"><label>Contact sécurité</label><input name="contact_email" type="email" value="${esc(c.contact_email)}" placeholder="securite@entreprise.ma"></div>
        <div><b class="small">Référentiels affichés</b><div>${frameworks.map((f) => `<label class="check" style="margin:6px 0"><input type="checkbox" data-fw="${f.code}" ${c.frameworks.includes(f.code) ? "checked" : ""}> ${esc(f.name)}</label>`).join("")}</div></div>
        <div><b class="small">Éléments affichés</b><div>
          ${check("show_scores", "Score de préparation par référentiel", c.show_scores)}${check("show_controls", "Mesures de sécurité en place, par domaine", c.show_controls)}
          ${check("show_tests", "Nombre de contrôles automatisés réussis", c.show_tests)}${check("show_subprocessors", "Sous-traitants traitant des données personnelles", c.show_subprocessors, "fournisseurs avec accès à des données personnelles ou sensibles")}</div></div>
        <div><b class="small">Politiques consultables sur demande</b> <span class="muted small">le titre et le résumé sont publics, le texte complet après accord</span>
          <div>${published.map((p) => `<label class="check" style="margin:6px 0"><input type="checkbox" data-pol="${p.code}" ${c.policies.includes(p.code) ? "checked" : ""}> ${esc(p.title)} <span class="muted small">v${p.version}</span></label>`).join("") || '<div class="muted small">Aucune politique publiée.</div>'}</div></div>
        ${admin ? '<div><button class="btn primary" id="save">Enregistrer</button></div>' : ""}</div></div></div>
      <div class="card"><div class="card-h"><h3>Comment ça marche</h3></div><div class="card-b small">
        <ol style="margin:0;padding-left:18px;line-height:1.7">
          <li>Choisissez ce que vous publiez : les scores, les mesures et les tests sont recalculés en continu.</li>
          <li>Partagez l’adresse <span class="code">/trust</span> (rendez Amane accessible via un nom de domaine en HTTPS).</li>
          <li>Un client demande l’accès aux documents : vous recevez la demande ici${t.requests ? " et par e-mail si les alertes sont configurées" : ""}.</li>
          <li>Vous accordez l’accès : il reçoit un lien personnel valable ${t.access_days} jours pour lire les politiques choisies.</li>
        </ol>
        <p class="muted" style="margin-bottom:0">Rien d’autre n’est exposé : ni preuves, ni risques, ni noms de personnes.</p></div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Demandes d’accès aux documents</h3><span class="muted small">${pending} en attente</span></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Demandeur</th><th>Motif</th><th>Reçue</th><th>Statut</th><th></th></tr></thead><tbody id="reqs">
      ${t.requests.map((r) => `<tr><td class="title"><b>${esc(r.name)}</b><span class="small muted">${esc(r.email)}${r.company ? ` · ${esc(r.company)}` : ""}</span></td>
        <td class="small">${esc(r.reason || "—")}</td><td class="small">${datetime(r.created_at)}</td>
        <td><span class="pill ${STATUS[r.status][1]}">${STATUS[r.status][0]}</span>${r.status === "approuvee" ? `<div class="small muted">jusqu’au ${date(r.expires_at)}</div>` : ""}</td>
        <td style="white-space:nowrap">${admin && r.status === "en_attente" ? `<button class="btn sm primary" data-ok="${r.id}">Accorder</button> <button class="btn sm" data-no="${r.id}">Refuser</button>`
          : admin && r.status === "approuvee" && r.token ? `<button class="btn sm" data-link="${esc(r.token)}">${icon("link")}Lien</button>` : ""}</td></tr>`).join("")
        || `<tr><td colspan="5">${empty("globe", "Aucune demande", "Les demandes faites depuis la page publique apparaîtront ici.")}</td></tr>`}</tbody></table></div></div>`;

  if (!admin) { main.querySelectorAll("#cfg input, #cfg textarea").forEach((x) => (x.disabled = true)); return; }
  const showLink = (url, emailed) => {
    const m = modal("Lien d’accès", `<p class="small" style="margin-top:0">${emailed ? "Le lien a été envoyé par e-mail au demandeur. " : ""}Lien personnel, valable ${t.access_days} jours :</p><pre class="cmd" style="white-space:pre-wrap;word-break:break-all">${esc(url)}</pre>`,
      `<button class="btn" data-c>Fermer</button><button class="btn primary" data-copy>Copier</button>`);
    m.el.querySelector("[data-c]").onclick = m.close;
    m.el.querySelector("[data-copy]").onclick = async () => { await navigator.clipboard.writeText(url).catch(() => {}); toast("Lien copié"); };
  };
  document.getElementById("save").onclick = async () => {
    const el = document.getElementById("cfg");
    const body = { frameworks: [...el.querySelectorAll("[data-fw]:checked")].map((x) => x.dataset.fw), policies: [...el.querySelectorAll("[data-pol]:checked")].map((x) => x.dataset.pol) };
    for (const f of el.querySelectorAll("[name]")) body[f.name] = f.type === "checkbox" ? f.checked : f.value;
    try { await api("/api/trust", { method: "PUT", body }); toast("Trust Center enregistré"); ctx.refresh(); } catch (e) { fail(e); }
  };
  document.getElementById("reqs").onclick = async (e) => {
    const ok = e.target.closest("[data-ok]"), no = e.target.closest("[data-no]"), link = e.target.closest("[data-link]");
    if (link) return showLink(`${location.origin}/trust?acces=${link.dataset.link}`);
    const b = ok || no;
    if (!b) return;
    try {
      const r = await api(`/api/trust/requests/${b.dataset.ok || b.dataset.no}/${ok ? "approve" : "reject"}`, { method: "POST" });
      toast(ok ? "Accès accordé" : "Demande refusée");
      await ctx.refresh();
      if (r.url) showLink(r.url, r.emailed);
    } catch (err) { fail(err); }
  };
}
