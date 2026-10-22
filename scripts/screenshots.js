// README screenshots of the demo instance, taken with the locally installed Chrome.
//   1. npm run demo, then start the demo server (port 4871)
//   2. node scripts/screenshots.js        -> docs/*.png
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE = process.env.AMANE_URL || "http://localhost:4871";
const OUT = path.join(__dirname, "..", "docs");
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const creds = fs.readFileSync(path.join(__dirname, "..", "demo-data", "IDENTIFIANTS-DEMO.txt"), "utf8");
const password = creds.match(/\(tous les comptes\) : (\S+)/)[1];
const ONLY = process.env.AMANE_SHOTS?.split(","); // e.g. AMANE_SHOTS=tests,integrations
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ["rssi@atlas-demo.test", [
    ["dashboard", "#/"],
    ["referentiel", "#/referentiels/ISO27001"],
    ["mesure", "#/mesures/37", { wait: ".drawer" }],
    ["tests", "#/tests"],
    ["politique", "#/politiques/6"],
    ["risques", "#/risques"],
    ["registre-0908", "#/traitements"],
    ["appareils", "#/appareils"],
    ["personnes", "#/personnes"],
    ["integrations", "#/integrations"],
    ["incidents", "#/incidents"],
    ["ebios-atelier1", "#/ebios/1"],
    ["ebios-traitement", "#/ebios/5"],
    ["trust-center-admin", "#/trust-center"],
    ["revue-acces", "#/revues-acces/2"],
    ["integrite-journal", "#/parametres", { element: "#integrity" }],
    ["palette", "#/", { palette: "chiffrement" }],
    ["dashboard-sombre", "#/", { theme: "dark" }],
    ["ebios-sombre", "#/ebios/5", { theme: "dark" }],
  ]],
  [null, [["trust-center", "/trust", { wait: ".tc-hero" }], ["connexion", "/#/connexion", { wait: ".auth" }]]],
  ["k.tazi@atlas-demo.test", [["mon-espace", "#/mon-espace"]]],
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--lang=fr-FR"], defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
  for (const [email, pages] of SHOTS) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    if (email) { // the public Trust Center needs no account
      await page.goto(`${BASE}/#/connexion`, { waitUntil: "networkidle0" });
      await page.type("input[name=email]", email);
      await page.type("input[name=password]", password);
      await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("form button")]);
    }
    for (const [name, hash, opt = {}] of pages) {
      if (ONLY && !ONLY.includes(name)) continue;
      await page.goto(`${BASE}${hash.startsWith("/") ? "" : "/"}${hash}`, { waitUntil: "networkidle0" });
      await page.evaluate((t) => localStorage.setItem("amane-theme", t), opt.theme || "light");
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForSelector(opt.wait || ".head h1");
      if (opt.palette) { // command palette open on a search
        await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control");
        await page.waitForSelector(".palette .it");
        await page.type(".palette input", opt.palette);
      }
      await page.evaluate(() => document.querySelectorAll("pre.cmd").forEach((el) => { el.textContent = el.textContent.replace(/token=[\w-]+/g, "token=••••••").replace(/^[\w-]{30,40}$/, "••••••••••••"); })); // never publish an agent token (log fingerprints are 64 hex characters and stay)
      await new Promise((r) => setTimeout(r, 600));
      if (opt.element) await (await page.$(opt.element)).screenshot({ path: path.join(OUT, `${name}.png`) }); // one card only
      else await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log("docs/" + name + ".png");
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
