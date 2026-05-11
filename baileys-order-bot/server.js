import "dotenv/config";
import express from "express";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import Pino from "pino";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import fs from "node:fs/promises";

const PORT = Number(process.env.PORT || 4000);
const GROUP_JID = process.env.WHATSAPP_GROUP_JID || "";
const ADMIN_JID = process.env.WHATSAPP_ADMIN_JID || "";
const SECRET = process.env.LEAD_WEBHOOK_SECRET || "";
const TELEGRAM_API_URL = "https://api.telegram.org";
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || "").trim();
const QR_FILE = path.resolve("./qr.png");

let sock;
let connectionStatus = "starting";
let latestQrAt = null;

function requireSecret(req, res, next) {
  if (!SECRET) {
    return res.status(500).json({ error: "LEAD_WEBHOOK_SECRET belum diset di server bot." });
  }

  if (req.get("x-lead-secret") !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

function formatMessage(payload) {
  const leadText = String(payload?.leadText || "").trim();
  if (leadText) return leadText.slice(0, 6000);

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const summary = [...messages].reverse().find((message) => (
    message.role === "assistant"
    && !/^halo, saya asisten/i.test(String(message.content || ""))
    && !/pesanan sudah dikirim/i.test(String(message.content || ""))
  ))?.content || messages
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.content)
    .join("\n");

  return [
    "ORDER BARU WEBSITE",
    "",
    String(summary || "Tidak ada ringkasan pesanan.").slice(0, 900)
  ].join("\n").slice(0, 6000);
}

function getTargetJids() {
  return [GROUP_JID, ADMIN_JID]
    .map((jid) => String(jid || "").trim())
    .filter(Boolean)
    .filter((jid, index, all) => all.indexOf(jid) === index);
}

async function sendQrToTelegram() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const qrBytes = await fs.readFile(QR_FILE);
    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT_ID);
    form.append("caption", [
      "QR WhatsApp Mendadak Transport baru.",
      "Scan dari WhatsApp > Perangkat tertaut > Tautkan perangkat.",
      "QR cepat kedaluwarsa, scan segera."
    ].join("\n"));
    form.append("photo", new Blob([qrBytes], { type: "image/png" }), "mendadak-whatsapp-qr.png");

    const response = await fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: form
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      console.error("Gagal mengirim QR ke Telegram:", data?.description || response.status);
    } else {
      console.log("QR WhatsApp dikirim ke Telegram.");
    }
  } catch (error) {
    console.error("Gagal membaca/mengirim QR ke Telegram:", error?.message || error);
  }
}

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: Pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQrAt = new Date().toISOString();
      console.log("Scan QR ini dengan WhatsApp yang akan menjadi bot:");
      qrcode.generate(qr, { small: true });
      await QRCode.toFile("./qr.png", qr, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: "M"
      });
      console.log(`QR juga disimpan ke ${QR_FILE}`);
      await sendQrToTelegram();
    }

    if (connection === "open") {
      connectionStatus = "connected";
      latestQrAt = null;
      console.log("WhatsApp bot connected.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      connectionStatus = `disconnected:${statusCode || "unknown"}`;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("Connection closed, reconnecting...");
        await startWhatsApp();
      } else {
        console.log("Logged out. Delete auth folder and scan QR again.");
      }
    }
  });
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({
    ok: connectionStatus === "connected",
    status: connectionStatus,
    target: getTargetJids()[0] || null,
    targets: getTargetJids(),
    latestQrAt,
    qrUrl: latestQrAt ? "/qr" : null
  });
});

app.get("/qr.png", (req, res) => {
  if (!latestQrAt) {
    return res.status(404).send("QR belum tersedia atau bot sudah terkoneksi.");
  }

  res.setHeader("Cache-Control", "no-store");
  return res.sendFile(QR_FILE);
});

app.get("/qr", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Scan QR WhatsApp Bot</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#fff;font-family:Arial,sans-serif;text-align:center}
    main{padding:24px}
    img{width:min(82vw,520px);background:#fff;padding:16px;border-radius:12px}
    p{color:#ddd;font-size:18px}
  </style>
</head>
<body>
  <main>
    <h1>Scan QR WhatsApp Bot</h1>
    <img src="/qr.png?t=${Date.now()}" alt="QR WhatsApp">
    <p>Buka WhatsApp > Perangkat tertaut > Tautkan perangkat.</p>
  </main>
</body>
</html>`);
});

app.post("/send-lead", requireSecret, async (req, res) => {
  if (!sock || connectionStatus !== "connected") {
    return res.status(503).json({ error: "WhatsApp bot belum terkoneksi." });
  }

  const targetJids = getTargetJids();
  if (!targetJids.length) {
    return res.status(500).json({ error: "WHATSAPP_GROUP_JID atau WHATSAPP_ADMIN_JID belum diset." });
  }

  const text = formatMessage(req.body);
  const errors = [];

  for (const targetJid of targetJids) {
    try {
      await sock.sendMessage(targetJid, { text });
      return res.json({ ok: true, target: targetJid });
    } catch (error) {
      errors.push({ target: targetJid, error: error?.message || String(error) });
    }
  }

  return res.status(502).json({
    error: "WhatsApp gagal mengirim ke semua target.",
    details: errors
  });
});

app.get("/groups", requireSecret, async (req, res) => {
  if (!sock || connectionStatus !== "connected") {
    return res.status(503).json({ error: "WhatsApp bot belum terkoneksi." });
  }

  const groups = await sock.groupFetchAllParticipating();
  const result = Object.values(groups).map((group) => ({
    id: group.id,
    subject: group.subject
  }));

  return res.json({ groups: result });
});

app.listen(PORT, async () => {
  console.log(`Lead bot listening on port ${PORT}`);
  await startWhatsApp();
});
