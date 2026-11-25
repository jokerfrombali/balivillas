/* Отзывы гостей из Hostex -> страницы вилл (видимый блок + review/aggregateRating
 * в VacationRental JSON-LD). Search Console «Жильё для отпуска» 18.09.2026 просил
 * именно эти два поля; выдумывать отзывы нельзя, поэтому берём настоящие.
 *
 * Источник: GET /reviews (Open API v3, read-only токен), фильтр property_id,
 * review_status=reviewed, окна по 180 дней (ограничение API) за последние два года.
 * Имён гостей API не отдаёт (и мы их не храним): автор в разметке — «Guest via Airbnb».
 *
 * Правило показа: на странице и в разметке — отзывы с оценкой >= SHOW_MIN и текстом.
 * Средняя оценка (aggregateRating) считается по ВСЕМ отзывам, а не по показанным:
 * иначе это ввод в заблуждение, и Google такое снимает.
 *
 * Бюджет: cron каждые 30 минут обходит PER_RUN вилл x 4 окна = 16 запросов к Hostex,
 * полный круг по 20 виллам — 2,5 часа. Хранение: KV reviews:<villa>, TTL нет.
 */
import { LINKS, api } from './hostex.js';

const SHOW_MIN = 5;          // на странице только 5 из 5; средняя — по всем отзывам
const SHOW_MAX = 12;         // не больше стольких на странице
const WINDOW_DAYS = 180;     // максимум, который принимает /reviews
const WINDOWS = 4;           // 4 x 180 = ~2 года
const PER_RUN = 4;
const CURSOR = 'reviews:cursor';
const key = (villa) => 'reviews:' + villa;

const linked = () => LINKS.filter((l) => l.pid);
const iso = (d) => d.toISOString().slice(0, 10);

function windows() {
  const out = [];
  let end = new Date();
  for (let i = 0; i < WINDOWS; i++) {
    const start = new Date(end.getTime() - WINDOW_DAYS * 86400000);
    out.push([iso(start), iso(end)]);
    end = new Date(start.getTime() - 86400000);
  }
  return out;
}

async function fetchVilla(env, link) {
  const byCode = {};
  for (const [a, b] of windows()) {
    let offset = 0;
    for (let page = 0; page < 5; page++) {
      const d = await api(env, '/reviews?property_id=' + link.pid + '&review_status=reviewed' +
        '&start_check_out_date=' + a + '&end_check_out_date=' + b + '&offset=' + offset + '&limit=100');
      const list = (d && (d.reviews || d.list || d.items)) || (Array.isArray(d) ? d : []);
      for (const r of list) {
        const g = r.guest_review;
        if (!g || typeof g.score !== 'number') continue;
        byCode[r.reservation_code] = {
          code: r.reservation_code,
          channel: r.channel_type || '',
          score: Number(g.score),
          text: String(g.content || '').trim().slice(0, 1200),
          date: (g.created_at || r.check_out_date || '').slice(0, 10),
          reply: r.host_reply && r.host_reply.content ? String(r.host_reply.content).trim().slice(0, 600) : ''
        };
      }
      if (list.length < 100) break;
      offset += 100;
    }
  }
  return Object.values(byCode).sort((x, y) => (y.date > x.date ? 1 : -1));
}

/* Один проход cron: следующие PER_RUN вилл по кругу. force=villaId — только она. */
export async function syncReviews(env, only) {
  const links = linked();
  let batch;
  if (only) {
    batch = links.filter((l) => l.villa === only);
  } else {
    const cur = Number(await env.THB_STATS.get(CURSOR)) || 0;
    batch = [];
    for (let i = 0; i < PER_RUN; i++) batch.push(links[(cur + i) % links.length]);
    await env.THB_STATS.put(CURSOR, String((cur + PER_RUN) % links.length));
  }
  const done = {};
  for (const link of batch) {
    try {
      const items = await fetchVilla(env, link);
      await env.THB_STATS.put(key(link.villa), JSON.stringify({ ts: Date.now(), ok: true, items }));
      done[link.villa] = items.length;
    } catch (e) {
      done[link.villa] = 'error: ' + String(e.message || e).slice(0, 60);
    }
  }
  return done;
}

export async function getReviews(env, villa) {
  try { return JSON.parse(await env.THB_STATS.get(key(villa)) || 'null'); } catch (e) { return null; }
}

/* Что отдаём наружу (страница, /api/reviews): без кодов броней. */
export function publicView(rec) {
  if (!rec || !rec.items || !rec.items.length) return null;
  const all = rec.items.filter((r) => r.score > 0);
  if (!all.length) return null;
  const avg = all.reduce((s, r) => s + r.score, 0) / all.length;
  const shown = all.filter((r) => r.score >= SHOW_MIN && r.text).slice(0, SHOW_MAX)
    .map((r) => ({ channel: r.channel, score: r.score, text: r.text, date: r.date, reply: r.reply }));
  return { ratingValue: Math.round(avg * 10) / 10, reviewCount: all.length, shown, ts: rec.ts };
}

