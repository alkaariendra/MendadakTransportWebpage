import { generateInvoicePdf } from './invoice-template.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    if (!body.customer_name || !body.car_model || !body.rental_dates) {
      return res.status(400).json({ ok: false, error: 'customer_name, car_model, dan rental_dates wajib diisi.' });
    }

    const pdf = await generateInvoicePdf({
      ...body,
      duration: Number(body.duration || 1),
      price_per_day: Number(body.price_per_day || 0),
      deposit: Number(body.deposit || 0),
      additional_item_price: Number(body.additional_item_price || 0),
    });
    const safeCustomer = String(body.customer_name).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'customer';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${safeCustomer}_${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.status(200).send(pdf);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
