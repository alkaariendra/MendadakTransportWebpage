import { Redis } from '@upstash/redis';
import { redisConfigured } from './_admin-auth.js';

export const LEAD_EVENTS_KEY = 'lead:events:v1';
export const LEAD_MAX_ROWS = 1000;
export const LEAD_TTL_SECONDS = 60 * 60 * 24 * 180;
export const LEAD_SUMMARY_LIMIT = 700;

const ATTRIBUTION_FIELDS = ['campaign_source', 'campaign_medium', 'campaign_name', 'campaign_content'];

function sanitizeText(value, limit) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function safePath(pageUrl) {
  const raw = sanitizeText(pageUrl, 300);
  if (!raw) return '';
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://www.mendadaktransport.com${raw.startsWith('/') ? '' : '/'}${raw}`);
    return `${parsed.pathname}${parsed.search}`.slice(0, 200);
  } catch {
    return raw.startsWith('/') ? raw.slice(0, 200) : '';
  }
}

export function buildLeadRecord({
  leadId,
  attribution = {},
  pageUrl = '',
  summary = '',
  userText = '',
  channel = '',
  notificationStatus = 'SENT',
  createdAt = new Date().toISOString()
} = {}) {
  const record = {
    leadId: sanitizeText(leadId, 80),
    createdAt,
    day: String(createdAt).slice(0, 10),
    status: 'NEW',
    followUpStatus: 'NEW',
    notificationStatus,
    channel: sanitizeText(channel, 40),
    pagePath: safePath(pageUrl),
    summary: sanitizeText(summary, LEAD_SUMMARY_LIMIT),
    userText: sanitizeText(userText, 400),
    attribution: {}
  };

  ATTRIBUTION_FIELDS.forEach((field) => {
    const value = sanitizeText(attribution?.[field], 60).toLowerCase();
    if (/^[a-z0-9][a-z0-9_-]{0,59}$/.test(value)) record.attribution[field] = value;
  });

  return record;
}

function createDefaultRedis(env) {
  return new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
}

export async function storeLead(record, { env = process.env, createRedis = createDefaultRedis, timeoutMs = 2500 } = {}) {
  if (!record || !record.leadId) return { ok: false, reason: 'EMPTY_RECORD' };
  if (!redisConfigured(env)) return { ok: false, reason: 'REDIS_NOT_CONFIGURED' };

  const task = (async () => {
    const redis = createRedis(env);
    const pipeline = redis.pipeline();
    pipeline.lpush(LEAD_EVENTS_KEY, JSON.stringify(record));
    pipeline.ltrim(LEAD_EVENTS_KEY, 0, LEAD_MAX_ROWS - 1);
    pipeline.expire(LEAD_EVENTS_KEY, LEAD_TTL_SECONDS);
    pipeline.incr(`lead:count:v1:${record.day}`);
    pipeline.expire(`lead:count:v1:${record.day}`, LEAD_TTL_SECONDS);
    await pipeline.exec();
    return { ok: true };
  })();

  return Promise.race([
    task.catch((error) => ({ ok: false, reason: String(error?.message || error).slice(0, 120) })),
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: 'TIMEOUT' }), timeoutMs))
  ]);
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

export async function readLeadStats({ limit = 20, days = 14, env = process.env, createRedis = createDefaultRedis } = {}) {
  if (!redisConfigured(env)) return { ok: false, reason: 'REDIS_NOT_CONFIGURED', leads: [] };

  const redis = createRedis(env);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const raw = await redis.lrange(LEAD_EVENTS_KEY, 0, LEAD_MAX_ROWS - 1);
  const rows = (raw || [])
    .map((entry) => {
      if (typeof entry === 'string') {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      }
      return entry && typeof entry === 'object' ? entry : null;
    })
    .filter(Boolean);

  const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const dayKeys = dayRange(windowDays);
  const recentCutoff = dayKeys[0];
  const inWindow = rows.filter((row) => String(row.day || '') >= recentCutoff);

  return {
    ok: true,
    total: rows.length,
    windowDays,
    windowCount: inWindow.length,
    byDay: dayKeys.map((day) => ({ day, count: inWindow.filter((row) => row.day === day).length })),
    bySource: countBy(inWindow, (row) => row.attribution?.campaign_source || 'direct'),
    byMedium: countBy(inWindow, (row) => row.attribution?.campaign_medium || 'none'),
    byCampaign: countBy(inWindow, (row) => row.attribution?.campaign_name),
    byContent: countBy(inWindow, (row) => row.attribution?.campaign_content),
    byChannel: countBy(inWindow, (row) => row.channel),
    byPage: countBy(inWindow, (row) => row.pagePath),
    latestCreatedAt: rows[0]?.createdAt || null,
    leads: rows.slice(0, safeLimit)
  };
}
