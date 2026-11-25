import { requireAdmin } from './_admin-auth.js';
import { readLeadStats } from './_lead-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  if (!requireAdmin(req, res)) return res.status(401).json({ ok: false, error: 'ADMIN_AUTH_REQUIRED' });

  const limit = Number(req.query?.limit || 20);
  const days = Number(req.query?.days || 14);

  try {
    const stats = await readLeadStats({ limit, days });
    if (!stats.ok) {
      return res.status(503).json({ ok: false, error: stats.reason || 'LEAD_STORE_UNAVAILABLE' });
    }
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Lead stats error:', error);
    return res.status(500).json({ ok: false, error: 'LEAD_STATS_FAILED' });
  }
}
