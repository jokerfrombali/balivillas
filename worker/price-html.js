/* Цена в самом HTML, а не только в браузере.
 *
 * Раньше в разметке везде стояло «On request», а настоящую цену подставлял
 * thb-cards.js уже на странице. Для гостя это работало, а для машин — нет:
 * Googlebot JavaScript выполняет, а GPTBot, ClaudeBot, PerplexityBot и CCBot
 * забирают HTML как есть и видели «цена по запросу». То есть на вопрос
 * «сколько стоит вилла в Сануре» у ассистента не было нашей цифры вообще, при
 * том что у Airbnb и Booking она есть.
 *
 * Поэтому цену вшиваем на выдаче через HTMLRewriter: одно чтение KV на запрос,
 * дальше поток переписывается на лету, без буферизации страницы.
 *
 * Цифра — минимальная цена за ночь по свободным ночам ближайших 90 дней из
 * Hostex (см. worker/hostex.js). Своей арифметики тут нет.
 *
 * thb-cards.js и thb-price.js никуда не делись: они по-прежнему уточняют цену
 * на выбранные даты. Числа те же, просто теперь первая отрисовка не пустая.
 */

import { readAllPrices } from './hostex.js';

/* «4800000» -> «4,800,000»: так же, как печатает Hostex в кабинете. */
function money(cur, n) {
  return cur + ' ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* Адрес виллы из onclick карточки каталога: window.location='/villa/...'. */
function urlFromOnclick(v) {
  const m = /window\.location='([^']+)'/.exec(v || '');
  return m ? m[1].split('?')[0] : null;
}

/* адреса в карточках итальянских страниц начинаются с /it/ — цены те же */
import { STRIP } from './langs.js';

const norm = (u) => (u || '').split('?')[0].split('#')[0].replace(STRIP, '');

export async function injectPrices(res, env, pathname, lang) {
  /* подписи к ценам: на итальянских близнецах (/it/) — по-итальянски */
  const IT = lang === 'it';
  const W = IT
    ? { from: 'da ', per: 'a notte', onreq: 'Su richiesta', min: ' · soggiorno minimo ', nights: ' notti' }
    : { from: 'from ', per: 'per night', onreq: 'On request', min: ' · minimum stay ', nights: ' nights' };
  const byUrl = await readAllPrices(env);
  if (!byUrl) return res;

  /* Состояние обхода: HTMLRewriter идёт по документу последовательно, поэтому
     достаточно помнить, внутри какой карточки мы сейчас. */
  let card = null;

  const own = byUrl[norm(pathname)] || null;   /* страница самой виллы */

  const setCard = (url) => { card = byUrl[norm(url)] || null; };

  /* «Rp 1,939,170» без подписи читается как цена за что угодно — за неделю,
     за виллу целиком. Дописываем «per night» тем же мелким шрифтом, каким это
     делает thb-cards.js, но стилем в самом теге: карточка не должна зависеть
     от того, загрузился ли скрипт. */
  const PER = '<span style="font-size:13px;font-weight:400;color:#706b61;' +
              'margin-left:5px;letter-spacing:0;font-family:inherit">' + W.per + '</span>';

  const cardText = (t) => {
    if (!card) return;
    if (t.text.indexOf('On request') < 0 && t.text.indexOf(W.onreq) < 0) return;
    t.replace(W.from + money(card.currency, card.price) + PER + ' ', { html: true });
  };

  return new HTMLRewriter()
    /* карточки главной: адрес в href */
    .on('a.thb-acard', { element(el) { setCard(el.getAttribute('href')); } })
    .on('a.thb-acard p.p', { text: cardText })

    /* карточки каталога и подборок по районам: адрес в onclick */
    .on('div.prop-card', { element(el) { setCard(urlFromOnclick(el.getAttribute('onclick'))); } })
    .on('div.prop-card span', { text: cardText })

    /* страница виллы: нижняя панель и заголовок карточки брони */
    .on('#thbBookBar strong', {
      text(t) {
        if (!own || (t.text.indexOf('Prices on request') < 0 && t.text.indexOf('Prezzi su richiesta') < 0)) return;
        t.replace(W.from + money(own.currency, own.price) + ' ' + W.per, { html: false });
      }
    })
    .on('[data-slot="booking-panel-header"]', {
      text(t) {
        if (!own || (t.text.indexOf('Select dates for pricing') < 0 && t.text.indexOf('Scegli le date per vedere il prezzo') < 0)) return;
        t.replace(W.from + money(own.currency, own.price) + ' ' + W.per, { html: false });
      }
    })
    .on('#selectedDateRange', {
      text(t) {
        if (!own || (t.text.indexOf('Select dates for pricing') < 0 && t.text.indexOf('Scegli le date per vedere il prezzo') < 0)) return;
        t.replace(W.from + money(own.currency, own.price) + ' ' + W.per +
                  (own.minStay > 1 ? W.min + own.minStay + W.nights : ''),
                  { html: false });
      }
    })
    .on('button[aria-label="Select dates"] span.text-secondary, button[aria-label="Scegli le date"] span.text-secondary', {
      text(t) {
        if (!own || (t.text.indexOf('Prices on request') < 0 && t.text.indexOf('Prezzi su richiesta') < 0)) return;
        t.replace(W.from + money(own.currency, own.price) + ' ' + W.per, { html: false });
      }
    })
    .transform(res);
}
