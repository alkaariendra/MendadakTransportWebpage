import { createHash, timingSafeEqual } from 'node:crypto';
import { Redis } from '@upstash/redis';

const LEAD_EVENTS_KEY = 'lead:events:v1';
const LEAD_MAX_ROWS = 1000;
const LEAD_TTL_SECONDS = 60 * 60 * 24 * 180;

function sendJson(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function checkAdmin(req) {
  const token = process.env.ADMIN_ACCESS_TOKEN;
  if (typeof token !== 'string' || token.length < 32) return { ok: false, code: 503, error: 'ADMIN_AUTH_NOT_CONFIGURED' };
  const supplied = req.headers?.authorization;
  const expected = `Bearer ${token}`;
  if (typeof supplied !== 'string' || !timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest())) {
    return { ok: false, code: 401, error: 'ADMIN_AUTH_REQUIRED' };
  }
  return { ok: true };
}

function dayRange(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function countBy(rows, pick) {
  const map = new Map();
  rows.forEach((row) => {
    const key = pick(row);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  const auth = checkAdmin(req);
  if (!auth.ok) return sendJson(res, auth.code, { ok: false, error: auth.error });

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return sendJson(res, 503, { ok: false, error: 'REDIS_NOT_CONFIGURED' });

  const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);
  const days = Math.min(Math.max(Number(req.query?.days) || 14, 1), 90);

  try {
    const redis = new Redis({ url, token });
    const raw = await redis.lrange(LEAD_EVENTS_KEY, 0, LEAD_MAX_ROWS - 1);
    const rows = (raw || [])
      .map((entry) => { try { return typeof entry === 'string' ? JSON.parse(entry) : entry; } catch { return null; } })
      .filter(Boolean);

    const dayKeys = dayRange(days);
    const cutoff = dayKeys[0];
    const inWindow = rows.filter((r) => String(r.day || '') >= cutoff);

    return sendJson(res, 200, {
      ok: true,
      total: rows.length,
      windowDays: days,
      windowCount: inWindow.length,
      byDay: dayKeys.map((day) => ({ day, count: inWindow.filter((r) => r.day === day).length })),
      bySource: countBy(inWindow, (r) => r.attribution?.campaign_source || 'direct'),
      byMedium: countBy(inWindow, (r) => r.attribution?.campaign_medium || 'none'),
      byCampaign: countBy(inWindow, (r) => r.attribution?.campaign_name),
      byContent: countBy(inWindow, (r) => r.attribution?.campaign_content),
      byChannel: countBy(inWindow, (r) => r.channel),
      byPage: countBy(inWindow, (r) => r.pagePath),
      latestCreatedAt: rows[0]?.createdAt || null,
      leads: rows.slice(0, limit)
    });
  } catch (error) {
    console.error('Lead stats error:', error?.message || error);
    return sendJson(res, 500, { ok: false, error: 'LEAD_STATS_FAILED' });
  }
}