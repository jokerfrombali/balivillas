/* Курсы валют для конвертации цен на сайте.
 *
 * Цены в Hostex и на сайте — в рупиях, а половина гостей их не читает: «Rp
 * 4,800,000» ни о чём не говорит человеку из Сиднея или Лондона. Поэтому в
 * шапке есть выбор валюты, а числа пересчитываются на лету.
 *
 * Курсы берём у open.er-api.com: без ключа, обновляется раз в сутки. Запрос
 * идёт с базой USD, а не IDR: в ответе с базой IDR курс округлён до двух
 * значащих цифр (0.000057 USD), это полпроцента ошибки на ровном месте.
 * С базой USD получаем IDR = 17628.6168 и считаем сами.
 *
 * Ходим не чаще раза в 12 часов и держим ответ в KV. Если источник молчит —
 * отдаём последний удачный: устаревший на день курс лучше, чем цена, которая
 * пропала с карточки.
 *
 * Мы ничего не продаём в этих валютах: это справочный пересчёт, счёт всё равно
 * в рупиях. Так и подписано в переключателе.
 */

const SRC = 'https://open.er-api.com/v6/latest/USD';
const KEY = 'fx:rates';
const TTL_MS = 12 * 3600 * 1000;

/* Топ-валюты гостей Бали: Австралия, Индия, Китай, Сингапур, Малайзия, Корея,
   Британия, США, Япония, Тайвань, Таиланд, Россия, Новая Зеландия плюс евро и
   сама рупия. */
export const CODES = ['IDR', 'USD', 'EUR', 'AUD', 'GBP', 'SGD', 'MYR',
                      'INR', 'CNY', 'JPY', 'KRW', 'RUB', 'THB', 'TWD', 'NZD'];

/* Страна гостя -> валюта, которую ему показать по умолчанию. Cloudflare отдаёт
   код страны в request.cf.country, ключ не нужен. */
const BY_COUNTRY = {
  ID: 'IDR', AU: 'AUD', NZ: 'NZD', US: 'USD', CA: 'USD',
  GB: 'GBP', SG: 'SGD', MY: 'MYR', IN: 'INR', CN: 'CNY', HK: 'CNY',
  JP: 'JPY', KR: 'KRW', RU: 'RUB', BY: 'RUB', KZ: 'RUB', TH: 'THB', TW: 'TWD',
  DE: 'EUR', FR: 'EUR', NL: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', AT: 'EUR',
  IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR',
  LV: 'EUR', LT: 'EUR', LU: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR'
};

async function fetchRates() {
  const res = await fetch(SRC, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new Error('http_' + res.status);

  const d = await res.json();
  if (d.result !== 'success' || !d.rates || !d.rates.IDR) throw new Error('bad_payload');

  const idrPerUsd = Number(d.rates.IDR);
  const out = {};
  for (const code of CODES) {
    const perUsd = Number(d.rates[code]);
    if (!perUsd) continue;
    out[code] = perUsd / idrPerUsd;      /* сколько валюты в одной рупии */
  }
  out.IDR = 1;

  return { ts: Date.now(), source: d.time_last_update_utc || '', rates: out };
}

export async function fxRates(env, force) {
  let cached = null;
  try { cached = JSON.parse(await env.THB_STATS.get(KEY) || 'null'); } catch (e) {}

  if (!force && cached && cached.rates && Date.now() - (cached.ts || 0) < TTL_MS) return cached;

  try {
    const fresh = await fetchRates();
    await env.THB_STATS.put(KEY, JSON.stringify(fresh));
    return fresh;
  } catch (e) {
    /* источник недоступен — отдаём последний удачный, пометив возрастом */
    if (cached && cached.rates) return cached;
    throw e;
  }
}

/* Валюта по стране гостя. Не нашли страну — рупия, как на самом сайте. */
export function suggest(country) {
  return BY_COUNTRY[String(country || '').toUpperCase()] || 'IDR';
}
