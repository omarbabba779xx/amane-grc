// Front-end: every module parses, pages and assets are served, no inline script (the CSP forbids them).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startAmane } = require("./helpers");

const WEB = path.join(__dirname, "..", "web");
const modules = [...fs.readdirSync(WEB).filter((f) => f.endsWith(".js")), ...fs.readdirSync(path.join(WEB, "pages")).map((f) => `pages/${f}`)];

let app;
before(async () => { app = await startAmane(); });
after(() => app.stop());

test("chaque module JavaScript du navigateur est syntaxiquement valide", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "amane-web-"));
  try {
    for (const m of modules) {
      const copy = path.join(tmp, m.replace("/", "_") + ".mjs"); // .mjs: checked as an ES module
      fs.copyFileSync(path.join(WEB, m), copy);
      execFileSync(process.execPath, ["--check", copy], { stdio: "pipe" });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("chaque page déclarée par le routeur existe", () => {
  const routes = [...fs.readFileSync(path.join(WEB, "app.js"), "utf8").matchAll(/\[\/\^[^,]+, "([\w-]+)", "[\w-]+", \[/g)].map((m) => m[1]);
  assert.ok(routes.length >= 17);
  for (const r of routes) assert.ok(fs.existsSync(path.join(WEB, "pages", `${r}.js`)), r);
});

test("aucun script en ligne dans les pages HTML", () => {
  for (const f of ["index.html", "trust.html"]) {
    const html = fs.readFileSync(path.join(WEB, f), "utf8");
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), f);
  }
});

test("l'application, la page publique, les styles et les polices sont servis", async () => {
  for (const [p, type] of [["/", "text/html"], ["/trust", "text/html"], ["/app.js", "javascript"], ["/pages/dashboard.js", "javascript"], ["/app.css", "text/css"], ["/fonts/geist-latin-wght-normal.woff2", "font/woff2"]]) {
    const r = await fetch(app.base + p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("content-type"), new RegExp(type), p);
  }
  const deep = await fetch(app.base + "/une/route/inconnue");
  assert.equal(deep.status, 200, "les routes de l'application renvoient index.html");
  assert.equal((await fetch(app.base + "/api/inconnu")).status, 404);
});
