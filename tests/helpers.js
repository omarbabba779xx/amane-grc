// Test harness: a fresh Amane (empty temporary data folder) on a random port, an HTTP client that keeps
// its session cookie, and a seeded organisation with one user per role.
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PASSWORD = "Mot-de-passe-test-2026";

// Environment must be set before the server modules are loaded (they read it once).
async function startAmane(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "amane-test-"));
  Object.assign(process.env, { AMANE_DATA: dir, AMANE_SECRET: "cle-de-test-uniquement", ...env });
  const app = require("../server/index");
  const { db } = require("../server/db");
  const server = await new Promise((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const stop = async () => {
    server.closeAllConnections();
    await new Promise((ok) => server.close(ok));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { base, dir, stop };
}

function client(base) {
  let cookie = "";
  async function call(method, p, body, headers = {}) {
    const r = await fetch(base + p, {
      method, redirect: "manual",
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });
    const set = r.headers.get("set-cookie");
    if (set?.startsWith("amane_session=")) cookie = set.split(";")[0];
    const type = r.headers.get("content-type") || "";
    const data = type.includes("json") ? await r.json() : await r.text();
    return { status: r.status, data, headers: r.headers };
  }
  return {
    call,
    get: (p) => call("GET", p),
    post: (p, b = {}, h) => call("POST", p, b, h),
    put: (p, b) => call("PUT", p, b),
    patch: (p, b) => call("PATCH", p, b),
    del: (p) => call("DELETE", p),
    login: (email, password = PASSWORD) => call("POST", "/api/login", { email, password }),
  };
}

// Organisation + administrator (setup screen), then a collaborator and an auditor created by the admin.
async function seed(base) {
  const admin = client(base);
  const s = await admin.post("/api/setup", { orgName: "Test Conseil SARL", sector: "Services et conseil", city: "Rabat", name: "Admin Test", email: "admin@test.ma", password: PASSWORD });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  const make = async (email, name, role) => {
    const u = await admin.post("/api/users", { email, name, role, department: "Conseil" });
    assert.equal(u.status, 200, JSON.stringify(u.data));
    const c = client(base);
    assert.equal((await c.login(email, u.data.temporary_password)).status, 200);
    c.id = u.data.id;
    return c;
  };
  return { admin, member: await make("membre@test.ma", "Membre Test", "membre"), auditor: await make("audit@test.ma", "Auditeur Test", "auditeur") };
}

const testStatus = async (c, code) => (await c.get("/api/tests")).data.find((t) => t.code === code);
const localNow = (msAgo = 0) => new Date(Date.now() - msAgo - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

module.exports = { startAmane, client, seed, testStatus, localNow, wait, PASSWORD };
