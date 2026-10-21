// Amane GRC web app: hash router, layout and authentication screens.
import { $, api, esc, icon, initials, fail, formData } from "./lib.js";

const ROUTES = [
  // [pattern, module, nav key, roles]
  [/^\/$/, "dashboard", "dashboard", ["admin", "auditeur"]],
  [/^\/referentiels(?:\/([\w-]+))?$/, "frameworks", "frameworks", ["admin", "auditeur"]],
  [/^\/mesures(?:\/(\d+))?$/, "controls", "controls", ["admin", "auditeur"]],
  [/^\/tests$/, "tests", "tests", ["admin", "auditeur"]],
  [/^\/politiques(?:\/(\d+))?$/, "policies", "policies", ["admin", "auditeur", "membre"]],
  [/^\/risques$/, "risks", "risks", ["admin", "auditeur"]],
  [/^\/fournisseurs$/, "vendors", "vendors", ["admin", "auditeur"]],
  [/^\/traitements$/, "processing", "processing", ["admin", "auditeur"]],
  [/^\/personnes$/, "people", "people", ["admin", "auditeur"]],
  [/^\/appareils$/, "devices", "devices", ["admin", "auditeur"]],
  [/^\/rapports$/, "reports", "reports", ["admin", "auditeur"]],
  [/^\/parametres$/, "settings", "settings", ["admin"]],
  [/^\/mon-espace$/, "me", "me", ["admin", "auditeur", "membre"]],
];
const NAV = [
  [null, [["dashboard", "#/", "Tableau de bord", "dashboard"], ["me", "#/mon-espace", "Mon espace", "home"]]],
  ["Conformité", [["frameworks", "#/referentiels", "Référentiels", "shield"], ["controls", "#/mesures", "Mesures", "list"], ["tests", "#/tests", "Tests automatisés", "pulse"], ["policies", "#/politiques", "Politiques", "doc"]]],
  ["Risques et tiers", [["risks", "#/risques", "Risques", "risk"], ["vendors", "#/fournisseurs", "Fournisseurs", "vendor"]]],
  ["Données personnelles", [["processing", "#/traitements", "Registre 09-08", "data"]]],
  ["Organisation", [["people", "#/personnes", "Personnes", "people"], ["devices", "#/appareils", "Appareils", "laptop"]]],
  [null, [["reports", "#/rapports", "Rapports", "report"], ["settings", "#/parametres", "Paramètres", "settings"]]],
];
const ROLE = { admin: "Administrateur", membre: "Collaborateur", auditeur: "Auditeur" };
export const state = { user: null, org: null, failing: 0 };
const root = $("#root");
const LOGO = `<div class="logo"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v6c0 4.6-3.2 8.4-7.5 9.9C7.7 20.4 4.5 16.6 4.5 12V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg></div>`;

async function boot() {
  const s = await api("/api/status");
  state.user = s.user; state.org = s.org;
  if (!s.setup) return setupScreen();
  if (!s.user) return loginScreen();
  addEventListener("hashchange", route);
  route();
}

