/* Карта раздела «виллы на продажу».
 *
 * На странице объекта и в каталоге показываем одну и ту же карту: все наши
 * объекты, выставленные на продажу, точками на настоящей карте, а не один
 * серый прямоугольник с местом текущей виллы. Покупатель смотрит не «где стоит
 * этот дом», а «что у вас вообще есть и где» — так это устроено у агентств, и
 * так же должно быть у нас.
 *
 * Точка кликается и открывается карточкой: фото, цена, район, номер объекта,
 * спальни и срок лизхолда, кнопка на страницу объекта. Цена в карточке —
 * обычный текст с «Rp …» или атрибутом data-thb-usd, поэтому переключатель
 * валют пересчитывает её сам, как и везде на сайте.
 *
 * Библиотека своя, лежит в /vendor/leaflet — без внешних CDN на странице.
 * Тайлы OpenStreetMap, атрибуция обязательна и стоит в углу карты.
 * Грузим всё лениво, когда карта подходит к экрану: это сотни килобайт и
 * чужие запросы, которые незачем делать на каждой загрузке страницы.
 *
 * Координаты берём те же, что и в аренде (data/villas.json) — объект-то один и
 * тот же. Точный дом не раскрываем: у текущего объекта рисуем круг района, как
 * на странице аренды, и подписываем, что места примерные.
 */
