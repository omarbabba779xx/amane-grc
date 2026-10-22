// Amane GRC web app: hash router, layout, command palette and authentication screens.
import { $, api, esc, icon, initials, fail, formData, theme } from "./lib.js";

const ROUTES = [
  // [pattern, module, nav key, roles]
  [/^\/$/, "dashboard", "dashboard", ["admin", "auditeur"]],
  [/^\/referentiels(?:\/([\w-]+))?$/, "frameworks", "frameworks", ["admin", "auditeur"]],
  [/^\/mesures(?:\/(\d+))?$/, "controls", "controls", ["admin", "auditeur"]],
  [/^\/tests$/, "tests", "tests", ["admin", "auditeur"]],
  [/^\/revues-acces(?:\/(\d+))?$/, "access-reviews", "access", ["admin", "auditeur", "membre"]],
  [/^\/politiques(?:\/(\d+))?$/, "policies", "policies", ["admin", "auditeur", "membre"]],
  [/^\/risques$/, "risks", "risks", ["admin", "auditeur"]],
  [/^\/ebios(?:\/(\d))?$/, "ebios", "ebios", ["admin", "auditeur"]],
  [/^\/incidents$/, "incidents", "incidents", ["admin", "auditeur"]],
  [/^\/trust-center$/, "trust-center", "trust", ["admin", "auditeur"]],
  [/^\/fournisseurs$/, "vendors", "vendors", ["admin", "auditeur"]],
  [/^\/traitements$/, "processing", "processing", ["admin", "auditeur"]],
  [/^\/personnes$/, "people", "people", ["admin", "auditeur"]],
  [/^\/appareils$/, "devices", "devices", ["admin", "auditeur"]],
  [/^\/integrations$/, "integrations", "integrations", ["admin", "auditeur"]],
  [/^\/rapports$/, "reports", "reports", ["admin", "auditeur"]],
  [/^\/parametres$/, "settings", "settings", ["admin"]],
  [/^\/mon-espace$/, "me", "me", ["admin", "auditeur", "membre"]],
];
const NAV = [
  [null, [["dashboard", "#/", "Vue d’ensemble", "dashboard"], ["me", "#/mon-espace", "Mon espace", "home"]]],
  ["Conformité", [["frameworks", "#/referentiels", "Référentiels", "shield"], ["controls", "#/mesures", "Mesures", "list"], ["tests", "#/tests", "Tests automatisés", "pulse"], ["access", "#/revues-acces", "Revue des accès", "key"], ["policies", "#/politiques", "Politiques", "doc"]]],
  ["Risques et tiers", [["risks", "#/risques", "Risques", "risk"], ["ebios", "#/ebios", "Analyse EBIOS RM", "target"], ["incidents", "#/incidents", "Incidents", "siren"], ["vendors", "#/fournisseurs", "Fournisseurs", "vendor"]]],
  ["Données personnelles", [["processing", "#/traitements", "Registre 09-08", "data"]]],
  ["Organisation", [["people", "#/personnes", "Personnes", "people"], ["devices", "#/appareils", "Appareils", "laptop"], ["integrations", "#/integrations", "Intégrations", "cloud"], ["trust", "#/trust-center", "Trust Center", "globe"]]],
  [null, [["reports", "#/rapports", "Rapports", "report"], ["settings", "#/parametres", "Paramètres", "settings"]]],
];
const ROLE = { admin: "Administrateur", membre: "Collaborateur", auditeur: "Auditeur" };
export const state = { user: null, org: null, failing: 0 };
const root = $("#root");
const LOGO = `<div class="logo"><svg viewBox="0 0 24 24"><path d="M12 3.5l7 2.8v5.5c0 4.3-3 7.9-7 9.2-4-1.3-7-4.9-7-9.2V6.3z"/><path d="M9.2 12.2l2 2 3.8-4"/></svg></div>`;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
theme();

async function boot() {
  const s = await api("/api/status");
  state.user = s.user; state.org = s.org;
  if (!s.setup) return setupScreen();
  if (!s.user) return loginScreen();
  addEventListener("hashchange", route);
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette(); }
  });
  route();
}

const allowedKeys = () => new Set(ROUTES.filter((r) => r[3].includes(state.user.role)).map((r) => r[2]));
function where(key) {
  for (const [g, items] of NAV) for (const it of items) if (it[0] === key) return [g, it[2]];
  return [null, ""];
}

