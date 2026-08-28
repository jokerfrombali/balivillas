/* Hostfully calendar sync over public iCal feeds.
 *
 * No API key needed: every property in Hostfully publishes a read-only .ics at
 * a fixed URL (Calendar Tools -> Calendar Export). We poll those, keep a mirror
 * in KV, and serve the site from the mirror — so a villa page never waits on
 * Hostfully and a burst of visitors never hammers them.
 *
 * What the feed gives us: booked/held date ranges. That is all. There are no
 * prices in iCal — those stay in data/villas.json until Hostfully opens API
 * access to this account.
 *
 * Privacy: Hostfully puts the guest name into SUMMARY ("Booked - <name>").
 * We parse dates only and never store or serve that string.
 */

const BASE = 'https://platform.hostfully.com/api/public/calendars/properties/';

/* Как часто обходим Hostfully. Фид собирается на их стороне на лету, жёсткого
   лимита на публичный календарь нет — 14 объектов раз в 2 часа это 168 запросов
   в сутки, пренебрежимо мало. Хотите свежее — ставьте 30, cron и так будит
   воркер каждые полчаса. */
export const SYNC_EVERY_MIN = 120;

/* Сколько месяцев календаря держим. Больше года вперёд никто не бронирует. */
const HORIZON_DAYS = 550;

/* Связка «вилла на сайте» -> «объект в Hostfully».
 *
 * Ключ — id из data/villas.json. uid — объект Hostfully.
 * Файл лежит в worker/, а worker/ исключён в .assetsignore, поэтому эти
 * идентификаторы не уезжают в публичную выдачу вместе со статикой.
 *
 * uid: null означает «вилла на сайте есть, объект в Hostfully ещё не назначен».
 * Такая вилла показывается в панели серой связкой, а не зелёной, и её календарь
 * на сайте просто не заполняется — это честнее, чем показать пустую занятость.
 */
export const LINKS = [
  { villa: 'own-premier-umalas-16',                   uid: '9d7d638d-4278-45b0-ba19-7ce1079d5bd8', hf: 'Premier Umalas 16' },
  { villa: 'own-premier-umalas-17',                   uid: 'e72a0f38-c6b8-4d8f-8432-bd2116548a25', hf: 'Premier Umalas 17' },
  { villa: 'own-villa-black-pool',                    uid: 'c4ac2103-bc6b-496c-8fec-38333762af32', hf: 'Villa Black Pool' },
  { villa: 'own-villa-kesari-4-3br-pool-villa-sanur', uid: '49ab19eb-f29a-4136-b8cd-6738fc448e91', hf: 'Villa Kesari 4' },
  { villa: 'own-the-wave-6br-beachside-villa-canggu', uid: '8d45f7f9-4c56-49b9-85c7-28d318fa5400', hf: 'The Wave' },

  /* Имена объектов в Hostfully внутренние («Pungutan 1»), а публичные имена
     там совпадают с названиями на сайте — по ним и сцепляли, а не по адресу. */
  { villa: 'own-sanur-2br-townhouse',       uid: '65747a9c-02f5-4bb6-ab54-67e751634bcd', hf: 'Pungutan 1' },
  { villa: 'own-sanur-modern-2br',          uid: 'b2996d8e-8e03-49ee-9d74-df4c38c36b87', hf: 'Pungutan 2' },
  { villa: 'own-sanur-garden-pool-4br',     uid: 'cfbde612-c8b9-4863-b0c1-8b4970473568', hf: 'Tanjung Sari 3' },
  { villa: 'own-eco-private-1br-ungasan',   uid: '61ee0ccf-871c-481e-ae4b-cb695b5e0ed4', hf: 'Mudra Villas 1' },
  { villa: 'own-eco-teak-2br-ungasan',      uid: '7228ab05-8f7a-4e31-92fe-fc10ad171d7b', hf: 'Mudra Villas 2' },
  { villa: 'own-eco-exclusive-1br-ungasan', uid: '248936d1-6da8-44d5-a2df-10959410f368', hf: 'Mudra 3' },

  /* Lucky Lily есть на сайте, но объекта под неё в Hostfully нет вообще —
     ни по названию, ни по адресу, ни по числу спален. Пока не заведут,
     календарь этой виллы на сайте остаётся без занятости. */
  { villa: 'own-lucky-lily-sanur-3br',      uid: null, hf: null }
];

