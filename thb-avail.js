/* Занятые даты в календаре на странице виллы.
 *
 * Берёт занятость из /api/availability — это зеркало календаря Hostex,
 * которое воркер обновляет по расписанию. Занятые ночи гасим и перечёркиваем,
 * как это делают Airbnb и Booking, и снимаем с них клик, чтобы гость не мог
 * выбрать заезд на занятый день.
 *
 * Файл ничего не рисует сам: календарь строит renderCalendars() на странице
 * виллы, мы только докрашиваем результат и делаем это заново после каждой
 * перерисовки (переключение месяца, свайп).
 */
(function () {
  'use strict';

  var sec = document.getElementById('section-availability');
  if (!sec || typeof window.renderCalendars !== 'function') return;

  var BUSY = null;                 /* Set из 'YYYY-MM-DD', занятые ночи */
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  /* ---------- стиль ---------- */
  var st = document.createElement('style');
  /* Занятое и прошедшее должны отличаться с первого взгляда. У прошедших дат
     на странице виллы стоит color:#d1d5db без линии — если занятые сделать
     таким же серым, они читаются как "уже прошло", а не "занято". Поэтому
     песочная подложка + перечёркивание терракотой из палитры бренда. */
  st.textContent =
    '.calendar-day.booked{color:#8a8378;cursor:default;background:#f0e7da;' +
      'text-decoration:line-through;text-decoration-color:#b84a31;' +
      'text-decoration-thickness:2px}' +
    '.calendar-day.booked:hover{background:#f0e7da}' +
    '.thb-avail-note{margin-top:10px;font-size:13px;color:#706b61;display:flex;' +
      'align-items:center;gap:8px;flex-wrap:wrap}' +
    '.thb-avail-note i{width:14px;height:14px;border-radius:50%;background:#f0e7da;' +
      'display:inline-block;position:relative;flex:none}' +
    '.thb-avail-note i::after{content:"";position:absolute;left:1px;right:1px;top:6px;' +
      'height:2px;background:#b84a31}' +
    '.thb-avail-warn{color:#b84a31}';
  document.head.appendChild(st);

  /* ---------- какая это вилла ---------- */
  /* Путь вида /villa/sanur/stylish-2br-pool-townhouse-sanur/ (и его языковые
     варианты) -> slug из villas.json. Сам файл страницы виллы и так тянет. */
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

  /* ---------- даты ---------- */
  function key(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  /* Название месяца -> номер. На итальянских страницах подпись переведена
     («Ottobre 2026»), а прежний запасной разбор через new Date() молча давал
     январь: V8 пропускает непонятное слово и читает только год. Поэтому
     сверяем и с английским списком, и с названиями месяцев языка страницы. */
  function monthIndex(name) {
    var n = String(name || '').toLowerCase();
    if (!n) return -1;
    var lang = (document.documentElement.lang || 'en');
    for (var m = 0; m < 12; m++) {
      if (n === MONTHS[m].toLowerCase()) return m;
      try {
        var loc = new Date(Date.UTC(2020, m, 1))
          .toLocaleDateString(lang, { month: 'long', timeZone: 'UTC' }).toLowerCase();
        if (n === loc) return m;
      } catch (e) {}
    }
    return -1;
  }

  function monthOf(title) {
    var parts = String(title || '').trim().split(/\s+/);
    if (parts.length < 2) return null;
    var year = parseInt(parts[parts.length - 1], 10);
    if (!year) return null;
    var m = monthIndex(parts[0]);
    return m < 0 ? null : { y: year, m: m };   /* месяц не узнали — лучше ничего не делать */
  }

  /* ---------- покраска ---------- */
  function paint() {
    if (!BUSY || !BUSY.size) return;

    var boxes = sec.querySelectorAll('.calendar-month');
    for (var i = 0; i < boxes.length; i++) {
      var titleEl = boxes[i].querySelector('.month-title');
      var when = monthOf(titleEl && titleEl.textContent);
      if (!when) continue;              /* месяц не разобрали — лучше не красить */

      var cells = boxes[i].querySelectorAll('.calendar-grid .calendar-day');
      for (var j = 0; j < cells.length; j++) {
        var cell = cells[j];
        if (cell.classList.contains('empty')) continue;
        var day = parseInt(cell.textContent, 10);
        if (!day) continue;
        if (BUSY.has(key(when.y, when.m, day))) {
          cell.classList.add('booked');
          cell.onclick = null;         /* тем же способом, каким его повесили */
        }
      }
    }
  }

  /* Календарь пересобирается при выборе даты, смене месяца и свайпе, и каждый
     раз grid.innerHTML очищается — покраска пропадает вместе с ячейками.
     Обёртку на window.renderCalendars ставить бесполезно: selectDate,
     prevMonth и nextMonth на странице виллы зовут внутреннюю функцию из
     замыкания, а не ту, что лежит в window. Поэтому смотрим на саму разметку:
     любая перестройка сетки — повод покрасить заново.

     paint() только добавляет класс и снимает onclick, то есть childList не
     меняет, — на свои же правки наблюдатель не сработает, цикла нет. */
  var repainting = false;
  function schedulePaint() {
    if (repainting) return;
    repainting = true;
    Promise.resolve().then(function () {
      repainting = false;
      try { paint(); } catch (e) {}
    });
  }

  new MutationObserver(schedulePaint).observe(sec, { childList: true, subtree: true });

  /* На случай, если календарь перерисуют через window.renderCalendars
     (так делает свайп-скрипт, добавляя месяцы) — оставляем и обёртку. */
  if (typeof window.renderCalendars === 'function') {
    var origRender = window.renderCalendars;
    window.renderCalendars = function () {
      var out = origRender.apply(this, arguments);
      schedulePaint();
      return out;
    };
  }

  /* ---------- защита от диапазона поверх занятых ночей ---------- */
  /* Занятый день кликнуть нельзя, но выбрать «до» и «после» — можно, и тогда
     в середине окажутся чужие брони. Смотрим не во внутренние переменные
     страницы, а на саму разметку: если занятая ячейка попала в выделение,
     диапазон недействителен. */
  function badRange() {
    return !!sec.querySelector('.calendar-day.booked.in-range, .calendar-day.booked.selected');
  }

  var noteText = '';

  function warn() {
    var n = sec.querySelector('.thb-avail-note');
    if (!n) return;
    n.classList.add('thb-avail-warn');
    n.innerHTML = '<i></i><span>Those dates include nights that are already booked. ' +
                  'Please pick a range without them.</span>';
    clearTimeout(warn.t);
    warn.t = setTimeout(function () {
      n.classList.remove('thb-avail-warn');
      n.innerHTML = '<i></i><span>' + noteText + '</span>';
    }, 4000);
  }

  sec.addEventListener('click', function () {
    setTimeout(function () {
      if (!BUSY || !badRange()) return;
      try { window.clearDates && window.clearDates(); } catch (e) {}
      warn();
    }, 0);
  });

  /* ---------- подпись под календарём ---------- */
  function note(text) {
    noteText = text;
    var n = sec.querySelector('.thb-avail-note');
    if (!n) {
      n = document.createElement('div');
      n.className = 'thb-avail-note';
      sec.appendChild(n);
    }
    n.innerHTML = '<i></i><span>' + text + '</span>';
  }

  /* ---------- даты из каталога ---------- */
  /* Гость отфильтровал каталог по датам и открыл виллу: даты приезжают в
     адресе и должны быть уже выбраны в календаре. Ставим их только если ночи
     свободны — иначе показали бы выбор поверх чужой брони. */
  function preset() {
    var a, b;
    try {
      var p = new URLSearchParams(location.search);
      a = p.get('checkin'); b = p.get('checkout');
    } catch (e) { return; }
    if (!a || !b || a >= b || typeof window.thbSetDates !== 'function') return;

    if (BUSY) {
      for (var d = a; d < b; d = next(d)) if (BUSY.has(d)) return;
    }
    try { window.thbSetDates(a, b); } catch (e) {}
  }

  function next(d) {
    var x = new Date(d + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + 1);
    return x.toISOString().slice(0, 10);
  }

  /* ---------- запуск ---------- */
  villaId().then(function (id) {
    if (!id) return;
    return fetch('/api/availability?villa=' + encodeURIComponent(id))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) return;
        BUSY = new Set(d.nights || []);
        paint();
        note('Crossed-out dates are already booked');
        preset();
      });
  }).catch(function () { /* нет данных — календарь просто остаётся как был */ })
    .then(function () { if (!BUSY) preset(); });
})();
