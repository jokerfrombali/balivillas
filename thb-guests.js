/* Гости в карточке бронирования: счётчик прямо в поле, без выпадашки.
 *
 * Как было (замерено на боевой странице Villa Kesari 4):
 *   — кнопка открывала .guest-dropdown, но та стояла position:absolute;top:100%
 *     относительно всей карточки, а не кнопки: кнопка кончается на 854px,
 *     выпадашка появлялась на 1133px. У карточки overflow:clip и низ на 1134px,
 *     поэтому её срезало целиком и выбрать гостей было нельзя;
 *   — нажатие «+» затирало разметку кнопки: до нажатия внутри два span
 *     и шеврон, после — голый текст «2 guests», подпись «Guests» и стрелка
 *     пропадали;
 *   — во всех виллах стояло «Maximum 8 guests», хотя в data/villas.json
 *     у Villa Kesari 4 указано guests: 6.
 *
 * Теперь вместо кнопки-раскрывашки — обычное поле в один ряд с Check-in и
 * Check-out: слева «Guests» и вместимость, справа «−  N  +». Ничего не
 * открывается и не закрывается, нечему и срезаться.
 *
 * Родные #guestMinus / #guestNumber / #guestPlus переносим как есть, вместе
 * с их обработчиками, — счёт остаётся страничным. Саму кнопку и выпадашку
 * не удаляем, а прячем: код страницы продолжает писать в них и не падает.
 *
 * Разметка карточки появляется позже DOMContentLoaded, поэтому сначала ждём.
 */
(function () {
  'use strict';

  var DONE = 'thbGuestsInline';

  waitFor(function () {
    return document.getElementById('guestSelector') &&
           document.getElementById('guestNumber') &&
           document.querySelector('.guest-dropdown');
  }, start, 15000);

  function waitFor(ready, run, limitMs) {
    if (ready()) { run(); return; }
    var obs = new MutationObserver(function () {
      if (!ready()) return;
      obs.disconnect();
      run();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, limitMs);
  }

  function start() {
    if (document.documentElement.dataset[DONE]) return;
    document.documentElement.dataset[DONE] = '1';

    var btn = document.getElementById('guestSelector');
    var drop = document.querySelector('.guest-dropdown');
    var num = document.getElementById('guestNumber');
    var minus = document.getElementById('guestMinus');
    var plus = document.getElementById('guestPlus');
    if (!btn || !drop || !num || !minus || !plus) return;

    /* ---------- стили ---------- */
    var st = document.createElement('style');
    st.textContent = [
      /* прячем и кнопку, и выпадашку: код страницы продолжает с ними работать */
      '#guestSelector,.guest-dropdown{display:none!important}',
      '.thb-guests{display:flex;align-items:center;justify-content:space-between;gap:12px;',
      '  height:68px;padding:0 16px;border:1px solid rgba(0,0,0,.078);border-radius:8px}',
      '.thb-guests .thb-g-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.thb-guests .thb-g-cap{font-size:13px;line-height:1.3;color:#6b6b6b}',
      '.thb-guests .thb-g-max{font-size:12px;line-height:1.3;color:#8a8a8a}',
      '.thb-guests .thb-g-ctl{display:flex;align-items:center;gap:12px;flex:none}',
      '.thb-guests .thb-g-ctl button{width:34px;height:34px;border-radius:50%;',
      '  border:1px solid rgba(0,0,0,.18);background:transparent;font-size:18px;line-height:1;',
      '  color:#111;cursor:pointer;display:flex;align-items:center;justify-content:center;',
      '  transition:border-color .15s,opacity .15s}',
      '.thb-guests .thb-g-ctl button:hover:not(:disabled){border-color:#111}',
      '.thb-guests .thb-g-ctl button:disabled{opacity:.35;cursor:default}',
      '.thb-guests .thb-g-num{min-width:22px;text-align:center;font-size:16px;color:#111}'
    ].join('\n');
    document.head.appendChild(st);

    /* ---------- поле ---------- */
    var field = document.createElement('div');
    field.className = 'thb-guests';

    var text = document.createElement('div');
    text.className = 'thb-g-text';
    var cap = document.createElement('span');
    cap.className = 'thb-g-cap';
    cap.textContent = 'Guests';
    var max = document.createElement('span');
    max.className = 'thb-g-max';
    text.appendChild(cap);
    text.appendChild(max);

    var ctl = document.createElement('div');
    ctl.className = 'thb-g-ctl';
    num.className = 'thb-g-num';
    num.removeAttribute('style');
    ctl.appendChild(minus);
    ctl.appendChild(num);
    ctl.appendChild(plus);

    field.appendChild(text);
    field.appendChild(ctl);
    btn.parentNode.insertBefore(field, btn);

    /* ---------- вместимость ---------- */
    var limit = null;

    function sync() {
      var n = parseInt(num.textContent, 10) || 1;
      minus.disabled = n <= 1;
      plus.disabled = limit ? n >= limit : false;
    }

    new MutationObserver(sync).observe(num, { childList: true, characterData: true, subtree: true });
    minus.addEventListener('click', function () { setTimeout(sync, 0); });
    plus.addEventListener('click', function () { setTimeout(sync, 0); });

    /* до ответа villas.json подпись пустая: лучше ничего, чем неверное число */
    max.textContent = '';
    sync();

    villaMax().then(function (m) {
      if (!m) { max.textContent = ''; return; }
      limit = m;
      max.textContent = 'Maximum ' + m + (m === 1 ? ' guest' : ' guests');

      /* страничный «+» знает свой максимум и о нашем не в курсе:
         перехватываем клик на стадии погружения и не пускаем дальше */
      plus.addEventListener('click', function (e) {
        var n = parseInt(num.textContent, 10) || 1;
        if (n >= limit) { e.stopImmediatePropagation(); e.preventDefault(); }
      }, true);

      var cur = parseInt(num.textContent, 10) || 1;
      if (cur > limit) num.textContent = String(limit);
      sync();
    });

    /* Форма заявки читает отсюда и текущее число, и предел: у неё свои
       счётчики взрослых и детей, и их сумма не должна перевалить вместимость.
       Без этого она считала, что предела нет вовсе. */
    window.thbGetGuests = function () {
      return { count: parseInt(num.textContent, 10) || 1, max: limit || 0 };
    };
  }

  /* Вместимость: сначала спрашиваем Hostfully — там она заведена вместе с
     ценой и минимальным сроком, и именно её видит гость на Airbnb и Booking.
     Не ответил — берём число из data/villas.json, как раньше. Своего числа
     не придумываем: нет ни там, ни там — подписи и предела просто нет. */
  function villaMax() {
    var path = location.pathname.replace(/\/+$/, '');
    var i = path.indexOf('/villa/');
    if (i < 0) return Promise.resolve(null);
    var slug = path.slice(i + 7);

    return fetch('/data/villas.json', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        var hit = (list || []).filter(function (v) { return v.slug === slug; })[0];
        if (!hit) return null;
        var local = hit.guests || null;

        return fetch('/api/price?villa=' + encodeURIComponent(hit.id))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            return (d && d.ok && d.maxGuests) ? d.maxGuests : local;
          })
          .catch(function () { return local; });
      })
      .catch(function () { return null; });
  }
})();
