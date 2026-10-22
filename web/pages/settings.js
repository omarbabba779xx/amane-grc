import { api, esc, icon, toast, fail, options, datetime, confirmBox } from "../lib.js";
import { readForm } from "./register.js";

export async function render(main, ctx) {
  const [org, users, log, fws, mail, inc] = await Promise.all([api("/api/org"), api("/api/users"), api("/api/activity"), api("/api/frameworks-all"), api("/api/settings/mail"), api("/api/settings/incidents")]);
  const integrity = await api("/api/audit/verify");
  const chk = (name, label, hint) => `<div class="field full"><label class="check"><input type="checkbox" name="${name}" ${mail[name] ? "checked" : ""}> ${label}</label>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  main.innerHTML = `<div class="head"><div><h1>Paramètres</h1><p>Organisme, référentiels, alertes par e-mail, agent Windows et journal d’activité.</p></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Organisme</h3></div><div class="card-b"><div class="form cols" id="org">
        <div class="field full"><label>Nom</label><input name="name" value="${esc(org.name)}"></div>
        <div class="field"><label>Secteur</label><input name="sector" value="${esc(org.sector || "")}"></div>
        <div class="field"><label>Effectif</label><input name="size" value="${esc(org.size || "")}"></div>
        <div class="field"><label>Ville</label><input name="city" value="${esc(org.city || "")}"></div>
        <div class="field"><label>RSSI</label><select name="rssi_user_id" data-num>${options(users.filter((u) => u.active).map((u) => [u.id, u.name]), org.rssi_user_id)}</select></div>
        <div class="full"><button class="btn primary" id="saveOrg">Enregistrer</button></div></div></div></div>
      <div class="card"><div class="card-h"><h3>Agent Windows</h3></div><div class="card-b">
        <p class="small" style="margin-top:0">Le jeton authentifie les rapports envoyés par les agents. Renouvelez-le s’il a été divulgué : les postes devront réinstaller l’agent.</p>
        <pre class="cmd">${esc(org.agent_token)}</pre>
        <button class="btn danger" id="rotate">${icon("refresh")}Renouveler le jeton</button></div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Référentiels suivis</h3><span class="muted small">les mesures sont communes : activer un référentiel ne crée pas de travail en double</span></div>
      <div class="card-b"><div class="list" id="fws">${fws.map((f) => `<div><div class="grow"><b>${esc(f.name)}</b><div class="small muted">${esc(f.description)}</div></div>
        <label class="check"><input type="checkbox" data-fw="${f.code}" ${f.enabled ? "checked" : ""}> Activé</label></div>`).join("")}</div></div></div>
    <div class="grid g21" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>${icon("mail")} Alertes par e-mail</h3><span class="pill ${mail.configured ? "ok" : ""}">${mail.configured ? "Configurées" : "Non configurées"}</span></div><div class="card-b">
        <div class="form cols" id="mail">
          <div class="field"><label>Serveur SMTP</label><input name="host" value="${esc(mail.host)}" placeholder="smtp.office365.com"></div>
          <div class="field"><label>Port</label><input name="port" type="number" value="${esc(mail.port)}"></div>
          <div class="field"><label>Utilisateur</label><input name="user" value="${esc(mail.user)}" autocomplete="off"></div>
          <div class="field"><label>Mot de passe</label><input name="pass" type="password" autocomplete="new-password" placeholder="${mail.has_password ? "•••••••• (laisser vide pour conserver)" : ""}"></div>
          <div class="field"><label>Adresse d’expédition</label><input name="from" value="${esc(mail.from)}" placeholder="amane@entreprise.ma"></div>
          <div class="field"><label>Adresse d’Amane (liens des e-mails)</label><input name="base_url" value="${esc(mail.base_url)}" placeholder="https://amane.entreprise.ma"></div>
          ${chk("secure", "Connexion TLS directe (port 465)", "Sinon STARTTLS est utilisé automatiquement si le serveur le propose (port 587).")}
          ${chk("alert_tests", "Prévenir les administrateurs dès qu’un test passe en échec")}
          ${chk("weekly_reminders", "Relancer chaque lundi les collaborateurs ayant des actions en attente", "Politiques à accepter, formation à renouveler, agent à installer.")}
          ${chk("dgssi_reminders", "Rappeler les déclarations d’incidents à la DGSSI (à déclarer, puis en retard)")}
          <div class="full" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="saveMail">Enregistrer</button><button class="btn" id="testMail">Envoyer un e-mail de test</button>
            <button class="btn" id="remind">Envoyer les relances maintenant</button></div></div>
        <p class="small muted" style="margin-bottom:0">Le mot de passe est chiffré (AES-256-GCM) et n’est jamais renvoyé au navigateur.</p></div></div>
      <div class="card"><div class="card-h"><h3>${icon("siren")} Incidents</h3></div><div class="card-b">
        <div class="field"><label>Délai interne de déclaration à la DGSSI (heures)</label><input id="hours" type="number" min="1" max="720" value="${inc.dgssi_hours}">
          <span class="hint">La loi 05-20 impose une déclaration sans délai. Fixez un délai conforme à votre statut et aux exigences de la DGSSI ; il sert aux échéances, aux tests et aux rappels.</span></div>
        <button class="btn primary" id="saveHours" style="margin-top:10px">Enregistrer</button>
        <h4 style="margin:22px 0 8px">Derniers e-mails</h4>
        <div class="list" style="max-height:260px;overflow:auto">${mail.log.map((n) => `<div><div class="grow small"><b>${esc(n.subject)}</b><div class="muted">${esc(n.recipient)} · ${datetime(n.at)}${n.error ? ` · ${esc(n.error)}` : ""}</div></div>
          <span class="pill ${n.status === "envoye" ? "ok" : "bad"}">${n.status === "envoye" ? "Envoyé" : "Erreur"}</span></div>`).join("") || '<div class="muted small">Aucun e-mail envoyé.</div>'}</div></div></div>
    </div>
    <div class="card" style="margin-top:16px" id="integrity">${integrityCard(integrity)}</div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Journal d’activité</h3><span class="muted small">300 derniers événements · chaînés et en ajout seul</span>
        <a class="btn sm" style="margin-left:auto" href="/api/reports/journal.csv">${icon("download")}Exporter tout le journal (CSV)</a></div>
      <div class="table-wrap" style="max-height:480px;overflow:auto"><table class="t"><thead><tr><th>N°</th><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Empreinte</th></tr></thead><tbody>
      ${log.map((a) => `<tr><td class="code">${a.id}</td><td class="small" style="white-space:nowrap">${datetime(a.at)}</td><td class="small">${esc(a.name || "Système")}</td><td>${esc(a.action)}</td><td class="small muted">${esc([a.entity, a.entity_id].filter(Boolean).join(" #"))}</td><td class="code" title="${esc(a.hash || "")}">${esc((a.hash || "").slice(0, 12))}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  document.getElementById("integrity").onclick = async (e) => {
    if (!e.target.closest("#verify")) return;
    try { const r = await api("/api/audit/verify"); document.getElementById("integrity").innerHTML = integrityCard(r); toast(r.ok ? "Journal intègre" : "Altération détectée", !r.ok); } catch (err) { fail(err); }
  };
  document.getElementById("saveOrg").onclick = async () => {
    try { await api("/api/org", { method: "PATCH", body: readForm(document.getElementById("org")) }); toast("Organisme enregistré"); } catch (e) { fail(e); }
  };
  document.getElementById("fws").onchange = async (e) => {
    const b = e.target.closest("[data-fw]");
    if (!b) return;
    try { await api(`/api/frameworks/${b.dataset.fw}`, { method: "PATCH", body: { enabled: b.checked } }); toast(b.checked ? "Référentiel activé" : "Référentiel désactivé"); } catch (err) { fail(err); }
  };
  const mailBody = () => { const b = readForm(document.getElementById("mail")); if (!b.pass) delete b.pass; return b; };
  document.getElementById("saveMail").onclick = async () => {
    try { await api("/api/settings/mail", { method: "PUT", body: mailBody() }); toast("Alertes enregistrées"); ctx.refresh(); } catch (e) { fail(e); }
  };
  document.getElementById("testMail").onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    try { await api("/api/settings/mail", { method: "PUT", body: mailBody() }); const r = await api("/api/settings/mail/test", { method: "POST" }); toast(`E-mail envoyé à ${r.to}`); } catch (e) { fail(e); }
    ctx.refresh();
  };
  document.getElementById("remind").onclick = async () => {
    try { const r = await api("/api/settings/mail/reminders", { method: "POST" }); toast(`${r.sent} relance(s) envoyée(s)`); setTimeout(ctx.refresh, 1500); } catch (e) { fail(e); }
  };
  document.getElementById("saveHours").onclick = async () => {
    try { await api("/api/settings/incidents", { method: "PUT", body: { dgssi_hours: Number(document.getElementById("hours").value) } }); toast("Délai enregistré"); } catch (e) { fail(e); }
  };
  document.getElementById("rotate").onclick = async () => {
    if (!(await confirmBox("Renouveler le jeton ?", "Les agents déjà installés cesseront de remonter des résultats jusqu’à leur réinstallation.", "Renouveler", true))) return;
    try { await api("/api/org/rotate-token", { method: "POST" }); toast("Jeton renouvelé"); ctx.refresh(); } catch (e) { fail(e); }
  };
}

// Result of the chain verification: entries, head fingerprint, anchors.
function integrityCard(v) {
  return `<div class="card-h"><h3>${icon("shield")} Intégrité du journal d’activité</h3>
      <span class="pill ${v.ok ? "ok" : "bad"}">${v.ok ? "Intègre" : "Altération détectée"}</span>
      <button class="btn sm" id="verify" style="margin-left:auto">${icon("refresh")}Vérifier maintenant</button></div>
    <div class="card-b">
      ${v.ok ? "" : `<p style="margin-top:0;color:var(--bad)"><b>Entrée n° ${v.broken.id} :</b> ${esc(v.broken.reason)}.</p>`}
      <div class="grid g4">
        <div><div class="small muted">Entrées vérifiées</div><b style="font-size:18px">${v.entries}</b></div>
        <div><div class="small muted">Dernière entrée</div><b style="font-size:18px">n° ${v.head?.id ?? "—"}</b></div>
        <div><div class="small muted">Ancrages quotidiens</div><b style="font-size:18px">${v.anchors}</b>${v.last_anchor ? `<div class="small muted">dernier le ${datetime(v.last_anchor.at)}${v.last_anchor.sent_to ? " · envoyé par e-mail" : ""}</div>` : ""}</div>
        <div><div class="small muted">Vérifié</div><b style="font-size:14px">${datetime(v.checked_at)}</b></div>
      </div>
      ${v.head ? `<div class="small muted" style="margin-top:14px">Empreinte actuelle de la chaîne (HMAC-SHA256)</div><pre class="cmd" style="margin:4px 0 0">${esc(v.head.hash)}</pre>` : ""}
      <p class="small muted" style="margin-bottom:0">Chaque entrée est scellée avec l’empreinte de la précédente et une clé secrète du serveur : une modification, une suppression ou un réordonnancement rompt la chaîne. La base refuse toute modification du journal, et l’empreinte du jour est conservée (et envoyée aux administrateurs si les alertes e-mail sont configurées).</p>
    </div>`;
}
