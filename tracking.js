/* Public-site measurement only. No lead payloads, contact URLs, or form contents. */
(() => {
  'use strict';
  if (window.mtTrackingInitialized || location.hostname.startsWith('rekap.')) return;
  window.mtTrackingInitialized = true;
  const GA = 'G-7XD934HR3V';
  const CLARITY = 'z8pl5hejj9';
  const ADS = 'AW-18150499001';
  const KEY = 'mt-privacy-v1';
  const publicPages = new Set(["/", "/all-new-avanza", "/all-new-xenia", "/alphard", "/fortuner", "/hiace-commuter", "/hiace-premio", "/honda-jazz", "/innova-reborn", "/innova-zenix", "/new-honda-brio", "/pajero-sport", "/paket-tour-lombok-3-hari", "/rental-mobil-bandara-lombok", "/rental-mobil-lepas-kunci-lombok", "/rental-mobil-mataram", "/terima-kasih", "/tour-3-hari-2-malam-paket-a", "/tour-3-hari-2-malam-paket-b", "/tour-3-hari-2-malam-paket-c", "/tour-3-hari-2-malam-paket-d", "/tour-3-hari-2-malam-paket-e", "/toyota-agya", "/vespa-matic", "/xpander", "/yamaha-xmax", "/zenix-g-hev", "/rental-mobil-dengan-driver-lombok", "/sewa-hiace-lombok", "/panduan-memilih-mobil-lombok"]);
  publicPages.add('/pricelist-armada-lombok');
  const candidate = location.pathname.replace(/\.html$/, '');
  const pagePath = candidate === '/index' ? '/' : candidate;
  if (!publicPages.has(pagePath)) return;
  const safePage = { page_path: pagePath, page_location: `https://www.mendadaktransport.com${pagePath}`, page_referrer: '', page_title: 'Mendadak Transport' };
  // Only exact, predefined campaign values may leave this document.
  const attribution = {};
  const campaignMap = {
    utm_source: ['campaign_source', ['google', 'instagram', 'facebook', 'whatsapp', 'google_business']],
    utm_medium: ['campaign_medium', ['cpc', 'organic', 'social', 'referral', 'email']],
    utm_campaign: ['campaign_name', ['lombok-rental', 'bandara-lombok', 'mataram', 'lepas-kunci-lombok']],
    utm_content: ['campaign_content', ['bio', 'profile', 'post', 'reel', 'story', 'highlight', 'dm', 'comment', 'ad']]
  };
  const query = new URLSearchParams(location.search);
  const rawQueryParts = location.search ? location.search.slice(1).split('&') : [];
  Object.entries(campaignMap).forEach(([key, [field, allowed]]) => {
    const rawValues = rawQueryParts.filter((part) => part.startsWith(`${key}=`)).map((part) => part.slice(key.length + 1));
    if (rawValues.length === 1 && rawValues[0] === query.get(key) && allowed.includes(rawValues[0])) attribution[field] = rawValues[0];
  });
  // Future lead callers may read this already-normalized snapshot, never the URL.
  // Simpan hanya token UTM yang sudah lolos allowlist agar atribusi tidak hilang
  // saat pengunjung berpindah halaman sebelum mengirim lead (sessionStorage, per tab).
  const ATTR_KEY = 'mt-attribution-v1';
  try {
    const stored = JSON.parse(sessionStorage.getItem(ATTR_KEY));
    if (stored && typeof stored === 'object') {
      Object.entries(campaignMap).forEach(([, [field, allowed]]) => {
        const value = stored[field];
        if (!attribution[field] && typeof value === 'string' && allowed.includes(value)) {
          attribution[field] = value;
        }
      });
    }
    if (Object.keys(attribution).length) {
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(attribution));
    }
  } catch (_) { /* Storage unavailable: attribution stays per-page. */ }
  window.mtGetAttribution = () => Object.freeze({ ...attribution });
  // Clarity reads the full URL, not safePage. Accept only literal, predefined
  // tokens: no arbitrary values, encoded aliases, duplicate keys or click IDs.
  const clarityQueryValues = new Map(Object.entries(campaignMap).map(([key, [, values]]) => [key, values]));
  clarityQueryValues.set('lang', ['id', 'en']);
  const claritySectionHashes = new Map([
    ['/', ['#beranda', '#cek-harga', '#layanan', '#area-layanan', '#armada', '#pricelist-preview', '#paket-wisata', '#persiapan-booking', '#homepage-faq', '#cara-booking', '#kontak']],
    ['/pricelist-armada-lombok', ['#poster-pricelist']]
  ]);
  function safeClarityLocation() {
    const currentPath = location.pathname.replace(/\.html$/, '').replace(/^\/index$/, '/');
    if (currentPath !== pagePath) return false;
    if (location.hash && !(claritySectionHashes.get(pagePath) || []).includes(location.hash)) return false;
    const seen = new Set();
    return !location.search || location.search.slice(1).split('&').every((part) => {
      const [key, value] = part.split('=');
      if (part !== `${key}=${value}` || seen.has(key) || !clarityQueryValues.get(key)?.includes(value)) return false;
      seen.add(key);
      return true;
    });
  }
  // Do not retain or forward click IDs. Ads may handle them only after Ads consent.
  let safeClarityReferrer = !document.referrer;
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      const allowed = ['www.google.com', 'www.google.co.id', 'www.bing.com', 'www.instagram.com', 'instagram.com', 'www.facebook.com', 'facebook.com', 'l.facebook.com', 'lm.facebook.com'];
      const trusted = referrer.protocol === 'https:' && !referrer.username && !referrer.password && !referrer.port && allowed.includes(referrer.hostname);
      if (trusted) safePage.page_referrer = referrer.origin;
      // Clarity reads the real referrer: all paths/queries, including same-site
      // referrals, stay blocked. Only existing trusted HTTPS root referrals pass.
      safeClarityReferrer = trusted && referrer.pathname === '/' && !referrer.search && !referrer.hash;
    } catch (_) { /* Unknown referrers remain private. */ }
  }
  let choice = null;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (stored && typeof stored.analytics === 'boolean' && typeof stored.ads === 'boolean' && Number.isFinite(stored.at) && stored.at <= Date.now() && Date.now() - stored.at < 180 * 86400000) choice = stored;
  } catch (_) { /* Storage unavailable: default denied. */ }
  let clarityLoaded = false;
  let loaded = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const gtag = window.gtag;
  const TRACKED_EVENTS = new Set(['quick_check_start', 'quick_check_complete', 'whatsapp_click', 'phone_click', 'whatsapp_form_submit', 'lead_submit_click', 'lead_notification_sent', 'lead_notification_failed', 'cta_click', 'fleet_filter', 'fleet_search', 'pricelist_click', 'package_click']);
  const TRACKED_EVENT_PARAMS = new Set(['form_name', 'lead_channel', 'service_type', 'duration', 'pickup_area', 'cta_position', 'cta_type', 'cta_label', 'filter_name', 'result_count', 'query_present', 'channel', 'source']);
  const safeEventValue = (value) => String(value ?? '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'unknown';
  function trackEvent(eventName, params = {}) {
    if (!choice?.analytics || !loaded || !TRACKED_EVENTS.has(eventName)) return;
    const safeParams = {};
    Object.entries(params).forEach(([key, value]) => {
      if (TRACKED_EVENT_PARAMS.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) safeParams[key] = safeEventValue(value);
    });
    gtag('event', eventName, { ...safePage, ...attribution, send_to: GA, ...safeParams });
  }
  window.mtTrackEvent = trackEvent;
  window.mtTrackLeadNotification = (success, channel = 'unknown') => trackEvent(success ? 'lead_notification_sent' : 'lead_notification_failed', { channel });
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('set', { ...safePage, ads_data_redaction: true, url_passthrough: false });
  function startClarity() {
    if (clarityLoaded || !choice?.analytics || !safeClarityLocation() || !safeClarityReferrer) return;
    // Assistant content must be masked before the recording script is requested.
    document.querySelectorAll('.ai-assistant').forEach((element) => element.setAttribute('data-clarity-mask', 'true'));
    new MutationObserver(() => {
      document.querySelectorAll('.ai-assistant').forEach((element) => element.setAttribute('data-clarity-mask', 'true'));
    }).observe(document.body, { childList: true, subtree: true });
    clarityLoaded = true;
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity('consent');
    const clarityTag = document.createElement('script');
    clarityTag.async = true;
    clarityTag.src = `https://www.clarity.ms/tag/${CLARITY}`;
    clarityTag.referrerPolicy = 'no-referrer';
    document.head.appendChild(clarityTag);
  }
  function start() {
    window[`ga-disable-${GA}`] = !choice?.analytics;
    if (loaded || (!choice?.analytics && !choice?.ads)) return;
    loaded = true;
    gtag('consent', 'update', { analytics_storage: choice.analytics ? 'granted' : 'denied', ad_storage: choice.ads ? 'granted' : 'denied', ad_user_data: choice.ads ? 'granted' : 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    if (choice.analytics) {
      startClarity();
      gtag('config', GA, { ...safePage, ...attribution, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ignore_referrer: true });
      gtag('event', 'page_view', { ...safePage, ...attribution, send_to: GA });
    }
    if (choice.ads) gtag('config', ADS, { ...safePage, allow_ad_personalization_signals: false });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${choice.analytics ? GA : ADS}`;
    tag.referrerPolicy = 'no-referrer';
    document.head.appendChild(tag);
  }
  function clearMeasurementCookies() {
    const domains = ['', location.hostname, '.mendadaktransport.com'];
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (!/^(_ga(?:_|$)|_gid$|_gat|_gcl_|_clck$|_clsk$)/.test(name)) return;
      domains.forEach((domain) => { document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ''} SameSite=Lax`; });
    });
  }
  function stopMeasurement() {
    window[`ga-disable-${GA}`] = true;
    gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    // Documented Consent API: false clears cookies and prevents further tracking.
    if (clarityLoaded) window.clarity('consent', false);
    clearMeasurementCookies();
  }
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Pilihan privasi');
  panel.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:10000;max-width:420px;width:calc(100% - 24px);max-height:75vh;overflow:auto;box-sizing:border-box;padding:18px;background:#fff;color:#172033;border:1px solid #555;border-radius:12px;box-shadow:0 4px 24px #0003;font:14px/1.5 system-ui';
  panel.innerHTML = '<strong>Privasi pengukuran</strong><p>Dengan izin Anda, Google Analytics dan Microsoft Clarity mengukur penggunaan situs; Google Ads mengukur iklan. Klik kontak bukan booking. Kami tidak mengirim nomor telepon, pesan, isian formulir, atau parameter URL sebagai data event. Clarity tetap menerapkan masking bawaan dan area input sensitif ditandai untuk disamarkan. Google tetap menerima data teknis seperti alamat IP. Pilihan disimpan selama 180 hari dan bisa dicabut kapan saja.</p><label style="display:block"><input type="checkbox" data-analytics> Izinkan analitik (Google Analytics dan Clarity)</label><label style="display:block"><input type="checkbox" data-ads> Izinkan pengukuran iklan (Google Ads)</label><p><a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">Privasi Microsoft</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privasi Google</a></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-reject>Tolak semua / cabut izin</button><button type="button" data-save>Simpan pilihan</button><button type="button" data-accept>Terima semua</button></div>';
  panel.querySelectorAll('button').forEach((button) => { button.style.cssText = 'padding:10px;border:1px solid #555;border-radius:6px;background:#fff;color:#172033;cursor:pointer;font:inherit'; });
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.textContent = 'Pengaturan privasi';
  settings.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:9999;padding:7px 10px;background:#fff;color:#172033;border:1px solid #555;border-radius:6px;font:12px system-ui;cursor:pointer';
  function show() {
    panel.querySelector('[data-analytics]').checked = !!choice?.analytics;
    panel.querySelector('[data-ads]').checked = !!choice?.ads;
    panel.hidden = false;
    settings.hidden = true;
  }
  function save(analytics, ads) {
    const wasLoaded = loaded;
    choice = { analytics, ads, at: Date.now() };
    let persisted = false;
    try { localStorage.setItem(KEY, JSON.stringify(choice)); persisted = true; } catch (_) { /* Choice still applies to this page. */ }
    // Stop collection immediately; reload removes already-loaded Google listeners.
    if (wasLoaded) {
      stopMeasurement();
      if (!persisted) {
        // No persistent consent means the new page safely defaults to denied.
        choice = null;
      }
      location.reload();
      return;
    }
    panel.hidden = true;
    settings.hidden = false;
    settings.focus();
    start();
  }
  settings.addEventListener('click', () => { show(); panel.querySelector('input').focus(); });
  panel.querySelector('[data-reject]').addEventListener('click', () => save(false, false));
  panel.querySelector('[data-accept]').addEventListener('click', () => save(true, true));
  panel.querySelector('[data-save]').addEventListener('click', () => save(panel.querySelector('[data-analytics]').checked, panel.querySelector('[data-ads]').checked));
  document.body.append(settings, panel);
  if (choice) { panel.hidden = true; start(); } else show();
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      choice = null;
      stopMeasurement();
      location.reload();
    }
  });
  let leadSubmitted = false;
  window.mtTrackLeadSubmitted = function (source = 'quick_check', details = {}) {
    if (!choice?.analytics || !loaded || leadSubmitted) return;
    leadSubmitted = true;
    trackEvent('whatsapp_form_submit', { form_name: source, lead_channel: 'whatsapp', ...details });
  };
  document.addEventListener('click', (event) => {
    if (!choice?.analytics || !loaded || !event.isTrusted) return;
    const target = event.target instanceof Element ? event.target.closest('a, button') : null;
    if (!target) return;
    let kind;
    if (target.matches('.ai-assistant-wa')) kind = 'lead_submit_click';
    else if (target.tagName === 'A') {
      const url = new URL(target.getAttribute('href') || '', location.origin);
      if (url.protocol === 'tel:') kind = 'phone_click';
      else if (url.protocol === 'https:' && ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(url.hostname)) kind = 'whatsapp_click';
      else if (url.origin === location.origin && /pricelist-armada-lombok/.test(url.pathname)) kind = 'pricelist_click';
      else if (url.origin === location.origin && /tour-|paket-tour/.test(url.pathname)) kind = 'package_click';
    }
    const position = target.closest('.floating-whatsapp-actions') ? 'floating' : target.closest('.ai-assistant') ? 'assistant' : target.closest('header, .mobile-nav') ? 'header' : target.closest('footer') ? 'footer' : target.closest('.hero') ? 'hero' : target.closest('.price-card') ? 'fleet_card' : target.closest('#kontak') ? 'contact' : 'content';
    const label = target.getAttribute('aria-label') || target.textContent || '';
    if (kind) trackEvent(kind, { cta_position: position, cta_label: label });
    if (target.dataset.trackCta) trackEvent('cta_click', { cta_position: position, cta_type: target.dataset.trackCta, cta_label: label });
  }, true);
})();
