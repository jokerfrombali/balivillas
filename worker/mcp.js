/* MCP-сервер The Host Bali.
 *
 * Единый слой доступа к данным для агентов: объекты сайта, занятость и цены из
 * зеркала Hostex, группы Facebook с их правилами и журнал публикаций. Нужен,
 * чтобы агент не ходил по страницам сайта и календарям глазами, а спрашивал
 * инструментом: какие виллы свободны в октябре, что за объект в Умаласе, когда
 * в эту группу можно публиковать снова.
 *
 * Транспорт — MCP over HTTP: POST /mcp с телом JSON-RPC 2.0. Отвечаем обычным
 * JSON, без SSE: все наши инструменты отвечают за один заход, поток не нужен.
 *
 * Доступ по токену (секрет MCP_TOKEN). Без него ручка отвечает 503: сервер,
 * который пишет в журнал и правит группы, открытым быть не должен.
 *
 * Hostex, как и везде, только на чтение.
 */

import { allBasePrices, busyNights, rangeQuotes } from './hostex.js';
import { listGroups, upsertGroup, deleteGroup, listPosts, savePost, deletePost, postingPlan } from './fbdata.js';

const NAME = 'thehostbali';
const VERSION = '1.0.0';
const PROTOCOL = '2024-11-05';
const SITE = 'https://thehostbali.com';
const WA = '6285746499697';

/* ---------- данные сайта ---------- */

async function json(env, path) {
  const r = await env.ASSETS.fetch(new Request(SITE + path));
  if (!r.ok) throw new Error('assets_' + r.status);
  return r.json();
}

const money = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

async function rentals(env) {
  const [list, prices] = await Promise.all([
    json(env, '/data/villas.json'),
    allBasePrices(env).catch(() => ({}))
  ]);
  return (list || []).map((v) => {
    const p = prices[v.id] || null;
    return {
      id: v.id,
      kind: 'rent',
      name: v.name,
      area: v.area,
      areaSlug: v.areaSlug,
      bedrooms: Number(v.bedrooms) || null,
      bathrooms: v.bathrooms || null,
      guests: Number(v.guests) || null,
      address: v.address || null,
      /* цена «от» за ночь из зеркала Hostex; null — объекта в Hostex нет и
         цену придётся спрашивать у команды, выдумывать её нельзя */
      priceFromPerNight: p && p.price ? p.price : null,
      currency: p ? p.currency : 'Rp',
      minStay: p ? p.minStay || null : null,
      maxGuests: p ? p.maxGuests || null : null,
      hostexLinked: !!p,
      url: SITE + (v.url || '/villa/' + v.slug + '/'),
      gallery: v.galleryUrl ? SITE + v.galleryUrl : null,
      photo: v.cardImage ? SITE + v.cardImage : null,
      photos: (v.images || []).slice(0, 12).map((x) => SITE + x),
      airbnb: v.airbnbUrl || null,
      booking: v.bookingUrl || null,
      lat: v.lat, lng: v.lng,
      description: v.description || ''
    };
  });
}

async function sales(env) {
  const [list, villas] = await Promise.all([
    json(env, '/data/for-sale.json'),
    json(env, '/data/villas.json').catch(() => [])
  ]);

  /* У пяти объектов продажи своих фото нет: это те же дома, что мы сдаём, и
     карточка на сайте берёт снимки у виллы. Агенту для объявления фото нужны,
     поэтому подставляем их из аренды по villaId. */
  const byVilla = {};
  for (const v of (villas || [])) byVilla[v.id] = v;

  return (list || []).map((s) => {
    const src = s.villaId ? byVilla[s.villaId] : null;
    const imgs = (s.images && s.images.length) ? s.images
               : (src ? (src.images || []) : []);
    const card = s.cardImage || (src ? src.cardImage : null);
    return ({
    id: s.id,
    kind: 'sale',
    ref: s.ref,
    name: s.shortName || s.name,
    fullName: s.name,
    area: s.area,
    areaSlug: s.areaSlug,
    status: s.status,
    priceUsd: s.priceUsd || null,
    ownership: s.ownership || null,
    leaseUntil: s.leaseUntil || null,
    bedrooms: Number(s.bedrooms) || null,
    bathrooms: Number(s.bathrooms) || null,
    landSqm: s.landSqm || null,
    buildingSqm: s.buildingSqm || null,
    address: s.address || null,
    rentalVillaId: s.villaId || null,      /* та же вилла в аренде, если сдаётся */
    url: SITE + '/villas-for-sale/' + s.slug + '/',
    photo: card ? SITE + card : null,
    photos: imgs.slice(0, 12).map((x) => SITE + x),
    income: s.income || null,
    legal: s.legal || null,
    description: s.description || ''
  });
  });
}

