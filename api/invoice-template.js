import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const logoPath = path.join(process.cwd(), 'assets', 'logo-mendadak-header.png');
const signaturePath = path.join(process.cwd(), 'assets', 'ttd-mendadak.png');

const defaultAccounts = [
  { bank: 'Bank BCA', number: process.env.PAYMENT_BCA_ACCOUNT || '0562196852', name: process.env.PAYMENT_BCA_NAME || 'MUHAMMAD NAUFAL ALFAREZ' },
  { bank: 'Bank Mandiri', number: process.env.PAYMENT_MANDIRI_ACCOUNT || '1610016112422', name: process.env.PAYMENT_MANDIRI_NAME || 'MUHAMMAD NAUFAL ALFAREZ' },
];

function formatNum(value) {
  return Number(value || 0).toLocaleString('en-US');
}

export function generateInvoicePdf(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const now = new Date();
      const invoiceNo = data.invoice_no || `MT-${Math.floor(100 + Math.random() * 900)}/INV/${now.getMonth() + 1}/${now.getFullYear()}`;
      const invoiceDate = data.invoice_date || now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const accounts = Array.isArray(data.payment_accounts) && data.payment_accounts.length ? data.payment_accounts : defaultAccounts;
      const items = data.items?.length ? data.items.map((item, index) => ({
        no: item.no || index + 1,
        name: item.name || '',
        subname: item.subname || '',
        date: item.date || '',
        duration: item.duration || '',
        qty: item.qty || '',
        price: Number(item.price || 0),
        amount: Number(item.amount || 0),
      })) : [{
        no: 1,
        name: String(data.car_model || 'INNOVA REBORN').toUpperCase(),
        subname: data.service_type || 'Sewa Mobil LK',
        date: data.rental_dates || '',
        duration: Number(data.duration || 1),
        qty: 1,
        price: Number(data.price_per_day || 0),
        amount: Number(data.duration || 1) * Number(data.price_per_day || 0),
      }];

      if (data.additional_item_name && data.additional_item_price) {
        const qty = Number(data.additional_item_qty || 1);
        items.push({ no: items.length + 1, name: data.additional_item_name, subname: '', date: '', duration: '', qty, price: Number(data.additional_item_price), amount: qty * Number(data.additional_item_price) });
      }

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const deposit = Number(data.deposit || 0);
      const total = subtotal - deposit;

      if (fs.existsSync(logoPath)) doc.image(logoPath, 45, 25, { fit: [190, 64], align: 'left', valign: 'center' });
      else doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('MENDADAK TRANSPORT', 45, 45);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#d71920').text('OFFICIAL INVOICE', 350, 48, { align: 'right', width: 200 });
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text('Tour & Transport Service Lombok', 350, 63, { align: 'right', width: 200 });
      doc.lineWidth(1.5).strokeColor('#0f172a').moveTo(45, 105).lineTo(550, 105).stroke();
      doc.lineWidth(0.5).strokeColor('#d71920').moveTo(45, 108).lineTo(550, 108).stroke();

      const metaTop = 125;
      const customer = data.customer_name || 'Customer';
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a');
      doc.text('Customer', 45, metaTop); doc.text(':', 110, metaTop); doc.font('Helvetica-Bold').text(customer, 120, metaTop);
      doc.font('Helvetica').text('No. HP', 45, metaTop + 16); doc.text(':', 110, metaTop + 16); doc.text(data.customer_phone || '-', 120, metaTop + 16);
      doc.text('Alamat', 45, metaTop + 32); doc.text(':', 110, metaTop + 32); doc.text(data.customer_address || 'Lombok', 120, metaTop + 32);
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

      let currentY = tableTop + headerHeight;
      for (let index = 0; index < 10; index += 1) {
        const item = items[index];
        const rowHeight = item ? 32 : 22;
        doc.lineWidth(0.5).strokeColor('#1e293b').rect(45, currentY, tableWidth, rowHeight).stroke();
        verticals.forEach((x) => doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke());
        if (item) {
          doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(String(item.no), col.no.x, currentY + 6, { width: col.no.w, align: 'center' });
          doc.font('Helvetica-Bold').text(String(item.name).toUpperCase(), col.item.x + 8, currentY + 6, { width: col.item.w - 12, height: 10, lineBreak: false, ellipsis: true });
          if (item.subname) doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(String(item.subname), col.item.x + 8, currentY + 18, { width: col.item.w - 12, height: 9, lineBreak: false, ellipsis: true });
          doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a');
          doc.text(String(item.date || ''), col.date.x + 3, currentY + 6, { width: col.date.w - 6, align: 'center', lineBreak: false, ellipsis: true });
          doc.text(String(item.duration || ''), col.dur.x, currentY + 6, { width: col.dur.w, align: 'center' });
          doc.text(String(item.qty || ''), col.qty.x, currentY + 6, { width: col.qty.w, align: 'center' });
          doc.text(item.price ? formatNum(item.price) : '', col.price.x, currentY + 6, { width: col.price.w - 6, align: 'right' });
          doc.text(item.amount ? formatNum(item.amount) : '', col.amount.x, currentY + 6, { width: col.amount.w - 6, align: 'right' });
        }
        currentY += rowHeight;
      }

      [['Sub Total', formatNum(subtotal)], ['Deposite', deposit ? formatNum(deposit) : '-'], ['Balance', '-'], ['Total', formatNum(total)]].forEach(([label, value], index) => {
        const y = currentY + index * 17 + 3;
        doc.font(index === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === 3 ? 9.5 : 9).fillColor('#0f172a');
        doc.text(label, 350, y, { width: 130, align: 'right' }); doc.text(value, col.amount.x, y, { width: col.amount.w - 6, align: 'right' });
      });
      currentY += 80;
      doc.lineWidth(1.5).strokeColor('#0f172a').moveTo(45, currentY).lineTo(550, currentY).stroke();
      doc.lineWidth(0.5).strokeColor('#d71920').moveTo(45, currentY + 3).lineTo(550, currentY + 3).stroke();

      const footerY = currentY + 25;
      doc.roundedRect(45, footerY + 25, 300, 91, 5).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(String(data.payment_method || 'TRANSFER PAYMENT').toUpperCase(), 45, footerY);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('REKENING RESMI MENDADAK TRANSPORT:', 45, footerY + 30);
      doc.font('Helvetica').fontSize(8).fillColor('#334155');
      accounts.slice(0, 2).forEach((account, index) => {
        doc.text(`- ${account.bank}: ${account.number}`, 45, footerY + 44 + index * 25);
        doc.font('Helvetica-Bold').text(`  a.n. ${account.name}`, 45, footerY + 56 + index * 25); doc.font('Helvetica');
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
    } catch (error) {
      reject(error);
    }
  });
}
