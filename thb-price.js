/* Цены на странице виллы — данные Hostex, вёрстка наша.
 *
 * Числа берём только через наш же воркер (/api/price и /api/quote) и рисуем
 * так, как рисуют Airbnb и Booking: цена за ночь сверху, разбивка по ночам над
 * кнопкой. Ставку в Hostex двигает PriceLabs, поэтому цена на выбранные даты
 * приходит живым запросом, а не из вчерашнего кэша.
 *
 * Уборку и налоги Open API Hostex не отдаёт — они настроены на стороне
 * каналов. Поэтому в разбивке только ночи: показать выдуманный сбор хуже, чем
 * не показать никакого.
 *
 * Бронирование остаётся заявкой. Кнопка как была ведёт в POST /api/lead —
 * в Hostex этот файл ничего не создаёт и не меняет.
 *
 * Даты берём из разметки календаря (.range-start / .range-end), а не из
 * внутренних переменных страницы: разметка стабильнее замыканий.
 */
(function () {
  'use strict';

  var panel = document.querySelector('[data-slot="booking-panel"]');
  var sec = document.getElementById('section-availability');
  if (!panel || !sec) return;

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  var BASE = null;      /* { price, currency, minStay, maxGuests } */
  var lastKey = '';

  /* ---------- стиль ---------- */
  var st = document.createElement('style');
  st.textContent =
    '.thb-price-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}' +
    '.thb-price-head b{font-size:22px;font-weight:600;letter-spacing:-.01em}' +
    '.thb-price-head span{font-size:15px;color:#706b61}' +
    '.thb-price-sub{margin-top:2px;font-size:13px;color:#8a8378}' +
    '.thb-bill{display:flex;flex-direction:column;gap:10px;font-size:14px;' +
      'color:#3c3831;margin-top:2px}' +
    '.thb-bill-row{display:flex;justify-content:space-between;gap:16px}' +
    '.thb-bill-row u{text-decoration:underline;text-decoration-color:#c9c5bd;' +
      'text-underline-offset:3px}' +
    '.thb-bill-total{display:flex;justify-content:space-between;gap:16px;' +
      'padding-top:12px;border-top:1px solid rgba(0,0,0,.08);font-weight:600}' +
    '.thb-bill-note{font-size:13px;color:#b84a31}' +
    '.thb-bill.is-loading{opacity:.45}';
  document.head.appendChild(st);

  /* ---------- какая это вилла ---------- */
  function villaId() {
    var path = location.pathname.replace(/\/+$/, '');
    var i = path.indexOf('/villa/');
    if (i < 0) return Promise.resolve(null);
    var slug = path.slice(i + 7);

    return fetch('/data/villas.json')
      .then(function (r) { return r.json(); })
      .then(function (list) {
        var hit = (list || []).filter(function (v) { return v.slug === slug; })[0];
        return hit ? hit.id : null;
      })
      .catch(function () { return null; });
  }

  /* ---------- деньги ---------- */
  /* Hostex отдаёт рупии без копеек, и в кабинете они печатаются через запятую —
     держим тот же вид, чтобы цифра на сайте и в кабинете читалась одинаково. */
  function money(v) {
    var n = Math.round(Number(v) || 0);
    var cur = (BASE && BASE.currency) || '';
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return cur ? cur + ' ' + s : s;
  }

  function nightsWord(n) { return n === 1 ? 'night' : 'nights'; }

  /* '2026-09-20' -> 'Sep 20', как подписаны поля дат в карточке */
  function human(d) {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-GB',
        { day: 'numeric', month: 'short' });
    } catch (e) { return d; }
  }

  /* ---------- даты из разметки ---------- */
  function monthOf(title) {
    var parts = String(title || '').trim().split(/\s+/);
    if (parts.length < 2) return null;
    var year = parseInt(parts[parts.length - 1], 10);
    if (!year) return null;
    var m = MONTHS.indexOf(parts[0]);
    if (m < 0) {
      var d = new Date(parts.join(' ') + ' 1');
      if (isNaN(d)) return null;
      return { y: d.getFullYear(), m: d.getMonth() };
    }
    return { y: year, m: m };
  }

  function iso(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  /* Возвращает { from, to } или null. Ищем по всем отрисованным месяцам. */
  function picked() {
    var from = null, to = null;
    var boxes = sec.querySelectorAll('.calendar-month');

    for (var i = 0; i < boxes.length; i++) {
      var t = boxes[i].querySelector('.month-title');
      var when = monthOf(t && t.textContent);
      if (!when) continue;

      var cells = boxes[i].querySelectorAll('.calendar-grid .calendar-day');
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        var day = parseInt(c.textContent, 10);
        if (!day) continue;
        if (c.classList.contains('range-start')) from = iso(when.y, when.m, day);
        if (c.classList.contains('range-end')) to = iso(when.y, when.m, day);
      }
    }

    return from && to && to > from ? { from: from, to: to } : null;
  }

  function guests() {
    var el = document.getElementById('guestNumber');
    var n = el ? parseInt(el.textContent, 10) : 1;
    return n > 0 ? n : 1;
  }

  /* ---------- отрисовка ---------- */
  function header() {
    var h = panel.querySelector('[data-slot="booking-panel-header"]');
    if (!h) return null;
    if (!h.querySelector('.thb-price-head')) h.textContent = '';
    var box = h.querySelector('.thb-price-head');
    if (!box) {
      box = document.createElement('div');
      box.className = 'thb-price-head';
      h.appendChild(box);
      var sub = document.createElement('div');
      sub.className = 'thb-price-sub';
      h.appendChild(sub);
    }
    return h;
  }

  function setHead(amount, per, sub) {
    var h = header();
    if (!h) return;
    h.querySelector('.thb-price-head').innerHTML =
      '<b>' + amount + '</b><span>' + per + '</span>';
    h.querySelector('.thb-price-sub').textContent = sub || '';
  }

  /* ---------- нижняя панель на телефоне ---------- */
  /* На узком экране карточка брони уезжает вниз, и цену гость не видит —
     как и на Airbnb, показываем её в липкой панели рядом с кнопкой.
     Панель рисует сама страница, в ней уже стоит «Prices on request». */
  var barSubDefault = null;

  function barParts() {
    var bar = document.getElementById('thbBookBar');
    if (!bar) return null;
    var box = bar.querySelector('.tbb-i');
    if (!box) return null;
    var top = box.querySelector('strong');
    var sub = box.querySelector('span');
    if (!top) return null;
    if (barSubDefault === null && sub) barSubDefault = sub.textContent;
    return { top: top, sub: sub };
  }

  var barWant = null;

  function paintBar() {
    if (!barWant) return;
    var p = barParts();
    if (!p) return;
    p.top.textContent = barWant.amount;
    if (p.sub) p.sub.textContent = barWant.sub || barSubDefault || '';
  }

  /* Панель монтируется страницей позже нашего первого запроса цены, поэтому
     запомненное значение доносим ещё несколько раз, пока она не появится. */
  function setBar(amount, sub) {
    barWant = { amount: amount, sub: sub };
    paintBar();
    [200, 800, 2000, 4000].forEach(function (ms) { setTimeout(paintBar, ms); });
  }

  function bill() {
    var cta = panel.querySelector('[data-slot="booking-panel-cta"]');
    if (!cta) return null;
    var b = panel.querySelector('.thb-bill');
    if (!b) {
      b = document.createElement('div');
      b.className = 'thb-bill';
      cta.parentNode.insertBefore(b, cta);
    }
    return b;
  }

  function clearBill() {
    var b = panel.querySelector('.thb-bill');
    if (b) b.remove();
  }

  function row(label, value) {
    return '<div class="thb-bill-row"><u>' + label + '</u><span>' + value + '</span></div>';
  }

  function showBase() {
    if (!BASE || !BASE.price) return;
    setHead(money(BASE.price), 'per night',
            BASE.minStay > 1 ? 'Minimum stay: ' + BASE.minStay + ' nights' : '');
    setBar(money(BASE.price) + ' per night', null);
    clearBill();
  }

  function showQuote(q) {
    var n = q.nights || 0;

    if (q.minStay && n < q.minStay) {
      setHead(money(BASE ? BASE.price : q.perNight), 'per night', '');
      setBar(money(BASE ? BASE.price : q.perNight) + ' per night',
             'Minimum stay: ' + q.minStay + ' ' + nightsWord(q.minStay));
      var b0 = bill();
      if (b0) {
        b0.classList.remove('is-loading');
        b0.innerHTML = '<div class="thb-bill-note">Minimum stay for these dates is ' +
                       q.minStay + ' ' + nightsWord(q.minStay) + '.</div>';
      }
      return;
    }

    setHead(money(q.perNight), 'per night', '');
    setBar(money(q.total) + ' total', n + ' ' + nightsWord(n) + ' · ' + human(q.checkIn) +
           ' – ' + human(q.checkOut));

    var b = bill();
    if (!b) return;
    b.classList.remove('is-loading');

    var html = row(money(q.perNight) + ' &times; ' + n + ' ' + nightsWord(n), money(q.rent));
    if (q.cleaningFee) html += row('Cleaning fee', money(q.cleaningFee));
    if (q.taxes) html += row('Taxes', money(q.taxes));
    html += '<div class="thb-bill-total"><span>Total</span><span>' +
            money(q.total) + '</span></div>';
    b.innerHTML = html;
  }

  /* ---------- расчёт ---------- */
  var VILLA = null;
  var timer = null;

  function refresh() {
    if (!VILLA) return;

    var range = picked();
    if (!range) { lastKey = ''; LAST = null; showBase(); return; }

    var g = guests();
    var k = range.from + '|' + range.to + '|' + g;
    if (k === lastKey) return;
    lastKey = k;

    var b = bill();
    if (b) b.classList.add('is-loading');

    var q = '?villa=' + encodeURIComponent(VILLA) +
            '&from=' + range.from + '&to=' + range.to + '&guests=' + g;

    fetch('/api/quote' + q)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (k !== lastKey) return;             /* гость успел поменять даты */
        if (!d || !d.ok) { LAST = null; showBase(); return; }
        LAST = d;
        showQuote(d);
      })
      .catch(function () { showBase(); });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 300);
  }

  /* Последний расчёт наружу — форма заявки берёт отсюда виллу, даты и число
     гостей, чтобы воркер посчитал сумму заново и положил её в Telegram.
     Само число из браузера никуда не отправляем: его легко подделать. */
  var LAST = null;

  window.thbGetPrice = function () {
    if (!VILLA) return null;
    var r = picked();
    return {
      villa: VILLA,
      from: r ? r.from : '',
      to: r ? r.to : '',
      guests: guests(),
      base: BASE ? BASE.price : 0,
      currency: BASE ? BASE.currency : '',
      quote: LAST
    };
  };

  /* ---------- запуск ---------- */
  villaId().then(function (id) {
    if (!id) return;
    VILLA = id;

    return fetch('/api/price?villa=' + encodeURIComponent(id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !d.price) return;
        BASE = d;
        showBase();

        new MutationObserver(schedule).observe(sec, { childList: true, subtree: true });
        panel.addEventListener('click', schedule);
        schedule();
      });
  }).catch(function () { /* нет цены — карточка остаётся как была */ });
})();
