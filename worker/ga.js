/* Google Analytics 4 Data API client for the Worker.
 *
 * Turns the service-account key into an access token (RS256 JWT signed with
 * WebCrypto, no libraries) and runs the reports the daily digest needs.
 *
 * Needs two things in the environment, otherwise every call returns null and the
 * digest falls back to the Worker's own counters:
 *   GA_SA_KEY       secret  — the service account JSON, verbatim
 *   GA_PROPERTY_ID  var     — numeric property id from GA4 Admin (not "G-...")
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

async function accessToken(env) {
  if (!env.GA_SA_KEY || !env.GA_PROPERTY_ID) return null;

  if (env.THB_STATS) {
    const cached = await env.THB_STATS.get('ga:token');
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
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
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
      await env.THB_STATS.put('ga:token', j.access_token, { expirationTtl: 3000 });
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
  const token = await accessToken(env);
  if (!token) return null;

  const day = dayOffset === 0 ? 'today' : (dayOffset === 1 ? 'yesterday' : dayOffset + 'daysAgo');
  const range = [{ startDate: day, endDate: day }];

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
