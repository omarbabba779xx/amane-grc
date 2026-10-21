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
  ]],
  ["k.tazi@atlas-demo.test", [["mon-espace", "#/mon-espace"]]],
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
  for (const [email, pages] of SHOTS) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/#/connexion`, { waitUntil: "networkidle0" });
    await page.type("input[name=email]", email);
    await page.type("input[name=password]", password);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("form button")]);
    for (const [name, hash, opt = {}] of pages) {
      if (ONLY && !ONLY.includes(name)) continue;
      await page.goto(`${BASE}/${hash}`, { waitUntil: "networkidle0" });
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForSelector(opt.wait || ".head h1");
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log("docs/" + name + ".png");
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
