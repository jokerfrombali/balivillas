/* thb-dates.js — фильтр по датам в каталоге аренды.
 *
 * До сих пор даты на странице каталога жили только в мобильной «шторке»
 * поиска и никак не влияли на выдачу: гость выбирал 12–18 октября и видел все
 * двадцать вилл, включая занятые. Этот файл добавляет в ряд фильтров кнопку с
 * календарём и прячет виллы, которые на выбранные даты заняты.
 *
 * Занятость берём из /api/calendars — это сводка зеркала Hostex в KV, одним
 * запросом на все виллы, ночи лежат отрезками [первая ночь, день выезда).
 * В Hostex с сайта не ходим (зеркало обновляет cron), писать туда нельзя.
 *
 * Правила выдачи:
 *   занята хотя бы одна ночь из выбранных  -> карточку прячем;
 *   свободна, но минимальный срок длиннее   -> показываем с пометкой «min N ночей»;
 *   объекта в Hostex нет (Lucky Lily и др.) -> показываем с пометкой «даты по
 *                                             запросу»: обещать свободу там,
 *                                             где календаря нет, нельзя.
 *
 * Прячем не инлайновым style, а атрибутом data-thb-date="off" плюс правилом в
 * CSS: иначе фильтр дрался бы за style.display с ящиком фильтров, чипами
 * районов и сортировкой.
 */
