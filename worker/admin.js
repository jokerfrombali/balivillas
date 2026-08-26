/* Admin API — everything /admin/ needs, behind the session cookie.
 *
 * Routes (all under /api/admin/):
 *   POST login | logout        session in, session out
 *   GET  me                    is this browser logged in, and what is wired up
 *   GET  overview?days=N       GA4 + KV counters + lead funnel for the dashboard
 *   GET  leads?limit=N         the lead archive, newest first
 *   POST lead                  {no, status, adminNote} — CRM state on one lead
 *   GET  seo?offset=N&limit=N  one slice of the on-site audit
 *   GET  search?days=N         Search Console queries and pages
 *   POST indexnow              {paths} — tell Bing these pages changed
 *   GET  health                are the key pages up right now
 *
 * Reads never mutate; the two writes (lead status, IndexNow) are explicit.
 */

import { gaDay, gaWeek, gaSeries, searchConsole } from './ga.js';
import { isAdmin, adminConfigured, handleLogin, handleLogout } from './auth.js';
import { listLeads, updateLead, summarise, STATUSES } from './leads.js';
import { auditBatch, sitemapPaths } from './seo.js';

const INDEXNOW_KEY = 'd9136b4b49643e1de42472f8c7cc1cf0';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

/* KV counters for one day, the numbers the Worker itself owns. */
async function kvDay(env, date) {
  const get = async (k) => Number(await env.THB_STATS.get(k)) || 0;
  return {
    views: await get('d:' + date + ':views'),
    leads: await get('d:' + date + ':leads'),
    wa: await get('d:' + date + ':wa')
  };
}

function witaDate(offsetDays) {
  const t = new Date(Date.now() + 8 * 3600000 - (offsetDays || 0) * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
}

async function overview(env, days) {
  const leads = await listLeads(env, 500);
  const now = Date.now();

  const [today, week, series] = await Promise.all([
    gaDay(env, 0),
    gaWeek(env, days),
    gaSeries(env, days)
  ]);

  /* The funnel is the whole point: traffic is meaningless if it never asks.
     GA4 counts the intent events, KV counts what actually reached the chat. */
  const ev = {};
  if (week && week.events) week.events.forEach(function (r) { ev[r[0]] = r[1]; });

  const periodLeads = summarise(leads, now - days * 86400000);
  const funnel = {
    visitors: week ? week.users : 0,
    datesPicked: ev.dates_selected || 0,
    formOpened: ev.booking_open || 0,
    waClicks: ev.whatsapp_click || 0,
    leads: periodLeads.total,
    booked: periodLeads.byStatus.booked
  };
  funnel.leadRate = funnel.visitors ? Math.round(funnel.leads / funnel.visitors * 1000) / 10 : 0;
  funnel.bookRate = funnel.leads ? Math.round(funnel.booked / funnel.leads * 1000) / 10 : 0;

  return {
    days: days,
    ga: week,
    gaToday: today,
    series: series,
    kvToday: env.THB_STATS ? await kvDay(env, witaDate(0)) : null,
    funnel: funnel,
    leads: {
      period: periodLeads,
      allTime: summarise(leads, 0),
      unanswered: leads.filter(function (l) { return l.status === 'new'; }).length
    },
    gaConnected: !!week,
    scConfigured: !!env.GA_SA_KEY
  };
}

/* Health of the pages the guest actually lands on. */
async function health(env) {
  const paths = ['/', '/property-rental/', '/villas/canggu/', '/contacts/',
                 '/villa/sanur/villa-black-pool-4br-sanur/'];
  const out = [];
  for (const p of paths) {
    try {
      const r = await env.ASSETS.fetch(new Request('https://thehostbali.com' + p));
      const body = await r.text();
      out.push({ path: p, status: r.status, kb: Math.round(body.length / 1024),
                 ok: r.status === 200 && body.length > 2000 });
    } catch (e) {
      out.push({ path: p, status: 0, kb: 0, ok: false });
    }
  }
  return out;
}

async function indexnow(env, paths) {
  const list = (paths || [])
    .filter(function (p) { return typeof p === 'string' && p.charAt(0) === '/'; })
    .slice(0, 100)
    .map(function (p) { return 'https://thehostbali.com' + p; });

  if (!list.length) return { ok: false, error: 'no_paths' };

  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'thehostbali.com',
        key: INDEXNOW_KEY,
        keyLocation: 'https://thehostbali.com/' + INDEXNOW_KEY + '.txt',
        urlList: list
      })
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, sent: list.length };
  } catch (e) {
    return { ok: false, error: 'network' };
  }
}

/* Login attempts are throttled by the caller (index.js) before we get here. */
export async function handleAdmin(req, env, path) {
  const url = new URL(req.url);
  const sub = path.replace(/^\/api\/admin\/?/, '');

  if (sub === 'login') {
    if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
    return handleLogin(req, env);
  }
  if (sub === 'logout') return handleLogout();

  /* everything below needs a live session */
  if (!await isAdmin(req, env)) {
    return json({ ok: false, error: adminConfigured(env) ? 'unauthorized' : 'not_configured' },
                adminConfigured(env) ? 401 : 503);
  }

  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 28));

  if (sub === 'me') {
    return json({
      ok: true,
      gaConfigured: !!(env.GA_SA_KEY && env.GA_PROPERTY_ID),
      kv: !!env.THB_STATS,
      statuses: STATUSES
    });
  }

  if (sub === 'overview') return json({ ok: true, data: await overview(env, days) });

  if (sub === 'leads') {
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));
    return json({ ok: true, leads: await listLeads(env, limit) });
  }

  if (sub === 'lead') {
    if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
    let d = {};
    try { d = await req.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
    const rec = await updateLead(env, d.no, d);
    return rec ? json({ ok: true, lead: rec }) : json({ ok: false, error: 'not_found' }, 404);
  }

  if (sub === 'seo') {
    const offset = Number(url.searchParams.get('offset')) || 0;
    const limit = Number(url.searchParams.get('limit')) || 12;
    return json({ ok: true, data: await auditBatch(env, offset, limit) });
  }

  if (sub === 'sitemap') return json({ ok: true, paths: await sitemapPaths(env) });

  if (sub === 'search') {
    const sc = await searchConsole(env, days);
    return json({ ok: true, data: sc, connected: !!sc });
  }

  if (sub === 'health') return json({ ok: true, pages: await health(env) });

  if (sub === 'indexnow') {
    if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
    let d = {};
    try { d = await req.json(); } catch (e) {}
    return json(await indexnow(env, d.paths));
  }

  return json({ ok: false, error: 'unknown endpoint' }, 404);
}
