// Public Trust Center: no account, read-only, shows only what the organisation chose to publish.
import { esc, icon, ring, date, datetime, md, modal, toast } from "./lib.js";

const root = document.getElementById("root");
const token = new URLSearchParams(location.search).get("acces") || "";
const STATE = { conforme: ["Conforme", "ok"], en_cours: ["En cours de mise en conformité", "info"], demarre: ["Programme démarré", "warn"] };
const LOGO = `<div class="logo"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v6c0 4.6-3.2 8.4-7.5 9.9C7.7 20.4 4.5 16.6 4.5 12V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg></div>`;

async function get(path) {
  const r = await fetch(path);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erreur ${r.status}`);
  return j;
}

async function boot() {
  let v;
  try { v = await get(`/api/public/trust${token ? `?acces=${encodeURIComponent(token)}` : ""}`); }
  catch (e) {
    root.innerHTML = `<div class="tc-wrap"><div class="card card-b" style="margin-top:60px;text-align:center"><h2>Trust Center indisponible</h2><p class="muted">Cette page n’est pas publiée.</p></div></div>`;
    return;
  }
  document.title = `Trust Center · ${v.org.name}`;
  const ok = v.domains ? v.domains.reduce((n, d) => n + d.items.length, 0) : 0;
  root.innerHTML = `
    <header class="tc-top"><div class="tc-wrap tc-bar">${LOGO}<div><b>${esc(v.org.name)}</b><span>Trust Center</span></div>
      ${v.contact_email ? `<a class="btn" style="margin-left:auto" href="mailto:${esc(v.contact_email)}">${icon("mail")}Contacter l’équipe sécurité</a>` : ""}</div></header>
    <section class="tc-hero"><div class="tc-wrap">
      <span class="tc-live"><i></i>Surveillance continue · mis à jour le ${datetime(v.updated_at)}</span>
      <h1>${esc(v.headline)}</h1>
      ${v.intro ? `<p>${esc(v.intro)}</p>` : ""}
      ${v.org.sector || v.org.city ? `<div class="small" style="opacity:.75">${esc([v.org.sector, v.org.city].filter(Boolean).join(" · "))}</div>` : ""}
    </div></section>
    <main class="tc-wrap">
      ${v.access ? `<div class="card card-b tc-access">${icon("check")}<div>Accès aux documents accordé à <b>${esc(v.access.name)}</b>${v.access.company ? ` (${esc(v.access.company)})` : ""} jusqu’au ${date(v.access.expires_at)}.</div></div>` : ""}

      <h2 class="tc-h">Conformité</h2>
      <div class="grid g3">${v.frameworks.map((f) => `<div class="card"><div class="fw-card">${f.score != null ? ring(f.score, "prêt", 84, 8) : ""}
        <div><h3>${esc(f.name)}</h3><span class="pill ${STATE[f.state][1]}">${STATE[f.state][0]}</span><p class="small muted" style="margin-bottom:0">${esc(f.description)}</p></div></div></div>`).join("")}</div>

      ${v.domains || v.tests ? `<h2 class="tc-h">Mesures de sécurité</h2>
      <div class="grid g4" style="margin-bottom:16px">
        ${v.domains ? `<div class="card stat"><div class="k">Mesures en place</div><div class="v">${ok}</div><div class="s">dans ${v.domains.length} domaines de sécurité</div></div>` : ""}
        ${v.tests ? `<div class="card stat"><div class="k">Contrôles automatisés réussis</div><div class="v">${v.tests.ok}</div><div class="s">vérifiés en continu sur les postes et les comptes</div></div>` : ""}
      </div>
      ${v.domains ? `<div class="grid g3">${v.domains.map((d) => `<div class="card"><div class="card-h"><h3>${esc(d.domain)}</h3><span class="small muted">${d.items.length} en place</span></div>
        <div class="card-b" style="padding-top:4px">${d.items.map((i) => `<div class="tc-item ok">${icon("check")}<span>${esc(i)}</span></div>`).join("")}</div></div>`).join("")}</div>` : ""}` : ""}

      ${v.policies.length ? `<h2 class="tc-h">Documents</h2>
      <div class="card"><div class="list">${v.policies.map((p) => `<div><div class="grow"><b>${esc(p.title)}</b><div class="small muted">${esc(p.summary || "")}</div>
        <div class="small muted">Version ${p.version} · approuvée le ${date(p.approved_at)}</div></div>
        ${v.access ? `<button class="btn" data-read="${esc(p.code)}">Lire</button>` : `<button class="btn" data-ask>${icon("key")}Demander l’accès</button>`}</div>`).join("")}</div></div>` : ""}

      ${v.subprocessors?.length ? `<h2 class="tc-h">Sous-traitants</h2>
      <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Sous-traitant</th><th>Service</th><th>Pays de traitement</th></tr></thead><tbody>
        ${v.subprocessors.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td class="small">${esc(s.service || "—")}</td><td class="small">${esc(s.country || "—")}</td></tr>`).join("")}</tbody></table></div></div>` : ""}

      ${!v.access && v.policies.length ? `<div class="card card-b tc-cta"><div><h3 style="margin:0">Besoin de nos politiques de sécurité ?</h3><p class="small muted" style="margin:4px 0 0">Pour un audit fournisseur ou un questionnaire de sécurité, demandez un accès : il est accordé par notre responsable de la sécurité.</p></div>
        <button class="btn primary" data-ask>Demander l’accès</button></div>` : ""}
    </main>
    <footer class="tc-wrap tc-foot">Données issues en continu du programme de conformité de ${esc(v.org.name)} · Amane GRC</footer>`;

  root.onclick = async (e) => {
    if (e.target.closest("[data-ask]")) return ask();
    const r = e.target.closest("[data-read]");
    if (r) {
      try {
        const p = await get(`/api/public/trust/policies/${encodeURIComponent(r.dataset.read)}?acces=${encodeURIComponent(token)}`);
        const m = modal(esc(p.title), `<div class="small muted" style="margin-bottom:10px">Version ${p.version} · approuvée le ${date(p.approved_at)} · document confidentiel, ne pas diffuser</div><div class="policy-body" style="max-height:60vh;overflow:auto">${md(p.body)}</div>`,
          `<button class="btn" data-c>Fermer</button>`);
        m.el.style.width = "min(860px, 94vw)";
        m.el.querySelector("[data-c]").onclick = m.close;
      } catch (err) { toast(err.message, true); }
    }
  };
}