(function () {
  'use strict';

  var CSS = '/vendor/leaflet/leaflet.css';
  var JS = '/vendor/leaflet/leaflet.js';
  var RADIUS_M = 45;          /* круг «примерно здесь» вокруг текущего объекта */
  var ZOOM_ONE = 15;          /* страница объекта: видно район и соседей */

  var path = location.pathname;
  if (path.indexOf('/villas-for-sale/') !== 0) return;
  if (/\/gallery\/$/.test(path)) return;

  /* Страница объекта: /villas-for-sale/<район>/<объект>/ */
  var mSale = path.match(/^\/villas-for-sale\/([^/]+)\/([^/]+)\/$/);
  /* Каталог: /villas-for-sale/ и /villas-for-sale/<район>/ */
  var mArea = path.match(/^\/villas-for-sale\/([^/]+)\/$/);

  var host = mSale ? holderOnSalePage() : holderInCatalog();
  if (!host) return;

  var slug = mSale ? mSale[1] + '/' + mSale[2] : null;
  var areaOnly = mSale ? null : (mArea ? mArea[1] : null);

  whenNear(host, function () {
    Promise.all([data(), lib()]).then(function (r) {
      draw(host, r[0]);
    }).catch(function () { /* нет карты — секция остаётся как была */ });
  });

  /* ---------- где живёт карта ---------- */

  /* На странице объекта это тот же бокс на 376px, в котором на страницах аренды
     лежит мёртвый MapKit: вёрстка одна на оба раздела. */
  function holderOnSalePage() {
    var sec = document.getElementById('section-location');
    if (!sec) return null;
    var mk = sec.querySelector('.mk-map-view');
    if (mk) {
      var up = mk;
      for (var i = 0; i < 4 && up; i++) {
        if (/h-\[376px\]/.test(up.className || '')) return up;
        up = up.parentElement;
      }
      return mk.parentElement;
    }
    var all = sec.querySelectorAll('[class*="376px"]');
    return all.length ? all[all.length - 1] : null;
  }

  /* В каталоге своего места под карту в вёрстке нет — делаем его сами перед
     сеткой карточек, с заголовком, чтобы блок читался как раздел страницы. */
  function holderInCatalog() {
    /* Сетка карточек называется по-разному на хабе и в районах. Ищем по всем
       именам сразу, но берём только видимую: точно такая же разметка лежит в
       выпадающем меню шапки, оно скрыто, и карта, попав туда, не отрисуется —
       у скрытого блока нулевой размер, и он никогда не «подходит к экрану». */
    var grid = null;
    var cands = document.querySelectorAll('#cardGrid, .cat-grid, div.g');
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].offsetParent) { grid = cands[i]; break; }
    }
    if (!grid || !grid.parentElement) return null;

    /* Если сетка лежит в своей обёртке со счётчиком «Showing N of N»,
       встаём перед всей обёрткой, а не между счётчиком и карточками. */
    if (/cards-wrap/.test(grid.parentElement.className || '') &&
        grid.parentElement.parentElement) grid = grid.parentElement;

    var wrap = document.createElement('section');
    wrap.id = 'thbSaleMapSection';
    wrap.style.cssText = 'margin:0 0 34px';

    var h = document.createElement('h2');
    h.textContent = 'Where these villas are';
    h.style.cssText = 'margin:0 0 12px;font:600 21px/1.3 Inter,system-ui,sans-serif;color:#0a0a0a';

    var box = document.createElement('div');
    box.style.cssText = 'height:420px;border-radius:14px;overflow:hidden;background:#eee9e0';

    wrap.appendChild(h);
    wrap.appendChild(box);
    grid.parentElement.insertBefore(wrap, grid);
    return box;
  }

  /* ---------- данные ---------- */

  function data() {
    return Promise.all([
      fetch('/data/for-sale.json').then(function (r) { return r.json(); }),
      fetch('/data/villas.json').then(function (r) { return r.json(); })
    ]).then(function (r) {
      var villas = {};
      (r[1] || []).forEach(function (v) { villas[v.id] = v; });

      return (r[0] || []).filter(function (s) {
        return s.status !== 'sold';
      }).map(function (s) {
        var v = villas[s.villaId] || {};
        s.lat = v.lat; s.lng = v.lng;
        s.image = v.cardImage || (v.images && v.images[0]) || '';
        return s;
      }).filter(function (s) {
        return typeof s.lat === 'number' && typeof s.lng === 'number';
      });
    });
  }

  function lib() {
    if (window.L && window.L.map) return Promise.resolve();

    if (!document.querySelector('link[href="' + CSS + '"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS;
      document.head.appendChild(link);
    }
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = JS;
      s.onload = ok;
      s.onerror = no;
      document.head.appendChild(s);
    });
  }

  /* ---------- отрисовка ---------- */

  function draw(box, list) {
    if (!list.length) return;

    var here = slug ? list.filter(function (s) { return s.slug === slug; })[0] : null;
    /* В районе показываем район, но соседние объекты не прячем: они рядом и
       покупателю полезны. Просто кадр ставим по своим. */
    var focus = list.filter(function (s) {
      return !areaOnly || s.areaSlug === areaOnly;
    });
    if (!focus.length) focus = list;

    style();
    box.innerHTML = '';
    box.style.position = 'relative';

    var map = L.map(box, {
      scrollWheelZoom: false,      /* колесо крутит страницу, а не карту */
      zoomControl: true,
      attributionControl: true
    });

    /* Подпись оставляем самую скупую: строчка «© OpenStreetMap» — это условие
       лицензии на тайлы, без неё карту брать нельзя. Всё остальное, что Leaflet
       ставит от себя (свой логотип с флагом и слово Leaflet), убираем. */
    map.attributionControl.setPrefix(false);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright" rel="noopener">&copy; OpenStreetMap</a>'
    }).addTo(map);

    if (here) {
      map.setView([here.lat, here.lng], ZOOM_ONE);
      L.circle([here.lat, here.lng], {
        radius: RADIUS_M,
        color: '#b84a31', weight: 2, opacity: .65,
        fillColor: '#b84a31', fillOpacity: .13,
        interactive: false
      }).addTo(map);
    } else {
      map.fitBounds(focus.map(function (s) { return [s.lat, s.lng]; }), {
        padding: [40, 40], maxZoom: 15
      });
    }

    list.forEach(function (s) {
      var mine = here && s.slug === here.slug;
      L.marker([s.lat, s.lng], {
        title: s.shortName,
        icon: L.divIcon({
          className: '',
          html: '<span class="thb-pin' + (mine ? ' thb-pin-me' : '') + '"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -12]
        })
      }).addTo(map).bindPopup(card(s), { minWidth: 250, maxWidth: 280, closeButton: true });
    });

    note(box);
    fullscreen(map, box);

    /* Клик по карте включает колесо: гость сам сказал, что работает с картой. */
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

    /* На странице объекта над картой висят кнопки старой вёрстки — они звали
       мёртвый MapKit. Убираем: у карты свои. */
    if (here) hideOldButtons(box);
  }

  /* Карточка в точке: то же, что в карточке каталога, только компактно. */
  function card(s) {
    var url = '/villas-for-sale/' + s.slug + '/';
    var img = s.image
      ? '<a href="' + url + '"><img src="' + s.image + '" alt="' + esc(s.shortName) +
        '" loading="lazy" width="250" height="150"></a>'
      : '';

    var bits = [];
    if (s.bedrooms) bits.push(s.bedrooms + (s.bedrooms === 1 ? ' bedroom' : ' bedrooms'));
    if (s.buildingSqm) bits.push(s.buildingSqm + ' m²');
    if (s.leaseYears) bits.push('leasehold ' + s.leaseYears + ' years');
    else if (s.ownership === 'leasehold' && s.leaseUntil) bits.push('leasehold until ' + s.leaseUntil);
    else if (s.ownership) bits.push(s.ownership);

    return '<div class="thb-pop">' + img +
      '<div class="thb-pop-b">' +
        '<p class="thb-pop-p">' + price(s) + '</p>' +
        '<h4><a href="' + url + '">' + esc(s.shortName) + '</a></h4>' +
        '<p class="thb-pop-m">' + esc(s.area) + ', Bali · ' + esc(s.ref) + '</p>' +
        '<p class="thb-pop-m">' + bits.join(' · ') + '</p>' +
        '<a class="thb-pop-cta" href="' + url + '">View this villa</a>' +
      '</div></div>';
  }

  /* Цена показывается в валюте продавца, а пересчитывает её общий скрипт:
     доллары через data-thb-usd, рупии — по тексту «Rp …». */
  function price(s) {
    if (s.priceUsd) {
      return '<span data-thb-usd="' + s.priceUsd + '">$' + thousands(s.priceUsd) + '</span>';
    }
    if (s.priceIdr) return 'Rp ' + thousands(s.priceIdr);
    return 'Price on request';
  }

  function thousands(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Подпись в углу: адреса на карте примерные — это честно и снимает вопрос
     «а почему точка не на моём доме». */
  function note(box) {
    var p = document.createElement('p');
    p.className = 'thb-map-note';
    p.textContent = 'The locations shown are approximate.';
    box.appendChild(p);
  }

  /* Кнопка «на весь экран» рядом с зумом — как на картах агентств. */
  function fullscreen(map, box) {
    var C = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        var wrap = L.DomUtil.create('div', 'leaflet-bar thb-fs');
        var a = L.DomUtil.create('a', '', wrap);
        a.href = '#';
        a.title = 'Full screen';
        a.setAttribute('role', 'button');
        a.innerHTML = '⛶';
        L.DomEvent.on(a, 'click', function (e) {
          L.DomEvent.stop(e);
          if (document.fullscreenElement) document.exitFullscreen();
          else if (box.requestFullscreen) box.requestFullscreen();
          setTimeout(function () { map.invalidateSize(); }, 250);
        });
        return wrap;
      }
    });
    map.addControl(new C());
    document.addEventListener('fullscreenchange', function () {
      setTimeout(function () { map.invalidateSize(); }, 100);
    });
  }

  function hideOldButtons(box) {
    var wrap = box.parentElement;
    if (!wrap) return;
    ['.absolute.top-4.left-4', '.absolute.top-4.right-4'].forEach(function (sel) {
      var el = wrap.querySelector(':scope > ' + sel);
      if (el) el.style.display = 'none';
    });
  }

  /* Ленивый запуск. Основной сигнал — IntersectionObserver, но полагаться
     только на него нельзя: в фоновой вкладке и в скрытом окне он молчит, и
     карта не собирается вовсе, хотя блок для неё на странице уже есть.
     Поэтому рядом идёт простая проверка по координатам блока. */
  function whenNear(el, fn) {
    var done = false;
    function go() {
      if (done) return;
      done = true;
      window.removeEventListener('scroll', check);
      clearInterval(timer);
      fn();
    }
    function near() {
      var r = el.getBoundingClientRect();
      var h = window.innerHeight || 800;
      return r.bottom > -400 && r.top < h + 400;
    }
    function check() { if (near()) go(); }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (rows) {
        if (!rows.some(function (r) { return r.isIntersecting; })) return;
        io.disconnect();
        go();
      }, { rootMargin: '400px' });
      io.observe(el);
    }
    var timer = setInterval(check, 500);
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  function style() {
    if (document.getElementById('thbSaleMapCss')) return;
    var st = document.createElement('style');
    st.id = 'thbSaleMapCss';
    st.textContent =
      '.thb-pin{display:block;width:16px;height:16px;border-radius:50%;' +
        'background:#2f7d4f;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);' +
        'margin:3px;cursor:pointer;transition:transform .12s}' +
      '.thb-pin:hover{transform:scale(1.25)}' +
      '.thb-pin-me{background:#b84a31;width:20px;height:20px;margin:1px}' +
      '.thb-map-note{position:absolute;left:10px;bottom:10px;z-index:600;margin:0;' +
        'background:rgba(255,255,255,.92);border-radius:6px;padding:5px 9px;' +
        'font:400 12px/1.3 Inter,system-ui,sans-serif;color:#4a4a45;pointer-events:none}' +
      '.thb-fs a{font-size:15px;line-height:26px;text-align:center}' +
      /* подпись лицензии — мелко и тихо, чтобы не спорила с картой */
      '.leaflet-control-attribution{background:rgba(255,255,255,.72)!important;' +
        'font:400 10px/1.4 Inter,system-ui,sans-serif!important;padding:1px 5px!important}' +
      '.leaflet-control-attribution a{color:#8a8a84!important;text-decoration:none}' +
      '.leaflet-popup-content{margin:0;width:250px!important}' +
      '.leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden}' +
      '.thb-pop img{display:block;width:100%;height:150px;object-fit:cover}' +
      '.thb-pop-b{padding:10px 12px 12px}' +
      '.thb-pop-p{margin:0 0 3px;font:700 16px/1.25 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '.thb-pop h4{margin:0 0 4px;font:600 14px/1.3 Inter,system-ui,sans-serif}' +
      '.thb-pop h4 a{color:#0a0a0a;text-decoration:none}' +
      '.thb-pop h4 a:hover{text-decoration:underline}' +
      '.thb-pop-m{margin:0 0 2px;font:400 12.5px/1.45 Inter,system-ui,sans-serif;color:#6b6b66}' +
      '.thb-pop-cta{display:inline-block;margin-top:9px;padding:7px 12px;border-radius:8px;' +
        'background:#0a0a0a;color:#fff!important;text-decoration:none;' +
        'font:600 12.5px/1 Inter,system-ui,sans-serif}' +
      '.thb-pop-cta:hover{background:#2a2a2a}' +
      '#thbSaleMapSection .leaflet-container,#section-location .leaflet-container{' +
        'width:100%;height:100%;font:inherit;background:#eee9e0}';
    document.head.appendChild(st);
  }
})();