function shell(active) {
  const allowed = allowedKeys();
  const nav = NAV.map(([g, items]) => {
    const vis = items.filter(([k]) => allowed.has(k));
    if (!vis.length) return "";
    return `${g ? `<div class="grp">${g}</div>` : '<div style="height:8px"></div>'}${vis.map(([k, href, label, ic]) =>
      `<a href="${href}" class="${k === active ? "on" : ""}">${icon(ic)}<span>${label}</span>${k === "tests" && state.failing ? `<span class="count">${state.failing}</span>` : ""}</a>`).join("")}`;
  }).join("");
  const [group, label] = where(active);
  root.innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand">${LOGO}<div><b>Amane</b><span>${esc(state.org?.name || "")}</span></div></div>
      <button class="jump" id="jump">${icon("search")}<span>Rechercher…</span><kbd>${isMac ? "⌘" : "Ctrl"} K</kbd></button>
      <nav class="nav">${nav}</nav>
      <div class="me"><div class="avatar">${esc(initials(state.user.name))}</div><div class="who"><b>${esc(state.user.name)}</b><span>${ROLE[state.user.role]}</span></div>
        <button id="logout" title="Se déconnecter">${icon("logout")}</button></div>
    </aside>
    <div class="mainwrap">
      <header class="topbar"><div class="crumbs">${group ? `<span>${group}</span><span class="sep">/</span>` : ""}<b>${esc(label)}</b></div>
        <div class="right"><span class="live" title="Les tests sont recalculés à chaque changement et toutes les 15 minutes"><i></i>Surveillance continue</span>
          <button class="iconbtn" id="theme" title="Thème clair ou sombre">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button></div></header>
      <main id="main"></main></div></div>`;
  $("#logout").onclick = async () => { await api("/api/logout", { method: "POST" }); location.hash = "#/"; location.reload(); };
  $("#jump").onclick = () => palette();
  $("#theme").onclick = (e) => { const t = theme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); e.currentTarget.innerHTML = icon(t === "dark" ? "sun" : "moon"); };
  return $("#main");
}

async function route() {
  const path = location.hash.replace(/^#/, "") || "/";
  if (path === "/connexion") return loginScreen();
  let match = null;
  for (const r of ROUTES) { const m = path.match(r[0]); if (m) { match = [r, m]; break; } }
  if (!match || !match[0][3].includes(state.user.role)) { location.hash = state.user.role === "membre" ? "#/mon-espace" : "#/"; return; }
  const [[, mod, key], m] = match;
  document.querySelectorAll(".drawer, .scrim, .modal, .palette, .palette-scrim").forEach((el) => el.remove()); // panels belong to the page being left
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

/* ---------- command palette: pages, measures, policies, risks, incidents, frameworks */
let index = null;
async function loadIndex() {
  const allowed = allowedKeys(), staff = state.user.role !== "membre";
  const pages = NAV.flatMap(([g, items]) => items.filter(([k]) => allowed.has(k)).map(([, href, label, ic]) => ({ group: "Pages", label, sub: g || "", href, ic })));
  const safe = (p) => p.catch(() => []);
  const none = Promise.resolve([]);
  const [controls, policies, risks, incidents, frameworks, vendors] = await Promise.all([
    staff ? safe(api("/api/controls")) : none, safe(api("/api/policies")), staff ? safe(api("/api/risks")) : none, staff ? safe(api("/api/incidents")) : none,
    staff ? safe(api("/api/frameworks")) : none, staff ? safe(api("/api/vendors")) : none]);
  return [...pages,
    ...frameworks.map((f) => ({ group: "Référentiels", label: f.name, code: f.short, href: `#/referentiels/${f.code}`, ic: "shield" })),
    ...controls.map((c) => ({ group: "Mesures", label: c.title, code: c.code, sub: c.domain, href: `#/mesures/${c.id}`, ic: "list" })),
    ...policies.map((p) => ({ group: "Politiques", label: p.title, href: `#/politiques/${p.id}`, ic: "doc" })),
    ...risks.map((r) => ({ group: "Risques", label: r.title, code: `${r.likelihood * r.impact}`, href: "#/risques", ic: "risk" })),
    ...incidents.map((i) => ({ group: "Incidents", label: i.title, href: "#/incidents", ic: "siren" })),
    ...vendors.map((v) => ({ group: "Fournisseurs", label: v.name, sub: v.service, href: "#/fournisseurs", ic: "vendor" }))];
}
const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function palette() {
  if (document.querySelector(".palette")) return;
  const scrim = document.createElement("div"), el = document.createElement("div");
  scrim.className = "palette-scrim"; el.className = "palette";
  el.innerHTML = `<input placeholder="Aller à une page, une mesure, une politique, un risque…" autocomplete="off" spellcheck="false"><div class="res"><div class="gl">Chargement…</div></div>
    <div class="ft"><span><span class="kbd">↑</span> <span class="kbd">↓</span> naviguer</span><span><span class="kbd">↵</span> ouvrir</span><span><span class="kbd">Échap</span> fermer</span></div>`;
  document.body.append(scrim, el);
  const input = el.querySelector("input"), res = el.querySelector(".res");
  const close = () => { scrim.remove(); el.remove(); removeEventListener("keydown", onKey, true); };
  let shown = [], sel = 0;
  const draw = () => {
    const terms = norm(input.value).trim().split(/\s+/).filter(Boolean);
    const all = index || [];
    shown = (terms.length ? all.filter((it) => { const h = norm(`${it.code || ""} ${it.label} ${it.sub || ""} ${it.group}`); return terms.every((t) => h.includes(t)); })
      : all.filter((it) => it.group === "Pages")).slice(0, 60);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    let last = "";
    res.innerHTML = shown.map((it, i) => {
      const g = it.group !== last ? `<div class="gl">${it.group}</div>` : "";
      last = it.group;
      return `${g}<div class="it ${i === sel ? "on" : ""}" data-i="${i}">${icon(it.ic)}${it.code ? `<span class="c">${esc(it.code)}</span>` : ""}<span class="t2">${esc(it.label)}</span>${it.sub ? `<span class="muted small">${esc(it.sub)}</span>` : ""}</div>`;
    }).join("") || '<div class="empty" style="padding:28px">Aucun résultat</div>';
    res.querySelector(".it.on")?.scrollIntoView({ block: "nearest" });
  };
  const go = (i) => { const it = shown[i]; if (!it) return; close(); location.hash = it.href; };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); go(sel); }
  };
  addEventListener("keydown", onKey, true);
  scrim.onclick = close;
  res.onclick = (e) => { const it = e.target.closest("[data-i]"); if (it) go(Number(it.dataset.i)); };
  res.onmousemove = (e) => { const it = e.target.closest("[data-i]"); if (it && Number(it.dataset.i) !== sel) { sel = Number(it.dataset.i); draw(); } };
  input.oninput = () => { sel = 0; draw(); };
  input.focus();
  index ||= await loadIndex();
  draw();
}

