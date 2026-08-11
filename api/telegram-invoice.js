import { Redis } from '@upstash/redis';
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const monthsList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatRupiah(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function generateContractInvoicePdf({ item, amount, invoiceNo, dueDay, monthName, year, status }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    const logoPath = path.join(process.cwd(), 'assets', 'logo-mendadak-transport.png');

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 45, 30, { width: 145 });
    } else {
      doc.font('Helvetica-Bold').fontSize(21).fillColor('#0f172a').text('MENDADAK', 45, 42, { continued: true });
      doc.fillColor('#d71920').text(' TRANSPORT');
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#d71920').text('OFFICIAL INVOICE', 350, 48, { align: 'right', width: 200 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Tagihan Sewa Kontrak - Lombok', 350, 63, { align: 'right', width: 200 });
    doc.lineWidth(1.5).strokeColor('#0f172a').moveTo(45, 105).lineTo(550, 105).stroke();
    doc.lineWidth(0.5).strokeColor('#d71920').moveTo(45, 108).lineTo(550, 108).stroke();

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('INVOICE TAGIHAN SEWA KONTRAK', 45, 132);
    doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a');
    doc.text(`Nomor Invoice: ${invoiceNo}`, 45, 164);
    doc.text(`Tanggal Invoice: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 45, 180);
    doc.text(`Penyewa / Klien: ${item.renter || 'Pelanggan'}`, 45, 214);
    doc.text(`Armada: ${item.model || 'Armada'} (${item.plate || '-'})`, 45, 230);
    doc.text(`Jatuh Tempo: Setiap tanggal ${dueDay} (${monthName} ${year})`, 45, 246);

    doc.roundedRect(45, 280, 505, 78, 6).fillAndStroke('#f8fafc', '#d71920');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text('TOTAL TAGIHAN', 65, 300);
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(`Rp ${formatRupiah(amount)}`, 65, 320);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(status === 'SUDAH_BAYAR' ? '#15803d' : '#b91c1c').text(`STATUS: ${String(status || 'BELUM_BAYAR').replace(/_/g, ' ')}`, 380, 320, { width: 145, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('REKENING RESMI PEMBAYARAN', 45, 400);
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(`Bank BCA: ${process.env.PAYMENT_BCA_ACCOUNT || '0562196852'} a.n. ${process.env.PAYMENT_BCA_NAME || 'MUHAMMAD NAUFAL ALFAREZ'}`, 45, 420);
    doc.text(`Bank Mandiri: ${process.env.PAYMENT_MANDIRI_ACCOUNT || '1610016112422'} a.n. ${process.env.PAYMENT_MANDIRI_NAME || 'MUHAMMAD NAUFAL ALFAREZ'}`, 45, 438);
    doc.text('Mohon kirim bukti pembayaran setelah melakukan transfer.', 45, 470);

    const signaturePath = path.join(process.cwd(), 'assets', 'ttd-mendadak.png');
    if (fs.existsSync(signaturePath)) {
      doc.image(signaturePath, 420, 500, { fit: [110, 55], align: 'center' });
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('MENDADAK TRANSPORT', 390, 565, { align: 'center', width: 155 });
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text('https://rekap.mendadaktransport.my.id/rekap', 45, 780);
    doc.end();
  });
}

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

        const pdfBuffer = await generateContractInvoicePdf({
          item,
          amount: due.currentMonthData.amt,
          invoiceNo: invNumber,
          dueDay: due.startDayNum,
          monthName: currentMonthName,
          year: currentYear,
          status: due.currentMonthData.st,
        });

        const tgUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('caption', `Invoice PDF tagihan kontrak untuk ${renter}\nJatuh tempo: tanggal ${due.startDayNum} ${currentMonthName} ${currentYear}\nTotal: Rp ${amtStr}`);
        form.append('document', new Blob([pdfBuffer], { type: 'application/pdf' }), `Invoice_Tagihan_Kontrak_${item.no || due.rIdx + 1}.pdf`);

        const tgResp = await fetch(tgUrl, {
          method: 'POST',
          body: form,
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
