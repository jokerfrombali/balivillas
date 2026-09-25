/* Hostex calendar and price sync over the official Open API v3.
 *
 * Replaces the old Hostfully integration. That one scraped public .ics feeds
 * and a booking-widget JSONP endpoint; this one talks to a documented API with
 * a real token, so we finally get what we never had: a price per date and a
 * minimum stay per date.
 *
 * ТОЛЬКО ЧТЕНИЕ. Hostex — рабочая система агентства, и трогать её с сайта мы
 * не имеем права: у токена thehostbali-site снято право Write, попытка записи
 * отбивается самим Hostex («401 Not authorized for this action»). Заявка с
 * сайта по-прежнему уходит в Telegram (POST /api/lead), бронь в Hostex заводят
 * руками. Здесь допустимы только GET и POST /listings/calendar — последний,
 * несмотря на метод, ничего не меняет, это запрос календаря.
 *
 * Если когда-нибудь заведём бронь прямо из сайта (POST /reservations), право
 * Write придётся вернуть в кабинете осознанно — само по себе оно не появится.
 *
 * Token lives in the HOSTEX_TOKEN secret. Never in the repo, never in the
 * static assets: worker/ is excluded in .assetsignore.
 *
 * Цены двигает PriceLabs, подключённый к тому же аккаунту Hostex, поэтому
 * своих цен мы не держим вообще — ни в data/villas.json, ни в коде. Зеркало в
 * KV обновляется каждые полчаса вместе с cron, а точный расчёт на выбранные
 * даты идёт живым запросом: показать вчерашнюю цену там, где гость нажимает
 * «забронировать», хуже, чем подождать лишние 300 мс.
 */

const BASE = 'https://api.hostex.io/v3';

/* Cron будит воркер каждые 30 минут (см. wrangler.jsonc). Обход стоит два
   запроса на весь аккаунт — занятость всех объектов одним вызовом и календарь
   всех листингов вторым, — поэтому ходим каждый раз, а не раз в два часа, как
   приходилось с Hostfully. */
export const SYNC_EVERY_MIN = 30;

/* Горизонт. У API ограничение: start_date в пределах года, end_date в пределах
   трёх лет. Дальше года вперёд у нас всё равно не бронируют. */
const HORIZON_DAYS = 365;

/* Связка «вилла на сайте» -> «объект в Hostex».
 *
 * Ключ — id из data/villas.json, pid — property id из GET /properties.
 * pid: null означает «вилла на сайте есть, объекта в Hostex нет» — такая вилла
 * показывается в панели серой связкой, календарь на её странице просто не
 * заполняется. Это честнее, чем показать пустую занятость.
 */
