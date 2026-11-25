/* Google API client for the Worker: GA4 Data API + Search Console.
 *
 * Two different auth paths on purpose, because the two products disagree about
 * service accounts:
 *
 *   GA4            — service account (RS256 JWT signed with WebCrypto, no libs).
 *                    GA_SA_KEY (secret) + GA_PROPERTY_ID (var, numeric, not "G-").
 *   Search Console — OAuth refresh token of a real account. Search Console
 *                    refuses to add a service account as a user at all
 *                    ("email address not found"), so the service account can
 *                    never read it. SC_CLIENT_ID + SC_CLIENT_SECRET +
 *                    SC_REFRESH_TOKEN (all secrets).
 *
 * Anything missing → the call returns null and the caller degrades honestly:
 * the digest falls back to the Worker's own counters, the panel says
 * "not connected" instead of showing zeros as if they were real.
 */

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const SC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/* Search Console через refresh-токен обычного аккаунта.
 *
 * Сервисный аккаунт сюда не подошёл: Search Console трижды отказалась его
 * добавлять («не найден адрес электронной почты») — она не резолвит
 * service-account адреса как аккаунты Google. Поэтому GA4 читает по-прежнему
 * сервисный аккаунт (там он принят и работает), а Search Console — OAuth от
 * myhostbali@gmail.com, который является владельцем ресурса.
 *
 * Нужны три секрета: SC_CLIENT_ID, SC_CLIENT_SECRET, SC_REFRESH_TOKEN.
 * Приложение опубликовано (In production), иначе refresh-токен протухал бы
 * через 7 дней. Область одна и только на чтение: webmasters.readonly.
 */
async function oauthToken(env) {
  if (!env.SC_CLIENT_ID || !env.SC_CLIENT_SECRET || !env.SC_REFRESH_TOKEN) return null;

  if (env.THB_STATS) {
    const cached = await env.THB_STATS.get('ga:token:sc');
    if (cached) return cached;
  }

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.SC_CLIENT_ID,
        client_secret: env.SC_CLIENT_SECRET,
        refresh_token: env.SC_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      }).toString()
    });
    const j = await r.json();
    if (!j.access_token) return null;
    if (env.THB_STATS) {
      await env.THB_STATS.put('ga:token:sc', j.access_token, { expirationTtl: 3000 });
    }
    return j.access_token;
  } catch (e) { return null; }
}

async function accessToken(env, scope) {
  /* Search Console идёт по OAuth, аналитика — по сервисному аккаунту */
  if (scope === SC_SCOPE) return oauthToken(env);

  if (!env.GA_SA_KEY) return null;
  scope = scope || GA_SCOPE;

  const cacheKey = 'ga:token:ga';
  if (env.THB_STATS) {
    const cached = await env.THB_STATS.get(cacheKey);
    if (cached) return cached;
  }

  let sa;
  try { sa = JSON.parse(env.GA_SA_KEY); } catch (e) { return null; }
  if (!sa.client_email || !sa.private_key) return null;

  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const part = (o) => b64url(enc.encode(JSON.stringify(o)));
  const unsigned =
    part({ alg: 'RS256', typ: 'JWT' }) + '.' +
    part({
      iss: sa.client_email,
      scope: scope,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    });

  let key;
  try {
    key = await crypto.subtle.importKey(
      'pkcs8', pemToDer(sa.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
    );
  } catch (e) { return null; }

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const jwt = unsigned + '.' + b64url(new Uint8Array(sig));

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
    });
    const j = await r.json();
    if (!j.access_token) return null;
    if (env.THB_STATS) {
      await env.THB_STATS.put(cacheKey, j.access_token, { expirationTtl: 3000 });
    }
    return j.access_token;
  } catch (e) { return null; }
}

