// Run only after all implementations land: node --experimental-vm-modules --test tests/security.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
async function load(name) {
  const context = vm.createContext({ process: { env: {} }, Set, Date, URL, URLSearchParams });
  const cache = new Map();
  async function moduleFor(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file });
    cache.set(file, mod);
    await mod.link(async (specifier, referencing) => {
      if (specifier === '@upstash/redis') return new vm.SyntheticModule(['Redis'], function () { this.setExport('Redis', class { constructor() { throw new Error('Real Redis forbidden'); } }); }, { context });
      if (specifier === 'node:crypto') return new vm.SyntheticModule(['createHash', 'timingSafeEqual'], function () { this.setExport('createHash', crypto.createHash); this.setExport('timingSafeEqual', crypto.timingSafeEqual); }, { context });
      return moduleFor(path.resolve(path.dirname(referencing.identifier), specifier));
    });
    return mod;
  }
  const mod = await moduleFor(path.join(root, 'api', name)); await mod.evaluate(); return mod.namespace;
}
function response() { return { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(body) { this.body=JSON.parse(JSON.stringify(body)); return this; }, end() { this.ended = true; return this; } }; }
test('public request guard emits request ID and rate limits synthetic clients', async () => {
  const { checkPublicRequest, resetPublicRequestBuckets } = await load('_request-guard.js');
  resetPublicRequestBuckets();
  const res = response();
  const first = checkPublicRequest({ headers: { 'x-forwarded-for': 'synthetic-client' } }, res, { scope: 'test', limit: 1, windowMs: 60_000 });
  assert.equal(first.ok, true);
  assert.match(res.headers['X-Request-Id'], /^mt-/);
  const second = checkPublicRequest({ headers: { 'x-forwarded-for': 'synthetic-client' } }, res, { scope: 'test', limit: 1, windowMs: 60_000 });
  assert.equal(second.ok, false);
  assert.ok(Number(res.headers['Retry-After']) >= 1);
  resetPublicRequestBuckets();
});
const env = { ADMIN_ACCESS_TOKEN: 'synthetic-admin-token-not-real-000000', UPSTASH_REDIS_REST_URL: 'https://synthetic.invalid', UPSTASH_REDIS_REST_TOKEN: 'synthetic-only' };
const auth = { authorization: `Bearer ${env.ADMIN_ACCESS_TOKEN}` };
test('unauthenticated sync denies GET/POST before constructing/accessing Redis', async () => {
  const { createSyncHandler } = await load('sync.js'); let calls=0;
  const handler=createSyncHandler({ env, createRedis: () => { calls++; throw Error('forbidden'); } });
  for (const method of ['GET','POST']) for (const headers of [{}, {authorization:'Bearer wrong'}]) {
    const res=response(); await handler({method,headers,body:{cash:[]}},res); assert.equal(res.code,401);
  }
  assert.equal(calls,0);
});
test('authorized sync writes active data and a versioned backup snapshot', async () => {
  const { createSyncHandler } = await load('sync.js'); const writes = []; const listOps = [];
  const createRedis = () => ({
    get: async key => [{ synthetic: key }],
    set: async (...args) => writes.push(args),
    lpush: async (...args) => listOps.push(['lpush', ...args]),
    ltrim: async (...args) => listOps.push(['ltrim', ...args])
  });
  const res = response();
  await createSyncHandler({ env, createRedis })({ method: 'POST', headers: auth, body: { cash: [], armada: [{ model: 'Synthetic' }] } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.backup.counts.cash, 0);
  assert.deepEqual(writes.slice(0, 2).map(([key]) => key), ['rekap:cash', 'rekap:armada']);
  assert.ok(writes.some(([key]) => key.startsWith('rekap:backup:v1:')));
  assert.deepEqual(listOps.map(([op]) => op), ['lpush', 'ltrim']);
});

test('backup endpoint requires admin and explicit restore confirmation', async () => {
  const { createBackupHandler } = await load('backups.js'); let constructed = 0;
  const handler = createBackupHandler({ env, createRedis: () => { constructed++; throw Error('forbidden'); } });
  for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
    const res = response(); await handler({ method: 'GET', headers }, res); assert.equal(res.code, 401);
  }
  assert.equal(constructed, 0);

  const snapshot = { version: 1, id: 'm1-valid-backup', createdAt: '2026-11-11T00:00:00.000Z', source: 'sync', counts: { kontrak: 1, daily: 1, cash: 1, armada: 1 }, data: { kontrak: [{}], daily: [{}], cash: [{}], armada: [{}] } };
  const writes = [];
  const createRedis = () => ({
    lrange: async () => [snapshot.id],
    get: async key => key === 'rekap:backup:v1:m1-valid-backup' ? snapshot : [{}],
    set: async (...args) => writes.push(['set', ...args]),
    lpush: async (...args) => writes.push(['lpush', ...args]),
    ltrim: async (...args) => writes.push(['ltrim', ...args])
  });
  const restoreHandler = createBackupHandler({ env, createRedis });
  let res = response(); await restoreHandler({ method: 'POST', headers: auth, body: { id: snapshot.id } }, res);
  assert.equal(res.code, 400); assert.equal(res.body.error, 'BACKUP_RESTORE_CONFIRMATION_REQUIRED');
  res = response(); await restoreHandler({ method: 'GET', headers: auth, query: { limit: 1 } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.backups.length, 1); assert.equal(res.body.backups[0].data, undefined);
  res = response(); await restoreHandler({ method: 'POST', headers: auth, body: { id: snapshot.id, confirm: 'RESTORE' } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.ok, true); assert.ok(res.body.safetyBackup.id);
  assert.ok(writes.some(([op, key]) => op === 'set' && key.startsWith('rekap:backup:v1:')));
  assert.ok(writes.some(([op, key]) => op === 'set' && key === 'rekap:cash'));
});

test('missing auth configuration blocks without Redis; authorized data shape is preserved', async () => {
  const { createSyncHandler } = await load('sync.js'); let calls=0; const writes=[];
  const createRedis=()=>{ calls++; return { get:async key=>[{synthetic:key}], set:async (...args)=>writes.push(args), lpush:async()=>{}, ltrim:async()=>{} }; };
  let res=response(); await createSyncHandler({env:{},createRedis})({method:'GET',headers:auth},res); assert.equal(res.code,503); assert.equal(calls,0);
  res=response(); const handler=createSyncHandler({env,createRedis}); await handler({method:'GET',headers:auth},res);
  assert.equal(res.code,200); assert.deepEqual(Object.keys(res.body).sort(),['armada','cash','daily','kontrak','ok']);
  res=response(); await handler({method:'POST',headers:auth,body:{cash:[],armada:[{model:'Synthetic'}]}},res); assert.equal(res.code,200); assert.deepEqual(writes.slice(0,2).map(w=>w[0]),['rekap:cash','rekap:armada']);
});
test('public endpoint reads fleet only and strictly projects model/status', async () => {
  const { createAvailabilityHandler } = await load('availability.js'); const reads=[];
  const handler=createAvailabilityHandler({env,createRedis:()=>({get:async key=>{reads.push(key);return [{model:'Synthetic',status:'READY',plate:'PRIVATE',notes:'PRIVATE',renter:'PRIVATE',cash:[1]},{model:'Synthetic2',status:'unexpected'}];}})});
  const res=response(); await handler({method:'GET'},res); assert.deepEqual(reads,['rekap:armada']);
  assert.deepEqual(res.body,{ok:true,armada:[{model:'Synthetic',status:'READY'},{model:'Synthetic2',status:'UNKNOWN'}]});
});
test('public outage, missing configuration and malformed storage never claim Ready', async () => {
  const { createAvailabilityHandler } = await load('availability.js');
  for (const options of [{env:{}},{env,createRedis:()=>({get:async()=>{throw Error('synthetic secret');}})},{env,createRedis:()=>({get:async()=>null})}]) {
    const res=response(); await createAvailabilityHandler(options)({method:'GET'},res); assert.equal(res.code,503); assert.deepEqual(res.body,{ok:false,armada:[],status:'UNKNOWN'});
  }
});
test('admin source has no embedded private defaults or bypass auth flag', () => {
  const html=fs.readFileSync(path.join(root,'rekap.html'),'utf8');
  for (const name of ['defaultMasterKontrak','defaultDailyRentals','defaultCashTransactions','defaultMasterArmada']) assert.ok(html.includes(`const ${name} = [];`));
  assert.ok(!html.includes("sessionStorage.setItem('fleet_auth', 'true')"));
  assert.ok(html.includes('ADMIN_AUTH_NOT_CONFIGURED')); assert.ok(html.includes('STORAGE_NOT_CONFIGURED'));
  for (const file of ['sync.js','telegram-invoice.js','invoice-pdf.js']) assert.ok(fs.readFileSync(path.join(root,'api',file),'utf8').includes('requireAdmin(req, res'));
});
test('credential fallbacks absent and all admin callers attach authorization', () => {
  const fallback = /process\.env\.(?:[A-Z_]*(?:TOKEN|SECRET|API_KEY)|UPSTASH_REDIS_REST_URL)\s*\|\|\s*['"][^'"]+['"]/;
  for (const name of fs.readdirSync(path.join(root, 'api')).filter(name => name.endsWith('.js'))) {
    assert.equal(fallback.test(fs.readFileSync(path.join(root, 'api', name), 'utf8')), false, `Credential fallback forbidden in ${name}`);
  }
  const html = fs.readFileSync(path.join(root, 'rekap.html'), 'utf8');
  assert.ok(html.includes("Authorization: 'Bearer ' + adminAccessToken"));
  for (const call of ["adminFetch(CLOUD_SYNC_URL", "adminFetch('/api/invoice-pdf'", "adminFetch('/api/telegram-invoice'"]) assert.ok(html.includes(call));
  assert.ok(!html.includes("localStorage.setItem('MT_TG_BOT_TOKEN'"));
  for (const name of ['invoice-template.js', 'telegram-invoice.js']) {
    const source = fs.readFileSync(path.join(root, 'api', name), 'utf8');
    assert.ok(!source.includes('056219')); assert.ok(!source.includes('161001')); assert.ok(!source.includes('MUHAMMAD NAUFAL'));
  }
});
test('Rekap save path queues debounced cloud sync and exposes status text', () => {
  const html = fs.readFileSync(path.join(root, 'rekap.html'), 'utf8');
  assert.ok(html.includes("const CLOUD_SYNC_DEBOUNCE_MS = 500;"));
  assert.ok(html.includes('id="cloud-sync-status"'));
  assert.ok(html.includes('function queueCloudSync()'));
  assert.ok(html.includes('queueCloudSync();'));
  assert.ok(!html.includes('// ☁️ CLOUD SYNC — push to VPS for multi-device access\n      pushToCloud();'));
});
test('lead attribution normalization allows finite values only and never PII or injection', async () => {
  const { normalizeAttribution } = await load('lead.js');
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeAttribution({ source: 'instagram', medium: 'social', campaign: 'mataram', content: 'reel' }))), {
    campaign_source: 'instagram', campaign_medium: 'social', campaign_name: 'mataram', campaign_content: 'reel'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeAttribution({
    source: 'instagram\nInjected', medium: 'social', campaign: 'mataram', content: 'bio',
    phone: '6281234567890', message: 'private message', raw: '?utm_content=ad'
  }))), { campaign_medium: 'social', campaign_name: 'mataram', campaign_content: 'bio' });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeAttribution({ content: 'bio', content2: 'ad' }))), { campaign_content: 'bio' });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeAttribution({ content: '%62io' }))), {});
});

