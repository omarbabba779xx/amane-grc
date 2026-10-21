// Shared list + side-panel form for the registers (risks, vendors, processing activities).
import { api, esc, icon, drawer, toast, fail, options, confirmBox, empty } from "../lib.js";

// fields: [{ name, label, type: text|textarea|select|date|number|check, options, full, hint, required }]
export function fieldHtml(f, value) {
  const v = value ?? f.default ?? "";
  const req = f.required ? "required" : "";
  let input;
  if (f.type === "textarea") input = `<textarea name="${f.name}" ${req} placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
  else if (f.type === "select") input = `<select name="${f.name}" ${f.num ? "data-num" : ""}>${f.blank ? '<option value="">—</option>' : ""}${options(f.options, v)}</select>`;
  else if (f.type === "check") return `<div class="field ${f.full ? "full" : ""}"><label class="check"><input type="checkbox" name="${f.name}" ${Number(v) ? "checked" : ""}> ${esc(f.label)}</label>${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}</div>`;
  else input = `<input type="${f.type || "text"}" name="${f.name}" value="${esc(v)}" ${req} placeholder="${esc(f.placeholder || "")}" ${f.type === "number" ? `min="${f.min ?? ""}" max="${f.max ?? ""}"` : ""}>`;
  return `<div class="field ${f.full ? "full" : ""}"><label>${esc(f.label)}</label>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}</div>`;
}

export function readForm(el) {
  const out = {};
  for (const f of el.querySelectorAll("[name]")) {
    if (f.type === "checkbox") out[f.name] = f.checked ? 1 : 0;
    else if (f.type === "number" || f.dataset.num !== undefined) out[f.name] = f.value === "" ? null : Number(f.value);
    else out[f.name] = f.value.trim() || null;
  }
  return out;
}

export async function registerPage(main, ctx, cfg) {
  const rows = await api(`/api/${cfg.table}`);
  const admin = ctx.user.role === "admin";
  let q = "";
  main.innerHTML = `<div class="head"><div><h1>${cfg.title}</h1><p>${cfg.subtitle}</p></div>
      <div class="actions">${cfg.csv ? `<a class="btn" href="/api/reports/${cfg.csv}.csv">${icon("download")}Exporter (CSV)</a>` : ""}${admin ? `<button class="btn primary" id="add">${icon("plus")}${cfg.addLabel}</button>` : ""}</div></div>
    ${cfg.top ? cfg.top(rows) : ""}
    <div class="toolbar"><input class="search" id="q" placeholder="Rechercher…"><span class="muted small">${rows.length} élément${rows.length > 1 ? "s" : ""}</span></div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr>${cfg.columns.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody id="rows"></tbody></table></div></div>`;
  const draw = () => {
    const list = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
    main.querySelector("#rows").innerHTML = list.map((r) => `<tr class="click" data-id="${r.id}">${cfg.columns.map((c) => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("")
      || `<tr><td colspan="${cfg.columns.length}">${empty(cfg.icon, cfg.emptyTitle, cfg.emptyText, admin ? `<button class="btn primary" data-add>${icon("plus")}${cfg.addLabel}</button>` : "")}</td></tr>`;
  };
  draw();
  main.querySelector("#q").oninput = (e) => { q = e.target.value.toLowerCase(); draw(); };
  const open = (row) => openForm(row, cfg, ctx, admin);
  main.querySelector("#add")?.addEventListener("click", () => open(null));
  main.querySelector("#rows").onclick = (e) => {
    if (e.target.closest("[data-add]")) return open(null);
    const tr = e.target.closest("tr[data-id]");
    if (tr) open(rows.find((r) => r.id === Number(tr.dataset.id)));
  };
}

async function openForm(row, cfg, ctx, admin) {
  const extra = cfg.extra ? await cfg.extra(row) : "";
  const body = `<div class="form cols" id="frm">${cfg.fields.map((f) => fieldHtml(f, row?.[f.name])).join("")}</div>${extra}<div class="err" id="err" style="margin-top:10px"></div>`;
  const d = drawer(row ? esc(row[cfg.nameField]) : cfg.addLabel, row && cfg.sub ? cfg.sub(row) : "", body,
    admin ? `${row ? `<button class="btn danger" id="del" style="margin-right:auto">${icon("trash")}Supprimer</button>` : ""}<button class="btn" data-x>Annuler</button><button class="btn primary" id="save">Enregistrer</button>` : "");
  if (!admin) { d.el.querySelectorAll("input, select, textarea").forEach((x) => (x.disabled = true)); return; }
  d.el.querySelector("[data-x]").onclick = d.close;
  cfg.wire?.(d.el, row);
  d.el.querySelector("#save").onclick = async () => {
    const data = { ...readForm(d.el.querySelector("#frm")), ...(cfg.collect ? cfg.collect(d.el) : {}) };
    try {
      await api(`/api/${cfg.table}${row ? `/${row.id}` : ""}`, { method: row ? "PATCH" : "POST", body: data });
      toast("Enregistré"); d.close(); ctx.refresh();
    } catch (e) { d.el.querySelector("#err").textContent = e.message; }
  };
  d.el.querySelector("#del")?.addEventListener("click", async () => {
    if (!(await confirmBox("Supprimer", `Supprimer « ${esc(row[cfg.nameField])} » du registre ?`, "Supprimer", true))) return;
    try { await api(`/api/${cfg.table}/${row.id}`, { method: "DELETE" }); toast("Supprimé"); d.close(); ctx.refresh(); } catch (e) { fail(e); }
  });
}