/* Объекты Hostfully, которым на сайте пока никто не соответствует. Держим
   списком, чтобы панель показывала их отдельно, а не делала вид, что их нет. */
export const UNLINKED_HF = [
  { uid: '0ebfe002-3b94-45cc-81fb-50ecff404758', hf: 'Leonardo · Luxury 9BR Resort (Pererenan)' },
  { uid: '94034ab2-a636-45cb-a307-c9d1e7a8ff06', hf: 'Mudra 4 — Tropical Villa with Pool (Ungasan)' },
  { uid: '9c68a2a5-d9cc-45b7-b1d8-dda81d7f9f90', hf: 'Villa Papat — Secret 4BR Big Villa (Umalas Tunon)' }
];

/* ---------- helpers ---------- */

function iso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

function today() { return iso(new Date()); }

/* ---------- iCal ---------- */

/* Разворачиваем сложенные строки: по RFC 5545 продолжение начинается с пробела
   или таба. Без этого длинный SUMMARY рвёт разбор следующего поля. */
function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

/* "20260829" или "20260829T140000Z" -> "2026-08-29" */
function icsDate(raw) {
  const m = String(raw || '').trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

/* Возвращает занятые интервалы [start, end), end — день выезда, он свободен. */
export function parseIcs(text) {
  const out = [];
  const blocks = unfold(text).split('BEGIN:VEVENT').slice(1);

  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0];
    let start = null, end = null;

    for (const line of body.split('\n')) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const name = line.slice(0, colon).split(';')[0].toUpperCase();
      const value = line.slice(colon + 1);
      if (name === 'DTSTART') start = icsDate(value);
      else if (name === 'DTEND') end = icsDate(value);
    }

    if (!start) continue;
    /* Событие без DTEND по стандарту длится один день. */
    if (!end || end <= start) end = addDays(start, 1);
    out.push([start, end]);
  }

  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

/* Ночи внутри интервалов, в пределах окна. День выезда не занят. */
export function rangesToNights(ranges, from, to) {
  const nights = new Set();
  for (const [s, e] of ranges) {
    let d = s < from ? from : s;
    while (d < e && d < to) { nights.add(d); d = addDays(d, 1); }
  }
  return [...nights].sort();
}

/* ---------- KV mirror ---------- */

const key = (villa) => 'hf:cal:' + villa;
const META = 'hf:meta';

/* Один объект. Ошибку не глотаем — записываем в зеркало, чтобы панель
   показала красную связку, а не молчала с устаревшими датами. */
export async function syncOne(env, link) {
  const prev = await readMirror(env, link.villa);

  if (!link.uid) {
    return { villa: link.villa, ok: false, error: 'not_linked', ranges: [], ts: Date.now() };
  }

  let rec;
  try {
    const res = await fetch(BASE + link.uid + '/calendar.ics?showHold=true', {
      headers: { accept: 'text/calendar' },
      cf: { cacheTtl: 0 }
    });

    if (!res.ok) throw new Error('http_' + res.status);
    const text = await res.text();
    if (text.indexOf('BEGIN:VCALENDAR') < 0) throw new Error('not_ical');

    rec = {
      villa: link.villa,
      uid: link.uid,
      ok: true,
      error: null,
      ranges: parseIcs(text),
      ts: Date.now(),
      lastOkTs: Date.now()
    };
  } catch (e) {
    /* Держим прошлые даты: пустой календарь опаснее слегка устаревшего —
       он показал бы виллу свободной на уже занятые даты. */
    rec = {
      villa: link.villa,
      uid: link.uid,
      ok: false,
      error: String(e && e.message || e).slice(0, 80),
      ranges: prev ? prev.ranges : [],
      ts: Date.now(),
      lastOkTs: prev ? prev.lastOkTs || 0 : 0
    };
  }

  await env.THB_STATS.put(key(link.villa), JSON.stringify(rec));
  return rec;
}

