/* Выбор валюты в шапке и пересчёт цен.
 *
 * Цены у нас в рупиях — так они заведены в Hostex, так же выставляется счёт.
 * Но «Rp 4,800,000» ничего не говорит гостю из Сиднея или Лондона, и он уходит
 * считать на калькуляторе или к конкуренту, где цена в его валюте.
 *
 * Поэтому: рядом с сердечком в шапке появляется код валюты, по клику —
 * список из пятнадцати валют стран, откуда к нам чаще всего приезжают.
 * Выбор запоминается в браузере, при первом заходе подставляется валюта по
 * стране гостя (её отдаёт Cloudflare в /api/fx).
 *
 * Пересчитываем прямо в тексте страницы: находим «Rp 4,800,000» и подменяем.
 * Исходная сумма остаётся в data-атрибуте, поэтому переключение туда-обратно
 * не теряет точность, а цены, которые дорисовывают другие скрипты (карточки,
 * расчёт на даты), подхватываются наблюдателем за DOM.
 *
 * Курс справочный, и это честно написано в списке: платёж всё равно в рупиях.
 */
(function () {
  'use strict';

  if (document.documentElement.dataset.thbFx) return;
  document.documentElement.dataset.thbFx = '1';

  var KEY = 'thb_currency_v1';
  var RE = /Rp\s?([\d][\d,.\s]*\d|\d)/g;      /* «Rp 4,800,000» в любом виде */

  /* Пятнадцать валют: Индонезия и страны, откуда к нам едут чаще всего. */
  var CUR = [
    { c: 'IDR', s: 'Rp',   n: 'Indonesian rupiah', d: 0 },
    { c: 'USD', s: '$',    n: 'US dollar',         d: 0 },
    { c: 'EUR', s: '€', n: 'Euro',            d: 0 },
    { c: 'AUD', s: 'A$',   n: 'Australian dollar', d: 0 },
    { c: 'GBP', s: '£', n: 'British pound',   d: 0 },
    { c: 'SGD', s: 'S$',   n: 'Singapore dollar',  d: 0 },
    { c: 'MYR', s: 'RM',   n: 'Malaysian ringgit', d: 0 },
    { c: 'INR', s: '₹', n: 'Indian rupee',    d: 0 },
    { c: 'CNY', s: 'CN¥', n: 'Chinese yuan',  d: 0 },
    { c: 'JPY', s: '¥', n: 'Japanese yen',    d: 0 },
    { c: 'KRW', s: '₩', n: 'Korean won',      d: 0 },
    { c: 'RUB', s: '₽', n: 'Russian ruble',   d: 0 },
    { c: 'THB', s: '฿', n: 'Thai baht',       d: 0 },
    { c: 'TWD', s: 'NT$',  n: 'Taiwan dollar',     d: 0 },
    { c: 'NZD', s: 'NZ$',  n: 'New Zealand dollar', d: 0 }
  ];
  var BY = {};
  CUR.forEach(function (x) { BY[x.c] = x; });

  var rates = null, cur = 'IDR', box = null, list = null;

  /* ---------- деньги ---------- */

  function thousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmt(idr, code) {
    var x = BY[code] || BY.IDR;
    var r = rates && rates[code];
    if (code === 'IDR' || !r) return 'Rp ' + thousands(Math.round(idr));

    var v = idr * r;
    /* мелкие суммы округляем до десятков, крупные — до целых: «$272» читается
       лучше, чем «$271.83», а «¥41,882» — лучше, чем «¥41,882.13» */
    var out = v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v);
    return x.s + ' ' + thousands(out);
  }

  /* ---------- пересчёт текста ---------- */

  function walk(root) {
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf('Rp') < 0) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest('script, style, #thbCurBox')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var out = [], n;
    while ((n = it.nextNode())) out.push(n);
    return out;
  }

  /* Запоминаем рупии в родителе: иначе после первой замены исходной суммы уже
     не найти, и «$272» превратился бы в мусор при следующем переключении. */
  function convert(root) {
    walk(root || document.body).forEach(function (node) {
      var p = node.parentElement;
      if (!p) return;

      var src = p.getAttribute('data-thb-idr');
      if (src === null) {
        if (!RE.test(node.nodeValue)) { RE.lastIndex = 0; return; }
        RE.lastIndex = 0;
        p.setAttribute('data-thb-idr', node.nodeValue);
        src = node.nodeValue;
      }

      node.nodeValue = src.replace(RE, function (whole, num) {
        var idr = parseFloat(String(num).replace(/[,\s]/g, ''));
        return isFinite(idr) ? fmt(idr, cur) : whole;
      });
    });
  }

  /* Другие скрипты дорисовывают цены позже: карточки в каталоге, расчёт на
     выбранные даты. Ждём их и пересчитываем добавленное. */
  function observe() {
    var timer = null;
    new MutationObserver(function (rows) {
      var touched = false;
      for (var i = 0; i < rows.length && !touched; i++) {
        var r = rows[i];
        if (r.type === 'characterData') touched = true;
        for (var j = 0; j < r.addedNodes.length && !touched; j++) touched = true;
      }
      if (!touched) return;
      clearTimeout(timer);
      timer = setTimeout(function () { convert(document.body); }, 120);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ---------- переключатель в шапке ---------- */

  function css() {
    var st = document.createElement('style');
    st.textContent =
      '#thbCurBox{position:relative;display:inline-flex;align-items:center;flex-shrink:0}' +
      '#thbCurBtn{display:inline-flex;align-items:center;gap:5px;height:40px;padding:0 12px;' +
        'border:1px solid rgba(10,10,10,.14);background:#fff;border-radius:999px;cursor:pointer;' +
        'font:600 13px/1 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '#thbCurBtn:hover{background:#faf9f7}' +
      '#thbCurBtn svg{width:13px;height:13px;opacity:.5}' +
      '#thbCurMenu{position:absolute;top:46px;right:0;z-index:1200;width:250px;max-height:60vh;' +
        'overflow:auto;background:#fff;border:1px solid #e6e3dc;border-radius:16px;' +
        'box-shadow:0 18px 44px rgba(0,0,0,.16);padding:6px;display:none}' +
      '#thbCurMenu.open{display:block}' +
      '#thbCurMenu button{display:flex;width:100%;align-items:center;gap:10px;padding:9px 11px;' +
        'border:0;background:transparent;border-radius:10px;cursor:pointer;text-align:left;' +
        'font:400 13.5px/1.25 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '#thbCurMenu button:hover{background:#f4f1ea}' +
      '#thbCurMenu button[aria-current="true"]{background:#0a0a0a;color:#fff}' +
      '#thbCurMenu b{font-weight:700;min-width:38px}' +
      '#thbCurMenu i{font-style:normal;opacity:.6;margin-left:auto}' +
      '#thbCurNote{padding:8px 11px 6px;font:400 11.5px/1.45 Inter,system-ui,sans-serif;color:#6b6b66}' +
      '@media(max-width:520px){#thbCurBtn{padding:0 10px;height:36px}#thbCurMenu{width:220px}}';
    document.head.appendChild(st);
  }

  function build() {
    var anchor = document.querySelector('a[href="/saved/"][data-fav-link]') ||
                 document.querySelector('a[href="/saved/"]');
    if (!anchor || !anchor.parentElement) return false;

    box = document.createElement('div');
    box.id = 'thbCurBox';

    var btn = document.createElement('button');
    btn.id = 'thbCurBtn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Change currency');
    btn.innerHTML = '<span data-cur-code>IDR</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
      '<path d="M6 9l6 6 6-6"/></svg>';

    list = document.createElement('div');
    list.id = 'thbCurMenu';
    list.setAttribute('role', 'listbox');

    CUR.forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('data-cur', x.c);
      b.innerHTML = '<b>' + x.c + '</b><span>' + x.n + '</span><i>' + x.s + '</i>';
      b.addEventListener('click', function () { pick(x.c); close(); });
      list.appendChild(b);
    });

    var note = document.createElement('div');
    note.id = 'thbCurNote';
    note.textContent = 'Indicative rates. Villas are priced and paid in rupiah.';
    list.appendChild(note);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      list.classList.contains('open') ? close() : open();
    });

    box.appendChild(btn);
    box.appendChild(list);
    anchor.parentElement.insertBefore(box, anchor);

    document.addEventListener('click', function (e) {
      if (box && !box.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    return true;
  }

  function open() {
    list.classList.add('open');
    box.querySelector('#thbCurBtn').setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (!list) return;
    list.classList.remove('open');
    box.querySelector('#thbCurBtn').setAttribute('aria-expanded', 'false');
  }

  function paintButton() {
    if (!box) return;
    box.querySelector('[data-cur-code]').textContent = cur;
    [].forEach.call(list.querySelectorAll('button[data-cur]'), function (b) {
      b.setAttribute('aria-current', b.getAttribute('data-cur') === cur ? 'true' : 'false');
    });
  }

  function pick(code) {
    cur = BY[code] ? code : 'IDR';
    try { localStorage.setItem(KEY, cur); } catch (e) {}
    paintButton();
    convert(document.body);
  }

  /* ---------- запуск ---------- */

  function start() {
    if (!build()) return;                /* нет шапки — нечего показывать */
    css();
    paintButton();
    observe();

    fetch('/api/fx').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !d.rates) return;
      rates = d.rates;

      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (e) {}

      /* Первый заход: показываем валюту страны гостя. Дальше — только его
         собственный выбор, страну больше не спрашиваем. */
      pick(saved && BY[saved] ? saved : (d.suggest || 'IDR'));
    }).catch(function () { /* без курсов остаются рупии, как и было */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
