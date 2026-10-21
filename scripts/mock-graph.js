// Local stand-in for Microsoft identity platform + Graph, to test the Microsoft 365 integration without a tenant.
// Start:  node scripts/mock-graph.js            (P1/P2 tenant: registration report available)
//         MOCK_NO_REPORT=1 node scripts/mock-graph.js   (free tenant: report refused, per-user methods)
// Then run Amane with AMANE_M365_LOGIN=http://127.0.0.1:4999 AMANE_M365_GRAPH=http://127.0.0.1:4999
// and configure any GUIDs with the secret "mock-secret".
const http = require("http");

const PORT = Number(process.env.MOCK_PORT || 4999);
const NO_REPORT = !!process.env.MOCK_NO_REPORT;
const BASE = `http://127.0.0.1:${PORT}`;
const T = (s) => `#microsoft.graph.${s}AuthenticationMethod`;

// [id, upn, name, enabled, roles, methods]
const USERS = [
  ["u1", "rssi@atlas-demo.test", "Salma Idrissi", true, ["Global Administrator"], ["microsoftAuthenticator", "fido2"]],
  ["u2", "y.benali@atlas-demo.test", "Youssef Benali", true, [], ["microsoftAuthenticator"]],
  ["u3", "n.amrani@atlas-demo.test", "Nadia Amrani", true, [], ["phone"]],
  ["u4", "k.tazi@atlas-demo.test", "Karim Tazi", true, [], []],
  ["u5", "h.elfassi@atlas-demo.test", "Hind El Fassi", true, [], ["email"]],
  ["u6", "o.chraibi@atlas-demo.test", "Omar Chraibi", true, ["Exchange Administrator", "User Administrator"], []],
  ["u7", "stagiaire@atlas-demo.test", "Ancien stagiaire", false, [], []],
  ["u8", "accueil@atlas-demo.test", "Accueil (boîte partagée)", true, [], ["windowsHelloForBusiness"]],
];
const MFA = new Set(["microsoftAuthenticator", "phone", "fido2", "softwareOath", "windowsHelloForBusiness"]);

const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const graphError = (res, code, msg) => json(res, code, { error: { code: "Authorization_RequestDenied", message: msg } });

http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  const p = url.pathname;
  if (req.method === "POST" && /^\/[^/]+\/oauth2\/v2\.0\/token$/.test(p)) {
    let body = "";
    req.on("data", (c) => (body += c));
    return req.on("end", () => {
      const f = new URLSearchParams(body);
      if (f.get("client_secret") !== "mock-secret") return json(res, 401, { error: "invalid_client", error_description: "AADSTS7000215: Invalid client secret provided.\r\nTrace ID: mock" });
      json(res, 200, { token_type: "Bearer", expires_in: 3599, access_token: "mock-token" });
    });
  }
  if (req.headers.authorization !== "Bearer mock-token") return graphError(res, 401, "Access token is missing or invalid.");

  if (p === "/v1.0/users") {
    // two pages to exercise @odata.nextLink
    const page = Number(url.searchParams.get("page") || 0), size = 5;
    const value = USERS.slice(page * size, page * size + size).map(([id, upn, name, enabled]) =>
      ({ id, userPrincipalName: upn, displayName: name, mail: upn, accountEnabled: enabled, userType: "Member" }));
    if (page === 0) value.push({ id: "g1", userPrincipalName: "invite_ext#EXT#@atlas.onmicrosoft.com", displayName: "Invité", userType: "Guest", accountEnabled: true });
    return json(res, 200, { value, ...((page + 1) * size < USERS.length ? { "@odata.nextLink": `${BASE}/v1.0/users?page=${page + 1}` } : {}) });
  }
  if (p === "/v1.0/directoryRoles") {
    const roles = {};
    for (const [id, , , , rs] of USERS) for (const r of rs) (roles[r] ||= []).push({ id });
    return json(res, 200, { value: Object.entries(roles).map(([displayName, members], i) => ({ id: `r${i}`, displayName, members })) });
  }
  if (p === "/v1.0/reports/authenticationMethods/userRegistrationDetails") {
    if (NO_REPORT) return graphError(res, 403, "Tenant does not have a SKU required for this operation.");
    return json(res, 200, { value: USERS.map(([id, upn, , , , ms]) => ({ id, userPrincipalName: upn, isMfaRegistered: ms.some((m) => MFA.has(m)), methodsRegistered: ms })) });
  }
  const m = p.match(/^\/v1\.0\/users\/([^/]+)\/authentication\/methods$/);
  if (m) {
    const u = USERS.find((x) => x[0] === m[1]);
    if (!u) return graphError(res, 404, "User not found");
    return json(res, 200, { value: [{ "@odata.type": T("password") }, ...u[5].map((t) => ({ "@odata.type": T(t) }))] });
  }
  if (p === "/v1.0/policies/identitySecurityDefaultsEnforcementPolicy") return json(res, 200, { isEnabled: false });
  if (p === "/v1.0/identity/conditionalAccess/policies") {
    return json(res, 200, { value: [
      { displayName: "Exiger la MFA pour tous les utilisateurs", state: "enabled", conditions: { users: { includeUsers: ["All"], excludeUsers: ["u8"] } }, grantControls: { builtInControls: ["mfa"] } },
      { displayName: "Bloquer l'authentification héritée", state: "enabled", conditions: { users: { includeUsers: ["All"] } }, grantControls: { builtInControls: ["block"] } },
    ] });
  }
  graphError(res, 404, `Mock: ${p} non simulé`);
}).listen(PORT, "127.0.0.1", () => console.log(`Graph simulé sur ${BASE}${NO_REPORT ? " (sans rapport P1/P2)" : ""}`));
