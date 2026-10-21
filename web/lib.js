// Shared helpers: API client, HTML escaping, icons, formatting, drawer/modal/toast, Markdown.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export async function api(path, { method = "GET", body, raw } = {}) {
  const opts = { method, headers: {} };
  if (raw) { opts.body = raw.body; Object.assign(opts.headers, raw.headers); }
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
  const r = await fetch(path, opts);
  const data = r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text();
  if (r.status === 401 && !path.startsWith("/api/login")) { location.hash = "#/connexion"; throw new Error("Connexion requise"); }
  if (!r.ok) throw new Error(data?.error || `Erreur ${r.status}`);
  return data;
}

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const date = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const datetime = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const today = () => new Date().toISOString().slice(0, 10);
export const initials = (n) => String(n || "?").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
export function ago(iso) {
  if (!iso) return "jamais";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 90) return "à l’instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

const P = {
  dashboard: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.6-3.2 8.4-7.5 9.9C7.7 20.4 4.5 16.6 4.5 12V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6l1 1 2-2M4.5 12l1 1 2-2M4.5 18l1 1 2-2"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" transform="translate(-1 0)"/><path d="M13 3.5v4h4M9 12h6M9 15.5h6"/>',
  risk: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  vendor: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  data: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6"/>',
  people: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16 14.6c2.7.1 4.9 1.8 5.5 4.9"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19"/>',
  report: '<path d="M5 20V10M10 20V4M15 20v-7M20 20v-11"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  home: '<path d="M4 11l8-6.5 8 6.5V20H4z"/><path d="M10 20v-5.5h4V20"/>',
  logout: '<path d="M14 4h4.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4.5 18.5h15"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18.5z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  siren: '<path d="M6.5 18v-5.5a5.5 5.5 0 0 1 11 0V18"/><path d="M4 18h16v2.5H4zM12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M4 6.5l8 6 8-6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
};
export const icon = (n) => `<svg class="i" viewBox="0 0 24 24">${P[n] || ""}</svg>`;

// Status labels and colours used across pages
export const HEALTH = {
  ok: ["En place", "ok"], attention: ["Test en échec", "bad"], en_cours: ["En cours", "info"], a_faire: ["À faire", "warn"], non_applicable: ["Non applicable", ""],
};
export const TEST = { ok: ["Réussi", "ok"], echec: ["En échec", "bad"], en_attente: ["En attente", ""], inconnu: ["Inconnu", "warn"] };
export const pill = (map, key) => { const [l, c] = map[key] || [key, ""]; return `<span class="pill ${c}">${esc(l)}</span>`; };

// Score gauge: thin track, flat stroke (no gradients), number in the middle.
export function ring(pct, label = "", size = 96, stroke = 5, color = "var(--ink)") {
  size = Math.min(size, 112); stroke = Math.min(stroke, 6);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--mute-soft)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
    <div class="lbl"><div><b style="font-size:${Math.round(size * 0.22)}px">${Math.round(pct)}<span style="display:inline;font-size:.55em;color:var(--fg-3);margin:0">%</span></b>${label ? `<span>${esc(label)}</span>` : ""}</div></div></div>`;
}

// Light / dark theme, remembered per browser
export function theme(set) {
  let t = set;
  try { if (set) localStorage.setItem("amane-theme", set); else t = localStorage.getItem("amane-theme"); } catch {}
  t ||= matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  return t;
}

export function toast(msg, bad = false) {
  const t = document.createElement("div");
  t.className = `toast ${bad ? "bad" : ""}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
export const fail = (e) => toast(e.message || String(e), true);

// Side drawer; returns { el, close }. onClose runs after closing.
export function drawer(title, sub, body, footer = "", onClose) {
  const scrim = document.createElement("div"), el = document.createElement("div");
  scrim.className = "scrim"; el.className = "drawer";
  el.innerHTML = `<div class="dh"><div><h2>${title}</h2>${sub ? `<div class="muted small" style="margin-top:3px">${sub}</div>` : ""}</div>
    <button class="btn sm x" data-close>${icon("x")}</button></div><div class="db">${body}</div>${footer ? `<div class="df">${footer}</div>` : ""}`;
  document.body.append(scrim, el);
  const close = () => { scrim.remove(); el.remove(); removeEventListener("keydown", onKey); onClose?.(); };
  const onKey = (e) => e.key === "Escape" && close();
  addEventListener("keydown", onKey);
  scrim.onclick = close;
  el.querySelector("[data-close]").onclick = close;
  return { el, close };
}
export function modal(title, body, footer) {
  const scrim = document.createElement("div"), el = document.createElement("div");
  scrim.className = "scrim"; scrim.style.zIndex = 42; el.className = "modal"; el.style.zIndex = 43;
  el.innerHTML = `<div class="mh"><h2 style="font-size:18px">${title}</h2></div><div class="mb">${body}</div><div class="mf">${footer}</div>`;
  document.body.append(scrim, el);
  const close = () => { scrim.remove(); el.remove(); };
  scrim.onclick = close;
  return { el, close };
}
export function confirmBox(title, text, okLabel = "Confirmer", danger = false) {
  return new Promise((resolve) => {
    const m = modal(title, `<p style="margin:0">${text}</p>`, `<button class="btn" data-no>Annuler</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${okLabel}</button>`);
    m.el.querySelector("[data-no]").onclick = () => { m.close(); resolve(false); };
    m.el.querySelector("[data-ok]").onclick = () => { m.close(); resolve(true); };
  });
}

// Reads the named inputs of a container into an object (checkboxes -> 0/1, number inputs -> numbers).
export function formData(el) {
  const out = {};
  for (const f of $$("[name]", el)) {
    if (f.type === "checkbox") out[f.name] = f.checked ? 1 : 0;
    else if (f.type === "number" || f.dataset.num !== undefined) out[f.name] = f.value === "" ? null : Number(f.value);
    else out[f.name] = f.value.trim();
  }
  return out;
}
export const options = (list, current) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(current ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("");

// Minimal Markdown (headings, lists, tables, bold, italics, paragraphs) for policies.
export function md(src) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/`(.+?)`/g, "<code>$1</code>");
  const lines = String(src || "").split(/\r?\n/);
  let html = "", list = null, table = [];
  const flushList = () => { if (list) { html += `</${list}>`; list = null; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((r) => !/^\|\s*-/.test(r)).map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    html += `<table><thead><tr>${rows[0].map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    table = [];
  };
  for (const l of lines) {
    if (/^\|/.test(l)) { flushList(); table.push(l.trim()); continue; }
    flushTable();
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flushList(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { flushList(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) { if (list !== "ol") { flushList(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; }
    else if (l.trim()) { flushList(); html += `<p>${inline(l)}</p>`; }
    else flushList();
  }
  flushList(); flushTable();
  return html;
}

export function empty(iconName, title, text, action = "") {
  return `<div class="empty">${icon(iconName)}<b>${title}</b><div>${text}</div>${action ? `<div style="margin-top:14px">${action}</div>` : ""}</div>`;
}
