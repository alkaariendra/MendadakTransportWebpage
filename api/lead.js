import { checkPublicRequest } from './_request-guard.js';
import { buildLeadRecord, storeLead } from './_lead-store.js';

const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER || "6285923601619";
const TELEGRAM_API_URL = "https://api.telegram.org";
const ATTRIBUTION_FIELDS = [
  ['campaign_source', ['source', 'campaign_source'], ['google', 'instagram', 'facebook', 'whatsapp', 'google_business']],
  ['campaign_medium', ['medium', 'campaign_medium'], ['cpc', 'organic', 'social', 'referral', 'email']],
  ['campaign_name', ['campaign', 'campaign_name'], ['lombok-rental', 'bandara-lombok', 'mataram', 'lepas-kunci-lombok']],
  ['campaign_content', ['content', 'campaign_content'], ['bio', 'profile', 'post', 'reel', 'story', 'highlight', 'dm', 'comment', 'ad']]
];

export function normalizeAttribution(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const normalized = {};
  ATTRIBUTION_FIELDS.forEach(([field, keys, allowed]) => {
    const values = keys.filter((key) => Object.prototype.hasOwnProperty.call(input, key)).map((key) => input[key]);
    if (values.length === 1 && typeof values[0] === 'string' && allowed.includes(values[0])) normalized[field] = values[0];
  });
  return normalized;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function createWhatsAppUrl(number, message) {
  return `https://wa.me/${String(number).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function cleanText(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_]{2,}/g, "")
    .trim();
}

function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: cleanText(message.content).slice(0, 1400)
    }))
    .filter((message) => message.content.length > 0);
}

function cleanSummary(text) {
  return cleanText(text)
    .replace(/^ringkasan pesanan:\s*/i, "")
    .replace(/klik tombol kirim pesanan ke admin.*$/i, "")
    .replace(/website akan mengirim notifikasi ke admin otomatis.*$/i, "")
    .replace(/ketersediaan dan harga final.*$/i, "")
    .replace(/perlu dikonfirmasi admin.*$/i, "")
    .replace(/agar admin bisa cek,?\s*mohon kirim.*$/i, "")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickUserText(messages) {
  return messages
    .filter((message) => message.role === "user")
    .slice(-5)
    .map((message) => cleanSummary(message.content))
    .filter(Boolean)
    .join("\n")
    .slice(0, 900);
}

function pickSummary(messages) {
  const assistantSummary = [...messages].reverse().find((message) => (
    message.role === "assistant"
    && !/^halo, saya asisten/i.test(message.content)
    && !/pesanan sudah dikirim/i.test(message.content)
    && /(ringkasan|catatan|nama|hp|nomor|wa|whatsapp|armada|mobil|motor|tour|paket|bandara|driver|lepas kunci|durasi|tanggal|jam|jemput|antar|pengantaran|pengambilan|alamat|lokasi|peserta|rute|tujuan)/i.test(message.content)
  ));

  if (assistantSummary) {
    return cleanSummary(assistantSummary.content).slice(0, 900);
  }

  const userSummary = pickUserText(messages);

  return (userSummary || "Pesanan baru dari AI assistant.").slice(0, 900);
}

function buildLeadText(messages, pageUrl, leadId = '', attribution = {}) {
  const summary = pickSummary(messages);
  const userText = pickUserText(messages);
  const attributionText = [
    attribution.campaign_source ? `Sumber ${attribution.campaign_source}` : '',
    attribution.campaign_medium ? `Medium ${attribution.campaign_medium}` : '',
    attribution.campaign_name ? `Kampanye ${attribution.campaign_name}` : '',
    attribution.campaign_content ? `Konten ${attribution.campaign_content}` : ''
  ].filter(Boolean).join(' · ');

  return [
    "ORDER BARU WEBSITE",
    leadId ? `Lead ID: ${leadId}` : "",
    `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA`,
    pageUrl ? `Sumber: ${pageUrl}` : "",
    attributionText ? `Atribusi: ${attributionText}` : "",
    "",
    userText ? "Pesan pelanggan:" : "",
    userText || "",
    userText ? "" : "",
    "Ringkasan:",
    summary,
    "",
    "Status follow-up: NEW",
    "Tindakan berikutnya: Balas pelanggan melalui WhatsApp",
    "",
    "Catatan katalog:",
    "Lead bisa berasal dari rental mobil, rental motor, paket tour, antar jemput bandara, atau transport acara/kantor.",
    "Harga dan ketersediaan final dikonfirmasi admin."
  ].filter(Boolean).join("\n");
}

async function sendTelegramLead(text) {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();

  if (!botToken || !chatId) {
    return {
      ok: false,
      skipped: true,
      reason: "TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum dikonfigurasi."
    };
  }

  const response = await fetch(`${TELEGRAM_API_URL}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    return {
      ok: false,
      reason: data?.description || `Telegram API error ${response.status}`
    };
  }

  return { ok: true };
}