/* ---------- authentication screens */
function authFrame(title, sub, form) {
  root.innerHTML = `<div class="auth">
    <div class="pane"><div class="box"><div class="brand">${LOGO}<div><b>Amane GRC</b><span>Conformité continue</span></div></div>
      <h2>${title}</h2><p class="sub">${sub}</p>${form}</div></div>
    <div class="art"><div class="small" style="opacity:.6;font-family:var(--mono)">amane · <bdi dir="rtl" style="font-family:var(--font)">أمان</bdi> · sécurité, confiance</div>
      <div><h3>Un seul programme de sécurité, <em>vérifié en continu</em>, pour toutes vos obligations.</h3>
        <ul><li><span>ISO 27001</span>SMSI, 93 mesures de l’Annexe A et déclaration d’applicabilité</li>
          <li><span>Loi 09-08</span>Registre des traitements, formalités CNDP, droits des personnes</li>
          <li><span>DNSSI · 05-20</span>Exigences DGSSI et déclaration des incidents</li>
          <li><span>EBIOS RM</span>Analyse de risques en cinq ateliers</li>
          <li><span>Tests</span>Agent Windows et Microsoft 365, recalculés toutes les 15 minutes</li></ul></div>
      <div class="foot">Hébergé chez vous. Aucune donnée n’est envoyée à un tiers.</div></div></div>`;
}

function loginScreen() {
  authFrame("Connexion", "Accédez à votre programme de conformité.", `
    <form class="form" id="f"><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="username" required autofocus></div>
    <div class="field"><label>Mot de passe</label><input name="password" type="password" autocomplete="current-password" required></div>
    <div class="err" id="err"></div><button class="btn primary">Se connecter</button></form>`);
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/login", { method: "POST", body: formData(e.target) }); location.hash = "#/"; location.reload(); }
    catch (err) { $("#err").textContent = err.message; }
  };
}

function setupScreen() {
  authFrame("Créer votre espace", "L’organisme et le compte de l’administrateur (RSSI). Les référentiels, 66 mesures et 12 modèles de politiques sont chargés automatiquement.", `
    <form class="form cols" id="f">
      <div class="field full"><label>Nom de l’organisme</label><input name="orgName" required autofocus placeholder="Ex. Atlas Conseil SARL"></div>
      <div class="field"><label>Secteur</label><select name="sector"><option>Services et conseil</option><option>Banque, assurance, finance</option><option>Santé</option><option>Industrie</option><option>Commerce et distribution</option><option>Technologies de l’information</option><option>Administration publique</option><option>Éducation</option><option>Autre</option></select></div>
      <div class="field"><label>Effectif</label><select name="size"><option>1 à 10</option><option selected>11 à 50</option><option>51 à 250</option><option>Plus de 250</option></select></div>
      <div class="field"><label>Ville</label><input name="city" placeholder="Casablanca"></div>
      <div class="field"><label>Votre nom</label><input name="name" required></div>
      <div class="field full"><label>Votre e-mail professionnel</label><input name="email" type="email" required autocomplete="username"></div>
      <div class="field full"><label>Mot de passe</label><input name="password" type="password" required minlength="12" autocomplete="new-password"><span class="hint">12 caractères minimum.</span></div>
      <div class="err full" id="err"></div>
      <button class="btn primary full">Créer mon espace de conformité</button>
    </form>`);
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/setup", { method: "POST", body: formData(e.target) }); location.hash = "#/"; location.reload(); }
    catch (err) { $("#err").textContent = err.message; }
  };
}

boot().catch(fail);