async function allProperties(env) {
  const [r, s] = await Promise.all([rentals(env), sales(env)]);
  return r.concat(s);
}

function waLink(text) {
  return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
}

/* ---------- инструменты ---------- */

const TOOLS = [
  {
    name: 'list_properties',
    description: 'Список объектов The Host Bali: аренда и продажа. Фильтры по типу, ' +
      'району, числу спален, цене и статусу. Для аренды отдаёт цену «от» за ночь из ' +
      'календаря Hostex, для продажи — цену объекта.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['rent', 'sale', 'all'], description: 'по умолчанию all' },
        area: { type: 'string', description: 'sanur | canggu | umalas | ungasan' },
        minBedrooms: { type: 'number' },
        maxBedrooms: { type: 'number' },
        maxPricePerNight: { type: 'number', description: 'для аренды, в рупиях' },
        maxPriceUsd: { type: 'number', description: 'для продажи, в долларах' },
        status: { type: 'string', description: 'для продажи: available | reserved | sold' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'get_property',
    description: 'Полная карточка объекта по id или адресу страницы: описание, фото, ' +
      'условия, ссылка на галерею и готовый текст запроса в WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id объекта, например own-villa-kesari-4-3br-pool-villa-sanur или sale-villa-sakura' },
        url: { type: 'string', description: 'адрес страницы объекта' }
      }
    }
  },
  {
    name: 'check_availability',
    description: 'Свободен ли объект на даты. Занятость и цены берутся из зеркала ' +
      'календаря Hostex, которое обновляется каждые полчаса. Отдаёт свободно/занято, ' +
      'минимальный срок на эти даты и сумму за период.',
    inputSchema: {
      type: 'object',
      properties: {
        propertyId: { type: 'string', description: 'id виллы в аренде' },
        from: { type: 'string', description: 'дата заезда, YYYY-MM-DD' },
        to: { type: 'string', description: 'дата выезда, YYYY-MM-DD' }
      },
      required: ['propertyId', 'from', 'to']
    }
  },
  {
    name: 'find_available',
    description: 'Какие виллы свободны на даты. То же, что check_availability, но сразу ' +
      'по всем объектам аренды: список свободных с суммой за период и список занятых.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
        area: { type: 'string' },
        minBedrooms: { type: 'number' },
        guests: { type: 'number' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'list_facebook_groups',
    description: 'Группы Facebook, где мы публикуем объявления, с их правилами: как ' +
      'часто можно постить, можно ли оставлять WhatsApp, можно ли поднимать пост, ' +
      'надо ли удалять предыдущий.',
    inputSchema: {
      type: 'object',
      properties: { activeOnly: { type: 'boolean' } }
    }
  },
  {
    name: 'upsert_facebook_group',
    description: 'Добавить группу или поправить её правила. Что не передано, остаётся ' +
      'прежним; неизвестное правило лучше оставить пустым, чем выдумать.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'если не передан, соберётся из url или названия' },
        name: { type: 'string' },
        url: { type: 'string' },
        members: { type: 'number' },
        language: { type: 'string' },
        area: { type: 'string' },
        kind: { type: 'string', enum: ['rent', 'sale', 'any'] },
        active: { type: 'boolean' },
        intervalDays: { type: 'number', description: 'раз в сколько дней можно публиковать' },
        whatsappAllowed: { type: 'boolean' },
        bumpAllowed: { type: 'boolean' },
        deleteOld: { type: 'boolean' },
        priceRequired: { type: 'boolean' },
        notes: { type: 'string' }
      }
    }
  },
  {
    name: 'delete_facebook_group',
    description: 'Убрать группу из списка. Если группу просто перестали вести, лучше ' +
      'поставить active: false через upsert_facebook_group: журнал по ней останется.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'delete_post',
    description: 'Убрать запись из журнала публикаций по её id. Нужна для исправления ' +
      'ошибок; удалённый в Facebook пост правильнее отмечать статусом removed.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'get_posting_plan',
    description: 'Что можно публиковать сегодня и почему нельзя остальное: по каждой ' +
      'группе — можно или нет, причина, дата следующей возможной публикации и ' +
      'последний пост из журнала.',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, по умолчанию сегодня' } }
    }
  },
  {
    name: 'save_post_result',
    description: 'Записать результат публикации в журнал: группа, объект, ссылка на ' +
      'пост, статус и заметка модерации. По этому журналу считается, когда в группу ' +
      'можно писать снова.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        propertyId: { type: 'string' },
        url: { type: 'string', description: 'ссылка на пост' },
        status: { type: 'string', enum: ['posted', 'removed', 'rejected', 'pending'] },
        note: { type: 'string' },
        postedAt: { type: 'string', description: 'ISO-время, по умолчанию сейчас' }
      },
      required: ['groupId']
    }
  },
  {
    name: 'list_posts',
    description: 'Журнал публикаций: что и когда публиковали, с фильтрами по группе, ' +
      'объекту и дате.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        propertyId: { type: 'string' },
        since: { type: 'string', description: 'ISO-дата' },
        limit: { type: 'number' }
      }
    }
  }
];

