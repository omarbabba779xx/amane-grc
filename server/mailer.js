// E-mail alerts: failing tests (to admins), weekly reminders (to each collaborator), DGSSI declaration deadlines.
// SMTP settings live in the "mail" setting; the password is encrypted at rest.
const nodemailer = require("nodemailer");
const { all, get, run, now, setting, saveSetting } = require("./db");
const { encrypt, decrypt } = require("./secrets");

const DEFAULTS = { host: "", port: 587, secure: 0, user: "", pass: null, from: "", base_url: "", alert_tests: 1, weekly_reminders: 1, dgssi_reminders: 1 };
const config = () => setting("mail", DEFAULTS);
const configured = (c = config()) => !!(c.host && c.from);

function view() {
  const { pass, ...c } = config();
  return { ...c, has_password: !!pass, configured: configured(c) };
}

function save(input) {
  const prev = config();
  const c = { ...prev };
  for (const k of ["host", "user", "from", "base_url"]) if (input[k] !== undefined) c[k] = String(input[k] || "").trim();
  for (const k of ["secure", "alert_tests", "weekly_reminders", "dgssi_reminders"]) if (input[k] !== undefined) c[k] = input[k] ? 1 : 0;
  if (input.port !== undefined) c.port = Number(input.port) || 587;
  if (input.pass) c.pass = encrypt(String(input.pass));
  if (input.clear_password) c.pass = null;
  if (c.host && !/^[\w.-]+$/.test(c.host)) throw new Error("Serveur SMTP invalide.");
  if (c.from && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.from.replace(/^.*<|>$/g, ""))) throw new Error("Adresse d'expédition invalide.");
  if (c.base_url && !/^https?:\/\/[^\s]+$/.test(c.base_url)) throw new Error("L'adresse d'Amane doit commencer par http:// ou https://");
  c.base_url = c.base_url.replace(/\/+$/, "");
  saveSetting("mail", c);
}

function transport(c) {
  return nodemailer.createTransport({
    host: c.host, port: c.port, secure: !!c.secure, name: "amane-grc",
    auth: c.user ? { user: c.user, pass: c.pass ? decrypt(c.pass) : "" } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  });
}

// Sends one e-mail and records the outcome in the notification log.
async function send(to, subject, text, kind) {
  const c = config();
  if (!configured(c)) throw new Error("Le serveur d'envoi n'est pas configuré.");
  subject = subject.split(/\s+/).join(" ").slice(0, 200); // no line break can reach the header
  const org = get("SELECT name FROM org WHERE id = 1")?.name || "Amane GRC";
  try {
    await transport(c).sendMail({ from: c.from.includes("<") ? c.from : `"Amane GRC · ${org.replace(/"/g, "")}" <${c.from}>`, to, subject, text });
    run("INSERT INTO notifications (at, recipient, subject, kind, status) VALUES (?, ?, ?, ?, 'envoye')", now(), to, subject, kind);
  } catch (e) {
    run("INSERT INTO notifications (at, recipient, subject, kind, status, error) VALUES (?, ?, ?, ?, 'erreur', ?)", now(), to, subject, kind, String(e.message).slice(0, 300));
    throw e;
  }
}
const quiet = (p) => p.catch(() => {}); // failures are already in the log

const link = (path) => { const b = config().base_url; return b ? `\n\n${b}/${path}` : ""; };
const admins = () => all("SELECT email, name FROM users WHERE role = 'admin' AND active = 1");

// Tests that have just failed: one message per administrator.
function testsFailed(list) {
  const c = config();
  if (!configured(c) || !c.alert_tests) return;
  const lines = list.map((t) => {
    const d = t.details || {};
    const who = d.failing?.length ? ` : ${d.failing.slice(0, 5).map((f) => f.name).join(", ")}${d.failing.length > 5 ? "…" : ""}` : d.message ? ` : ${d.message}` : "";
    return `• ${t.title}${who}`;
  });
  const subject = list.length === 1 ? `Test en échec : ${list[0].title}` : `${list.length} tests passés en échec`;
  for (const a of admins()) quiet(send(a.email, subject, `Bonjour ${a.name},\n\nAmane a détecté ${list.length === 1 ? "un test qui vient" : "des tests qui viennent"} de passer en échec :\n\n${lines.join("\n")}\n\nLes corrections sont indiquées sur la page Tests automatisés.${link("#/tests")}`, "test"));
}

