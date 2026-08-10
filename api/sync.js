import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://peaceful-gnat-190124.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAuasAQIgcDEwNjcwN2FhYTUzMTI0MTA3YjA0ZjMwYjY3NjJkNTllMg',
});

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const kontrak = await redis.get('rekap:kontrak');
      const daily   = await redis.get('rekap:daily');
      const cash    = await redis.get('rekap:cash');
      const armada  = await redis.get('rekap:armada');
      return res.status(200).json({
        ok: true,
        kontrak: kontrak || null,
        daily:   daily   || null,
        cash:    cash    || null,
        armada:  armada  || null,
      });
    }

    if (req.method === 'POST') {
      const { kontrak, daily, cash, armada } = req.body || {};
      if (kontrak !== undefined) await redis.set('rekap:kontrak', kontrak);
      if (daily   !== undefined) await redis.set('rekap:daily',   daily);
      if (cash    !== undefined) await redis.set('rekap:cash',    cash);
      if (armada  !== undefined) await redis.set('rekap:armada',  armada);
      return res.status(200).json({ ok: true, saved: true, timestamp: new Date().toISOString() });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