/* ---------- выполнение ---------- */

async function call(env, name, args) {
  const a = args || {};

  if (name === 'list_properties') {
    const kind = a.kind || 'all';
    let list = kind === 'rent' ? await rentals(env)
             : kind === 'sale' ? await sales(env)
             : await allProperties(env);

    if (a.area) list = list.filter((x) => (x.areaSlug || '').toLowerCase() === String(a.area).toLowerCase());
    if (a.minBedrooms) list = list.filter((x) => (x.bedrooms || 0) >= a.minBedrooms);
    if (a.maxBedrooms) list = list.filter((x) => (x.bedrooms || 0) <= a.maxBedrooms);
    if (a.maxPricePerNight) list = list.filter((x) => x.kind !== 'rent' || (x.priceFromPerNight && x.priceFromPerNight <= a.maxPricePerNight));
    if (a.maxPriceUsd) list = list.filter((x) => x.kind !== 'sale' || (x.priceUsd && x.priceUsd <= a.maxPriceUsd));
    if (a.status) list = list.filter((x) => x.kind !== 'sale' || x.status === a.status);
    if (a.limit) list = list.slice(0, a.limit);

    /* в списке держим короткую карточку: полную отдаёт get_property */
    return {
      total: list.length,
      properties: list.map((x) => ({
        id: x.id, kind: x.kind, name: x.name, area: x.area,
        bedrooms: x.bedrooms, guests: x.guests,
        priceFromPerNight: x.priceFromPerNight, priceUsd: x.priceUsd,
        currency: x.currency, status: x.status, hostexLinked: x.hostexLinked,
        url: x.url, photo: x.photo
      }))
    };
  }

  if (name === 'get_property') {
    const all = await allProperties(env);
    const key = String(a.id || a.url || '').replace(/\/+$/, '');
    const one = all.filter((x) => x.id === key || x.url.replace(/\/+$/, '') === key ||
                                  x.url.replace(/\/+$/, '').endsWith(key))[0];
    if (!one) return { error: 'not_found', hint: 'сначала list_properties' };

    const text = one.kind === 'sale'
      ? 'Hi The Host Bali! I am interested in ' + one.name + ' (' + one.ref + '). Is it still available?'
      : 'Hi The Host Bali! I am interested in ' + one.name + '. Is it available?';

    return {
      property: one,
      whatsapp: waLink(text),
      /* готовый костяк объявления: цифры берём из карточки, ничего не выдумываем */
      postTemplate: {
        title: one.name,
        line: one.kind === 'sale'
          ? [one.area, one.bedrooms ? one.bedrooms + ' BR' : null,
             one.landSqm ? one.landSqm + ' m² land' : null,
             one.ownership, one.leaseUntil ? 'until ' + one.leaseUntil : null,
             one.priceUsd ? '$' + money(one.priceUsd) : null].filter(Boolean).join(' · ')
          : [one.area, one.bedrooms ? one.bedrooms + ' BR' : null,
             one.guests ? 'sleeps ' + one.guests : null,
             one.priceFromPerNight ? 'from ' + one.currency + ' ' + money(one.priceFromPerNight) + '/night' : null
            ].filter(Boolean).join(' · '),
        url: one.url,
        photos: one.photos
      }
    };
  }

  if (name === 'check_availability') {
    const data = await busyNights(env, a.propertyId, a.from, a.to);
    if (!data) return { error: 'unknown_property_or_not_in_hostex', propertyId: a.propertyId };

    const q = await rangeQuotes(env, a.from, a.to).catch(() => null);
    const all = await rentals(env);
    const one = all.filter((x) => x.id === a.propertyId)[0] || null;
    const priced = q && one ? q.byUrl[one.url.replace(SITE, '')] : null;

    return {
      propertyId: a.propertyId,
      from: a.from, to: a.to,
      available: data.nights.length === 0,
      busyNights: data.nights,
      minStay: one ? one.minStay : null,
      total: priced ? priced.total : null,
      perNight: priced ? priced.perNight : null,
      currency: priced ? priced.currency : 'Rp',
      calendarCheckedAt: data.checkedAt ? new Date(data.checkedAt).toISOString() : null,
      stale: !!data.stale,
      url: one ? one.url : null
    };
  }

  if (name === 'find_available') {
    const [list, q] = await Promise.all([
      rentals(env),
      rangeQuotes(env, a.from, a.to).catch(() => null)
    ]);

    let pool = list;
    if (a.area) pool = pool.filter((x) => (x.areaSlug || '').toLowerCase() === String(a.area).toLowerCase());
    if (a.minBedrooms) pool = pool.filter((x) => (x.bedrooms || 0) >= a.minBedrooms);
    if (a.guests) pool = pool.filter((x) => (x.guests || 0) >= a.guests);

    const free = [], busy = [], unknown = [];
    for (const v of pool) {
      const data = await busyNights(env, v.id, a.from, a.to);
      if (!data) { unknown.push({ id: v.id, name: v.name, url: v.url, why: 'объекта нет в Hostex, даты по запросу' }); continue; }
      const priced = q ? q.byUrl[v.url.replace(SITE, '')] : null;
      const row = {
        id: v.id, name: v.name, area: v.area, bedrooms: v.bedrooms, guests: v.guests,
        url: v.url, photo: v.photo,
        total: priced ? priced.total : null,
        perNight: priced ? priced.perNight : null,
        currency: priced ? priced.currency : 'Rp',
        minStay: v.minStay
      };
      if (data.nights.length) { row.busyNights = data.nights; busy.push(row); }
      else free.push(row);
    }
    free.sort((x, y) => (x.total || 0) - (y.total || 0));

    return { from: a.from, to: a.to, free, busy, unknown };
  }

  if (name === 'list_facebook_groups') {
    const list = await listGroups(env);
    const out = a.activeOnly ? list.filter((g) => g.active) : list;
    return { total: out.length, groups: out };
  }

  if (name === 'upsert_facebook_group') return { group: await upsertGroup(env, a) };

  if (name === 'delete_facebook_group') return { deleted: await deleteGroup(env, a.id) };

  if (name === 'delete_post') return { deleted: await deletePost(env, a.id) };

  if (name === 'get_posting_plan') return await postingPlan(env, a.date);

  if (name === 'save_post_result') return { post: await savePost(env, a) };

  if (name === 'list_posts') {
    const list = await listPosts(env, a);
    return { total: list.length, posts: a.limit ? list.slice(0, a.limit) : list.slice(0, 200) };
  }

  throw new Error('unknown tool: ' + name);
}