// Weekly to-do for each collaborator: policies to accept, training, agent.
function weeklyReminders() {
  const pols = all("SELECT id, title, version FROM policies WHERE status = 'publiee'");
  let sent = 0;
  for (const u of all("SELECT id, email, name, training_at FROM users WHERE active = 1 AND role != 'auditeur'")) {
    const todo = [];
    const missing = pols.filter((p) => !get("SELECT 1 FROM policy_acceptances WHERE policy_id = ? AND version = ? AND user_id = ?", p.id, p.version, u.id));
    if (missing.length) todo.push(`• Lire et accepter ${missing.length} politique(s) : ${missing.map((p) => p.title).join(", ")}`);
    if (!u.training_at || Date.now() - new Date(u.training_at) > 365 * 864e5) todo.push("• Suivre la formation de sensibilisation à la sécurité (à faire ou à renouveler)");
    const dev = get("SELECT MAX(last_seen) AS seen FROM devices WHERE user_id = ?", u.id);
    if (!dev?.seen || Date.now() - new Date(dev.seen) > 7 * 864e5) todo.push("• Installer l'agent Amane sur votre ordinateur (commande dans Mon espace)");
    if (!todo.length) continue;
    quiet(send(u.email, "Vos actions de sécurité de la semaine", `Bonjour ${u.name},\n\nIl vous reste ${todo.length} action(s) pour le programme de sécurité :\n\n${todo.join("\n")}\n\nTout se fait depuis Mon espace, en quelques minutes.${link("#/mon-espace")}`, "relance"));
    sent++;
  }
  return sent;
}

// DGSSI deadline: a reminder when an incident needs declaring, then once more when it is late.
function dgssiReminders(state) {
  const hours = setting("incidents", { dgssi_hours: 24 }).dgssi_hours;
  state.dgssi ||= {};
  for (const i of all("SELECT id, title, detected_at FROM incidents WHERE dgssi_required = 1 AND dgssi_notified_at IS NULL")) {
    const deadline = new Date(new Date(i.detected_at).getTime() + hours * 3600e3);
    const stage = Date.now() > deadline ? "retard" : "a_declarer";
    if ((state.dgssi[i.id] || []).includes(stage)) continue;
    state.dgssi[i.id] = [...(state.dgssi[i.id] || []), stage];
    const when = deadline.toLocaleString("fr-MA", { dateStyle: "long", timeStyle: "short" });
    const subject = stage === "retard" ? `Déclaration DGSSI en retard : ${i.title}` : `Incident à déclarer à la DGSSI : ${i.title}`;
    for (const a of admins()) quiet(send(a.email, subject, `Bonjour ${a.name},\n\nL'incident « ${i.title} » doit être déclaré à la DGSSI (maCERT). Échéance interne : ${when}${stage === "retard" ? " (dépassée)" : ""}.\n\nLa fiche de déclaration pré-remplie est disponible sur la fiche de l'incident.${link("#/incidents")}`, "dgssi"));
  }
}

// Hourly scheduler: DGSSI reminders, and the weekly reminder on Monday morning.
function tick() {
  const c = config();
  if (!configured(c)) return;
  const state = setting("mail_state", {});
  if (c.dgssi_reminders) dgssiReminders(state);
  const d = new Date();
  if (c.weekly_reminders && d.getDay() === 1 && d.getHours() >= 9 && (!state.weekly || Date.now() - new Date(state.weekly) > 6 * 864e5)) {
    state.weekly = now();
    weeklyReminders();
  }
  saveSetting("mail_state", state);
}

const log = () => all("SELECT * FROM notifications ORDER BY id DESC LIMIT 50");

module.exports = { view, save, send, testsFailed, weeklyReminders, tick, log, configured };
