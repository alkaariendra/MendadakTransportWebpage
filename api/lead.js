const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER || "6289697301342";

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
    .replace(/klik tombol kirim pesanan ke admin.*$/i, "")
    .replace(/website akan mengirim notifikasi ke admin otomatis.*$/i, "")
    .replace(/ketersediaan dan harga final.*$/i, "")
    .replace(/perlu dikonfirmasi admin.*$/i, "")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickSummary(messages) {
  const assistantSummary = [...messages].reverse().find((message) => (
    message.role === "assistant"
    && !/^halo, saya asisten/i.test(message.content)
    && !/pesanan sudah dikirim/i.test(message.content)
    && /(ringkasan|catatan|nama|hp|nomor|wa|brio|lepas kunci|durasi|jam|pengantaran|pengambilan|alamat|ambil|paket)/i.test(message.content)
  ));

  if (assistantSummary) {
    return cleanSummary(assistantSummary.content).slice(0, 900);
  }

  const userSummary = messages
    .filter((message) => message.role === "user")
    .slice(-5)
    .map((message) => cleanSummary(message.content))
    .filter(Boolean)
    .join("\n");

  return (userSummary || "Pesanan baru dari AI assistant.").slice(0, 900);
}

function buildLeadText(messages, pageUrl) {
  const summary = pickSummary(messages);

  return [
    "ORDER BARU WEBSITE",
    `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA`,
    pageUrl ? `Sumber: ${pageUrl}` : "",
    "",
    "Paket:",
    "Mobil: New Honda Brio lepas kunci",
    "Harga: Rp350.000 / 24 jam",
    "Mulai: Besok jam 09:00",
    "Durasi: 24 jam",
    "",
    "Ringkasan:",
    summary
  ].filter(Boolean).join("\n");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const messages = normalizeMessages(body.messages);

    if (!messages.length) {
      return sendJson(res, 400, { error: "Ringkasan pesanan masih kosong." });
    }

    const leadText = buildLeadText(messages, body.pageUrl);
    const fallbackUrl = createWhatsAppUrl(ADMIN_WHATSAPP_NUMBER, leadText);

    if (!process.env.LEAD_WEBHOOK_URL) {
      return sendJson(res, 200, {
        ok: false,
        fallback: true,
        fallbackUrl,
        message: "Notifikasi otomatis belum aktif. Membuka WhatsApp admin sebagai fallback."
      });
    }

    const response = await fetch(process.env.LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lead-secret": process.env.LEAD_WEBHOOK_SECRET || ""
      },
      body: JSON.stringify({
        source: "mendadaktransport.com",
        createdAt: new Date().toISOString(),
        pageUrl: body.pageUrl || "",
        leadText,
        messages
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, 502, {
        ok: false,
        fallback: true,
        fallbackUrl,
        message: data?.error || "Notifikasi otomatis gagal. Membuka WhatsApp admin sebagai fallback."
      });
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Pesanan sudah dikirim ke admin WhatsApp."
    });
  } catch (error) {
    console.error("Lead API error:", error);
    return sendJson(res, 500, {
      error: "Terjadi kendala saat mengirim pesanan."
    });
  }
};