export const LINKS = [
  { villa: 'own-premier-umalas-16',                   pid: 12782384, hx: 'Premier Umalas 16' },
  { villa: 'own-premier-umalas-17',                   pid: 12782385, hx: 'Premier Umalas 17' },
  { villa: 'own-villa-black-pool',                    pid: 12782389, hx: 'Black Pool' },
  { villa: 'own-villa-kesari-4-3br-pool-villa-sanur', pid: 12782390, hx: 'Kesari 4' },
  { villa: 'own-the-wave-6br-beachside-villa-canggu', pid: 12782388, hx: 'The Wave' },
  { villa: 'own-sanur-2br-townhouse',                 pid: 12782386, hx: 'Pungutan 1' },
  { villa: 'own-sanur-garden-pool-4br',               pid: 12782387, hx: 'Tanjung Sari 3' },
  { villa: 'own-eco-private-1br-ungasan',             pid: 12782382, hx: 'Mudra 1' },
  { villa: 'own-eco-teak-2br-ungasan',                pid: 12782383, hx: 'Mudra 2' },
  { villa: 'own-eco-exclusive-1br-ungasan',           pid: 12782380, hx: 'Mudra 3' },

  /* Объекты, заведённые в Hostex позже сайта: страницы под них добавлены
     отдельно, id совпадают с data/villas.json. */
  { villa: 'own-eco-tropical-1br-ungasan',            pid: 12782381, hx: 'Mudra 4' },
  { villa: 'own-papat-4br-pool-villa-umalas',         pid: 12782391, hx: 'Papat' },
  { villa: 'own-leonardo-9br-resort-pererenan',       pid: 12782379, hx: 'Leonardo' },

  /* Комплекс Serenity на Jl. Kesari II, заведён в Hostex 2026-09. Id взяты из
     кабинета и сверены с уже связанными объектами: все 13 прежних pid совпали
     один в один, значит нумерация та же. */
  { villa: 'own-serenity-3',                          pid: 12792879, hx: 'Serenity 3' },
  { villa: 'own-serenity-9',                          pid: 12792880, hx: 'Serenity 9' },
  { villa: 'own-serenity-6-1',                        pid: 12793985, hx: 'Serenity 6.1' },
  { villa: 'own-serenity-6-2',                        pid: 12793986, hx: 'Serenity 6.2' },
  { villa: 'own-serenity-10',                         pid: 12793987, hx: 'Serenity 10' },

  /* Этих двух в Hostex нет ни под каким именем: Pungutan 2 туда не завели,
     Lucky Lily не заводили и в Hostfully. Пока не появятся — календарь и цена
     на их страницах остаются пустыми, а не выдуманными. */
  { villa: 'own-sanur-modern-2br',                    pid: null, hx: null },
  { villa: 'own-lucky-lily-sanur-3br',                pid: null, hx: null }
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

/* Бали живёт в UTC+8, а воркер считает в UTC. Без сдвига с полуночи до 8 утра
   по местному времени «сегодня» уезжало бы на день назад, и календарь на
   странице виллы открывался бы на вчерашней дате. */
function today() {
  return iso(new Date(Date.now() + 8 * 3600 * 1000));
}

function nightsBetween(a, b) {
  const out = [];
  let d = a;
  while (d < b) { out.push(d); d = addDays(d, 1); }
  return out;
}

/* Hostex отдаёт код валюты (IDR), а страницы виллы печатают её как есть перед
   суммой. «IDR 4,800,000» читается хуже, чем «Rp 4,800,000», и не совпадает с
   тем, что гость видел на Airbnb. */
const CURRENCY_SIGN = { IDR: 'Rp', USD: '$', EUR: '€', AUD: 'A$', SGD: 'S$' };
function sign(code) { return CURRENCY_SIGN[String(code || '').toUpperCase()] || code || ''; }

/* ---------- API ---------- */

export async function api(env, path, init) {
  const token = env.HOSTEX_TOKEN;
  if (!token) throw new Error('no_token');

  const res = await fetch(BASE + path, {
    method: (init && init.method) || 'GET',
    headers: {
      'Hostex-Access-Token': token,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: init && init.body ? JSON.stringify(init.body) : undefined,
    cf: { cacheTtl: 0 }
  });

  if (!res.ok) throw new Error('http_' + res.status);

  const data = await res.json();
  if (data.error_code !== 200) {
    throw new Error('api_' + data.error_code + '_' + String(data.error_msg || '').slice(0, 40));
  }
  return data.data;
}

const linked = () => LINKS.filter((l) => l.pid);
const linkOf = (villa) => LINKS.filter((l) => l.villa === villa && l.pid)[0] || null;

/* ---------- KV mirror ---------- */

const calKey = (villa) => 'hx:cal:' + villa;
const priceKey = (villa) => 'hx:price:' + villa;
const quoteKey = (villa, a, b) => 'hx:quote:' + villa + ':' + a + ':' + b;
const CHANNELS = 'hx:channels';
const META = 'hx:meta';

/* Сводка «адрес страницы -> цена от», одним ключом.
 *
 * Нужна затем, что цену мы подставляем прямо в HTML на выдаче (см.
 * worker/price-html.js): читать на каждый показ страницы по ключу на виллу —
 * это тринадцать чтений KV на запрос, а так одно. */
const PRICES_ALL = 'hx:prices:all';

/* Сводка занятости всех вилл разом — фильтр по датам в каталоге. Без неё
   страница каталога читала бы по ключу на виллу: двадцать чтений KV на один
   запрос. Ночи лежат отрезками [первая ночь, день выезда), так ответ в
   несколько раз короче списка дат. */
const CAL_ALL = 'hx:cal:all:v2';

/* Цены по датам для всех вилл разом. Нужны затем, что в каталоге, когда гость
   выбрал даты, карточка должна показывать сумму за эти ночи, а не «от». Считать
   её живым запросом в Hostex на каждую виллу нельзя — это двадцать запросов на
   один выбор дат; поэтому суммируем по зеркалу. */
const DAYS_ALL = 'hx:days:all';

/* Точный расчёт держим 15 минут: PriceLabs правит ставки в течение дня, но
   перебор дат гостем не должен превращаться в шквал запросов к Hostex. */
const QUOTE_TTL_SEC = 900;

/* Карта каналов живёт сутки: листинги и коэффициенты меняются, когда объект
   заводят или снимают с канала, — это события недельного масштаба. */
const CHANNELS_TTL_SEC = 86400;

export async function readMirror(env, villa) {
  try { return JSON.parse(await env.THB_STATS.get(calKey(villa)) || 'null'); }
  catch (e) { return null; }
}

async function readPrices(env, villa) {
  try { return JSON.parse(await env.THB_STATS.get(priceKey(villa)) || 'null'); }
  catch (e) { return null; }
}

/* ---------- каналы и базовая ставка ----------
 *
 * Цена в Hostex висит на листинге канала, а не на объекте. Какой из каналов
 * несёт нашу собственную ставку, говорит GET /pricing_ratios: канал с
 * ratio = 100 — это база, остальные считаются от неё (у нас Booking и Agoda
 * идут со 115). Значит прямую цену для сайта надо брать с базового канала и
 * ничего самим не пересчитывать.
 *
 * Если базового канала вдруг нет (все с наценкой), берём минимальный ratio и
 * приводим цену к сотне — это по-прежнему цифра Hostex, просто снятая с
 * наценки канала.
 */
async function loadChannels(env, force) {
  if (!force) {
    try {
      const hit = JSON.parse(await env.THB_STATS.get(CHANNELS) || 'null');
      if (hit && hit.ts && Date.now() - hit.ts < CHANNELS_TTL_SEC * 1000) return hit.map;
    } catch (e) {}
  }

  const map = {};

  /* Вместимость берём из метаданных листинга: в самом объекте Hostex её нет, а
     показывать на карточке больше гостей, чем пускает канал, нельзя. */
  const caps = {};
  try {
    const ls = await api(env, '/listings?limit=100');
    for (const l of (ls.listings || [])) {
      const cap = Number((l.metadata || {}).person_capacity) || 0;
      if (cap) caps[l.listing_id] = Math.max(caps[l.listing_id] || 0, cap);
    }
  } catch (e) { /* без вместимости переживём: страница возьмёт её из villas.json */ }

  for (const link of linked()) {
    let picked = null;
    try {
      const r = await api(env, '/pricing_ratios?property_id=' + link.pid);
      const chans = (r.channels || []).filter((c) => Number(c.ratio) > 0);
      if (chans.length) {
        chans.sort((a, b) => Number(a.ratio) - Number(b.ratio));
        const base = chans.filter((c) => Number(c.ratio) === 100)[0] || chans[0];
        picked = {
          channel_type: base.channel_type,
          listing_id: base.listing_id,
          ratio: Number(base.ratio) || 100,
          /* остальные каналы держим рядом: по ним сторож проверяет, не отстала
             ли цена на базовом листинге (см. checkDrift) */
          all: chans.map((c) => ({
            channel_type: c.channel_type,
            listing_id: c.listing_id,
            ratio: Number(c.ratio) || 100
          }))
        };
      }
    } catch (e) {}

    if (picked) {
      picked.maxGuests = caps[picked.listing_id] || 0;
      map[link.villa] = picked;
    }
  }

  try {
    await env.THB_STATS.put(CHANNELS, JSON.stringify({ ts: Date.now(), map }),
                            { expirationTtl: CHANNELS_TTL_SEC * 2 });
  } catch (e) {}

  return map;
}

/* Цена канала -> наша базовая ставка. ratio 100 ничего не меняет. */
function toBase(price, ratio) {
  const p = Number(price) || 0;
  const r = Number(ratio) || 100;
  return r === 100 ? p : Math.round(p * 100 / r);
}

/* ---------- sync ---------- */

/* Занятые ночи — из реальных броней, а не из /availabilities.
 *
 * Тонкость, на которой легко ошибиться. GET /availabilities отдаёт
 * available: false и на забронированные даты, и на те, что просто закрыты
 * окном продаж канала: Airbnb открывает календарь не на год вперёд, и на
 * закрытых датах в /listings/calendar стоит inventory: 0 при живой цене.
 * У Black Pool так закрыто всё с октября, у Tanjung Sari 3 — весь год, при
 * нуле броней. Возьми мы available за «занято» — сайт показал бы эти виллы
 * забронированными на год, хотя напрямую мы их продаём.
 *
 * Поэтому занятость считаем по броням, а available держим отдельно, как
 * диагностику для панели.
 *
 * Приватность: в брони лежат имя, телефон и почта гостя. Берём только даты и
 * property_id, остальное не покидает этот вызов.
 */
async function fetchReservations(env, from, to) {
  const out = {};
  const seen = {};

  /* У API окно заезда не больше 180 дней, поэтому идём отрезками. */
  let start = from;
  while (start < to) {
    let end = addDays(start, 175);
    if (end > to) end = to;

    let offset = 0;
    for (;;) {
      const d = await api(env, '/reservations?start_check_in_date=' + start +
                               '&end_check_in_date=' + end +
                               '&limit=100&offset=' + offset);
      const batch = d.reservations || [];

      for (const r of batch) {
        if (seen[r.reservation_code]) continue;
        seen[r.reservation_code] = 1;

        /* Отменённую бронь дата отпускает: если её считать занятой, вилла
           навсегда останется занятой на эти ночи. */
        if (r.status !== 'accepted') continue;

        const pid = r.property_id;
        if (!out[pid]) out[pid] = [];
        for (const n of nightsBetween(r.check_in_date, r.check_out_date)) out[pid].push(n);
      }

      if (batch.length < 100) break;
      offset += 100;
    }

    start = addDays(end, 1);
  }

  for (const pid of Object.keys(out)) {
    out[pid] = [...new Set(out[pid])].sort();
  }
  return out;
}

/* Недоступные даты по версии Hostex.
 *
 * Здесь смешаны две разные вещи: настоящие блокировки (владелец закрыл даты,
 * ремонт, бронь из чужого источника) и «хвост» — даты, до которых канал просто
 * не открыл продажи. Хвост видно по тому, что он тянется непрерывно до конца
 * горизонта: у Black Pool так закрыто всё с октября, у Tanjung Sari 3 — почти
 * весь год. Его отбрасываем, остальное считаем занятым.
 *
 * Без этого сайт показывал свободными реально закрытые даты: у Premier Umalas
 * 16 девять ночей сентября, у Mudra 2 — тринадцать. Броней на них нет, и по
 * /reservations они не приходят. */
async function fetchClosed(env, from, to) {
  const ids = linked().map((l) => l.pid).join(',');
  const d = await api(env, '/availabilities?property_ids=' + ids +
                           '&start_date=' + from + '&end_date=' + to);

  const out = {};
  for (const p of (d.properties || [])) {
    const days = (p.availabilities || []).map((a) => a.date);
    const shut = new Set((p.availabilities || [])
      .filter((a) => a.available === false)
      .map((a) => a.date));

    /* Ищем начало хвоста: непрерывную полосу закрытых дат, упирающуюся в конец
       горизонта. Всё, что до неё, — настоящие блокировки. */
    let tail = null;
    for (let i = days.length - 1; i >= 0; i--) {
      if (!shut.has(days[i])) break;
      tail = days[i];
    }

    out[p.id] = {
      blocked: [...shut].filter((d0) => tail === null || d0 < tail).sort(),
      closedTail: tail,
      closedCount: shut.size
    };
  }
  return out;
}

/* Календарь цен списка листингов одним запросом.
   Возвращает { listing_id: { date: { price, minStay } } }. */
async function fetchCalendar(env, chans, from, to) {
  const listings = [];
  const seen = {};
  for (const villa of Object.keys(chans)) {
    const c = chans[villa];
    const k = c.channel_type + '|' + c.listing_id;
    if (seen[k]) continue;
    seen[k] = true;
    listings.push({ channel_type: c.channel_type, listing_id: c.listing_id });
  }
  if (!listings.length) return {};

  const d = await api(env, '/listings/calendar', {
    method: 'POST',
    body: { start_date: from, end_date: to, listings }
  });

  const out = {};
  for (const l of (d.listings || [])) {
    const days = {};
    for (const c of (l.calendar || [])) {
      days[c.date] = {
        price: Number(c.price) || 0,
        minStay: Number((c.restrictions || {}).min_stay_on_arrival) || 0
      };
    }
    out[l.listing_id] = days;
  }
  return out;
}

/* Полный обход. force игнорирует интервал — это кнопка «Проверить сейчас». */
export async function syncAll(env, force) {
  let meta = {};
  try { meta = JSON.parse(await env.THB_STATS.get(META) || '{}'); } catch (e) {}

  const dueAt = (meta.ts || 0) + SYNC_EVERY_MIN * 60000;
  if (!force && Date.now() < dueAt) return { skipped: true, nextAt: dueAt };

  const from = today();
  const to = addDays(from, HORIZON_DAYS);

  let chans = {};
  try { chans = await loadChannels(env, !!force); } catch (e) {}

  let busy = null, cal = null, closed = {}, fail = null;
  try { busy = await fetchReservations(env, from, to); }
  catch (e) { fail = String(e && e.message || e).slice(0, 80); }

  /* Диагностика для панели. Не получилось — не беда, занятость от этого не
     зависит. */
  try { closed = await fetchClosed(env, from, to); }
  catch (e) {}

  try { cal = await fetchCalendar(env, chans, from, to); }
  catch (e) { /* занятость важнее цены: без цен обойдёмся, без календаря нет */ }

  let okCal = 0, okPrice = 0, healedTotal = 0;

  /* Поправки от сторожа: даты, где наш листинг отстал от каналов. Их считает
     checkDrift раз в два часа, здесь мы их только применяем. */
  let heal = {};
  try {
    const dr = JSON.parse(await env.THB_STATS.get(DRIFT_KEY) || 'null');
    for (const v of Object.keys((dr && dr.villas) || {})) {
      if (dr.villas[v].heal) heal[v] = dr.villas[v].heal;
    }
  } catch (e) {}

  /* Копим цены по ходу обхода: перечитывать их из KV сразу после записи нельзя,
     чтение может вернуть ещё пустое значение, и вилла молча выпадет из сводки
     для HTML. */
  const fresh = {};
  const freshCal = {};

  for (const link of linked()) {
    /* Занятость. Пустой календарь опаснее слегка устаревшего — он показал бы
       виллу свободной на уже занятые даты, поэтому при ошибке держим прошлые
       даты и помечаем связку несвежей. */
    const prev = await readMirror(env, link.villa);
    const nights = busy ? (busy[link.pid] || []) : null;

    const shut = closed[link.pid] || { blocked: [], closedTail: null, closedCount: 0 };

    /* Гостю всё равно, бронь это или блокировка: и то и другое — «нельзя».
       Поэтому в календарь идут обе группы, а порознь они видны только в
       панели, чтобы было понятно, откуда что взялось. */
    const all = nights
      ? [...new Set(nights.concat(shut.blocked))].sort()
      : null;

    /* Для панели считаем именно блокировки, без пересечения с бронями: иначе
       выходит «104 брони и 105 блокировок» на одну и ту же занятость. */
    const onlyBlocked = nights
      ? shut.blocked.filter((d) => !nights.includes(d)).length
      : 0;

    const rec = all
      ? { villa: link.villa, pid: link.pid, ok: true, error: null,
          nights: all, booked: nights.length, blocked: onlyBlocked,
          closedTail: shut.closedTail, closed: shut.closedCount,
          from, to, ts: Date.now(), lastOkTs: Date.now() }
      : { villa: link.villa, pid: link.pid, ok: false, error: fail || 'no_data',
          nights: prev ? prev.nights || [] : [],
          booked: prev ? prev.booked || 0 : 0,
          blocked: prev ? prev.blocked || 0 : 0,
          closedTail: prev ? prev.closedTail || null : null,
          closed: prev ? prev.closed || 0 : 0,
          from, to, ts: Date.now(), lastOkTs: prev ? prev.lastOkTs || 0 : 0 };

    await env.THB_STATS.put(calKey(link.villa), JSON.stringify(rec));
    freshCal[link.villa] = rec;
    if (rec.ok) okCal++;

    /* Цены. */
    const c = chans[link.villa];
    const days = c && cal ? cal[c.listing_id] : null;
    if (!days) continue;

    const norm = {};
    for (const date of Object.keys(days)) {
      const p = toBase(days[date].price, c.ratio);
      if (p > 0) norm[date] = [p, days[date].minStay || 0];
    }

    /* Hostex не дописал цены на наш листинг — ставим те, что получили каналы.
       В Hostex при этом ничего не пишем: правим только то, что показываем. */
    const fix = heal[link.villa] || null;
    let healed = 0;
    if (fix) {
      for (const date of Object.keys(fix)) {
        const h = fix[date];
        if (!norm[date] || !h) continue;
        /* цена на листинге изменилась с прошлой сверки — значит Hostex её
           дописал, и подменять больше нечего */
        if (norm[date][0] !== h[1]) continue;
        norm[date] = [h[0], norm[date][1]];
        healed++;
      }
      healedTotal += healed;
    }

    /* Цена «от» для карточки в каталоге: минимум по свободным ночам ближайших
       трёх месяцев. Занятые ночи в расчёт не берём — обещать цену на дату,
       которую уже не продать, нечестно. */
    const busySet = {};
    for (const n of (rec.nights || [])) busySet[n] = 1;
    const window = addDays(from, 90);

    let min = 0;
    for (const date of Object.keys(norm)) {
      if (date >= window) continue;
      if (busySet[date]) continue;
      const p = norm[date][0];
      if (!min || p < min) min = p;
    }

    const priceRec = {
      ok: true,
      price: min,
      currency: sign('IDR'),
      minStay: (norm[from] && norm[from][1]) || 1,
      maxGuests: c.maxGuests || 0,
      channel: c.channel_type,
      ratio: c.ratio,
      healed: healed,
      days: norm,
      ts: Date.now()
    };

    await env.THB_STATS.put(priceKey(link.villa), JSON.stringify(priceRec));
    if (min) { okPrice++; fresh[link.villa] = priceRec; }
  }

  /* Сводка для подстановки цены в HTML. Адреса страниц берём из
     data/villas.json — того же файла, что читает сайт, чтобы slug не пришлось
     держать в двух местах и рассинхронизировать. */
  try { await writeAllPrices(env, fresh); } catch (e) { /* карточки просто останутся без цены */ }
  /* Сводка занятости для фильтра по датам в каталоге. */
  try { await writeAllCalendars(env, freshCal, fresh); } catch (e) { /* фильтр переживёт: соберётся при запросе */ }
  /* Цены по датам — для сумм в карточках каталога. */
  try { await writeAllDays(env, fresh); } catch (e) { /* соберётся при первом запросе */ }

  meta = {
    ts: Date.now(),
    everyMin: SYNC_EVERY_MIN,
    total: linked().length,
    ok: okCal,
    prices: okPrice,
    /* сколько дат сайт показывает по ценам каналов, потому что на нашем
       листинге Hostex их не обновил */
    healed: healedTotal,
    error: fail
  };
  await env.THB_STATS.put(META, JSON.stringify(meta));

  return { skipped: false, meta };
}

/* Адрес страницы виллы: у части вилл в data/villas.json лежит url, у части он
   пустой, зато slug есть у всех. Из-за пустого url четыре виллы молча выпадали
   из сводки цен и оставались с «On request» при живой цене. */
async function urlMap(env) {
  const res = await env.ASSETS.fetch(new Request('https://thehostbali.com/data/villas.json'));
  if (!res.ok) throw new Error('villas_' + res.status);
  const list = await res.json();

  const urlOf = {};
  for (const v of (list || [])) {
    if (!v || !v.id) continue;
    const u = v.url || (v.slug ? '/villa/' + v.slug + '/' : null);
    if (u) urlOf[v.id] = u;
  }
  return urlOf;
}

async function writeAllPrices(env, fresh) {
  const urlOf = await urlMap(env);

  const byUrl = {};
  for (const link of linked()) {
    const rec = (fresh && fresh[link.villa]) || await readPrices(env, link.villa);
    if (!rec || !rec.ok || !rec.price || !urlOf[link.villa]) continue;
    byUrl[urlOf[link.villa]] = {
      price: rec.price,
      currency: rec.currency,
      minStay: rec.minStay
    };
  }

  await env.THB_STATS.put(PRICES_ALL, JSON.stringify({ ts: Date.now(), byUrl }));
  return Object.keys(byUrl).length;
}

/* Занятые ночи -> отрезки [первая ночь, день выезда).
   '2026-10-12','2026-10-13','2026-10-14' -> ['2026-10-12','2026-10-15'].
   Каталог проверяет пересечение с выбранными датами, а не перебирает даты. */
function nightsToRanges(nights) {
  const out = [];
  const list = [...new Set(nights || [])].sort();
  let start = null, prev = null;
  for (const d of list) {
    if (start === null) { start = prev = d; continue; }
    if (d === addDays(prev, 1)) { prev = d; continue; }
    out.push([start, addDays(prev, 1)]);
    start = prev = d;
  }
  if (start !== null) out.push([start, addDays(prev, 1)]);
  return out;
}

/* Минимальный срок по датам -> отрезки [начало, конец, ночей].
   PriceLabs держит min stay 2 почти весь год и поднимает его на пики, поэтому
   отрезков выходит единицы. Брать min stay «на сегодня» для декабрьских дат
   нельзя — именно на пики он и меняется. */
function minStayRanges(days) {
  const dates = Object.keys(days || {}).sort();
  const out = [];
  let start = null, prev = null, val = null;
  for (const d of dates) {
    const m = Number(days[d][1]) || 0;
    if (!m) continue;
    if (start === null) { start = prev = d; val = m; continue; }
    if (m === val && d === addDays(prev, 1)) { prev = d; continue; }
    out.push([start, addDays(prev, 1), val]);
    start = prev = d; val = m;
  }
  if (start !== null) out.push([start, addDays(prev, 1), val]);
  return out;
}

/* Сводка занятости для фильтра по датам в каталоге: адрес страницы -> отрезки
   занятых ночей, минимальный срок по датам и вместимость. Вилла без объекта в Hostex в
   сводку не попадает — каталог показывает её как «даты по запросу», а не как
   свободную: обещать свободу там, где календаря нет, нельзя. */
async function writeAllCalendars(env, freshCal, freshPrice) {
  const urlOf = await urlMap(env);

  const byUrl = {};
  let from = today(), to = addDays(from, HORIZON_DAYS);

  for (const link of linked()) {
    const rec = (freshCal && freshCal[link.villa]) || await readMirror(env, link.villa);
    const url = urlOf[link.villa];
    if (!rec || !url) continue;

    const pr = (freshPrice && freshPrice[link.villa]) || await readPrices(env, link.villa);
    const mins = pr ? minStayRanges(pr.days) : [];
    byUrl[url] = {
      busy: nightsToRanges(rec.nights),
      minStay: (pr && pr.minStay) || 1,
      /* отрезков обычно единицы; если PriceLabs дробит срок по дням, длинный
         список тут не нужен — хватит значения по умолчанию */
      min: mins.length <= 60 ? mins : [],
      maxGuests: (pr && pr.maxGuests) || 0,
      stale: !rec.ok
    };
    if (rec.from && rec.from > from) from = rec.from;
    if (rec.to && rec.to < to) to = rec.to;
  }

  await env.THB_STATS.put(CAL_ALL, JSON.stringify({ ts: Date.now(), from, to, byUrl }));
  return Object.keys(byUrl).length;
}

async function writeAllDays(env, freshPrice) {
  const urlOf = await urlMap(env);

  const byUrl = {};
  for (const link of linked()) {
    const rec = (freshPrice && freshPrice[link.villa]) || await readPrices(env, link.villa);
    const url = urlOf[link.villa];
    if (!rec || !rec.ok || !rec.days || !url) continue;

    /* держим только цену: минимальный срок уже лежит в сводке календарей */
    const days = {};
    for (const d of Object.keys(rec.days)) {
      const p = rec.days[d][0];
      if (p > 0) days[d] = p;
    }
    byUrl[url] = { cur: rec.currency || 'Rp', days };
  }

  await env.THB_STATS.put(DAYS_ALL, JSON.stringify({ ts: Date.now(), byUrl }));
  return Object.keys(byUrl).length;
}

/* Сумма за выбранные ночи по каждой вилле. Ночи берём как [заезд, выезд):
   ночь выезда не считается. Вилла, у которой в зеркале нет цены хотя бы на
   одну ночь из выбранных, в ответ не попадает — в карточке останется «от»,
   а не придуманная сумма. */
export async function rangeQuotes(env, from, to) {
  let rec = null;
  try { rec = JSON.parse(await env.THB_STATS.get(DAYS_ALL) || 'null'); } catch (e) {}
  if (!rec || !rec.byUrl) {
    try {
      await writeAllDays(env);
      rec = JSON.parse(await env.THB_STATS.get(DAYS_ALL) || 'null');
    } catch (e) {}
  }
  if (!rec || !rec.byUrl) return null;

  const nights = nightsBetween(from, to);
  if (!nights.length) return null;

  const out = {};
  for (const url of Object.keys(rec.byUrl)) {
    const { cur, days } = rec.byUrl[url];
    let total = 0, ok = true;
    for (const d of nights) {
      const p = days[d];
      if (!p) { ok = false; break; }
      total += p;
    }
    if (!ok) continue;
    out[url] = {
      total,
      perNight: Math.round(total / nights.length),
      currency: cur || 'Rp'
    };
  }

  return { from, to, nights: nights.length, byUrl: out, ts: rec.ts || 0 };
}

/* Одно чтение KV на запрос каталога. Ключа нет (первый деплой, вытеснение) —
   собираем на месте, иначе фильтр по датам молчал бы до ближайшего cron. */
export async function readAllCalendars(env) {
  try {
    const rec = JSON.parse(await env.THB_STATS.get(CAL_ALL) || 'null');
    if (rec && rec.byUrl) return rec;
  } catch (e) {}

  try {
    await writeAllCalendars(env);
    const rec = JSON.parse(await env.THB_STATS.get(CAL_ALL) || 'null');
    if (rec && rec.byUrl) return rec;
  } catch (e) {}

  return null;
}

/* Сводка цен для выдачи HTML. Одно чтение KV на запрос страницы.
 *
 * Если ключа нет — первый деплой, вытесненный ключ, только что добавленная
 * сводка — собираем её на месте и кладём обратно. Иначе цена на сайте ждала бы
 * ближайшего обхода по cron, то есть до получаса «On request» на всех
 * карточках при живых ценах в KV. */
export async function readAllPrices(env) {
  try {
    const rec = JSON.parse(await env.THB_STATS.get(PRICES_ALL) || 'null');
    if (rec && rec.byUrl) return rec.byUrl;
  } catch (e) {}

  try {
    await writeAllPrices(env);
    const rec = JSON.parse(await env.THB_STATS.get(PRICES_ALL) || 'null');
    return rec && rec.byUrl ? rec.byUrl : null;
  } catch (e) { return null; }
}

/* ---------- reads ---------- */

/* Занятые ночи одной виллы. Отдаём только даты — ни имён гостей, ни сумм.
   Hostex, в отличие от iCal Hostfully, имя гостя сюда и не кладёт. */
export async function busyNights(env, villa, from, to) {
  const rec = await readMirror(env, villa);
  if (!rec) return null;

  const a = from || today();
  const b = to || addDays(a, HORIZON_DAYS);
  const nights = (rec.nights || []).filter((d) => d >= a && d < b).sort();

  return {
    villa,
    from: a,
    to: b,
    nights,
    checkedAt: rec.ts || 0,
    stale: !rec.ok
  };
}

/* Базовая цена «от» из зеркала. В Hostex на каждый просмотр страницы не ходим:
   зеркало обновляется по cron каждые полчаса. */
export async function basePrice(env, villa) {
  const link = linkOf(villa);
  if (!link) return null;

  const rec = await readPrices(env, villa);
  if (rec && rec.ok && rec.price) {
    return { ok: true, price: rec.price, currency: rec.currency,
             minStay: rec.minStay, maxGuests: rec.maxGuests, ts: rec.ts };
  }

  /* Пустое зеркало — первый деплой или вытесненный ключ. Синхронизируем разом,
     чтобы карточка не осталась без цены. */
  try {
    await syncAll(env, true);
    const fresh = await readPrices(env, villa);
    if (fresh && fresh.ok && fresh.price) {
      return { ok: true, price: fresh.price, currency: fresh.currency,
               minStay: fresh.minStay, maxGuests: fresh.maxGuests, ts: fresh.ts };
    }
  } catch (e) {}

  return null;
}

/* Все цены «от» разом — для карточек в каталоге: тринадцать отдельных запросов
   с одной страницы ни к чему. Вилла без объекта в Hostex в ответ не попадает,
   и карточка честно остаётся с «On request». */
export async function allBasePrices(env) {
  const out = {};
  for (const link of linked()) {
    const rec = await readPrices(env, link.villa);
    if (rec && rec.ok && rec.price) {
      out[link.villa] = {
        price: rec.price,
        currency: rec.currency,
        minStay: rec.minStay,
        maxGuests: rec.maxGuests
      };
    }
  }
  return out;
}

/* ---------- сторож: не отстала ли цена на нашем листинге ----------
 *
 * Цену для сайта мы берём с базового листинга (ratio 100) — это «Booking Site»
 * в Hostex, наш прямой сайт. 24 сентября 2026 Hostex не смог дописать туда
 * цены на два окна по Mudra 3 («Price update partially failed», таймаут их
 * внутреннего сервиса), на Airbnb, Booking и Trip.com цены ушли — и сайт
 * несколько дней показывал суммы на 0,3–8% ниже, пока человек не сверил
 * календарь руками.
 *
 * Сторож сверяет сам: тянет календари всех каналов одним запросом, приводит
 * цены к базовой ставке по ratio и считает даты, где базовый листинг
 * разошёлся с большинством остальных. Ничего не чинит и никуда не пишет —
 * только отчёт: чинить всё равно на стороне PriceLabs/Hostex.
 */
const DRIFT_KEY = 'hx:drift';
const DRIFT_DAYS = 365;        /* сорванная запись бывает и на окне будущего года */
const DRIFT_TOL = 0.01;        /* 1% — округления каналов не считаем расхождением */
const DRIFT_MIN_DATES = 3;     /* одна-две даты — это ручная правка, не сбой */

/* Порог доверия: чинить цену по каналам можно только там, где наш листинг с
   ними обычно согласен. Вилла со своей ровной ставкой согласия не наберёт, и
   её ставку мы не тронем. */
const HEAL_AGREE = 0.7;
/* Разница больше половины — это не сорванная запись, а другая цена. */
const HEAL_MAX = 0.5;

export async function checkDrift(env) {
  let chans = await loadChannels(env, false);
  /* карта каналов в KV может быть от прошлой версии, где лежал только базовый
     листинг: без остальных каналов сверять не с чем */
  if (!Object.keys(chans).some((v) => (chans[v].all || []).length > 1)) {
    chans = await loadChannels(env, true);
  }
  const villas = Object.keys(chans);
  if (!villas.length) return null;

  const listings = [];
  const seen = {};
  for (const villa of villas) {
    for (const c of (chans[villa].all || [chans[villa]])) {
      const k = c.channel_type + '|' + c.listing_id;
      if (seen[k]) continue;
      seen[k] = true;
      listings.push({ channel_type: c.channel_type, listing_id: c.listing_id });
    }
  }
  if (listings.length < 2) return null;

  const from = today();
  const to = addDays(from, DRIFT_DAYS);
  const d = await api(env, '/listings/calendar', {
    method: 'POST',
    body: { start_date: from, end_date: to, listings }
  });

  const byListing = {};
  for (const l of (d.listings || [])) {
    const days = {};
    for (const c of (l.calendar || [])) {
      const p = Number(c.price) || 0;
      if (p > 0) days[c.date] = p;
    }
    byListing[l.listing_id] = days;
  }

  const out = {};
  for (const villa of villas) {
    const c = chans[villa];
    const base = byListing[c.listing_id];
    const others = (c.all || []).filter((x) => x.listing_id !== c.listing_id);
    if (!base || !others.length) continue;

    const dates = [];
    let agreed = 0, compared = 0;
    const heal = {};
    for (const date of Object.keys(base).sort()) {
      /* к базовой ставке приводим каждый канал по его ratio */
      const want = [];
      for (const o of others) {
        const days = byListing[o.listing_id];
        const p = days && days[date];
        if (p) want.push(toBase(p, o.ratio));
      }
      if (want.length < 2) continue;

      /* берём медиану остальных каналов: один канал с ручной правкой не должен
         объявлять сбоем всё окно */
      want.sort((a, b) => a - b);
      const med = want[Math.floor(want.length / 2)];
      const mine = toBase(base[date], c.ratio);
      if (!med || !mine) continue;

      compared++;
      const off = Math.abs(mine - med) / med;
      if (off <= DRIFT_TOL) { agreed++; continue; }

      dates.push({ date, ours: mine, channels: med });
      /* Поправку держим отдельно: применять её или нет, решаем ниже, когда
         посчитаем согласие по всему году. */
      /* храним и то, что сейчас лежит у нас: как только Hostex допишет цену,
         поправка перестанет подходить и применяться */
      if (want.length >= 2 && off <= HEAL_MAX) heal[date] = [med, mine];
    }

    const agree = compared ? agreed / compared : 0;
    const canHeal = agree >= HEAL_AGREE && Object.keys(heal).length > 0;

    if (dates.length >= DRIFT_MIN_DATES) {
      /* разброс расхождения: ровный процент на сотне дат — это чаще разная
         модель цены (фикс на нашем листинге), а скачок на куске окна — сбитая
         запись. Отдаём и то и другое, решает человек. */
      const pcts = dates.map((x) => (x.ours - x.channels) / x.channels * 100);
      const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      out[villa] = {
        n: dates.length,
        from: dates[0].date,
        to: dates[dates.length - 1].date,
        ours: dates[0].ours,
        channels: dates[0].channels,
        agree: Math.round(agree * 100),
        /* цены, которыми сайт подменит отставшие: пусто, если это не сбой
           записи, а своя ставка виллы */
        heal: canHeal ? heal : null,
        healed: canHeal ? Object.keys(heal).length : 0,
        pct: Math.round(avg * 10) / 10,
        pctMin: Math.round(Math.min.apply(null, pcts) * 10) / 10,
        pctMax: Math.round(Math.max.apply(null, pcts) * 10) / 10,
        baseChannel: c.channel_type,
        others: others.map((o) => o.channel_type + ':' + o.ratio).join(', ')
      };
    }
  }

  const rec = { ts: Date.now(), villas: out, checked: villas.length };
  try { await env.THB_STATS.put(DRIFT_KEY, JSON.stringify(rec)); } catch (e) {}
  return rec;
}

export async function readDrift(env) {
  try { return JSON.parse(await env.THB_STATS.get(DRIFT_KEY) || 'null'); }
  catch (e) { return null; }
}

/* Расчёт на выбранные даты.
 *
 * Идём в Hostex живьём, а не в зеркало: цену двигает PriceLabs, и на экране
 * бронирования гость должен видеть ту же цифру, что стоит в кабинете сейчас.
 * Короткий кэш в KV защищает от перебора дат, лимит по IP стоит в index.js.
 *
 * Уборки и налогов Open API не отдаёт — в Hostex они настроены на стороне
 * каналов. Поэтому в счёте только ночи: показать выдуманный сбор хуже, чем не
 * показать никакого.
 */
export async function quote(env, villa, checkIn, checkOut, guests) {
  const link = linkOf(villa);
  if (!link) return null;

  const g = Math.max(1, Math.min(30, Number(guests) || 1));
  const k = quoteKey(villa, checkIn, checkOut);

  try {
    const hit = JSON.parse(await env.THB_STATS.get(k) || 'null');
    if (hit) return { ...hit, guests: g };
  } catch (e) {}

  const chans = await loadChannels(env, false);
  const c = chans[villa];
  if (!c) return null;

  const cal = await fetchCalendar(env, { [villa]: c }, checkIn, checkOut);
  const days = cal[c.listing_id] || {};

  /* Те же поправки, что и в зеркале: иначе каталог показывал бы цену каналов,
     а страница виллы — отставшую цену нашего листинга. */
  let fix = null;
  try {
    const dr = JSON.parse(await env.THB_STATS.get(DRIFT_KEY) || 'null');
    fix = ((dr && dr.villas && dr.villas[villa]) || {}).heal || null;
  } catch (e) {}

  let rent = 0, priced = 0, healed = 0;
  for (const d of nightsBetween(checkIn, checkOut)) {
    const day = days[d];
    if (!day || !day.price) continue;
    const live = toBase(day.price, c.ratio);
    const h = fix && fix[d];
    const use = h && h[1] === live ? h[0] : live;
    if (use !== live) healed++;
    rent += use;
    priced++;
  }

  /* Ни одной ночи с ценой — объект снят с продажи или даты за горизонтом.
     Отдаём null: пусть страница покажет «по запросу», а не ноль рупий. */
  if (!priced) return null;

  const out = {
    villa,
    checkIn,
    checkOut,
    guests: g,
    currency: sign('IDR'),
    nights: priced,
    minStay: (days[checkIn] && days[checkIn].minStay) || 0,
    rent,
    healed,
    cleaningFee: 0,
    taxes: 0,
    total: rent,
    perNight: Math.round(rent / priced),
    ts: Date.now()
  };

  try { await env.THB_STATS.put(k, JSON.stringify(out), { expirationTtl: QUOTE_TTL_SEC }); }
  catch (e) {}

  return out;
}

/* ---------- панель ---------- */

export async function status(env) {
  let meta = {};
  try { meta = JSON.parse(await env.THB_STATS.get(META) || '{}'); } catch (e) {}

  /* последний отчёт сторожа цен: какие виллы разошлись с каналами и где сайт
     показывает цену каналов вместо отставшей */
  let drift = null;
  try {
    const d = JSON.parse(await env.THB_STATS.get(DRIFT_KEY) || 'null');
    if (d) {
      drift = { ts: d.ts, villas: {} };
      for (const v of Object.keys(d.villas || {})) {
        const x = d.villas[v];
        drift.villas[v] = { n: x.n, from: x.from, to: x.to, pct: x.pct,
                            agree: x.agree, healed: x.healed };
      }
    }
  } catch (e) {}

  let chans = {};
  try { chans = (JSON.parse(await env.THB_STATS.get(CHANNELS) || '{}') || {}).map || {}; }
  catch (e) {}

  const from = today();
  const to = addDays(from, 90);
  const staleAfter = SYNC_EVERY_MIN * 60000 * 2.5;

  const links = [];
  for (const link of LINKS) {
    const rec = await readMirror(env, link.villa);
    const price = await readPrices(env, link.villa);
    const age = rec ? Date.now() - (rec.lastOkTs || 0) : Infinity;

    let state = 'off';                       /* серая связка: объекта нет */
    if (link.pid) {
      if (!rec) state = 'wait';              /* связан, но ни разу не опрошен */
      else if (rec.ok && age < staleAfter) state = 'live';
      else if (rec.lastOkTs && age < staleAfter * 4) state = 'stale';
      else state = 'down';
    }

    const c = chans[link.villa] || null;

    links.push({
      villa: link.villa,
      hx: link.hx,
      pid: link.pid,
      linked: !!link.pid,
      state,
      error: rec ? rec.error : null,
      checkedAt: rec ? rec.ts : 0,
      lastOkTs: rec ? rec.lastOkTs || 0 : 0,
      busyNights90: rec ? (rec.nights || []).filter((d) => d >= from && d < to).length : 0,
      booked: rec ? rec.booked || 0 : 0,
      blocked: rec ? rec.blocked || 0 : 0,
      closed: rec ? rec.closed || 0 : 0,
      closedTail: rec ? rec.closedTail || null : null,
      price: price && price.ok ? price.price : 0,
      currency: price ? price.currency : '',
      channel: c ? c.channel_type : null,
      ratio: c ? c.ratio : null,
      /* сколько дат показываем по ценам каналов: Hostex не дописал их на наш
         листинг, сайт подставил сам (см. checkDrift) */
      healed: price ? price.healed || 0 : 0
    });
  }

  return {
    everyMin: SYNC_EVERY_MIN,
    lastRunTs: meta.ts || 0,
    nextRunTs: (meta.ts || 0) + SYNC_EVERY_MIN * 60000,
    lastError: meta.error || null,
    links,
    live: links.filter((l) => l.state === 'live').length,
    priced: links.filter((l) => l.price > 0).length,
    total: links.length,
    healed: links.reduce((n, l) => n + (l.healed || 0), 0),
    drift
  };
}