function ask() {
  const m = modal("Demander l’accès aux documents", `<form class="form" id="f">
      <div class="field"><label>Nom et prénom</label><input name="name" required></div>
      <div class="field"><label>E-mail professionnel</label><input name="email" type="email" required></div>
      <div class="field"><label>Entreprise</label><input name="company"></div>
      <div class="field"><label>Motif de la demande</label><textarea name="reason" placeholder="Ex. Évaluation fournisseur avant signature du contrat"></textarea></div>
      <div class="err" id="err"></div></form>`, `<button class="btn" data-c>Annuler</button><button class="btn primary" data-s>Envoyer la demande</button>`);
  m.el.querySelector("[data-c]").onclick = m.close;
  m.el.querySelector("[data-s]").onclick = async () => {
    const f = m.el.querySelector("#f");
    if (!f.reportValidity()) return;
    const body = Object.fromEntries(new FormData(f));
    const r = await fetch("/api/public/trust/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { m.el.querySelector("#err").textContent = j.error || "Envoi impossible"; return; }
    m.el.querySelector(".mb").innerHTML = '<p style="margin:0">Merci, votre demande a bien été transmise. Vous recevrez un lien d’accès par e-mail après validation.</p>';
    m.el.querySelector(".mf").innerHTML = '<button class="btn primary" data-c>Fermer</button>';
    m.el.querySelector("[data-c]").onclick = m.close;
  };
}

boot();
