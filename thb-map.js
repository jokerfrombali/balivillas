/* Карта в секции «Where you'll be» на странице виллы.
 *
 * Что было: в разметке лежит контейнер Apple MapKit (.mk-map-view с пустыми
 * canvas), но сам mapkit на страницу не подключён — window.mapkit не
 * определён, карта не рисуется, у гостя просто серый прямоугольник. Заодно
 * рядом с контейнером висят три кнопки вёрстки — «Expand map», «Zoom in»,
 * «Zoom out» — они звали MapKit и потому не делали ничего.
 *
 * Что делаем: кладём в тот же контейнер карту Google (iframe, ключ не нужен)
 * без пина, а поверх — полупрозрачный круг, как показывают примерное место
 * Airbnb и Booking. Точный адрес не раскрываем: круг про район, а не про дом.
 * Кнопки вёрстки перехватываем и вешаем на них реальные действия.
 *
 * Радиус круга задан в МЕТРАХ и переводится в пиксели по масштабу карты,
 * поэтому при зуме круг остаётся тем же куском земли, а не «резиновым».
 *
 * Координаты берём из data/villas.json — оттуда же, откуда их берёт остальной
 * сайт. Нет координат у виллы — ничего не трогаем, пусть остаётся как было.
 *
 * Грузим iframe лениво, когда секция подходит к экрану: карта тянет ресурсы
 * Google, и делать это на каждой загрузке страницы незачем.
 */
(function () {
  'use strict';

  var ZOOM = 17;          /* улица и её название читаются */
  var ZOOM_MIN = 14, ZOOM_MAX = 19;
  var RADIUS_M = 45;      /* радиус круга на местности, метры (~3 дома) */

  var sec = document.getElementById('section-location');
  if (!sec) return;

  villa().then(function (v) {
    if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return;

    var holder = findHolder();
    if (!holder) return;

    var zoom = ZOOM;

    holder.innerHTML = '';
    holder.style.position = 'relative';
    holder.style.background = '#eee9e0';

    var circle = document.createElement('div');
    circle.setAttribute('aria-hidden', 'true');
    circle.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'border-radius:50%',
      'background:rgba(184,74,49,.13)',
      'border:2px solid rgba(184,74,49,.65)',
      'pointer-events:none', 'z-index:2',
      'transition:width .15s,height .15s,margin .15s'
    ].join(';');

    /* Метры на пиксель в проекции Web Mercator на широте виллы. */
    function sizeCircle() {
      var mpp = 156543.03392 * Math.cos(v.lat * Math.PI / 180) / Math.pow(2, zoom);
      var d = Math.round(2 * RADIUS_M / mpp);
      circle.style.width = d + 'px';
      circle.style.height = d + 'px';
      circle.style.margin = (-d / 2) + 'px 0 0 ' + (-d / 2) + 'px';
    }

    var frame = null;
    function src() {
      return 'https://maps.google.com/maps?ll=' + v.lat + ',' + v.lng +
             '&z=' + zoom + '&output=embed';
    }

    var made = false;
    function build() {
      if (made) return;
      made = true;
      frame = document.createElement('iframe');
      frame.src = src();
      frame.title = (v.name || 'Villa') + ' — area map';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.setAttribute('allowfullscreen', '');
      frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;z-index:1';
      holder.insertBefore(frame, circle);
    }

    function setZoom(z) {
      z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      if (z === zoom) return;
      zoom = z;
      sizeCircle();
      if (frame) frame.src = src();
    }

    sizeCircle();
    holder.appendChild(circle);

    wireButtons(holder, setZoom, function () { return zoom; });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (rows) {
        if (!rows.some(function (r) { return r.isIntersecting; })) return;
        io.disconnect();
        build();
      }, { rootMargin: '400px' });
      io.observe(holder);
    } else {
      build();
    }
  }).catch(function () { /* нет данных — секция остаётся как была */ });

  /* Кнопки вёрстки над картой: они были завязаны на мёртвый MapKit.
   * Перехватываем в фазе capture, чтобы их собственный обработчик не сработал,
   * и делаем то, что на них написано. Лишний поисковый кружок слева убираем —
   * он ничего не ищет и закрывает ссылку «Open in Maps». */
  function wireButtons(holder, setZoom, getZoom) {
    var wrap = holder.parentElement;
    if (!wrap) return;

    var left = wrap.querySelector(':scope > .absolute.top-4.left-4');
    if (left) left.style.display = 'none';

    var btns = wrap.querySelectorAll(':scope > .absolute.top-4.right-4 button');
    Array.prototype.forEach.call(btns, function (b) {
      var label = (b.getAttribute('aria-label') || '').toLowerCase();
      var fn = null;
      if (label.indexOf('zoom in') === 0) fn = function () { setZoom(getZoom() + 1); };
      else if (label.indexOf('zoom out') === 0) fn = function () { setZoom(getZoom() - 1); };
      else if (label.indexOf('expand') === 0) fn = function () {
        var t = holder.parentElement || holder;
        if (document.fullscreenElement) document.exitFullscreen();
        else if (t.requestFullscreen) t.requestFullscreen();
      };
      if (!fn) return;
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        fn();
      }, true);
    });
  }

  /* Контейнер карты: тот самый бокс на 376px, где лежал мёртвый MapKit. */
  function findHolder() {
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

  function villa() {
    /* Страница объекта на продажу — это та же вилла, но по другому адресу, и по
       slug её в data/villas.json не найти. Поэтому генератор кладёт координаты
       прямо в секцию, и мы берём их, не заглядывая в файл. */
    var own = sec.getAttribute('data-thb-lat');
    if (own) {
      return Promise.resolve({
        lat: parseFloat(own),
        lng: parseFloat(sec.getAttribute('data-thb-lng')),
        name: sec.getAttribute('data-thb-name') || document.title
      });
    }

    var path = location.pathname.replace(/\/+$/, '');
    var i = path.indexOf('/villa/');
    if (i < 0) return Promise.resolve(null);
    var slug = path.slice(i + 7);

    return fetch('/data/villas.json')
      .then(function (r) { return r.json(); })
      .then(function (list) {
        return (list || []).filter(function (x) { return x.slug === slug; })[0] || null;
      });
  }
})();
