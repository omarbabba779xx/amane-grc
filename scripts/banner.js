// README banner and GitHub social preview (1280 x 640), rendered with the local Chrome from the app's own
// design: ink background, terracotta accent, Geist type, and the real dashboard screenshot.
//   node scripts/banner.js   ->  docs/banner.png
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.join(__dirname, "..");
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"].find(fs.existsSync);
const data = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString("base64")}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; font-weight: 100 900; src: url(${data("web/fonts/geist-latin-wght-normal.woff2", "font/woff2")}) format("woff2"); }
@font-face { font-family: GeistX; font-weight: 100 900; src: url(${data("web/fonts/geist-latin-ext-wght-normal.woff2", "font/woff2")}) format("woff2"); }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; src: url(${data("web/fonts/geist-mono-latin-wght-normal.woff2", "font/woff2")}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body { width: 1280px; height: 640px; background: #141413; color: #f1f0eb; font-family: Geist, GeistX, sans-serif; overflow: hidden; position: relative; -webkit-font-smoothing: antialiased; }
.grid { position: absolute; inset: 0; opacity: .06; background-image: linear-gradient(45deg, #fff 1px, transparent 1px), linear-gradient(-45deg, #fff 1px, transparent 1px); background-size: 30px 30px; }
.glow { position: absolute; width: 760px; height: 760px; right: -210px; top: -60px; background: radial-gradient(closest-side, rgba(224, 122, 77, .22), transparent); }
.left { position: absolute; left: 72px; top: 64px; bottom: 60px; width: 560px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { width: 52px; height: 52px; border-radius: 13px; background: #f1f0eb; display: grid; place-items: center; position: relative; }
.logo svg { width: 30px; height: 30px; fill: none; stroke: #141413; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.logo::after { content: ""; position: absolute; right: -4px; bottom: -4px; width: 15px; height: 15px; border-radius: 50%; background: #e07a4d; border: 3px solid #141413; }
.name { font-size: 30px; font-weight: 650; letter-spacing: -.02em; }
.ar { font-family: "Segoe UI", "Arial", sans-serif; font-size: 22px; color: #9b9a92; margin-left: 4px; }
h1 { font-size: 52px; line-height: 1.04; letter-spacing: -.045em; font-weight: 640; margin-top: 46px; }
h1 em { font-style: normal; color: #ec9168; }
p { font-size: 19px; line-height: 1.5; color: #b5b4ac; margin-top: 20px; max-width: 520px; }
.chips { margin-top: auto; display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font: 500 14px "Geist Mono", monospace; color: #d9d8d1; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.04); border-radius: 7px; padding: 6px 10px; }
.chip b { color: #ec9168; font-weight: 600; }
.shot { position: absolute; left: 690px; top: 92px; width: 860px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 40px 90px rgba(0,0,0,.55), 0 0 0 8px rgba(255,255,255,.035); transform: perspective(1800px) rotateY(-9deg) rotateX(3deg); transform-origin: left center; }
.shot img { display: block; width: 100%; }
.bar { height: 30px; background: #232321; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
.bar i { width: 10px; height: 10px; border-radius: 50%; background: #3a3936; }
.bar span { margin-left: 14px; font: 500 12px "Geist Mono", monospace; color: #8e8d86; }
.fade { position: absolute; left: 640px; right: 0; bottom: 0; height: 230px; background: linear-gradient(to bottom, rgba(20,20,19,0), #141413 85%); }
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<div class="left">
  <div class="brand"><div class="logo"><svg viewBox="0 0 24 24"><path d="M12 3.5l7 2.8v5.5c0 4.3-3 7.9-7 9.2-4-1.3-7-4.9-7-9.2V6.3z"/><path d="M9.2 12.2l2 2 3.8-4"/></svg></div>
    <div class="name">Amane GRC <span class="ar">أمان</span></div></div>
  <h1>La conformité <em>vérifiée en continu</em> pour les entreprises marocaines.</h1>
  <p>Un seul programme de sécurité : mesures unifiées, tests automatiques sur les postes et Microsoft 365, EBIOS RM, incidents DGSSI et Trust Center.</p>
  <div class="chips"><span class="chip"><b>ISO</b> 27001:2022</span><span class="chip"><b>Loi</b> 09-08 · CNDP</span><span class="chip"><b>DNSSI</b> · 05-20</span>
    <span class="chip"><b>NIST</b> CSF 2.0</span><span class="chip"><b>COBIT</b> 2019</span><span class="chip"><b>EBIOS</b> RM</span></div>
</div>
<div class="shot"><div class="bar"><i></i><i></i><i></i><span>amane · vue d’ensemble</span></div><img src="${data("docs/dashboard-sombre.png", "image/png")}"></div>
<div class="fade"></div>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1280, height: 640, deviceScaleFactor: 2 } });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, "docs", "banner.png") });
  await browser.close();
  console.log("docs/banner.png");
})().catch((e) => { console.error(e); process.exit(1); });
