/* Карта каталога аренды: все наши виллы одним взглядом.
 *
 * Та же строка с кнопкой «Show map», что и в разделе продаж, но точки другие:
 * в аренде мы никогда не показываем дом точно — гость видит круг «примерно
 * здесь», как на странице виллы. Поэтому на карте не пины, а полупрозрачные
 * круги радиусом в сотню метров, а центр круга ещё и сдвинут от дома на
 * несколько десятков метров — одинаково для одной и той же виллы при каждой
 * загрузке, чтобы карта не «дрожала», но не в точку.
 *
 * Клик по кругу — карточка: фото, название, район, спальни и гости, цена «от»
 * (берём её с карточки в каталоге на этой же странице, там она уже
 * пересчитана в валюту гостя) и ссылка на виллу.
 *
 * Данные — data/villas.json, координаты в нём из Hostex. Библиотека своя,
 * /vendor/leaflet, тайлы OpenStreetMap. Грузится только по нажатию кнопки.
 */
(function () {
  'use strict';

  var CSS = '/vendor/leaflet/leaflet.css';
  var JS = '/vendor/leaflet/leaflet.js';
  var RADIUS_M = 110;      /* круг «примерно здесь» */
  var SHIFT_M = 70;        /* сдвиг центра круга от дома */

  var path = location.pathname;
  var mArea = path.match(/^\/villas\/([^/]+)\/$/);
  var isList = path === '/property-rental/' || path === '/villas/' || !!mArea;
  if (!isList) return;
  var areaOnly = mArea ? mArea[1] : null;

  style();
  buildPanel();

  /* ---------- панель над сеткой ---------- */

  function buildPanel() {
    var grid = null;
    var cands = document.querySelectorAll('#cardGrid, .cat-grid, div.g');
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].offsetParent) { grid = cands[i]; break; }
    }
    if (!grid || !grid.parentElement) return;

    /* встаём внутрь .cards-wrap — он держит поля и ширину каталога */
    var host = grid.closest ? grid.closest('.cards-wrap') : null;
    var before = grid;
    if (host) {
      while (before && before.parentElement !== host) before = before.parentElement;
      if (!before) before = grid;
    }

    var wrap = document.createElement('section');
    wrap.className = 'thb-mapblock';
    wrap.id = 'thbRentMapSection';

    var bar = document.createElement('div');
    bar.className = 'thb-mapbar';
    var txt = document.createElement('div');
    txt.className = 'thb-mapbar-t';
    txt.innerHTML = '<b>See where the villas are</b>' +
      '<span class="thb-mapbar-s">All our villas on one map</span>';
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
      if (open && !started) {
        started = true;
        Promise.all([data(), lib()]).then(function (r) { draw(box, r[0]); })
          .catch(function () { wrap.remove(); });
      } else if (open && window.thbRentMap) {
        setTimeout(function () { window.thbRentMap.invalidateSize(); }, 60);
      }
    });

    data().then(function (list) {
      if (!list.length) { wrap.remove(); return; }
      var n = areaOnly ? list.filter(function (v) { return v.areaSlug === areaOnly; }).length : list.length;
      txt.querySelector('.thb-mapbar-s').textContent =
        (areaOnly ? n + (n === 1 ? ' villa here' : ' villas here') : n + ' villas') +
        ' · shown as an area, not a doorstep';
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
    cache = fetch('/data/villas.json').then(function (r) { return r.json(); }).then(function (list) {
      return (list || []).filter(function (v) {
        return typeof v.lat === 'number' && typeof v.lng === 'number';
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

  /* Сдвиг центра круга: одинаковый для виллы при каждой загрузке (по её id),
     но не в дом. ~70 м в сторону, зависящую от id. */
  function fuzz(v) {
    var h = 0;
    for (var i = 0; i < v.id.length; i++) h = (h * 31 + v.id.charCodeAt(i)) >>> 0;
    var ang = (h % 360) * Math.PI / 180;
    var dLat = SHIFT_M * Math.cos(ang) / 111320;
    var dLng = SHIFT_M * Math.sin(ang) / (111320 * Math.cos(v.lat * Math.PI / 180));
    return [v.lat + dLat, v.lng + dLng];
  }

  /* ---------- отрисовка ---------- */

  function draw(box, list) {
    var focus = list.filter(function (v) { return !areaOnly || v.areaSlug === areaOnly; });
    if (!focus.length) focus = list;

    box.innerHTML = '';
    box.style.position = 'relative';

    var map = L.map(box, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    window.thbRentMap = map;
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '<a href="https://www.openstreetmap.org/copyright" rel="noopener">&copy; OpenStreetMap</a>'
    }).addTo(map);

    var pts = focus.map(fuzz);
    map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });

    var w = Math.max(180, Math.min(250, box.clientWidth - 44));
    var maxH = Math.max(140, Math.min(300, box.clientHeight - 120));

    list.forEach(function (v) {
      var c = fuzz(v);
      var circle = L.circle(c, {
        radius: RADIUS_M,
        color: '#b84a31', weight: 2, opacity: .7,
        fillColor: '#b84a31', fillOpacity: .18
      }).addTo(map);
      circle.bindPopup(card(v), {
        minWidth: w, maxWidth: w, maxHeight: maxH,
        autoPan: true, keepInView: true,
        autoPanPaddingTopLeft: [14, 18], autoPanPaddingBottomRight: [14, 30]
      });
    });

    map.on('popupopen', function (e) {
      var el = e.popup._container;
      if (!el) return;
      var px = map.project(e.popup.getLatLng(), map.getZoom());
      px.y -= el.clientHeight / 2 + 8;
      map.panTo(map.unproject(px, map.getZoom()), { animate: false });
    });

    var p = document.createElement('p');
    p.className = 'thb-map-note';
    p.textContent = 'Villas are shown as an area, not an exact address';
    box.appendChild(p);

    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });
  }

  /* Цена «от» — с карточки этой виллы в каталоге на той же странице: там она
     уже подставлена сервером и пересчитана в валюту гостя. */
  function priceOf(v) {
    var url = v.url || ('/villa/' + v.slug + '/');
    var cards = document.querySelectorAll('.prop-card');
    for (var i = 0; i < cards.length; i++) {
      var oc = cards[i].getAttribute('onclick') || '';
      if (oc.indexOf(url) < 0) continue;
      var spans = cards[i].querySelectorAll('span');
      for (var j = 0; j < spans.length; j++) {
        var st = spans[j].getAttribute('style') || '';
        if (st.indexOf('font-size:19px') < 0) continue;
        /* в этом span сервер пишет и цену, и подпись «per night» отдельным
           узлом — берём только цену, подпись добавим сами */
        var t = '';
        for (var k = 0; k < spans[j].childNodes.length; k++) {
          if (spans[j].childNodes[k].nodeType === 3) t += spans[j].childNodes[k].nodeValue;
        }
        t = t.trim();
        return t ? t + ' per night' : spans[j].textContent.replace(/per night/i, ' per night').trim();
      }
    }
    return '';
  }

  function card(v) {
    var url = v.url || ('/villa/' + v.slug + '/');
    var img = v.cardImage || (v.images && v.images[0]) || '';
    var name = (v.name || '').split(' — ')[0];
    var bits = [];
    if (v.bedrooms) bits.push(v.bedrooms + ' bd');
    if (v.guests) bits.push(v.guests + ' guests');
    var pr = priceOf(v);
    return '<div class="thb-pop">' +
      (img ? '<a href="' + url + '" class="thb-pop-i"><img src="' + img + '" alt="' + esc(name) +
             '" loading="lazy" width="250" height="100"></a>' : '') +
      '<div class="thb-pop-b">' +
        (pr ? '<p class="thb-pop-p">from ' + esc(pr) + '</p>' : '') +
        '<h4><a href="' + url + '">' + esc(name) + '</a></h4>' +
        '<p class="thb-pop-m">' + esc(v.area) + ', Bali · ' + bits.join(' · ') + '</p>' +
        '<a class="thb-pop-cta" href="' + url + '">View this villa</a>' +
      '</div></div>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function style() {
    if (document.getElementById('thbRentMapCss')) return;
    var st = document.createElement('style');
    st.id = 'thbRentMapCss';
    st.textContent =
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
      '#thbRentMapSection .thb-mapbox.leaflet-container{height:430px}' +
      '@media(max-width:600px){.thb-mapbar{flex-direction:column;align-items:stretch;gap:11px}' +
        '.thb-mapbtn{justify-content:center;width:100%}' +
        '#thbRentMapSection .thb-mapbox.leaflet-container{height:340px}}' +
      '.leaflet-container{font:inherit;background:#eee9e0}' +
      '.thb-map-note{position:absolute;left:10px;bottom:10px;z-index:600;margin:0;' +
        'background:rgba(255,255,255,.9);border-radius:6px;padding:4px 8px;' +
        'font:400 11px/1.3 Inter,system-ui,sans-serif;color:#6b6b66;pointer-events:none}' +
      '.leaflet-control-attribution{background:rgba(255,255,255,.72)!important;' +
        'font:400 10px/1.4 Inter,system-ui,sans-serif!important;padding:1px 5px!important}' +
      '.leaflet-control-attribution a{color:#8a8a84!important;text-decoration:none}' +
      '.leaflet-popup-content{margin:0}' +
      '.leaflet-popup-content-wrapper{border-radius:12px;padding:0;overflow:hidden;' +
        'box-shadow:0 8px 26px rgba(20,16,10,.22)}' +
      '.leaflet-popup-close-button{top:5px!important;right:6px!important;color:#fff!important;' +
        'text-shadow:0 1px 3px rgba(0,0,0,.55);font-size:19px!important}' +
      '.thb-pop-i{display:block;line-height:0}' +
      '.thb-pop img{display:block;width:100%;height:100px;object-fit:cover}' +
      '.thb-pop-b{padding:9px 12px 12px}' +
      '.thb-pop-p{margin:0 0 2px;font:700 15px/1.25 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '.thb-pop h4{margin:0 0 3px;font:600 13.5px/1.3 Inter,system-ui,sans-serif}' +
      '.thb-pop h4 a{color:#0a0a0a;text-decoration:none}' +
      '.thb-pop-m{margin:0;font:400 12px/1.4 Inter,system-ui,sans-serif;color:#6b6b66}' +
      '.thb-pop-cta{display:block;margin-top:9px;padding:8px 12px;border-radius:8px;text-align:center;' +
        'background:#0a0a0a;color:#fff!important;text-decoration:none;' +
        'font:600 12.5px/1 Inter,system-ui,sans-serif}';
    document.head.appendChild(st);
  }
})();
