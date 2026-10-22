// Minimal SMTP server for the tests: accepts AUTH PLAIN and keeps every message in memory.
const net = require("net");

function decodeSubject(raw) {
  return raw.replace(/=\?UTF-8\?Q\?(.*?)\?=\s*/gi, (_, q) => Buffer.from(q.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"))
    .replace(/=\?UTF-8\?B\?(.*?)\?=\s*/gi, (_, b) => Buffer.from(b, "base64").toString("utf8"));
}

function smtpSink() {
  const mails = [];
  const server = net.createServer((s) => {
    let data = false, buf = "", msg = { to: [] }, body = "";
    const say = (l) => s.write(l + "\r\n");
    say("220 sink ESMTP");
    s.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) {
          if (line === ".") {
            data = false;
            const subject = (body.match(/^Subject: (.*(?:\r\n[ \t].*)*)/m) || [])[1] || "";
            mails.push({ from: msg.from, to: msg.to.map((t) => t.replace(/[<>]/g, "")), subject: decodeSubject(subject.replace(/\r\n[ \t]/g, " ")), body });
            msg = { to: [] }; body = ""; say("250 OK");
          } else body += line + "\r\n";
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO")) s.write("250-sink\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (cmd.startsWith("AUTH PLAIN")) say("235 OK");
        else if (cmd.startsWith("MAIL FROM")) { msg.from = line.slice(10); say("250 OK"); }
        else if (cmd.startsWith("RCPT TO")) { msg.to.push(line.slice(8)); say("250 OK"); }
        else if (cmd === "DATA") { data = true; say("354 go"); }
        else if (cmd === "QUIT") { say("221 bye"); s.end(); }
        else say("250 OK");
      }
    });
    s.on("error", () => {});
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ port: server.address().port, mails, close: () => new Promise((r) => server.close(r)) })));
}

module.exports = { smtpSink };