export async function readMirror(env, villa) {
  try { return JSON.parse(await env.THB_STATS.get(key(villa)) || 'null'); }
  catch (e) { return null; }
}

/* Обход всех связок. force игнорирует интервал — это кнопка «Проверить сейчас».
   Идём последовательно: 14 запросов укладываются в лимиты воркера, а параллель
   на бесплатном плане упирается в число одновременных соединений. */
export async function syncAll(env, force) {
  let meta = {};
  try { meta = JSON.parse(await env.THB_STATS.get(META) || '{}'); } catch (e) {}

  const dueAt = (meta.ts || 0) + SYNC_EVERY_MIN * 60000;
  if (!force && Date.now() < dueAt) return { skipped: true, nextAt: dueAt };

  const results = [];
  for (const link of LINKS) {
    if (!link.uid) continue;
    results.push(await syncOne(env, link));
  }

  meta = {
    ts: Date.now(),
    everyMin: SYNC_EVERY_MIN,
    total: results.length,
    ok: results.filter((r) => r.ok).length
  };
  await env.THB_STATS.put(META, JSON.stringify(meta));
  return { skipped: false, meta, results: results.length };
}

/* ---------- reads ---------- */

/* Занятые ночи одной виллы. Отдаём только даты — ни имён, ни сумм. */
export async function busyNights(env, villa, from, to) {
  const rec = await readMirror(env, villa);
  if (!rec) return null;
  const a = from || today();
  const b = to || addDays(a, HORIZON_DAYS);
  return {
    villa,
    from: a,
    to: b,
    nights: rangesToNights(rec.ranges || [], a, b),
    checkedAt: rec.ts || 0,
    stale: !rec.ok
  };
}

/* Состояние всех связок для панели. */
export async function status(env) {
  let meta = {};
  try { meta = JSON.parse(await env.THB_STATS.get(META) || '{}'); } catch (e) {}

  const from = today();
  const to = addDays(from, 90);
  const staleAfter = SYNC_EVERY_MIN * 60000 * 2.5;

  const links = [];
  for (const link of LINKS) {
    const rec = await readMirror(env, link.villa);
    const age = rec ? Date.now() - (rec.lastOkTs || 0) : Infinity;

    let state = 'off';                       /* серая связка: объект не назначен */
    if (link.uid) {
      if (!rec) state = 'wait';              /* назначен, но ни разу не опрошен */
      else if (rec.ok && age < staleAfter) state = 'live';
      else if (rec.lastOkTs && age < staleAfter * 4) state = 'stale';
      else state = 'down';
    }

    links.push({
      villa: link.villa,
      hf: link.hf,
      linked: !!link.uid,
      state,
      error: rec ? rec.error : null,
      checkedAt: rec ? rec.ts : 0,
      lastOkTs: rec ? rec.lastOkTs || 0 : 0,
      bookings: rec ? (rec.ranges || []).length : 0,
      busyNights90: rec ? rangesToNights(rec.ranges || [], from, to).length : 0
    });
  }

  return {
    everyMin: SYNC_EVERY_MIN,
    lastRunTs: meta.ts || 0,
    nextRunTs: (meta.ts || 0) + SYNC_EVERY_MIN * 60000,
    links,
    unlinkedHf: UNLINKED_HF.map((p) => ({ hf: p.hf })),
    live: links.filter((l) => l.state === 'live').length,
    total: links.length
  };
}
