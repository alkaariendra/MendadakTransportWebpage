import { Redis } from '@upstash/redis';
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { generateInvoicePdf as generateSharedInvoicePdf } from './invoice-template.js';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://peaceful-gnat-190124.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAuasAQIgcDEwNjcwN2FhYTUzMTI0MTA3YjA0ZjMwYjY3NjJkNTllMg',
});

const monthsList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatRupiah(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function resolveAsset(name) {
  const candidates = [
    path.join(process.cwd(), 'assets', name),
    path.join(process.cwd(), 'public', 'assets', name),
    path.join(path.dirname(process.cwd()), 'assets', name),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function generateContractInvoicePdf({ item, amount, invoiceNo, dueDay, monthName, year, status }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    const logoPath = resolveAsset('logo-mendadak-header.png');
    const signaturePath = resolveAsset('ttd-mendadak.png');
    const customer = item.renter || 'Pelanggan';
    const model = item.model || 'Armada Rental';
    const plate = item.plate || '-';
    const invoiceDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const paymentStatus = String(status || 'BELUM_BAYAR').replace(/_/g, ' ');
    const accounts = [
      { bank: 'Bank BCA', number: process.env.PAYMENT_BCA_ACCOUNT || '0562196852', name: process.env.PAYMENT_BCA_NAME || 'MUHAMMAD NAUFAL ALFAREZ' },
      { bank: 'Bank Mandiri', number: process.env.PAYMENT_MANDIRI_ACCOUNT || '1610016112422', name: process.env.PAYMENT_MANDIRI_NAME || 'MUHAMMAD NAUFAL ALFAREZ' },
    ];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 45, 25, { fit: [190, 64], align: 'left', valign: 'center' });
    } else {
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('MENDADAK', 45, 45, { continued: true });
      doc.fillColor('#d71920').text(' TRANSPORT');
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#d71920').text('OFFICIAL INVOICE', 350, 48, { align: 'right', width: 200 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text('Tour & Transport Service Lombok', 350, 63, { align: 'right', width: 200 });
    doc.lineWidth(1.5).strokeColor('#0f172a').moveTo(45, 105).lineTo(550, 105).stroke();
    doc.lineWidth(0.5).strokeColor('#d71920').moveTo(45, 108).lineTo(550, 108).stroke();

    const metaTop = 125;
    doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a');
    doc.text('Customer', 45, metaTop); doc.text(':', 110, metaTop); doc.font('Helvetica-Bold').text(customer, 120, metaTop);
    doc.font('Helvetica').text('Alamat', 45, metaTop + 16); doc.text(':', 110, metaTop + 16); doc.text(item.address || 'Lombok', 120, metaTop + 16);
    doc.text('Invoice Number  :', 340, metaTop, { align: 'right', width: 110 }); doc.font('Helvetica-Bold').text(invoiceNo, 455, metaTop);
    doc.font('Helvetica').text('Invoice Date  :', 340, metaTop + 16, { align: 'right', width: 110 }); doc.text(invoiceDate, 455, metaTop + 16);

    const tableTop = 169;
    const tableWidth = 505;
    const col = { no: { x: 45, w: 25 }, item: { x: 70, w: 145 }, date: { x: 215, w: 125 }, dur: { x: 340, w: 60 }, qty: { x: 400, w: 35 }, price: { x: 435, w: 55 }, amount: { x: 490, w: 60 } };
    const verticals = [col.item.x, col.date.x, col.dur.x, col.qty.x, col.price.x, col.amount.x];
    const headerHeight = 22;
    doc.rect(45, tableTop, tableWidth, headerHeight).fill('#f8fafc');
    doc.lineWidth(0.75).strokeColor('#0f172a').rect(45, tableTop, tableWidth, headerHeight).stroke();
    verticals.forEach((x) => doc.moveTo(x, tableTop).lineTo(x, tableTop + headerHeight).stroke());
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
    [['NO', col.no], ['ITEM', col.item], ['DATE', col.date], ['DURATION', col.dur], ['QTY', col.qty], ['PRICE', col.price], ['AMOUNT', col.amount]].forEach(([label, c]) => doc.text(label, c.x, tableTop + 7, { width: c.w, align: 'center' }));

    const rows = [{ no: 1, name: 'SEWA KONTRAK MOBIL', subname: `${model} - ${plate}`, date: `Jatuh tempo ${dueDay} ${monthName} ${year}`, duration: 1, qty: 1, price: amount, amount }];
    let currentY = tableTop + headerHeight;
    for (let index = 0; index < 10; index += 1) {
      const row = rows[index];
      const rowHeight = row ? 32 : 22;
      doc.lineWidth(0.5).strokeColor('#1e293b').rect(45, currentY, tableWidth, rowHeight).stroke();
      verticals.forEach((x) => doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke());
      if (row) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(String(row.no), col.no.x, currentY + 6, { width: col.no.w, align: 'center' });
        doc.font('Helvetica-Bold').text(row.name, col.item.x + 8, currentY + 6, { width: col.item.w - 12, height: 10, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(row.subname, col.item.x + 8, currentY + 18, { width: col.item.w - 12, height: 9, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a');
        doc.text(row.date, col.date.x + 3, currentY + 6, { width: col.date.w - 6, align: 'center', lineBreak: false, ellipsis: true });
        doc.text('1', col.dur.x, currentY + 6, { width: col.dur.w, align: 'center' });
        doc.text('1', col.qty.x, currentY + 6, { width: col.qty.w, align: 'center' });
        doc.text(formatRupiah(row.price), col.price.x, currentY + 6, { width: col.price.w - 6, align: 'right' });
        doc.text(formatRupiah(row.amount), col.amount.x, currentY + 6, { width: col.amount.w - 6, align: 'right' });
      }
      currentY += rowHeight;
    }

    [['Sub Total', formatRupiah(amount)], ['Deposite', '-'], ['Balance', '-'], ['Total', formatRupiah(amount)]].forEach(([label, value], index) => {
      const y = currentY + index * 17 + 3;
      doc.font(index === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === 3 ? 9.5 : 9).fillColor('#0f172a');
      doc.text(label, 350, y, { width: 130, align: 'right' });
      doc.text(value, col.amount.x, y, { width: col.amount.w - 6, align: 'right' });
    });
    currentY += 4 * 17 + 12;
    doc.lineWidth(1.5).strokeColor('#0f172a').moveTo(45, currentY).lineTo(550, currentY).stroke();
    doc.lineWidth(0.5).strokeColor('#d71920').moveTo(45, currentY + 3).lineTo(550, currentY + 3).stroke();

    const footerY = currentY + 25;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(`STATUS: ${paymentStatus}`, 45, footerY);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('REKENING RESMI MENDADAK TRANSPORT:', 45, footerY + 30);
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    accounts.forEach((account, index) => {
      doc.text(`- ${account.bank}: ${account.number}`, 45, footerY + 44 + index * 25);
      doc.font('Helvetica-Bold').text(`  a.n. ${account.name}`, 45, footerY + 56 + index * 25);
      doc.font('Helvetica');
    });
    const sigX = 390;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#d71920').text('MENDADAK TRANSPORT', sigX, footerY, { align: 'center', width: 155 });
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b').text('TOUR & TRANSPORT SERVICE', sigX, footerY + 12, { align: 'center', width: 155 });
    if (fs.existsSync(signaturePath)) doc.image(signaturePath, sigX + 2, footerY + 22, { fit: [151, 70], align: 'center', valign: 'center' });
    const signatureLineY = footerY + 96;
    doc.lineWidth(1).strokeColor('#0f172a').moveTo(sigX, signatureLineY).lineTo(sigX + 155, signatureLineY).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('Admin Mendadak Transport', sigX, signatureLineY + 4, { align: 'center', width: 155 });
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text('MUHAMMAD NAUFAL ALFAREZ', sigX, signatureLineY + 16, { align: 'center', width: 155 });
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

        const pdfBuffer = await generateSharedInvoicePdf({
          invoice_no: invNumber,
          customer_name: renter,
          customer_address: item.address || 'Lombok',
          customer_phone: item.phone || '-',
          car_model: model,
          service_type: 'Tagihan Sewa Kontrak',
          rental_dates: `Jatuh tempo ${due.startDayNum} ${currentMonthName} ${currentYear}`,
          duration: 1,
          price_per_day: due.currentMonthData.amt,
          payment_method: `STATUS: ${String(due.currentMonthData.st || 'BELUM_BAYAR').replace(/_/g, ' ')}`,
          items: [{
            no: 1,
            name: 'SEWA KONTRAK MOBIL',
            subname: `${model} - ${plate}`,
            date: `Jatuh tempo ${due.startDayNum} ${currentMonthName} ${currentYear}`,
            duration: 1,
            qty: 1,
            price: due.currentMonthData.amt,
            amount: due.currentMonthData.amt,
          }],
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
