import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://peaceful-gnat-190124.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAuasAQIgcDEwNjcwN2FhYTUzMTI0MTA3YjA0ZjMwYjY3NjJkNTllMg',
});

const monthsList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const botToken = req.query.botToken || req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = req.query.chatId || req.body?.chatId || process.env.TELEGRAM_CHAT_ID;

    // Get contracts from Redis or request body
    let kontrakList = req.body?.kontrak;
    if (!kontrakList) {
      kontrakList = await redis.get('rekap:kontrak');
    }

    if (!kontrakList || !Array.isArray(kontrakList)) {
      return res.status(400).json({ ok: false, error: 'Data kontrak tidak ditemukan' });
    }

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthIdx = today.getMonth();
    const currentMonthName = monthsList[currentMonthIdx];
    const currentYear = today.getFullYear();

    let sentInvoices = [];
    let dueContracts = [];

    kontrakList.forEach((item, rIdx) => {
      const startDate = item.start_date || '2026-01-01';
      let startDayNum = 1;
      try {
        const parts = startDate.split('-');
        if (parts.length === 3) startDayNum = parseInt(parts[2]) || 1;
      } catch (e) {}

      const currentMonthData = item.months[currentMonthIdx] || { amt: 0, st: 'BELUM_BAYAR' };

      // Check if due day matches current day OR if forced via trigger
      const isDueDay = (startDayNum === currentDay) || req.query.force === 'true' || req.body?.force === true;

      if (isDueDay && currentMonthData.amt > 0) {
        dueContracts.push({
          item,
          startDayNum,
          currentMonthData,
          rIdx
        });
      }
    });

    if (dueContracts.length === 0) {
      return res.status(200).json({
        ok: true,
        message: `Tidak ada tagihan sewa yang jatuh tempo pada hari ini (Tanggal ${currentDay} ${currentMonthName} ${currentYear}).`,
        dueCount: 0
      });
    }

    // Send formatted Telegram messages if Bot Token & Chat ID are provided
    if (botToken && chatId) {
      for (const due of dueContracts) {
        const item = due.item;
        const renter = item.renter || 'Pelanggan';
        const model = item.model || 'Armada';
        const plate = item.plate || '';
        const amtStr = Number(due.currentMonthData.amt).toLocaleString('id-ID');
        const invNumber = `INV/MT-KONTRAK/${currentYear}/${(currentMonthIdx + 1).toString().padStart(2, '0')}/${item.no || (due.rIdx + 1)}`;
        const statusBadge = due.currentMonthData.st === 'SUDAH_BAYAR' ? '🟢 LUNAS' : '🔴 BELUM DIBAYAR';

        const messageText = 
`🧾 *OFFICIAL INVOICE TAGIHAN SEWA KONTRAK*
*MENDADAK TRANSPORT LOMBOK*
--------------------------------------------------------
📌 *Nomor Invoice*: \`${invNumber}\`
👤 *Penyewa / Klien*: *${renter}*
🚘 *Armada*: *${model}* (\`${plate}\`)
📅 *Jatuh Tempo*: Setiap Tanggal *${due.startDayNum}* (${currentMonthName} ${currentYear})
💰 *Total Tagihan*: *Rp ${amtStr}*
📌 *Status*: ${statusBadge}

🏦 *REKENING RESMI PEMBAYARAN:*
• *Bank BCA*: \`0562196852\` a.n. *MUHAMMAD NAUFAL ALFAREZ*
• *Bank Mandiri*: \`1610016112422\` a.n. *MUHAMMAD NAUFAL ALFAREZ*

🔗 _Cetak invoice resmi web & rekap lengkap:_
https://rekap.mendadaktransport.my.id/rekap

_Pesan otomatis sistem Mendadak Transport Workspace_`;

        const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const tgResp = await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown'
          })
        });

        const tgResult = await tgResp.json();
        sentInvoices.push({
          renter,
          model,
          plate,
          amt: due.currentMonthData.amt,
          success: tgResult.ok
        });
      }
    }

    return res.status(200).json({
      ok: true,
      dueCount: dueContracts.length,
      sentCount: sentInvoices.length,
      dueContracts: dueContracts.map(d => ({ renter: d.item.renter, model: d.item.model, plate: d.item.plate, amt: d.currentMonthData.amt })),
      sentInvoices
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
