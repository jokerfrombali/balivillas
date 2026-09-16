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

  /* Исходная сумма запоминается для каждого текстового узла отдельно.
     Раньше она лежала на родителе — и это ломалось там, где сервер пишет в
     один контейнер и цену, и подпись «per night»: внутри оказывалось два
     текстовых узла, оба брали одну и ту же исходную строку, и пробел после
     подписи превращался во вторую цену. На карточке было «$ 110 per night
     $ 110». */
  var SRC = new WeakMap();

  function walk(root) {
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest('script, style, #thbCurBox, #thbCurMenu')) return NodeFilter.FILTER_REJECT;
        /* уже наш узел — берём даже без «Rp»: после пересчёта его там нет */
        if (SRC.has(n)) return NodeFilter.FILTER_ACCEPT;
        if (!n.nodeValue || n.nodeValue.indexOf('Rp') < 0) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var out = [], n;
    while ((n = it.nextNode())) out.push(n);
    return out;
  }

  /* Цены на продажу заведены в долларах, а не в рупиях: так их называет
     владелец и так они стоят в документах. Такие суммы помечены атрибутом
     data-thb-usd, и пересчитываем мы их через рупию — курс у нас к ней. */
  function usdNodes(root) {
    return [].slice.call((root || document.body).querySelectorAll('[data-thb-usd]'));
  }

  function convertUsd(root) {
    if (!rates || !rates.USD) return;
    usdNodes(root).forEach(function (el) {
      var usd = parseFloat(el.getAttribute('data-thb-usd'));
      if (!isFinite(usd)) return;
      if (cur === 'USD') { el.textContent = '$' + thousands(Math.round(usd)); return; }
      el.textContent = fmt(usd / rates.USD, cur);
    });
  }

  function convert(root) {
    convertUsd(root);
    walk(root || document.body).forEach(function (node) {
      var src = SRC.get(node);

      if (src === undefined) {
        RE.lastIndex = 0;
        if (!RE.test(node.nodeValue)) { RE.lastIndex = 0; return; }
        RE.lastIndex = 0;
        src = node.nodeValue;
        SRC.set(node, src);
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

  /* Кнопка живёт в шапке рядом с переключателем языка и должна выглядеть так
     же тихо: без рамки и белого фона, только код валюты и стрелка. Выделяем её
     мягкой заливкой лишь тогда, когда гость сам выбрал валюту, отличную от
     рупии, — тогда подсветка несёт смысл, а не просто шумит.

     На узких экранах шапка и так впритык: логотип, язык, валюта, сердце и
     бургер. Поэтому там кнопка ужимается, а стрелка убирается вовсе. */
  function css() {
    var st = document.createElement('style');
    st.textContent =
      '#thbCurBox{position:relative;display:inline-flex;align-items:center;flex-shrink:0}' +
      '#thbCurBtn{display:inline-flex;align-items:center;gap:5px;height:40px;padding:0 10px;' +
        'border:0;background:transparent;border-radius:999px;cursor:pointer;' +
        'font:500 14px/1 Inter,system-ui,sans-serif;color:#0a0a0a;' +
        'transition:background .18s}' +
      '#thbCurBtn svg{width:12px;height:12px;opacity:.45;flex-shrink:0}' +
      '@media(hover:hover){#thbCurBtn:hover{background:rgba(10,10,10,.055)}}' +
      '#thbCurBox[data-picked="1"] #thbCurBtn{background:rgba(10,10,10,.05);font-weight:600}' +

      '#thbCurMenu{position:absolute;top:46px;right:0;z-index:1200;width:250px;' +
        'max-width:calc(100vw - 24px);max-height:min(62vh,420px);overflow:auto;' +
        'background:#fff;border:1px solid #e6e3dc;border-radius:16px;' +
        'box-shadow:0 18px 44px rgba(0,0,0,.16);padding:6px;display:none}' +
      '#thbCurMenu.open{display:block}' +
      '#thbCurMenu button{display:flex;width:100%;align-items:center;gap:10px;padding:9px 11px;' +
        'border:0;background:transparent;border-radius:10px;cursor:pointer;text-align:left;' +
        'font:400 13.5px/1.25 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '@media(hover:hover){#thbCurMenu button:hover{background:#f4f1ea}}' +
      '#thbCurMenu button[aria-current="true"]{background:#0a0a0a;color:#fff}' +
      '#thbCurMenu b{font-weight:700;min-width:38px}' +
      '#thbCurMenu i{font-style:normal;opacity:.6;margin-left:auto}' +
      '#thbCurNote{padding:8px 11px 6px;font:400 11.5px/1.45 Inter,system-ui,sans-serif;color:#6b6b66}' +

      '#thbCurRow{display:flex;align-items:center;justify-content:space-between;gap:12px;' +
        'padding:13px 4px;border-top:1px solid rgba(10,10,10,.08);margin-top:6px;' +
        'font:500 15px/1.2 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '#thbCurRow select{border:1px solid rgba(10,10,10,.14);background:#fff;' +
        'border-radius:999px;padding:8px 12px;font:600 14px/1 Inter,system-ui,sans-serif;' +
        'color:#0a0a0a;cursor:pointer}' +
      '@media(max-width:640px){#thbCurBtn{height:36px;padding:0 7px;font-size:13px;gap:4px}}' +
      '@media(max-width:430px){#thbCurBtn{padding:0 5px;font-size:12.5px}' +
        '#thbCurBtn svg{display:none}}';
    document.head.appendChild(st);
  }

  function build() {
    /* на итальянских страницах ссылка ведёт на /it/saved/ */
    var anchor = document.querySelector('a[data-fav-link]') ||
                 document.querySelector('a[href$="/saved/"]');
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

    mobileRow();

    document.addEventListener('click', function (e) {
      if (box && !box.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    return true;
  }

  /* В каталоге и подборках шапка на телефоне прячет и язык, и сердце — остаётся
     логотип с бургером. Значит выбор валюты должен быть и внутри меню, иначе на
     мобильном до него не добраться. Здесь обычный select: родной барабан
     телефона удобнее любого своего списка. */
  var sel = null;
  function mobileRow() {
    var menu = document.getElementById('thbMobileMenu');
    if (!menu || document.getElementById('thbCurRow')) return;

    var row = document.createElement('div');
    row.id = 'thbCurRow';

    var label = document.createElement('span');
    label.textContent = 'Currency';

    sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Currency');
    CUR.forEach(function (x) {
      var o = document.createElement('option');
      o.value = x.c;
      o.textContent = x.c + ' · ' + x.s;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { pick(sel.value); });

    row.appendChild(label);
    row.appendChild(sel);
    menu.appendChild(row);
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
    box.setAttribute('data-picked', cur !== 'IDR' ? '1' : '0');
    if (sel && sel.value !== cur) sel.value = cur;
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

      /* Первый заход: показываем валюту страны гостя. На страницах продажи —
         доллары: цена объявлена в них, и рупия там сбивает с толку. Дальше
         работает только собственный выбор гостя. */
      var sale = !!document.querySelector('[data-thb-usd]');
      pick(saved && BY[saved] ? saved : (sale ? 'USD' : (d.suggest || 'IDR')));
    }).catch(function () { /* без курсов остаются рупии, как и было */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