test('lead store builds sanitized append-only records and degrades without Redis', async () => {
  const store = await load('_lead-store.js');
  const record = store.buildLeadRecord({
    leadId: 'mt-synthetic-1',
    attribution: { campaign_source: 'instagram', campaign_medium: 'social', campaign_content: 'reel', campaign_name: '<script>' },
    pageUrl: 'https://www.mendadaktransport.com/innova-zenix?utm_source=instagram',
    summary: '  Sewa   Innova 3 hari\t dari bandara  ',
    channel: 'telegram+whatsapp'
  });
  assert.equal(record.leadId, 'mt-synthetic-1');
  assert.equal(record.attribution.campaign_source, 'instagram');
  assert.equal(record.attribution.campaign_content, 'reel');
  assert.equal(record.attribution.campaign_name, undefined);
  assert.equal(record.pagePath, '/innova-zenix?utm_source=instagram');
  assert.equal(record.summary, 'Sewa Innova 3 hari dari bandara');
  assert.match(record.day, /^\d{4}-\d{2}-\d{2}$/);

  const offline = await store.storeLead(record, { env: {} });
  assert.equal(offline.ok, false);
  assert.equal(offline.reason, 'REDIS_NOT_CONFIGURED');

  const stats = await store.readLeadStats({ env: {} });
  assert.equal(stats.ok, false);
  assert.equal(stats.reason, 'REDIS_NOT_CONFIGURED');
  assert.equal(stats.leads.length, 0);
});

test('lead stats endpoint denies unauthenticated access before touching storage', async () => {
  const { default: handler } = await load('leads.js');
  const res = response();
  await handler({ method: 'GET', headers: {}, query: {} }, res);
  assert.notEqual(res.code, 200);
  assert.equal(res.body.ok, false);
});