async function sendWebhookLead(body, messages, leadText, leadId, attribution) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  const webhookSecret = String(process.env.LEAD_WEBHOOK_SECRET || "").trim();

  if (!webhookUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "LEAD_WEBHOOK_URL belum dikonfigurasi."
    };
  }

  const webhookPayload = {
    source: "mendadaktransport.com",
    createdAt: new Date().toISOString(),
    leadId,
    status: "NEW",
    followUpStatus: "NEW",
    nextAction: "REPLY_ON_WHATSAPP",
    pageUrl: body.pageUrl || "",
    leadText,
    messages
  };
  if (Object.keys(attribution).length) webhookPayload.attribution = attribution;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lead-secret": webhookSecret
    },
    body: JSON.stringify(webhookPayload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      reason: data?.error || `Lead webhook error ${response.status}`
    };
  }

  return { ok: true };
}

function normalizeChannelResult(result) {
  if (result.status === "fulfilled") {
    return result.value || { ok: false, reason: "Respons kosong." };
  }

  return {
    ok: false,
    reason: result.reason?.message || String(result.reason || "Channel notification failed.")
  };
}

export default async function handler(req, res) {
  const guard = checkPublicRequest(req, res, { scope: 'lead', limit: 12, windowMs: 60_000 });
  if (!guard.ok) return sendJson(res, 429, { error: 'Terlalu banyak permintaan. Coba lagi sebentar.', requestId: guard.requestId });
  const requestId = guard.requestId;
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed", requestId });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const messages = normalizeMessages(body.messages);

    if (!messages.length) {
      return sendJson(res, 400, { error: "Ringkasan pesanan masih kosong.", requestId });
    }

    const leadId = requestId;
    const attribution = normalizeAttribution(body.attribution);
    const leadText = buildLeadText(messages, body.pageUrl, leadId, attribution);
    const fallbackUrl = createWhatsAppUrl(ADMIN_WHATSAPP_NUMBER, leadText);

    const [telegramResult, webhookResult] = (
      await Promise.allSettled([
        sendTelegramLead(leadText),
        sendWebhookLead(body, messages, leadText, leadId, attribution)
      ])
    ).map(normalizeChannelResult);

    if (telegramResult.ok || webhookResult.ok) {
      const channels = [
        telegramResult.ok ? "telegram" : "",
        webhookResult.ok ? "whatsapp" : ""
      ].filter(Boolean);

      if (!telegramResult.ok) {
        console.error("Telegram notification failed:", telegramResult.reason);
      }

      if (!webhookResult.ok) {
        console.error("WhatsApp notification failed:", webhookResult.reason);
      }

      const stored = await storeLead(buildLeadRecord({
        leadId,
        attribution,
        pageUrl: body.pageUrl,
        summary: pickSummary(messages),
        userText: pickUserText(messages),
        channel: channels.join("+"),
        notificationStatus: "SENT"
      }));
      if (!stored.ok) {
        console.error("Lead storage skipped:", stored.reason);
      }

      return sendJson(res, 200, {
        ok: true,
        leadId,
        status: 'NEW',
        followUpStatus: 'NEW',
        nextAction: 'REPLY_ON_WHATSAPP',
        channel: channels.join("+"),
        stored: Boolean(stored.ok),
        telegramSent: Boolean(telegramResult.ok),
        whatsappSent: Boolean(webhookResult.ok),
        message: webhookResult.ok
          ? "Pesanan sudah dikirim ke WhatsApp admin."
          : "Pesanan sudah dikirim ke admin."
      });
    }

    console.error("Lead notification failed:", {
      telegram: telegramResult.reason,
      webhook: webhookResult.reason
    });

    const storedFallback = await storeLead(buildLeadRecord({
      leadId,
      attribution,
      pageUrl: body.pageUrl,
      summary: pickSummary(messages),
      userText: pickUserText(messages),
      channel: 'fallback',
      notificationStatus: "PENDING_NOTIFICATION"
    }));
    if (!storedFallback.ok) {
      console.error("Lead storage skipped:", storedFallback.reason);
    }

    return sendJson(res, 200, {
      ok: false,
      leadId,
      status: 'NEW',
      followUpStatus: 'PENDING_NOTIFICATION',
      nextAction: 'OPEN_WHATSAPP_FALLBACK',
      fallback: true,
      stored: Boolean(storedFallback.ok),
      fallbackUrl,
      message: "Notifikasi otomatis belum aktif. Membuka WhatsApp admin sebagai fallback."
    });
  } catch (error) {
    console.error("Lead API error:", error);
    return sendJson(res, 500, {
      error: "Terjadi kendala saat mengirim pesanan."
    });
  }
};
