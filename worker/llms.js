/* llms.txt и llms-full.txt с живыми ценами.
 *
 * Сами файлы собирает tools/build-llms.py из каталога: названия, описания,
 * удобства, ссылки. Цен в каталоге нет — они живут в Hostex и меняются каждый
 * день, поэтому в собранном файле у каждой виллы стояло «rates on request».
 * Ассистент, которого спросили, сколько стоит вилла в Сануре, так и отвечал —
 * или брал цифры у конкурентов.
 *
 * Здесь файл отдаётся через воркер, и строка «Rates:» каждой виллы заменяется
 * живой: цена «от» за ночь, минимальный срок и ближайший свободный заезд. Всё
 * из того же зеркала Hostex в KV, что и на сайте: два чтения KV на запрос,
 * в Hostex не ходим. Если данных нет, файл уходит как есть — это честнее, чем
 * выдуманная цифра.
 */

import { readAllPrices, readAllCalendars } from './hostex.js';

const ORIGIN = 'https://balivillas.ai';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return n < 10 ? '0' + n : String(n); }
function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function addDays(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
/* Бали живёт в UTC+8 */
function today() { return iso(new Date(Date.now() + 8 * 3600 * 1000)); }
function human(s) { const d = new Date(s + 'T00:00:00Z'); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

function money(cur, n) {
  const s = String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (cur || 'Rp') + ' ' + s;
}

function minStayAt(rec, d) {
  const m = (rec && rec.min) || [];
  for (const r of m) if (d >= r[0] && d < r[1]) return r[2] || 1;
  return (rec && rec.minStay) || 1;
}

function isFree(rec, a, b) {
  for (const r of (rec.busy || [])) if (a < r[1] && r[0] < b) return false;
  return true;
}

/* Ближайший заезд с завтрашнего дня, на который свободен минимальный срок. */
function nextFree(rec) {
  if (!rec) return null;
  let d = addDays(today(), 1);
  for (let i = 0; i < 240; i++) {
    const ms = minStayAt(rec, d);
    if (isFree(rec, d, addDays(d, ms))) return { date: d, nights: ms };
    d = addDays(d, 1);
  }
  return null;
}

function liveLine(url, prices, cal) {
  const p = prices && prices[url];
  if (!p || !p.price) return null;
  const c = cal && cal.byUrl ? cal.byUrl[url] : null;
  const bits = ['from ' + money(p.currency, p.price) + ' per night'];
  const ms = c ? minStayAt(c, addDays(today(), 1)) : (p.minStay || 0);
  if (ms > 1) bits.push('minimum stay ' + ms + ' nights');
  const nf = nextFree(c);
  if (nf) bits.push('next free check-in ' + human(nf.date));
  return 'Rates: ' + bits.join(' · ') +
         ' (live from our booking calendar, refreshed every 30 minutes)';
}

function injectFull(text, prices, cal) {
  return text.replace(
    /Rates: [^\n]*\nPage: https:\/\/thehostbali\.com(\/villa\/[^\n]+)/g,
    (whole, url) => {
      const line = liveLine(url.trim(), prices, cal);
      return line ? line + '\nPage: ' + ORIGIN + url : whole;
    }
  );
}

/* В коротком файле — цена «от» по району рядом со счётом вилл. */
function injectShort(text, prices, villas) {
  const minByArea = {};
  for (const v of (villas || [])) {
    const url = v.url || (v.slug ? '/villa/' + v.slug + '/' : '');
    const p = prices && prices[url];
    const a = (v.areaSlug || '').toLowerCase();
    if (!p || !p.price || !a) continue;
    if (!minByArea[a] || p.price < minByArea[a].price) minByArea[a] = p;
  }
  return text.replace(
    /(\(https:\/\/thehostbali\.com\/villas\/([a-z-]+)\/\): \d+ villas?)/g,
    (whole, head, slug) => {
      const m = minByArea[slug];
      return m ? head + ', from ' + money(m.currency, m.price) + ' per night' : whole;
    }
  );
}

export async function serveLlms(req, env, path) {
  const asset = await env.ASSETS.fetch(req);
  if (!asset.ok) return asset;
  let text = await asset.text();

  try {
    const [prices, cal] = await Promise.all([
      readAllPrices(env).catch(() => null),
      readAllCalendars(env).catch(() => null)
    ]);
    if (path === '/llms-full.txt') {
      text = injectFull(text, prices, cal);
    } else {
      let villas = [];
      try {
        const r = await env.ASSETS.fetch(new Request(ORIGIN + '/data/villas.json'));
        if (r.ok) villas = await r.json();
      } catch (e) {}
      text = injectShort(text, prices, villas);
    }
  } catch (e) { /* файл уйдёт как собран, без живых цифр */ }

  return new Response(text, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=1800'
    }
  });
}