async function runReport(env, token, body) {
  try {
    const r = await fetch(
      'https://analyticsdata.googleapis.com/v1beta/properties/' + env.GA_PROPERTY_ID + ':runReport',
      {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const j = await r.json();
    return j.error ? null : j;
  } catch (e) { return null; }
}

function rows(report) {
  return (report && report.rows) || [];
}

/* One day of numbers. dayOffset 0 = today, 1 = yesterday. */
export async function gaDay(env, dayOffset) {
  const day = dayOffset === 0 ? 'today' : (dayOffset === 1 ? 'yesterday' : dayOffset + 'daysAgo');
  return gaRange(env, [{ startDate: day, endDate: day }]);
}

/* Last N full days, ending yesterday — for the weekly digest. */
export async function gaWeek(env, days) {
  return gaRange(env, [{ startDate: (days || 7) + 'daysAgo', endDate: 'yesterday' }]);
}

async function gaRange(env, range) {
  if (!env.GA_PROPERTY_ID) return null;
  const token = await accessToken(env, GA_SCOPE);
  if (!token) return null;

  const [totals, pages, sources, events] = await Promise.all([
    runReport(env, token, {
      dateRanges: range,
      metrics: [
        { name: 'activeUsers' }, { name: 'sessions' },
        { name: 'screenPageViews' }, { name: 'averageSessionDuration' }
      ]
    }),
    runReport(env, token, {
      dateRanges: range,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 5
    }),
    runReport(env, token, {
      dateRanges: range,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 4
    }),
    runReport(env, token, {
      dateRanges: range,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['whatsapp_click', 'booking_open', 'booking_submit', 'dates_selected', 'phone_click']
          }
        }
      },
      limit: 10
    })
  ]);

  if (!totals) return null;

  const m = (r, i) => Number(((rows(r)[0] || {}).metricValues || [])[i] ? rows(r)[0].metricValues[i].value : 0);
  const pair = (r) => rows(r).map(function (x) {
    return [x.dimensionValues[0].value, Number(x.metricValues[0].value)];
  });

  return {
    users: m(totals, 0),
    sessions: m(totals, 1),
    views: m(totals, 2),
    avgSec: Math.round(m(totals, 3)),
    pages: pair(pages),
    channels: pair(sources),
    events: pair(events)
  };
}

/* Day-by-day users, for the trend line in the panel. */
export async function gaSeries(env, days) {
  if (!env.GA_PROPERTY_ID) return null;
  const token = await accessToken(env, GA_SCOPE);
  if (!token) return null;

  const rep = await runReport(env, token, {
    dateRanges: [{ startDate: (days || 28) + 'daysAgo', endDate: 'yesterday' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 100
  });
  if (!rep) return null;

  return rows(rep).map(function (x) {
    const d = x.dimensionValues[0].value;              // YYYYMMDD
    return {
      date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8),
      users: Number(x.metricValues[0].value),
      sessions: Number(x.metricValues[1].value)
    };
  });
}

/* ---------- Search Console ----------
 * Same service account, a second scope. Returns null unless the account was
 * also added as a user on the Search Console property — the panel then just
 * shows the "not connected" hint instead of failing. */

function scDate(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/* Даты для Search Console, ISO. daysAgo считается от сегодня. */
export function scDateAgo(daysAgo) { return scDate(daysAgo); }

/* Один произвольный запрос к Search Console — нужен движку возможностей,
   которому требуются свои срезы (query+page, два периода подряд). */
export async function searchConsoleRaw(env, body) {
  const token = await accessToken(env, SC_SCOPE);
  if (!token) return null;
  return scQuery(env, token, body);
}

async function scQuery(env, token, body) {
  const site = env.SC_SITE_URL || 'https://balivillas.ai/';
  try {
    const r = await fetch(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/' +
        encodeURIComponent(site) + '/searchAnalytics/query',
      {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const j = await r.json();
    return j.error ? null : j;
  } catch (e) { return null; }
}

/* Queries and pages from organic search. Search Console data lags ~2 days, so
   the window ends three days back to avoid showing a half-empty last day. */
export async function searchConsole(env, days) {
  const token = await accessToken(env, SC_SCOPE);
  if (!token) return null;

  const range = { startDate: scDate((days || 28) + 3), endDate: scDate(3) };

  const [queries, pages, totals] = await Promise.all([
    scQuery(env, token, Object.assign({}, range, { dimensions: ['query'], rowLimit: 25 })),
    scQuery(env, token, Object.assign({}, range, { dimensions: ['page'], rowLimit: 15 })),
    scQuery(env, token, Object.assign({}, range, { rowLimit: 1 }))
  ]);

  if (!queries && !pages && !totals) return null;

  const map = (j, cut) => ((j && j.rows) || []).map(function (r) {
    return {
      key: (r.keys && r.keys[0]) || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 1000) / 10,
      position: Math.round((r.position || 0) * 10) / 10
    };
  }).slice(0, cut);

  const t = (totals && totals.rows && totals.rows[0]) || {};
  return {
    from: range.startDate,
    to: range.endDate,
    clicks: t.clicks || 0,
    impressions: t.impressions || 0,
    ctr: Math.round((t.ctr || 0) * 1000) / 10,
    position: Math.round((t.position || 0) * 10) / 10,
    queries: map(queries, 25),
    pages: map(pages, 15)
  };
}
