/* Карта раздела «виллы на продажу».
 *
 * На странице объекта карта стоит сразу: секция «Where you'll be» для того и
 * есть. В каталоге она по умолчанию свёрнута в одну строку с кнопкой — там
 * человек пришёл смотреть карточки, и большой прямоугольник посреди списка
 * только мешает. Нажал «Show map» — карта развернулась под строкой.
 *
 * Точки — все наши объекты на продажу. Клик открывает карточку: фото, цена,
 * район, ключевые цифры и ссылка. Карточку держим низкой, чтобы она помещалась
 * в высоту карты и не вылезала за её край; Leaflet при этом сам подвигает
 * карту так, чтобы карточка была видна целиком.
 *
 * Цена в карточке — обычный текст «Rp …» или атрибут data-thb-usd, поэтому
 * переключатель валют в шапке пересчитывает её сам, как и везде на сайте.
 *
 * Библиотека своя, лежит в /vendor/leaflet — без внешних CDN. Тайлы
 * OpenStreetMap; строчка «© OpenStreetMap» в углу — условие их лицензии.
 *
 * Координаты берём из data/villas.json, а туда они попадают из Hostex — из той
 * же системы, что отдаёт календарь. Своих координат мы не выдумываем. Точный
 * дом не раскрываем: у текущего объекта рисуем круг района.
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
  /* Каталог района: /villas-for-sale/<район>/ */
  var mArea = path.match(/^\/villas-for-sale\/([^/]+)\/$/);

  var slug = mSale ? mSale[1] + '/' + mSale[2] : null;
  var areaOnly = mSale ? null : (mArea ? mArea[1] : null);

  style();

  if (mSale) {
    var holder = holderOnSalePage();
    if (holder) whenNear(holder, function () { start(holder); });
  } else {
    buildCatalogPanel();
  }

  /* ---------- страница объекта ---------- */

  /* Тот же бокс на 376px, в котором на страницах аренды лежит мёртвый
     MapKit: вёрстка у аренды и продажи одна. */
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

  /* ---------- каталог: строка с кнопкой, карта по запросу ---------- */

  function buildCatalogPanel() {
    /* Сетка карточек называется по-разному на хабе и в районах. Берём только
       видимую: точно такая же разметка лежит в выпадающем меню шапки. */
    var grid = null;
    var cands = document.querySelectorAll('#cardGrid, .cat-grid, div.g');
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].offsetParent) { grid = cands[i]; break; }
    }
    if (!grid || !grid.parentElement) return;

    /* Вставляем внутрь .cards-wrap — это тот контейнер, который держит поля и
       максимальную ширину каталога. Если встать снаружи, строка растянется во
       всю ширину экрана и не совпадёт с сеткой карточек. */
    var host = grid.closest ? grid.closest('.cards-wrap') : null;
    var before = grid;
    if (host) {
      before = grid;
      while (before && before.parentElement !== host) before = before.parentElement;
      if (!before) before = grid;
    }

    var wrap = document.createElement('section');
    wrap.className = 'thb-mapblock';
    wrap.id = 'thbSaleMapSection';

    var bar = document.createElement('div');
    bar.className = 'thb-mapbar';

    var txt = document.createElement('div');
    txt.className = 'thb-mapbar-t';
    txt.innerHTML = '<b>See where they are</b>' +
      '<span class="thb-mapbar-s">All our listings on one map</span>';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thb-mapbtn';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = pinSvg() + '<span>Show map</span>';

    var box = document.createElement('div');
    box.className = 'thb-mapbox';
    box.hidden = true;

    bar.appendChild(txt);
    bar.appendChild(btn);
    wrap.appendChild(bar);
    wrap.appendChild(box);
    before.parentElement.insertBefore(wrap, before);

    var started = false;
    btn.addEventListener('click', function () {
      var open = box.hidden;
      box.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.lastChild.textContent = open ? 'Hide map' : 'Show map';
      if (open && !started) { started = true; start(box); }
      else if (open && window.thbSaleMap) {
        setTimeout(function () { window.thbSaleMap.invalidateSize(); }, 60);
      }
    });

    /* Число объектов в подписи — из тех же данных, что и точки. */
    data().then(function (list) {
      if (!list.length) { wrap.remove(); return; }
      var n = areaOnly ? list.filter(function (s) { return s.areaSlug === areaOnly; }).length : list.length;
      txt.querySelector('.thb-mapbar-s').textContent =
        (areaOnly ? n + (n === 1 ? ' villa here' : ' villas here') : n + ' listings') +
        ' · streets shown as an area, not a doorstep';
    }).catch(function () { wrap.remove(); });
  }

  function pinSvg() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5' +
      'A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';
  }

  /* ---------- данные ---------- */

  var cache = null;
  function data() {
    if (cache) return cache;
    cache = Promise.all([
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
    return cache;
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

  function start(box) {
    Promise.all([data(), lib()]).then(function (r) {
      draw(box, r[0]);
    }).catch(function () { /* нет карты — блок остаётся как был */ });
  }

  /* ---------- отрисовка ---------- */

  function draw(box, list) {
    if (!list.length) return;

    var here = slug ? list.filter(function (s) { return s.slug === slug; })[0] : null;
    var focus = list.filter(function (s) { return !areaOnly || s.areaSlug === areaOnly; });
    if (!focus.length) focus = list;

    box.innerHTML = '';
    box.style.position = 'relative';

    var map = L.map(box, {
      scrollWheelZoom: false,      /* колесо крутит страницу, а не карту */
      zoomControl: true,
      attributionControl: true
    });
    window.thbSaleMap = map;

    /* Подпись оставляем самую скупую: «© OpenStreetMap» — условие лицензии на
       тайлы. Логотип Leaflet со своим флагом убираем. */
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

    /* Ширину и высоту карточки считаем от самой карты: в фиксированных 250px
       она вылезала за край вместе с «хвостиком». */
    var w = Math.max(180, Math.min(250, box.clientWidth - 44));
    var maxH = Math.max(140, Math.min(300, box.clientHeight - 120));

    list.forEach(function (s) {
      var mine = here && s.slug === here.slug;
      L.marker([s.lat, s.lng], {
        title: s.shortName,
        riseOnHover: true,
        icon: L.divIcon({
          className: '',
          html: '<span class="thb-pin' + (mine ? ' thb-pin-me' : '') + '"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -11]
        })
      }).addTo(map).bindPopup(card(s), {
        minWidth: w,
        maxWidth: w,
        maxHeight: maxH,
        autoPan: true,
        keepInView: true,
        /* сверху место под кнопки зума, снизу — под подпись карты */
        autoPanPaddingTopLeft: [14, 18],
        autoPanPaddingBottomRight: [14, 30],
        closeButton: true
      });
    });

    note(box);
    fullscreen(map, box);

    /* Своё дотягивание кадра под карточку. Штатный autoPan у Leaflet считает
       место от точки и на невысокой карте (376px в секции виллы) регулярно
       оставляет карточку наполовину за верхним или нижним краем. Поэтому после
       открытия сами сдвигаем карту на половину высоты карточки вверх — тогда
       она целиком в кадре, у какого бы края ни стояла точка. */
    map.on('popupopen', function (e) {
      var el = e.popup._container;
      if (!el) return;
      var px = map.project(e.popup.getLatLng(), map.getZoom());
      px.y -= el.clientHeight / 2 + 8;
      /* Без анимации: если гость щёлкает по точкам подряд, анимация
         предыдущего сдвига глотает следующий, и карточка остаётся за краем. */
      map.panTo(map.unproject(px, map.getZoom()), { animate: false });
    });

    /* Колесо включаем только после клика по карте: иначе оно перехватывает
       прокрутку страницы. */
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

    if (here) hideOldButtons(box);
  }

  /* Карточка в точке: то же, что в карточке каталога, только низкая — она
     должна помещаться в высоту карты целиком. */
  function card(s) {
    var url = '/villas-for-sale/' + s.slug + '/';
    var img = s.image
      ? '<a href="' + url + '" class="thb-pop-i"><img src="' + s.image + '" alt="' + esc(s.shortName) +
        '" loading="lazy" width="250" height="100"></a>'
      : '';

    var bits = [];
    if (s.bedrooms) bits.push(s.bedrooms + ' bd');
    if (s.buildingSqm) bits.push(s.buildingSqm + ' m²');
    if (s.leaseYears) bits.push(s.leaseYears + ' yrs lease');
    else if (s.ownership === 'leasehold' && s.leaseUntil) bits.push('lease to ' + s.leaseUntil);
    else if (s.ownership) bits.push(s.ownership);

    return '<div class="thb-pop">' + img +
      '<div class="thb-pop-b">' +
        '<p class="thb-pop-p">' + price(s) + '</p>' +
        '<h4><a href="' + url + '">' + esc(s.shortName) + '</a></h4>' +
        '<p class="thb-pop-m">' + esc(s.area) + ', Bali · ' + bits.join(' · ') + '</p>' +
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

  /* Подпись в углу: места на карте примерные — это честно и снимает вопрос
     «почему точка не на моём доме». */
  function note(box) {
    var p = document.createElement('p');
    p.className = 'thb-map-note';
    p.textContent = 'Locations are approximate';
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
     только на него нельзя: в фоновой вкладке и в скрытом окне он молчит.
     Рядом идёт простая проверка по координатам блока. */
  function whenNear(el, fn) {
    var done = false, timer;
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
    timer = setInterval(check, 500);
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  function style() {
    if (document.getElementById('thbSaleMapCss')) return;
    var st = document.createElement('style');
    st.id = 'thbSaleMapCss';
    st.textContent =
      /* строка с кнопкой в каталоге */
      '.thb-mapblock{margin:0 0 26px}' +
      '.thb-mapbar{display:flex;align-items:center;justify-content:space-between;gap:16px;' +
        'padding:13px 16px;border:1px solid rgba(10,10,10,.1);border-radius:14px;background:#faf8f4}' +
      '.thb-mapbar-t b{display:block;font:600 15px/1.3 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '.thb-mapbar-s{display:block;margin-top:2px;font:400 12.5px/1.4 Inter,system-ui,sans-serif;color:#6b6b66}' +
      '.thb-mapbtn{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 15px;' +
        'flex-shrink:0;border:1px solid rgba(10,10,10,.16);border-radius:999px;background:#fff;' +
        'color:#0a0a0a;font:600 13.5px/1 Inter,system-ui,sans-serif;cursor:pointer}' +
      '@media(hover:hover){.thb-mapbtn:hover{border-color:#0a0a0a;background:#f4f1ea}}' +
      '.thb-mapbtn svg{opacity:.55}' +
      '.thb-mapbox{height:430px;margin-top:10px;border-radius:14px;overflow:hidden;background:#eee9e0}' +
      '@media(max-width:600px){.thb-mapbar{flex-direction:column;align-items:stretch;gap:11px}' +
        '.thb-mapbtn{justify-content:center;width:100%}.thb-mapbox{height:340px}}' +
      /* точки */
      '.thb-pin{display:block;width:16px;height:16px;border-radius:50%;' +
        'background:#2f7d4f;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);' +
        'margin:3px;cursor:pointer;transition:transform .12s}' +
      '.thb-pin:hover{transform:scale(1.25)}' +
      '.thb-pin-me{background:#b84a31;width:20px;height:20px;margin:1px}' +
      '.thb-map-note{position:absolute;left:10px;bottom:10px;z-index:600;margin:0;' +
        'background:rgba(255,255,255,.9);border-radius:6px;padding:4px 8px;' +
        'font:400 11px/1.3 Inter,system-ui,sans-serif;color:#6b6b66;pointer-events:none}' +
      '.thb-fs a{font-size:15px;line-height:26px;text-align:center}' +
      '.leaflet-control-attribution{background:rgba(255,255,255,.72)!important;' +
        'font:400 10px/1.4 Inter,system-ui,sans-serif!important;padding:1px 5px!important}' +
      '.leaflet-control-attribution a{color:#8a8a84!important;text-decoration:none}' +
      /* карточка объекта на карте */
      '.leaflet-popup-content{margin:0}' +
      '.leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden;' +
        'box-shadow:0 8px 26px rgba(20,16,10,.22)}' +
      '.leaflet-popup-close-button{top:5px!important;right:6px!important;color:#fff!important;' +
        'text-shadow:0 1px 3px rgba(0,0,0,.55);font-size:19px!important}' +
      '.thb-pop-i{display:block;line-height:0}' +
      '.thb-pop img{display:block;width:100%;height:100px;object-fit:cover}' +
      '.thb-pop-b{padding:9px 12px 12px}' +
      '.thb-pop-p{margin:0 0 2px;font:700 16px/1.25 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '.thb-pop h4{margin:0 0 3px;font:600 13.5px/1.3 Inter,system-ui,sans-serif}' +
      '.thb-pop h4 a{color:#0a0a0a;text-decoration:none}' +
      '.thb-pop h4 a:hover{text-decoration:underline}' +
      '.thb-pop-m{margin:0;font:400 12px/1.4 Inter,system-ui,sans-serif;color:#6b6b66}' +
      '.thb-pop-cta{display:block;margin-top:9px;padding:8px 12px;border-radius:8px;text-align:center;' +
        'background:#0a0a0a;color:#fff!important;text-decoration:none;' +
        'font:600 12.5px/1 Inter,system-ui,sans-serif}' +
      '.thb-pop-cta:hover{background:#2a2a2a}' +
      /* высоту в каталоге задаёт .thb-mapbox; правило с id перебивало её
         своими height:100% и складывало карту в ноль */
      '#section-location .leaflet-container{width:100%;height:100%}' +
      '#thbSaleMapSection .thb-mapbox.leaflet-container{height:430px}' +
      '@media(max-width:600px){#thbSaleMapSection .thb-mapbox.leaflet-container{height:340px}}' +
      '.leaflet-container{font:inherit;background:#eee9e0}';
    document.head.appendChild(st);
  }
})();
