/* The Host Bali — site backend on Cloudflare Workers.
 *
 * Serves the static site (ASSETS binding) and adds a small API that talks to the
 * Telegram admin chat:
 *
 *   POST /api/lead    a request from the site form, or a WhatsApp click with the
 *                     exact text the guest is about to send. Gets a ticket
 *                     number and lands in the "leads" topic.
 *   POST /api/hit     anonymous pageview counter (no cookies, no address kept).
 *   POST /api/alert   a JavaScript error caught in the browser -> "ops" topic.
 *   POST /api/tg      Telegram webhook: /stats, /stats вчера, /health
 *   GET  /api/health  cheap endpoint for external uptime monitors.
 *   cron              asset health check every run + daily digest at 08:xx WITA.
 *
 * The bot token lives in the TELEGRAM_TOKEN secret, never in the repo.
 */

const TZ_OFFSET_MIN = 8 * 60;            // Asia/Makassar (WITA), no DST

/* ---------- helpers ---------- */

function wita(d) {
  const t = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate()),
    time: p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()),
    human: p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + '.' + t.getUTCFullYear() +
           ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()) + ' WITA'
  };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

async function tg(env, text, topic) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, skipped: 'no token' };
  const body = {
    chat_id: env.TG_CHAT || '-1003961611036',
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (topic) body.message_thread_id = Number(topic);
  try {
    const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/* KV counter. At this volume a lost increment now and then is acceptable. */
async function bump(env, key, by, ttlDays) {
  if (!env.THB_STATS) return 0;
  const cur = Number(await env.THB_STATS.get(key)) || 0;
  const next = cur + (by || 1);
  await env.THB_STATS.put(key, String(next), { expirationTtl: (ttlDays || 120) * 86400 });
  return next;
}

/* Throttle per visitor, so nobody can flood the chat through the endpoint.
 * The address is hashed, never written down: a rate-limit bucket only needs to
 * tell requests apart, not to identify anyone. */
function fingerprint(ip) {
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h * 33) ^ ip.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function tooFast(env, ip, bucket, limit, windowSec) {
  if (!env.THB_STATS) return false;
  const key = 'rl:' + bucket + ':' + fingerprint(ip) + ':' + Math.floor(Date.now() / (windowSec * 1000));
  const n = Number(await env.THB_STATS.get(key)) || 0;
  if (n >= limit) return true;
  await env.THB_STATS.put(key, String(n + 1), { expirationTtl: windowSec * 2 });
  return false;
}

async function ticket(env) {
  if (!env.THB_STATS) return null;
  const n = await bump(env, 'seq:lead', 1, 3650);
  return String(n).padStart(4, '0');
}

/* ---------- API ---------- */

async function handleLead(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (await tooFast(env, ip, 'lead', 6, 60)) return json({ ok: false, error: 'rate' }, 429);

  let d = {};
  try { d = await req.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

  const t = wita(new Date());
  const no = await ticket(env);
  const cf = req.cf || {};
  const source = d.source === 'whatsapp' ? 'WhatsApp' : 'Форма на сайте';

  const rows = [];
  if (d.villa) rows.push(['Вилла', d.villa]);
  if (d.checkin) rows.push(['Заезд', d.checkin]);
  if (d.checkout) rows.push(['Выезд', d.checkout]);
  if (d.nights) rows.push(['Ночей', d.nights]);
  if (d.adults || d.children) {
    rows.push(['Гостей', (d.adults || 1) + ' взр.' + (d.children ? ' + ' + d.children + ' дет.' : '')]);
  } else if (d.guests) {
    rows.push(['Гостей', d.guests]);
  }
  if (d.name) rows.push(['Имя', d.name]);
  if (d.email) rows.push(['Email', d.email]);
  if (d.phone) rows.push(['Телефон', d.phone]);
  if (d.note) rows.push(['Комментарий', d.note]);

  const lines = [
    '🏝 <b>Заявка ' + (no ? '#' + no : '') + '</b> · ' + esc(source),
    '🕒 ' + esc(t.human),
    ''
  ];
  rows.forEach(function (r) { lines.push('<b>' + esc(r[0]) + ':</b> ' + esc(r[1])); });

  if (d.text) {
    lines.push('', '<b>Текст обращения:</b>', '<code>' + esc(String(d.text).slice(0, 1500)) + '</code>');
  }
  const where = d.page || d.url;
  if (where) lines.push('', '🔗 ' + esc(where));
  const geo = [cf.city, cf.country].filter(Boolean).join(', ');
  if (geo) lines.push('📍 ' + esc(geo));

  const res = await tg(env, lines.join('\n'), env.TG_TOPIC_LEADS || 2);
  await bump(env, 'd:' + t.date + ':leads');
  if (d.source === 'whatsapp') await bump(env, 'd:' + t.date + ':wa');

  return json({ ok: !!res.ok, ticket: no });
}

async function handleHit(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (await tooFast(env, ip, 'hit', 90, 60)) return new Response(null, { status: 204 });

  let d = {};
  try { d = await req.json(); } catch (e) {}
  const t = wita(new Date());
  const path = String(d.path || '/').slice(0, 120);
  await bump(env, 'd:' + t.date + ':views');
  await bump(env, 'd:' + t.date + ':p:' + path);

  let src = 'direct';
  try {
    if (d.ref) {
      const h = new URL(d.ref).hostname.replace(/^www\./, '');
      if (h && h !== 'thehostbali.com') src = h.slice(0, 60);
    }
  } catch (e) {}
  await bump(env, 'd:' + t.date + ':s:' + src);

  return new Response(null, { status: 204 });
}

async function handleAlert(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (await tooFast(env, ip, 'alert', 3, 300)) return new Response(null, { status: 204 });

  let d = {};
  try { d = await req.json(); } catch (e) {}
  const msg = String(d.message || 'unknown error').slice(0, 400);

  /* one alert per unique error per hour — a render loop must not spam the chat */
  if (env.THB_STATS) {
    let h = 0;
    for (let i = 0; i < msg.length; i++) h = (h * 31 + msg.charCodeAt(i)) | 0;
    const key = 'alert:' + h;
    if (await env.THB_STATS.get(key)) return new Response(null, { status: 204 });
    await env.THB_STATS.put(key, '1', { expirationTtl: 3600 });
  }

  const t = wita(new Date());
  const parts = [
    '🛠 <b>Ошибка на сайте</b>',
    '🕒 ' + esc(t.human),
    '',
    '<code>' + esc(msg) + '</code>'
  ];
  if (d.page) parts.push('', '🔗 ' + esc(d.page));
  if (d.ua) parts.push(esc(String(d.ua).slice(0, 120)));

  await tg(env, parts.join('\n'), env.TG_TOPIC_OPS || 4);
  return new Response(null, { status: 204 });
}

/* ---------- cron: uptime + daily digest ---------- */

async function topKeys(env, prefix, top) {
  if (!env.THB_STATS) return [];
  const names = [];
  let cursor;
  do {
    const page = await env.THB_STATS.list({ prefix: prefix, cursor: cursor });
    page.keys.forEach(function (k) { names.push(k.name); });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  const rows = [];
  for (const name of names.slice(0, 200)) {
    rows.push([name.slice(prefix.length), Number(await env.THB_STATS.get(name)) || 0]);
  }
  return rows.sort(function (a, b) { return b[1] - a[1]; }).slice(0, top);
}

async function statsText(env, dayOffsetDays, title) {
  const d = wita(new Date(Date.now() - dayOffsetDays * 86400000));
  const get = async (k) => Number(await env.THB_STATS.get(k)) || 0;

  const views = await get('d:' + d.date + ':views');
  const leads = await get('d:' + d.date + ':leads');
  const wa = await get('d:' + d.date + ':wa');
  const pages = await topKeys(env, 'd:' + d.date + ':p:', 5);
  const srcs = await topKeys(env, 'd:' + d.date + ':s:', 4);

  const lines = [
    '📊 <b>' + esc(title) + ' ' + esc(d.date) + '</b>',
    '',
    'Просмотров: <b>' + views + '</b>',
    'Заявок: <b>' + leads + '</b>' + (wa ? ' (из них WhatsApp: ' + wa + ')' : '')
  ];
  if (pages.length) {
    lines.push('', '<b>Страницы:</b>');
    pages.forEach(function (r) { lines.push(r[1] + ' · ' + esc(r[0])); });
  }
  if (srcs.length) {
    lines.push('', '<b>Источники:</b>');
    srcs.forEach(function (r) { lines.push(r[1] + ' · ' + esc(r[0])); });
  }
  if (!views && !leads) lines.push('', 'Активности пока не было.');
  return lines.join('\n');
}

async function digest(env) {
  await tg(env, await statsText(env, 1, 'Сайт за'), env.TG_TOPIC_OPS || 4);
}

/* The bot answers commands in the chat: /stats, /stats yesterday, /health */
async function handleTgHook(req, env) {
  if (env.TG_HOOK_SECRET &&
      req.headers.get('x-telegram-bot-api-secret-token') !== env.TG_HOOK_SECRET) {
    return new Response(null, { status: 403 });
  }
  let u = {};
  try { u = await req.json(); } catch (e) { return new Response(null, { status: 204 }); }
  const msg = u.message || u.edited_message;
  const text = ((msg && msg.text) || '').trim().toLowerCase();
  if (!msg || !text || text.charAt(0) !== '/') return new Response(null, { status: 204 });

  const topic = msg.message_thread_id || env.TG_TOPIC_OPS || 4;
  const cmd = text.replace(/@[a-z0-9_]+/g, '');

  if (cmd.indexOf('/stats') === 0) {
    const yesterday = /yesterday|вчера/.test(cmd);
    await tg(env, await statsText(env, yesterday ? 1 : 0,
             yesterday ? 'Сайт за' : 'Сайт сегодня,'), topic);
  } else if (cmd.indexOf('/health') === 0) {
    const res = await probe(env);
    const okAll = res.every(function (r) { return r.ok; });
    const lines = [okAll ? '✅ <b>Сайт в порядке</b>' : '🚨 <b>Есть проблемы</b>', ''];
    res.forEach(function (r) {
      lines.push((r.ok ? '✔' : '✖') + ' ' + r.status + ' · ' + esc(r.path));
    });
    await tg(env, lines.join('\n'), topic);
  } else if (cmd.indexOf('/help') === 0 || cmd.indexOf('/start') === 0) {
    await tg(env, ['<b>Команды</b>', '',
                   '/stats — сегодняшние цифры',
                   '/stats вчера — за прошлые сутки',
                   '/health — доступны ли ключевые страницы',
                   '', 'Сводка за сутки приходит сама в 08:xx WITA.'].join('\n'), topic);
  }
  return new Response(null, { status: 204 });
}

/* Health of the asset store, checked through the ASSETS binding.
 * Fetching our own public hostname from inside the Worker loops back into the
 * edge and returns 522 — that produced false "site is down" alerts. */
async function probe(env) {
  const paths = ['/', '/property-rental/', '/villa/sanur/villa-black-pool-4br-sanur/'];
  const out = [];
  for (const p of paths) {
    try {
      const r = await env.ASSETS.fetch(new Request('https://thehostbali.com' + p));
      const body = await r.text();
      out.push({ path: p, status: r.status, bytes: body.length, ok: r.status === 200 && body.length > 2000 });
    } catch (e) {
      out.push({ path: p, status: 0, bytes: 0, ok: false, error: String(e).slice(0, 120) });
    }
  }
  return out;
}

/* Alert on the transition into trouble, then at most once an hour, and once more
 * when it clears — so a long outage cannot flood the chat. */
async function watch(env) {
  const res = await probe(env);
  const bad = res.filter(function (r) { return !r.ok; });
  const now = Date.now();
  const stateKey = 'ops:down';
  let prev = null;
  if (env.THB_STATS) {
    try { prev = JSON.parse(await env.THB_STATS.get(stateKey) || 'null'); } catch (e) {}
  }

  if (bad.length) {
    const quiet = prev && (now - prev.at) < 3600000;
    if (!quiet) {
      const lines = ['🚨 <b>Страницы сайта отдают ошибку</b>', ''];
      bad.forEach(function (r) {
        lines.push(esc(r.status ? r.status + ' — ' + r.path : 'нет ответа — ' + r.path));
      });
      lines.push('', 'Проверено изнутри воркера, через хранилище файлов.');
      await tg(env, lines.join('\n'), env.TG_TOPIC_OPS || 4);
    }
    if (env.THB_STATS) {
      await env.THB_STATS.put(stateKey, JSON.stringify({ at: quiet ? prev.at : now }), { expirationTtl: 86400 });
    }
  } else if (prev) {
    await tg(env, '✅ <b>Сайт снова в порядке</b>\nВсе проверяемые страницы отвечают.', env.TG_TOPIC_OPS || 4);
    if (env.THB_STATS) await env.THB_STATS.delete(stateKey);
  }
  return res;
}

/* ---------- entry ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname.indexOf('/api/') === 0) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
      if (url.pathname === '/api/health') {
        const res = await probe(env);
        return json({ ok: res.every(function (r) { return r.ok; }), ts: Date.now(), pages: res });
      }
      if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

      /* only our own pages may post here */
      const origin = req.headers.get('origin') || '';
      if (url.pathname !== '/api/tg' && origin &&
          !/^https?:\/\/(www\.)?thehostbali\.com$|^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }

      if (url.pathname === '/api/lead') return handleLead(req, env);
      if (url.pathname === '/api/hit') return handleHit(req, env);
      if (url.pathname === '/api/alert') return handleAlert(req, env);
      if (url.pathname === '/api/tg') return handleTgHook(req, env);
      return json({ ok: false, error: 'unknown endpoint' }, 404);
    }

    return env.ASSETS.fetch(req);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async function () {
      await watch(env);
      const h = wita(new Date());
      if (h.time.indexOf('08:') === 0) await digest(env);
    })());
  }
};