const CH = { airbnb: 'Airbnb', 'booking.com': 'Booking.com', booking: 'Booking.com', agoda: 'Agoda', expedia: 'Expedia', vrbo: 'Vrbo', hostex_direct: 'direct booking' };
const chName = (c) => CH[String(c || '').toLowerCase()] || (c ? c : 'booking');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stars(n) {
  const full = Math.round(n);
  return '<span aria-label="' + n + ' out of 5" style="color:#d9a21b;letter-spacing:1px">' +
    '★'.repeat(full) + '<span style="color:#d9d4c9">' + '★'.repeat(5 - full) + '</span></span>';
}

function sectionHtml(v, lang) {
  const IT = lang === 'it';
  const T = IT
    ? { h: 'Recensioni degli ospiti', sum: (n, c) => n + ' su 5 · ' + c + (c === 1 ? ' recensione' : ' recensioni'), via: 'Ospite via ', reply: 'Risposta del team', note: 'Recensioni verificate: arrivano dal nostro sistema di prenotazione (Airbnb, Booking.com, prenotazioni dirette). Mostriamo le recensioni a 5 stelle; la media è calcolata su tutte.' }
    : { h: 'Guest reviews', sum: (n, c) => n + ' out of 5 · ' + c + (c === 1 ? ' review' : ' reviews'), via: 'Guest via ', reply: 'Reply from the team', note: 'Verified stays: reviews come straight from our booking system (Airbnb, Booking.com, direct bookings). We show 5-star reviews; the average rating is calculated over all reviews.' };
  const cards = v.shown.map((r) =>
    '<article style="border:1px solid #e6e3dc;border-radius:16px;padding:18px 20px;background:#fff">' +
    '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
    '<span style="font-weight:600;font-size:15px">' + esc(T.via + chName(r.channel)) + '</span>' +
    '<span style="font-size:13px;color:#6b6b66">' + stars(r.score) + ' <span style="margin-left:6px">' + esc(r.date) + '</span></span></div>' +
    '<p style="margin:0;font-size:15px;line-height:1.7;color:#2a2a26">' + esc(r.text) + '</p>' +
    (r.reply ? '<p style="margin:10px 0 0;padding:10px 14px;background:#f2efe8;border-radius:12px;font-size:14px;line-height:1.6;color:#4b4b45"><b>' + esc(T.reply) + ':</b> ' + esc(r.reply) + '</p>' : '') +
    '</article>').join('');
  return '<section id="section-reviews" class="py-8 lg:py-10 flex flex-col gap-6 lg:gap-8 @container" data-thb-reviews>' +
    '<div class="flex flex-col gap-2"><h2 class="text-headline text-primary font-medium" data-slot="heading">' + T.h + '</h2>' +
    '<p style="font-size:16px;color:#3b3b36">' + stars(v.ratingValue) + ' <b>' + esc(T.sum(v.ratingValue, v.reviewCount)) + '</b></p></div>' +
    (cards ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">' + cards + '</div>' : '') +
    '<p style="font-size:13px;color:#6b6b66;margin:0">' + esc(T.note) + '</p></section>';
}

/* Вилла по адресу страницы: /villa/<slug>/ -> id из data/villas.json. */
async function villaForPath(env, pathNoLang) {
  const res = await env.ASSETS.fetch(new Request('https://balivillas.ai/data/villas.json'));
  if (!res.ok) return null;
  const list = await res.json();
  for (const v of (list || [])) {
    const u = v.url || (v.slug ? '/villa/' + v.slug + '/' : null);
    if (u && u === pathNoLang) return v.id;
  }
  return null;
}

export async function injectReviews(res, env, pathNoLang, lang) {
  const villa = await villaForPath(env, pathNoLang);
  if (!villa) return res;
  const v = publicView(await getReviews(env, villa));
  if (!v) return res;

  const html = sectionHtml(v, lang);
  let buf = '';
  return new HTMLRewriter()
    .on('section#section-rules', { element(el) { el.after(html, { html: true }); } })
    .on('script[type="application/ld+json"]', {
      text(t) {
        buf += t.text;
        if (!t.lastInTextNode) { t.remove(); return; }
        const raw = buf; buf = '';
        if (raw.indexOf('"VacationRental"') < 0) { t.replace(raw); return; }
        try {
          const d = JSON.parse(raw);
          d.aggregateRating = { '@type': 'AggregateRating', ratingValue: v.ratingValue, reviewCount: v.reviewCount, bestRating: 5, worstRating: 1 };
          d.review = v.shown.map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: 'Guest via ' + chName(r.channel) },
            datePublished: r.date,
            reviewBody: r.text,
            reviewRating: { '@type': 'Rating', ratingValue: r.score, bestRating: 5, worstRating: 1 }
          }));
          t.replace(JSON.stringify(d));
        } catch (e) { t.replace(raw); }
      }
    })
    .transform(res);
}