(function () {
  'use strict';
  if (window.__thbDates) return;
  window.__thbDates = true;

  var path = location.pathname.replace(/^\/(it|ru|de|fr|es|nl|ja|ko|zh-hans|zh-hant|ar)(?=\/)/, '');
  var IT = path !== location.pathname;
  if (!/^\/(property-rental|villas)\/([^/]+\/)?$/.test(path)) return;

  var T = IT ? {
    dates: 'Date', any: 'Qualsiasi data', clear: 'Cancella', apply: 'Mostra',
    villas: function (n) { return n + (n === 1 ? ' villa' : ' ville'); },
    free: function (n) { return n + (n === 1 ? ' villa libera' : ' ville libere'); },
    nights: function (n) { return n + (n === 1 ? ' notte' : ' notti'); },
    minStay: function (n) { return 'min ' + n + (n === 1 ? ' notte' : ' notti'); },
    onRequest: 'Date su richiesta', checkin: 'Check-in', checkout: 'Check-out',
    addDate: 'Aggiungi la data',
    forNights: function (n) { return 'per ' + n + (n === 1 ? ' notte' : ' notti'); },
    none: 'Nessuna villa libera per queste date. Prova altre date o scrivici su WhatsApp.',
    longer: function (n, m) { return 'Altre ' + n + (n === 1 ? ' villa è libera' : ' ville sono libere') +
      ' ma con soggiorno minimo di ' + m + (m === 1 ? ' notte' : ' notti') + '.'; },
    dow: ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'],
    mon: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio',
          'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
    monShort: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    loading: 'Controllo dei calendari…'
  } : {
    dates: 'Dates', any: 'Any dates', clear: 'Clear', apply: 'Show',
    villas: function (n) { return n + (n === 1 ? ' villa' : ' villas'); },
    free: function (n) { return n + (n === 1 ? ' villa free' : ' villas free'); },
    nights: function (n) { return n + (n === 1 ? ' night' : ' nights'); },
    minStay: function (n) { return 'min ' + n + (n === 1 ? ' night' : ' nights'); },
    onRequest: 'Dates on request', checkin: 'Check-in', checkout: 'Check-out',
    addDate: 'Add date',
    forNights: function (n) { return 'for ' + n + (n === 1 ? ' night' : ' nights'); },
    none: 'No villas free for these dates. Try other dates or message us on WhatsApp.',
    longer: function (n, m) { return n + (n === 1 ? ' more villa is free' : ' more villas are free') +
      ' but need at least ' + m + (m === 1 ? ' night' : ' nights') + '.'; },
    dow: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    mon: ['January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December'],
    monShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    loading: 'Checking the calendars…'
  };

  /* ---------- даты ---------- */

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function parse(s) { return new Date(s + 'T00:00:00Z'); }
  function addDays(s, n) { var d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  /* Бали живёт в UTC+8: без сдвига «сегодня» с полуночи до 8 утра уезжало бы назад */
  function today() { return iso(new Date(Date.now() + 8 * 3600 * 1000)); }
  function nights(a, b) { return a && b ? Math.round((parse(b) - parse(a)) / 86400000) : 0; }
  function short(s) { var d = parse(s); return d.getUTCDate() + ' ' + T.monShort[d.getUTCMonth()]; }
  function range(a, b) {
    if (!a || !b) return '';
    var x = parse(a), y = parse(b);
    return x.getUTCMonth() === y.getUTCMonth()
      ? x.getUTCDate() + '–' + y.getUTCDate() + ' ' + T.monShort[y.getUTCMonth()]
      : short(a) + ' – ' + short(b);
  }

  /* ---------- состояние ---------- */

  var S = { ci: '', co: '' };
  var CAL = null;          /* {url: {busy:[[a,b]], minStay, maxGuests, stale}} */
  var loading = null;

  function load() {
    if (CAL) return Promise.resolve(CAL);
    if (loading) return loading;
    loading = fetch('/api/calendars')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { CAL = (j && j.ok && j.villas) || {}; return CAL; })
      .catch(function () { CAL = {}; return CAL; });
    return loading;
  }

  /* Адрес виллы у карточки: в href ссылки или внутри onclick у div. */
  function urlOf(card) {
    var a = card.getAttribute('href');
    if (!a) {
      var oc = card.getAttribute('onclick') || '';
      var m = oc.match(/window\.location\s*=\s*'([^']+)'/);
      a = m ? m[1] : '';
    }
    return (a || '').split('?')[0].replace(/^\/(it|ru|de|fr|es|nl|ja|ko|zh-hans|zh-hant|ar)(?=\/)/, '');
  }

  /* Минимальный срок берём на дату заезда: на пиках он выше, чем сегодня. */
  function minStay(rec, ci) {
    var m = rec.min || [];
    for (var i = 0; i < m.length; i++) {
      if (ci >= m[i][0] && ci < m[i][1]) return m[i][2] || 1;
    }
    return rec.minStay || 1;
  }

  /* 'free' | 'busy' | 'short' | 'unknown' */
  function verdict(card) {
    if (!S.ci || !S.co) return 'free';
    var rec = CAL && CAL[urlOf(card)];
    if (!rec) return 'unknown';
    var b = rec.busy || [];
    for (var i = 0; i < b.length; i++) {
      /* пересечение [ci, co) с занятым отрезком [b0, b1) */
      if (S.ci < b[i][1] && b[i][0] < S.co) return 'busy';
    }
    return nights(S.ci, S.co) < minStay(rec, S.ci) ? 'short' : 'free';
  }

  /* ---------- разметка ---------- */

  function css() {
    var st = document.createElement('style');
    st.id = 'thb-dates-css';
    st.textContent =
      '.prop-card[data-thb-date="off"]{display:none!important}' +
      '#thbDatesBtn{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 16px;' +
        'border:1.5px solid #e6e3dc;border-radius:999px;background:#fff;cursor:pointer;' +
        "font:600 13.5px/1 Inter,system-ui,sans-serif;color:#0a0a0a;white-space:nowrap;" +
        'transition:border-color .15s}' +
      '@media(hover:hover){#thbDatesBtn:hover{border-color:#0a0a0a}}' +
      '#thbDatesBtn[data-on="1"]{border-color:#0a0a0a;background:#0a0a0a;color:#fff}' +
      '#thbDatesBtn svg{width:15px;height:15px;flex:0 0 auto}' +
      '#thbDatesWrap{position:relative;display:inline-flex}' +

      /* окно кладём в body и позиционируем по кнопке: ряд фильтров
         скроллится по горизонтали и обрезал бы поповер */
      '#thbCalPop{position:fixed;z-index:1300;width:640px;max-width:calc(100vw - 32px);' +
        'background:#fff;border:1px solid #e6e3dc;border-radius:20px;box-shadow:0 22px 54px rgba(0,0,0,.18);' +
        'padding:18px;display:none;font-family:Inter,system-ui,sans-serif}' +
      '#thbCalPop.open{display:block}' +
      '#thbCalPop .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}' +
      '#thbCalPop .hd b{font:600 14px/1.2 Inter,system-ui,sans-serif}' +
      '#thbCalPop .hd .sub{font:400 12.5px/1.2 Inter,system-ui,sans-serif;color:#6b6b66;margin-top:3px;display:block}' +
      '#thbCalPop .nav{display:flex;gap:6px}' +
      '#thbCalPop .nav button{width:32px;height:32px;border:1px solid #e6e3dc;border-radius:50%;background:#fff;' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;color:#0a0a0a}' +
      '#thbCalPop .nav button[disabled]{opacity:.35;cursor:default}' +
      '#thbCalPop .ms{display:flex;gap:24px}' +
      '#thbCalPop .m{flex:1;min-width:0}' +
      '#thbCalPop .mt{text-align:center;font:600 13.5px/1 Inter,system-ui,sans-serif;margin-bottom:10px}' +
      '#thbCalPop .dow,#thbCalPop .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}' +
      '#thbCalPop .dow span{text-align:center;font:500 11px/1 Inter,system-ui,sans-serif;color:#9a968e;padding:4px 0 8px}' +
      '#thbCalPop .grid button{height:36px;border:0;background:transparent;border-radius:10px;cursor:pointer;' +
        'font:500 13px/1 Inter,system-ui,sans-serif;color:#0a0a0a;padding:0}' +
      '@media(hover:hover){#thbCalPop .grid button:not([disabled]):hover{background:#f4f1ea}}' +
      '#thbCalPop .grid button[disabled]{color:#c9c5bd;cursor:default}' +
      '#thbCalPop .grid button.in{background:#f2efe8;border-radius:0}' +
      '#thbCalPop .grid button.e1,#thbCalPop .grid button.e2{background:#0a0a0a;color:#fff}' +
      '#thbCalPop .grid button.e1{border-radius:10px 0 0 10px}' +
      '#thbCalPop .grid button.e2{border-radius:0 10px 10px 0}' +
      '#thbCalPop .grid button.e1.e2{border-radius:10px}' +
      '#thbCalPop .ft{display:flex;align-items:center;justify-content:space-between;gap:12px;' +
        'margin-top:14px;padding-top:14px;border-top:1px solid #efece5}' +
      '#thbCalPop .ft .x{border:0;background:transparent;cursor:pointer;text-decoration:underline;' +
        'font:500 13px/1 Inter,system-ui,sans-serif;color:#0a0a0a;padding:8px 2px}' +
      '#thbCalPop .ft .go{border:0;background:#0a0a0a;color:#fff;border-radius:999px;cursor:pointer;' +
        'height:42px;padding:0 22px;font:600 13.5px/1 Inter,system-ui,sans-serif}' +
      '#thbCalPop .ft .go[disabled]{opacity:.45;cursor:default}' +

      '.thb-dnote{position:absolute;left:10px;bottom:10px;z-index:2;padding:5px 10px;border-radius:999px;' +
        'background:rgba(255,255,255,.94);backdrop-filter:blur(4px);' +
        'font:600 11.5px/1 Inter,system-ui,sans-serif;color:#0a0a0a;box-shadow:0 2px 10px rgba(0,0,0,.12)}' +
      '.thb-dnote.warn{background:#fdf4e3;color:#8a5a12}' +
      /* строка поиска под заголовком района: та же роль, что у большого поиска
         на /property-rental/, где даты уже были */
      '#thbHeroDates{display:flex;align-items:stretch;margin:18px auto 0;max-width:520px;' +
        'background:#fff;border-radius:999px;padding:5px;box-shadow:0 10px 30px rgba(0,0,0,.18);' +
        'font-family:Inter,system-ui,sans-serif;text-align:left}' +
      '#thbHeroDates .seg{flex:1;min-width:0;border:0;background:transparent;cursor:pointer;' +
        'padding:8px 18px;border-radius:999px;text-align:left;transition:background .15s}' +
      '@media(hover:hover){#thbHeroDates .seg:hover{background:#f4f1ea}}' +
      '#thbHeroDates .seg b{display:block;font:700 10.5px/1 Inter,system-ui,sans-serif;' +
        'letter-spacing:.09em;text-transform:uppercase;color:#8a877f;margin-bottom:5px}' +
      '#thbHeroDates .seg span{display:block;font:500 14px/1.1 Inter,system-ui,sans-serif;color:#9a968e;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#thbHeroDates .seg span.set{color:#0a0a0a;font-weight:600}' +
      '#thbHeroDates .sep{width:1px;background:#e6e3dc;margin:8px 0;flex:0 0 auto}' +
      '#thbHeroDates .go{flex:0 0 auto;border:0;background:#0a0a0a;color:#fff;border-radius:999px;' +
        'cursor:pointer;padding:0 20px;font:600 13.5px/1 Inter,system-ui,sans-serif;display:flex;' +
        'align-items:center;gap:7px}' +
      '#thbHeroDates .go svg{width:14px;height:14px;flex:0 0 auto}' +
      '@media(max-width:640px){#thbHeroDates{max-width:none;margin-top:14px}' +
        '#thbHeroDates .seg{padding:7px 12px}#thbHeroDates .go{padding:0 15px;font-size:0;gap:0}}' +

      /* блок «Даты» в ящике фильтров */
      '#thbFilterDates .row{display:flex;gap:8px}' +
      '#thbFilterDates .seg{flex:1;min-width:0;border:1.5px solid #e6e3dc;background:#fff;' +
        'border-radius:14px;padding:9px 13px;cursor:pointer;text-align:left}' +
      '@media(hover:hover){#thbFilterDates .seg:hover{border-color:#0a0a0a}}' +
      '#thbFilterDates .seg b{display:block;font:700 10px/1 Inter,system-ui,sans-serif;' +
        'letter-spacing:.08em;text-transform:uppercase;color:#8a877f;margin-bottom:5px}' +
      '#thbFilterDates .seg span{display:block;font:500 13.5px/1.1 Inter,system-ui,sans-serif;color:#9a968e}' +
      '#thbFilterDates .seg span.set{color:#0a0a0a;font-weight:600}' +
      '#thbFilterDates .x{margin-top:10px;border:0;background:transparent;padding:0;cursor:pointer;' +
        'font:500 12px/1 Inter,system-ui,sans-serif;color:#6b6b66;text-decoration:underline}' +

      '.thb-dtot{display:block;margin-top:2px;font:400 12.5px/1.2 Inter,system-ui,sans-serif;' + 'color:#706b61;letter-spacing:0}' +
      '#thbDatesHint{margin:6px 0 0;font:400 13px/1.45 Inter,system-ui,sans-serif;color:#6b6b66}' +
      '#thbNoDates{margin:18px 0;padding:18px 20px;border:1px solid #e6e3dc;border-radius:16px;' +
        'background:#fff;font:400 14px/1.5 Inter,system-ui,sans-serif;color:#0a0a0a}' +

      '@media(max-width:860px){' +
        '#thbCalPop{inset:auto 0 0 0!important;width:auto;max-width:none;max-height:86dvh;' +
          'overflow:auto;border-radius:22px 22px 0 0;padding:16px}' +
        '#thbCalPop .ms{flex-direction:column;gap:18px}' +
        '#thbCalScrim{position:fixed;inset:0;background:rgba(10,10,10,.34);z-index:1290;display:none}' +
        '#thbCalScrim.open{display:block}}';
    document.head.appendChild(st);
  }

  var btn, pop, scrim, grids, applyBtn, monthCursor;

  function toolsRow() {
    var t = document.querySelectorAll('.thb-tools');
    for (var i = 0; i < t.length; i++) if (t[i].offsetParent) return t[i];
    return t[0] || null;
  }

  function build() {
    var tools = toolsRow();
    if (!tools) return false;

    css();

    var wrap = document.createElement('div');
    wrap.id = 'thbDatesWrap';
    btn = document.createElement('button');
    btn.id = 'thbDatesBtn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><span></span>';
    wrap.appendChild(btn);

    pop = document.createElement('div');
    pop.id = 'thbCalPop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', T.dates);
    document.body.appendChild(pop);

    scrim = document.createElement('div');
    scrim.id = 'thbCalScrim';
    document.body.appendChild(scrim);

    tools.insertBefore(wrap, tools.firstChild);

    monthCursor = today().slice(0, 7) + '-01';
    renderPop();

    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      pop.classList.contains('open') ? close() : open();
    });
    scrim.addEventListener('click', close);
    openers.push(wrap);
    document.addEventListener('click', function (e) {
      if (!pop.classList.contains('open') || pop.contains(e.target)) return;
      for (var i = 0; i < openers.length; i++) if (openers[i].contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    label();
    return true;
  }

  /* Календарь открывается из трёх мест: кнопки в ряду фильтров, строки поиска
     в шапке района и ящика фильтров. Позиционируем по тому, откуда открыли. */
  var anchorFor = null;
  var openers = [];

  function place() {
    if (window.innerWidth <= 860) return;          /* снизу, как шторка */
    var r = (anchorFor || btn).getBoundingClientRect();
    var w = Math.min(640, window.innerWidth - 32);
    var left = Math.min(Math.max(16, r.left), window.innerWidth - w - 16);
    pop.style.width = w + 'px';
    pop.style.left = left + 'px';
    /* не хватает места снизу — раскрываем вверх */
    var h = pop.offsetHeight || 420;
    pop.style.top = (r.bottom + 8 + h > window.innerHeight - 12 && r.top - 8 - h > 12
      ? r.top - 8 - h : r.bottom + 8) + 'px';
  }

  /* Строка поиска под заголовком страницы района. На /property-rental/ такой
     поиск с датами есть, а на странице района его не было вовсе — гость
     доходил до района и не находил, куда вписать даты. */
  function buildHeroBar() {
    if (document.getElementById('hsGo')) return;        /* большой поиск уже есть */
    var host = document.querySelector('.promo-center');
    if (!host || document.getElementById('thbHeroDates')) return;

    var bar = document.createElement('div');
    bar.id = 'thbHeroDates';
    bar.innerHTML =
      '<button type="button" class="seg"><b>' + T.checkin + '</b>' +
        '<span data-thb-ci>' + T.addDate + '</span></button>' +
      '<i class="sep"></i>' +
      '<button type="button" class="seg"><b>' + T.checkout + '</b>' +
        '<span data-thb-co>' + T.addDate + '</span></button>' +
      '<button type="button" class="go">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' + T.apply + '</button>';
    host.appendChild(bar);
    openers.push(bar);

    [].forEach.call(bar.querySelectorAll('.seg'), function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        pop.classList.contains('open') ? close() : open(bar);
      });
    });
    bar.querySelector('.go').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!S.ci || !S.co) { open(bar); return; }
      var rb = document.querySelector('.results-bar') || document.getElementById('cardGrid');
      if (rb) rb.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* Тот же выбор дат внутри ящика фильтров: гость открывает «Filters» и ищет
     даты там, рядом с остальными условиями. */
  function buildFilterRow() {
    var panel = document.getElementById('filterPanel');
    if (!panel || document.getElementById('thbFilterDates')) return;

    var sec = document.createElement('div');
    sec.className = 'filter-section';
    sec.id = 'thbFilterDates';
    sec.innerHTML =
      '<div class="filter-title">' + T.dates +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
        ' aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/>' +
        '<path d="M8 3v4M16 3v4M3 10h18"/></svg></div>' +
      '<div class="filter-body"><div class="row">' +
        '<button type="button" class="seg"><b>' + T.checkin + '</b>' +
          '<span data-thb-ci>' + T.addDate + '</span></button>' +
        '<button type="button" class="seg"><b>' + T.checkout + '</b>' +
          '<span data-thb-co>' + T.addDate + '</span></button>' +
      '</div><button type="button" class="x" data-thb-clear style="display:none">' + T.clear + '</button></div>';

    var first = panel.querySelector('.filter-section');
    if (first) panel.insertBefore(sec, first); else panel.appendChild(sec);
    openers.push(sec);

    [].forEach.call(sec.querySelectorAll('.seg'), function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        pop.classList.contains('open') ? close() : open(sec);
      });
    });
    sec.querySelector('[data-thb-clear]').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      S.ci = S.co = ''; D.ci = D.co = ''; apply(); renderPop();
    });

    /* «Clear all» в ящике снимает и даты */
    var all = panel.querySelector('button[onclick*="clearAllFilters"]');
    if (all) all.addEventListener('click', function () {
      setTimeout(function () {
        if (!S.ci && !S.co) return;
        S.ci = S.co = ''; D.ci = D.co = ''; apply(); renderPop();
      }, 0);
    });
  }

  function open(from) {
    anchorFor = from || btn;
    load().then(function () { renderPop(); place(); });
    pop.classList.add('open');
    scrim.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    place(); place();                              /* второй раз — по факту высоты */
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
  }
  function close() {
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    pop.classList.remove('open');
    scrim.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  /* черновик выбора внутри окна: применяем по кнопке */
  var D = { ci: '', co: '' };

  function renderPop() {
    D.ci = D.ci || S.ci; D.co = D.co || S.co;

    var head = '<div class="hd"><div><b>' + T.dates + '</b>' +
      '<span class="sub">' + (D.ci && D.co
        ? range(D.ci, D.co) + ' · ' + T.nights(nights(D.ci, D.co))
        : (D.ci ? short(D.ci) + ' → ' + T.checkout : T.checkin + ' → ' + T.checkout)) +
      '</span></div><div class="nav">' +
      '<button type="button" data-nav="-1" aria-label="&larr;"' + (monthCursor <= today().slice(0, 7) + '-01' ? ' disabled' : '') + '>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button type="button" data-nav="1" aria-label="&rarr;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '</div></div>';

    var ms = '<div class="ms">' + month(monthCursor) + month(addMonth(monthCursor, 1)) + '</div>';

    var n = D.ci && D.co ? countFor(D.ci, D.co) : visibleCards().length;
    var ft = '<div class="ft"><button type="button" class="x">' + T.clear + '</button>' +
      '<button type="button" class="go"' + (D.ci && !D.co ? ' disabled' : '') + '>' +
      (CAL ? T.apply + ' ' + T.villas(n) : T.loading) + '</button></div>';

    pop.innerHTML = head + ms + ft;

    [].forEach.call(pop.querySelectorAll('[data-nav]'), function (b) {
      b.addEventListener('click', function () {
        monthCursor = addMonth(monthCursor, Number(b.getAttribute('data-nav')));
        renderPop();
      });
    });
    [].forEach.call(pop.querySelectorAll('.grid button[data-d]'), function (b) {
      b.addEventListener('click', function () { pick(b.getAttribute('data-d')); });
    });
    pop.querySelector('.x').addEventListener('click', function () {
      D.ci = D.co = ''; S.ci = S.co = ''; apply(); renderPop();
    });
    if (pop.classList.contains('open')) place();

    pop.querySelector('.go').addEventListener('click', function () {
      if (D.ci && !D.co) return;
      S.ci = D.ci; S.co = D.co; apply(); close();
    });
  }

  function addMonth(m, n) {
    var d = parse(m); d.setUTCMonth(d.getUTCMonth() + n); return iso(d).slice(0, 8) + '01';
  }

  function month(first) {
    var d = parse(first), y = d.getUTCFullYear(), mo = d.getUTCMonth();
    var start = new Date(Date.UTC(y, mo, 1)).getUTCDay();
    var days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    var min = today();

    var h = '<div class="m"><div class="mt">' + T.mon[mo] + ' ' + y + '</div><div class="dow">';
    for (var i = 0; i < 7; i++) h += '<span>' + T.dow[i] + '</span>';
    h += '</div><div class="grid">';
    for (var s = 0; s < start; s++) h += '<span></span>';
    for (var day = 1; day <= days; day++) {
      var ds = y + '-' + pad(mo + 1) + '-' + pad(day);
      var off = ds < min;
      var cls = [];
      if (D.ci && ds === D.ci) cls.push('e1');
      if (D.co && ds === D.co) cls.push('e2');
      if (D.ci && D.co && ds > D.ci && ds < D.co) cls.push('in');
      h += '<button type="button" data-d="' + ds + '"' + (off ? ' disabled' : '') +
           (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + day + '</button>';
    }
    return h + '</div></div>';
  }

  function pick(ds) {
    if (!D.ci || D.co || ds <= D.ci) { D.ci = ds; D.co = ''; }
    else { D.co = ds; }
    renderPop();
  }

  /* ---------- применение ---------- */

  function cards() { return [].slice.call(document.querySelectorAll('.prop-card')); }
  function visibleCards() {
    return cards().filter(function (c) {
      return c.getAttribute('data-thb-date') !== 'off' && c.style.display !== 'none';
    });
  }

  function countFor(ci, co) {
    var save = { ci: S.ci, co: S.co };
    S.ci = ci; S.co = co;
    var n = cards().filter(function (c) {
      var v = verdict(c);
      return c.style.display !== 'none' && v !== 'busy' && v !== 'short';
    }).length;
    S.ci = save.ci; S.co = save.co;
    return n;
  }

  function note(card, text, warn) {
    var wrap = card.querySelector('.img-wrap') || card;
    var el = card.querySelector('.thb-dnote');
    if (!text) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.className = 'thb-dnote';
      wrap.appendChild(el);
    }
    el.className = 'thb-dnote' + (warn ? ' warn' : '');
    el.textContent = text;
  }

  var baseTitle = null;

  /* ---------- сумма за выбранные ночи в карточке ---------- */
  /* «Rp 2,462,255 per night» ничего не говорит гостю, который уже выбрал даты:
     он хочет увидеть, во сколько обойдётся именно этот приезд. Суммы считает
     воркер по зеркалу цен (/api/quotes), пересчёт в валюту делает
     thb-currency.js — он подхватывает новый текст сам. */
  var QUOTES = {};
  var ORIG = new WeakMap();

  function priceBox(card) {
    return card.querySelector('span[style*="font-size:19px"]') ||
           card.querySelector('p.p') || null;
  }

  function thousands(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function restorePrices() {
    cards().forEach(function (c) {
      var box = priceBox(c);
      if (box && ORIG.has(box)) { box.innerHTML = ORIG.get(box); ORIG.delete(box); }
    });
  }

  function paintPrices(q) {
    if (!q || !q.villas) return;
    var n = q.nights || nights(S.ci, S.co);
    cards().forEach(function (c) {
      var box = priceBox(c);
      var rec = box && q.villas[urlOf(c)];
      if (!box || !rec) return;
      if (!ORIG.has(box)) ORIG.set(box, box.innerHTML);
      box.innerHTML = (rec.currency || 'Rp') + ' ' + thousands(rec.total) +
                      '<span class="thb-dtot">' + T.forNights(n) + '</span>';
    });
  }

  function prices() {
    if (!S.ci || !S.co) { restorePrices(); return; }
    var key = S.ci + '_' + S.co;
    if (QUOTES[key]) { paintPrices(QUOTES[key]); return; }
    fetch('/api/quotes?from=' + S.ci + '&to=' + S.co)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) return;
        QUOTES[key] = j;
        if (S.ci + '_' + S.co === key) paintPrices(j);
      })
      .catch(function () { /* сумму не показали — в карточке осталась цена «от» */ });
  }

  var shortInfo = { n: 0, min: 0 };

  function apply() {
    var on = !!(S.ci && S.co);
    shortInfo = { n: 0, min: 0 };

    cards().forEach(function (c) {
      if (!on) { c.removeAttribute('data-thb-date'); note(c, ''); return; }
      var v = verdict(c);
      if (v === 'busy' || v === 'short') {
        c.setAttribute('data-thb-date', 'off');
        note(c, '');
        if (v === 'short' && c.style.display !== 'none') {
          var m = minStay(CAL[urlOf(c)] || {}, S.ci);
          shortInfo.n++;
          if (!shortInfo.min || m < shortInfo.min) shortInfo.min = m;
        }
        return;
      }
      c.removeAttribute('data-thb-date');
      note(c, v === 'unknown' ? T.onRequest : '', false);
    });

    label();
    title();
    drawerCta();
    hint(on);
    empty(on);
    prices();
    url();
    pushToSheet();
    try { document.dispatchEvent(new CustomEvent('thb:cards-changed')); } catch (e) {}
  }

  /* Виллы, свободные на эти даты, но с длинным минимальным сроком: прятать
     молча нечестно — гость решит, что всё занято, хотя достаточно добавить
     ночь. */
  function hint(on) {
    var el = document.getElementById('thbDatesHint');
    var show = on && shortInfo.n > 0;
    if (!show) { if (el) el.remove(); return; }
    if (!el) {
      var t = document.getElementById('resultsTitle');
      if (!t || !t.parentElement) return;
      el = document.createElement('p');
      el.id = 'thbDatesHint';
      t.parentElement.insertBefore(el, t.nextSibling);
    }
    el.textContent = T.longer(shortInfo.n, shortInfo.min);
  }

  function label() {
    var on = !!(S.ci && S.co);

    if (btn) {
      btn.querySelector('span').textContent = on ? range(S.ci, S.co) : T.dates;
      btn.setAttribute('data-on', on ? '1' : '0');
    }

    [].forEach.call(document.querySelectorAll('[data-thb-ci]'), function (e) {
      e.textContent = S.ci ? short(S.ci) : T.addDate;
      e.classList.toggle('set', !!S.ci);
    });
    [].forEach.call(document.querySelectorAll('[data-thb-co]'), function (e) {
      e.textContent = S.co ? short(S.co) : T.addDate;
      e.classList.toggle('set', !!S.co);
    });
    [].forEach.call(document.querySelectorAll('[data-thb-clear]'), function (e) {
      e.style.display = on ? '' : 'none';
    });
  }

  /* Район берём из адреса страницы или из активного чипа, а не из заголовка:
     заголовок к этому моменту мог переписать поиск в шапке. */
  function areaLabel() {
    var m = path.match(/^\/villas\/([^/]+)\/$/);
    var a = m ? m[1] : '';
    if (!a) {
      var on = document.querySelector('.thb-qchip.on');
      a = (on && on.getAttribute('data-area')) || '';
    }
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : '';
  }

  /* Кнопка в ящике фильтров считает свои карточки и не знает про даты:
     показывала «Show 11 villas», когда на эти даты свободны восемь. */
  function drawerCta() {
    var panel = document.getElementById('filterPanel');
    var cta = panel && panel.querySelector('.btn-primary');
    if (cta) cta.textContent = T.apply + ' ' + T.villas(visibleCards().length);
  }

  function title() {
    var el = document.getElementById('resultsTitle');
    if (!el) return;
    if (baseTitle === null) baseTitle = el.textContent.trim();
    if (!S.ci || !S.co) { el.textContent = baseTitle; return; }
    var a = areaLabel();
    el.textContent = T.free(visibleCards().length) + ' · ' + range(S.ci, S.co) +
                     (a ? ' — ' + a : '');
  }

  function empty(on) {
    var box = document.getElementById('thbNoDates');
    var grid = document.getElementById('cardGrid');
    var show = on && visibleCards().length === 0;
    if (!show) { if (box) box.remove(); return; }
    if (!box && grid && grid.parentElement) {
      box = document.createElement('div');
      box.id = 'thbNoDates';
      box.textContent = T.none;
      grid.parentElement.insertBefore(box, grid);
    }
  }

  /* Даты в адресе: чтобы ссылку можно было переслать и чтобы страница виллы
     открылась уже с выбранными датами. */
  function url() {
    try {
      var u = new URL(location.href);
      if (S.ci && S.co) { u.searchParams.set('checkin', S.ci); u.searchParams.set('checkout', S.co); }
      else { u.searchParams.delete('checkin'); u.searchParams.delete('checkout'); }
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) {}
  }

  /* Мобильная шторка и большой поиск в шапке каталога держат те же даты: два
     разных ответа на один вопрос на одной странице — это поломка. */
  function pushToSheet() {
    var ci = document.getElementById('thbCi'), co = document.getElementById('thbCo');
    if (ci && ci.value !== S.ci) ci.value = S.ci;
    if (co && co.value !== S.co) co.value = S.co;

    /* мобильная «таблетка» поиска над списком */
    var sub = document.querySelector('#thbSearchPill .tsp-s');
    if (sub) {
      var bits = sub.textContent.split('·');
      bits[0] = (S.ci && S.co ? range(S.ci, S.co) : T.any) + ' ';
      sub.textContent = bits.join('·');
    }

    var vi = document.getElementById('hsInVal'), vo = document.getElementById('hsOutVal');
    if (vi) { vi.textContent = S.ci ? short(S.ci) : T.addDate; vi.classList.toggle('set', !!S.ci); }
    if (vo) { vo.textContent = S.co ? short(S.co) : T.addDate; vo.classList.toggle('set', !!S.co); }
    if (window.thbHeroQ) { window.thbHeroQ.ci = S.ci; window.thbHeroQ.co = S.co; }
  }

  /* Большой поиск в шапке каталога: свой календарь, свои поля. Его «Search»
     фильтровал по району и гостям, даты уходили только в заголовок. */
  function hookHero() {
    var go = document.getElementById('hsGo');
    if (go) go.addEventListener('click', function () {
      setTimeout(function () {
        var q = window.thbHeroQ || {};
        var a = q.ci || '', b = q.co || '';
        if (a === S.ci && b === S.co) { if (S.ci && S.co) apply(); return; }
        S.ci = a; S.co = b; D.ci = a; D.co = b;
        load().then(apply);
      }, 0);
    });
    var clr = document.getElementById('calClear');
    if (clr) clr.addEventListener('click', function () {
      setTimeout(function () {
        if (!S.ci && !S.co) return;
        S.ci = S.co = ''; D.ci = D.co = ''; apply();
      }, 0);
    });
  }

  function pullFromSheet() {
    var ci = document.getElementById('thbCi'), co = document.getElementById('thbCo');
    var a = ci ? ci.value : '', b = co ? co.value : '';
    if (a === S.ci && b === S.co) return;
    S.ci = a; S.co = b; D.ci = a; D.co = b;
    load().then(apply);
  }

  function hookSheet() {
    var ci = document.getElementById('thbCi'), co = document.getElementById('thbCo');
    if (ci) ci.addEventListener('change', pullFromSheet);
    if (co) co.addEventListener('change', pullFromSheet);
    var go = document.getElementById('thbSheetApply');
    if (go) go.addEventListener('click', function () { setTimeout(pullFromSheet, 0); });
    var clr = document.querySelector('.tsh-clear');
    if (clr) clr.addEventListener('click', function () { setTimeout(pullFromSheet, 0); });
  }

  /* Клик по карточке несёт выбранные даты на страницу виллы. */
  function hookCards() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || !S.ci || !S.co) return;
      var card = e.target.closest ? e.target.closest('.prop-card') : null;
      if (!card || e.target.closest('.thb-fav, [data-fav-btn], a')) return;
      var u = urlOf(card);
      if (!u) return;
      e.preventDefault(); e.stopPropagation();
      location.href = (IT ? '/it' : '') + u + '?checkin=' + S.ci + '&checkout=' + S.co;
    }, true);
  }

  /* Прочие фильтры (ящик, чипы районов, сортировка) меняют inline display —
     пересчитываем заголовок и пустую выдачу, само скрытие держит CSS. */
  function watch() {
    if (!window.MutationObserver) return;

    var grid = document.getElementById('cardGrid');
    if (grid) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(function () { if (S.ci && S.co) apply(); }, 60);
      }).observe(grid, { attributes: true, subtree: true, attributeFilter: ['style'] });
    }

    /* Ящик фильтров и сортировка пишут в заголовок свой счёт («2 villas
       available»), не зная про даты. Возвращаем свой — но только когда даты
       выбраны и текст действительно чужой, иначе получится вечный цикл. */
    var el = document.getElementById('resultsTitle');
    if (!el) return;
    var mine = '';
    var lock = false;
    new MutationObserver(function () {
      if (lock || !S.ci || !S.co) return;
      if (el.textContent.trim() === mine) return;
      lock = true;
      title();
      mine = el.textContent.trim();
      setTimeout(function () { lock = false; }, 0);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  function fromUrl() {
    try {
      var p = new URLSearchParams(location.search);
      var a = p.get('checkin'), b = p.get('checkout');
      if (a && b && a < b && b > today()) { S.ci = a; S.co = b; D.ci = a; D.co = b; return true; }
    } catch (e) {}
    return false;
  }

  function init() {
    if (!document.querySelector('.prop-card')) return;
    if (!build()) return;
    var t0 = document.getElementById('resultsTitle');
    if (t0) baseTitle = t0.textContent.trim();   /* до любых фильтров */
    buildHeroBar();
    buildFilterRow();
    hookSheet();
    hookHero();
    hookCards();
    watch();
    if (fromUrl()) { label(); load().then(apply); }
    else pullFromSheet();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
