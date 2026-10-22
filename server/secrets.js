// Encryption of stored credentials (AES-256-GCM). The key comes from AMANE_SECRET,
// or from data/secret.key, created on first use and never leaving the server.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DATA } = require("./db");

let key = null;
function getKey() {
  if (key) return key;
  if (process.env.AMANE_SECRET) return (key = crypto.createHash("sha256").update(process.env.AMANE_SECRET).digest());
  const file = path.join(DATA, "secret.key");
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  return (key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64"));
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}
function decrypt(blob) {
  const [, iv, tag, data] = String(blob).split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

// Separate key for the activity log HMAC chain, derived from the same secret
let logKey = null;
const macKey = () => (logKey ||= crypto.createHmac("sha256", getKey()).update("amane-journal-v1").digest());

module.exports = { encrypt, decrypt, macKey };