/* ---------- транспорт ---------- */

function rpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function res(body, status) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization, mcp-session-id',
      'access-control-allow-methods': 'POST, GET, OPTIONS'
    }
  });
}

export async function handleMcp(req, env) {
  if (req.method === 'OPTIONS') return res(null, 204);

  const token = env.MCP_TOKEN;
  if (!token) {
    return res({ error: 'mcp_not_configured',
                 hint: 'задайте секрет MCP_TOKEN: npx wrangler secret put MCP_TOKEN' }, 503);
  }

  const auth = req.headers.get('authorization') || '';
  const given = auth.replace(/^Bearer\s+/i, '').trim();
  if (given !== token) return res({ error: 'unauthorized' }, 401);

  /* GET — на streamable HTTP это подписка на события сервера. Событий мы не
     шлём, поэтому честно отвечаем, что метод не поддержан. */
  if (req.method !== 'POST') return res({ error: 'method_not_allowed' }, 405);

  let body;
  try { body = await req.json(); } catch (e) { return res(rpcError(null, -32700, 'parse error')); }

  const one = async (msg) => {
    const id = msg && msg.id != null ? msg.id : null;
    const method = msg && msg.method;

    if (method === 'initialize') {
      return rpc(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: NAME, version: VERSION },
        instructions: 'Данные The Host Bali: объекты аренды и продажи, занятость и ' +
          'цены из зеркала Hostex, группы Facebook с правилами и журнал публикаций. ' +
          'Hostex только на чтение: брони и цены отсюда не меняются.'
      });
    }

    if (method === 'notifications/initialized' || method === 'notifications/cancelled') return null;
    if (method === 'ping') return rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS });

    if (method === 'resources/list') return rpc(id, { resources: [] });
    if (method === 'prompts/list') return rpc(id, { prompts: [] });

    if (method === 'tools/call') {
      const p = msg.params || {};
      try {
        const out = await call(env, p.name, p.arguments);
        return rpc(id, {
          content: [{ type: 'text', text: JSON.stringify(out, null, 1) }],
          isError: false
        });
      } catch (e) {
        return rpc(id, {
          content: [{ type: 'text', text: 'ошибка: ' + String(e && e.message || e) }],
          isError: true
        });
      }
    }

    return rpcError(id, -32601, 'method not found: ' + method);
  };

  if (Array.isArray(body)) {
    const out = [];
    for (const m of body) {
      const r = await one(m);
      if (r) out.push(r);
    }
    return out.length ? res(out) : res(null, 202);
  }

  const out = await one(body);
  return out ? res(out) : res(null, 202);
}