function shell(active) {
  const allowed = new Set(ROUTES.filter((r) => r[3].includes(state.user.role)).map((r) => r[2]));
  const nav = NAV.map(([g, items]) => {
    const vis = items.filter(([k]) => allowed.has(k));
    if (!vis.length) return "";
    return `${g ? `<div class="grp">${g}</div>` : '<div style="height:6px"></div>'}${vis.map(([k, href, label, ic]) =>
      `<a href="${href}" class="${k === active ? "on" : ""}">${icon(ic)}${label}${k === "tests" && state.failing ? `<span class="count">${state.failing}</span>` : ""}</a>`).join("")}`;
  }).join("");
  root.innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand">${LOGO}<div><b>Amane</b><span>${esc(state.org?.name || "")}</span></div></div>
      <nav class="nav">${nav}</nav>
      <div class="me"><div class="avatar">${esc(initials(state.user.name))}</div><div class="who"><b>${esc(state.user.name)}</b><span>${ROLE[state.user.role]}</span></div>
        <button id="logout" title="Se déconnecter">${icon("logout")}</button></div>
    </aside>
    <main id="main"></main></div>`;
  $("#logout").onclick = async () => { await api("/api/logout", { method: "POST" }); location.hash = "#/"; location.reload(); };
  return $("#main");
}

async function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  if (path === "/connexion") return loginScreen();
  let match = null;
  for (const r of ROUTES) { const m = path.match(r[0]); if (m) { match = [r, m]; break; } }
  if (!match || !match[0][3].includes(state.user.role)) { location.hash = state.user.role === "membre" ? "#/mon-espace" : "#/"; return; }
  const [[, mod, key], m] = match;
  document.querySelectorAll(".drawer, .scrim, .modal").forEach((el) => el.remove()); // panels belong to the page being left
  if (state.user.role !== "membre") api("/api/tests").then((t) => { const n = t.filter((x) => x.status === "echec").length; if (n !== state.failing) { state.failing = n; const c = document.querySelector('.nav a[href="#/tests"]'); if (c) shellCount(c, n); } }).catch(() => {});
  const main = shell(key);
  main.innerHTML = '<div class="muted" style="padding:40px 0">Chargement…</div>';
  try {
    const page = await import(`./pages/${mod}.js`);
    await page.render(main, { param: m[1], user: state.user, refresh: route });
  } catch (e) { main.innerHTML = `<div class="card card-b err">${esc(e.message)}</div>`; }
}
function shellCount(a, n) {
  a.querySelector(".count")?.remove();
  if (n) a.insertAdjacentHTML("beforeend", `<span class="count">${n}</span>`);
}

function authFrame(title, sub, form) {
  root.innerHTML = `<div class="auth"><div class="box"><div class="brand">${LOGO}<div><b>Amane GRC</b><span>Conformité ISO 27001 · loi 09-08 · DNSSI</span></div></div>
    <h2>${title}</h2><p class="sub">${sub}</p>${form}</div></div>`;
}

function loginScreen() {
  authFrame("Connexion", "Accédez à votre programme de conformité.", `
    <form class="form" id="f"><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="username" required autofocus></div>
    <div class="field"><label>Mot de passe</label><input name="password" type="password" autocomplete="current-password" required></div>
    <div class="err" id="err"></div><button class="btn primary" style="height:42px;justify-content:center">Se connecter</button></form>`);
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/login", { method: "POST", body: formData(e.target) }); location.hash = "#/"; location.reload(); }
    catch (err) { $("#err").textContent = err.message; }
  };
}

function setupScreen() {
  authFrame("Bienvenue dans Amane", "Configurez votre organisme et le compte de l’administrateur (RSSI). Les référentiels, 66 mesures et 12 modèles de politiques sont prêts.", `
    <form class="form cols" id="f">
      <div class="field full"><label>Nom de l’organisme</label><input name="orgName" required autofocus placeholder="Ex. Atlas Conseil SARL"></div>
      <div class="field"><label>Secteur</label><select name="sector"><option>Services et conseil</option><option>Banque, assurance, finance</option><option>Santé</option><option>Industrie</option><option>Commerce et distribution</option><option>Technologies de l’information</option><option>Administration publique</option><option>Éducation</option><option>Autre</option></select></div>
      <div class="field"><label>Effectif</label><select name="size"><option>1 à 10</option><option selected>11 à 50</option><option>51 à 250</option><option>Plus de 250</option></select></div>
      <div class="field"><label>Ville</label><input name="city" placeholder="Casablanca"></div>
      <div class="field"><label>Votre nom</label><input name="name" required></div>
      <div class="field full"><label>Votre e-mail professionnel</label><input name="email" type="email" required autocomplete="username"></div>
      <div class="field full"><label>Mot de passe</label><input name="password" type="password" required minlength="12" autocomplete="new-password"><span class="hint">12 caractères minimum.</span></div>
      <div class="err full" id="err"></div>
      <button class="btn primary full" style="height:42px;justify-content:center">Créer mon espace de conformité</button>
    </form>`);
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/setup", { method: "POST", body: formData(e.target) }); location.hash = "#/"; location.reload(); }
    catch (err) { $("#err").textContent = err.message; }
  };
}

boot().catch(fail);
