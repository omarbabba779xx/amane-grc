// Passwords (scrypt), sessions (random token in an HttpOnly cookie) and role checks.
const crypto = require("crypto");
const { get, run, now } = require("./db");

const COOKIE = "amane_session";
const DAYS = 7;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const [, saltHex, hashHex] = stored.split("$");
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}
const strongEnough = (p) => typeof p === "string" && p.length >= 12;

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, new Date(Date.now() + DAYS * 864e5).toISOString());
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: false, maxAge: DAYS * 864e5, path: "/" });
}
function destroySession(req, res) {
  const token = readCookie(req);
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  res.clearCookie(COOKIE, { path: "/" });
}
function readCookie(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// Attaches req.user when the session is valid.
function loadUser(req, _res, next) {
  const token = readCookie(req);
  if (token) {
    const s = get(`SELECT u.id, u.email, u.name, u.role, u.title, u.department FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`, token, now());
    if (s) req.user = s;
  }
  next();
}
const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Connexion requise" }));
// admin: everything · membre: own tasks (policies, profile) · auditeur: read-only on the whole programme
const requireRole = (...roles) => (req, res, next) =>
  !req.user ? res.status(401).json({ error: "Connexion requise" }) : roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Action non autorisée pour votre rôle" });

module.exports = { hashPassword, verifyPassword, strongEnough, createSession, destroySession, loadUser, requireUser, requireRole };
