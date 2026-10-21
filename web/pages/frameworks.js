import { api, esc, ring, icon, pill, HEALTH, modal, toast, fail } from "../lib.js";

export async function render(main, ctx) {
  if (ctx.param) return detail(main, ctx);
  const fws = await api("/api/frameworks");
  main.innerHTML = `<div class="head"><div><h1>Référentiels</h1><p>Chaque mesure Amane couvre plusieurs exigences à la fois : avancer sur une mesure fait progresser tous les référentiels concernés.</p></div></div>
    <div class="grid g3">${fws.map((f) => `
      <a class="card" href="#/referentiels/${f.code}" style="color:inherit;text-decoration:none">
        <div class="fw-card">${ring(f.score, "prêt")}<div><h3>${esc(f.name)}</h3><p>${esc(f.description)}</p></div></div>
        <div style="display:flex;gap:18px;padding:0 18px 16px" class="small">
          <span><b>${f.requirements}</b> <span class="muted">exigences</span></span><span><b>${f.met}</b> <span class="muted">satisfaites</span></span>
          <span><b>${f.controls}</b> <span class="muted">mesures liées</span></span></div></a>`).join("")}</div>`;
}

function reqState(r) {
  if (!r.applicable) return ["Exclue", ""];
  const cs = r.controls.filter((c) => c.health !== "non_applicable");
  if (!cs.length) return ["Sans mesure", "warn"];
  const ok = cs.filter((c) => c.health === "ok").length;
  return ok === cs.length ? ["Satisfaite", "ok"] : ok || cs.some((c) => ["en_cours", "attention"].includes(c.health)) ? ["En partie", "info"] : ["À traiter", "warn"];
}

async function detail(main, ctx) {
  const f = await api(`/api/frameworks/${ctx.param}`);
  const admin = ctx.user.role === "admin";
  let filter = "toutes", q = "";
  const sections = [...new Set(f.requirements_list.map((r) => r.section))];
  main.innerHTML = `
    <div class="head"><div><div class="small"><a href="#/referentiels">Référentiels</a> › ${esc(f.short)}</div><h1>${esc(f.name)}</h1><p>${esc(f.description)}</p></div>
      <div class="actions">${f.code === "ISO27001" ? `<a class="btn" href="/api/reports/soa.csv">${icon("download")}Déclaration d’applicabilité (CSV)</a>` : ""}</div></div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat" style="display:flex;gap:14px;align-items:center">${ring(f.score, "prêt", 84, 8)}<div><div class="k">Score</div><div class="s">mesures en place</div></div></div>
      <div class="card stat"><div class="k">Exigences satisfaites</div><div class="v">${f.met}<span class="muted" style="font-size:16px"> / ${f.requirements}</span></div></div>
      <div class="card stat"><div class="k">En partie</div><div class="v">${f.partial}</div></div>
      <div class="card stat"><div class="k">Mesures en place</div><div class="v">${f.controls_ok}<span class="muted" style="font-size:16px"> / ${f.controls}</span></div></div>
    </div>
    <div class="toolbar"><input class="search" id="q" placeholder="Rechercher une exigence…">
      <div class="chips" id="chips">${["toutes", "Satisfaite", "En partie", "À traiter", "Exclue"].map((c) => `<button class="chip ${c === "toutes" ? "on" : ""}" data-f="${c}">${c === "toutes" ? "Toutes" : c}</button>`).join("")}</div></div>
    <div id="list"></div>`;

  const draw = () => {
    const rows = f.requirements_list.filter((r) => (filter === "toutes" || reqState(r)[0] === filter)
      && (!q || `${r.ref} ${r.title} ${r.description}`.toLowerCase().includes(q)));
    document.getElementById("list").innerHTML = sections.map((s) => {
      const rs = rows.filter((r) => r.section === s);
      if (!rs.length) return "";
      return `<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>${esc(s)}</h3><span class="muted small">${rs.length}</span></div>
        <div class="table-wrap"><table class="t" style="margin-top:10px"><tbody>${rs.map((r) => {
          const [l, cls] = reqState(r);
          return `<tr><td style="width:84px"><span class="code">${esc(r.ref)}</span></td>
            <td class="title"><b>${esc(r.title)}</b>${r.description ? `<div class="small muted">${esc(r.description)}</div>` : ""}
              ${!r.applicable && r.justification ? `<div class="small" style="margin-top:3px">Exclusion : ${esc(r.justification)}</div>` : ""}</td>
            <td style="width:280px">${r.controls.map((c) => `<a class="tag" href="#/mesures/${c.id}" title="${esc(c.title)} · ${HEALTH[c.health][0]}" style="${c.health === "ok" ? "background:var(--ok-soft);color:var(--ok)" : ""}">${esc(c.code)}</a>`).join("")}</td>
            <td style="width:120px">${pill({ [l]: [l, cls] }, l)}</td>
            ${admin ? `<td style="width:40px"><button class="btn sm" data-req="${r.id}" title="Applicabilité">${icon("edit")}</button></td>` : ""}</tr>`;
        }).join("")}</tbody></table></div></div>`;
    }).join("") || '<div class="card card-b muted">Aucune exigence ne correspond.</div>';
  };
  draw();
  document.getElementById("q").oninput = (e) => { q = e.target.value.toLowerCase(); draw(); };
  document.getElementById("chips").onclick = (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll("#chips .chip").forEach((x) => x.classList.toggle("on", x === b));
    draw();
  };
  document.getElementById("list").onclick = (e) => {
    const b = e.target.closest("[data-req]");
    if (!b) return;
    const r = f.requirements_list.find((x) => x.id === Number(b.dataset.req));
    const m = modal(`${esc(r.ref)} · ${esc(r.title)}`, `
      <label class="check"><input type="checkbox" id="app" ${r.applicable ? "checked" : ""}> Exigence applicable</label>
      <div class="field" style="margin-top:12px"><label>Justification (obligatoire pour exclure)</label><textarea id="just">${esc(r.justification || "")}</textarea></div>
      <div class="err" id="err"></div>`, `<button class="btn" data-c>Annuler</button><button class="btn primary" data-s>Enregistrer</button>`);
    m.el.querySelector("[data-c]").onclick = m.close;
    m.el.querySelector("[data-s]").onclick = async () => {
      const applicable = m.el.querySelector("#app").checked, justification = m.el.querySelector("#just").value.trim();
      if (!applicable && !justification) { m.el.querySelector("#err").textContent = "Indiquez pourquoi cette exigence est exclue."; return; }
      try { await api(`/api/requirements/${r.id}`, { method: "PATCH", body: { applicable, justification } }); m.close(); toast("Applicabilité enregistrée"); ctx.refresh(); }
      catch (err) { fail(err); }
    };
  };
}
