/* Карта в секции «Where you'll be» на странице виллы.
 *
 * Что было: в разметке лежит контейнер Apple MapKit (.mk-map-view с пустыми
 * canvas), но сам mapkit на страницу не подключён — window.mapkit не
 * определён, карта не рисуется, у гостя просто серый прямоугольник.
 *
 * Что делаем: кладём в тот же контейнер карту Google (iframe, ключ не нужен)
 * без пина, а поверх — полупрозрачный круг, как показывают примерное место
 * Airbnb и Booking. Точный адрес не раскрываем: круг про район, а не про дом.
 *
 * Координаты берём из data/villas.json — оттуда же, откуда их берёт остальной
 * сайт. Нет координат у виллы — ничего не трогаем, пусть остаётся как было.
 *
 * Грузим iframe лениво, когда секция подходит к экрану: карта тянет ресурсы
 * Google, и делать это на каждой загрузке страницы незачем.
 */
(function () {
  'use strict';

  var ZOOM = 16;          /* примерно квартал целиком */
  var CIRCLE = 170;       /* диаметр круга в пикселях при высоте бокса 376 */

  var sec = document.getElementById('section-location');
  if (!sec) return;

  villa().then(function (v) {
    if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return;

    var holder = findHolder();
    if (!holder) return;

    holder.innerHTML = '';
    holder.style.position = 'relative';
    holder.style.background = '#eee9e0';

    var circle = document.createElement('div');
    circle.setAttribute('aria-hidden', 'true');
    circle.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'width:' + CIRCLE + 'px', 'height:' + CIRCLE + 'px',
      'margin:' + (-CIRCLE / 2) + 'px 0 0 ' + (-CIRCLE / 2) + 'px',
      'border-radius:50%',
      'background:rgba(184,74,49,.15)',
      'border:2px solid rgba(184,74,49,.7)',
      'pointer-events:none', 'z-index:2'
    ].join(';');

    /* Ленивая загрузка: iframe создаём, только когда секция подходит к экрану. */
    var made = false;
    function build() {
      if (made) return;
      made = true;
      var f = document.createElement('iframe');
      f.src = 'https://maps.google.com/maps?ll=' + v.lat + ',' + v.lng +
              '&z=' + ZOOM + '&output=embed';
      f.title = (v.name || 'Villa') + ' — area map';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.setAttribute('allowfullscreen', '');
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;z-index:1';
      holder.insertBefore(f, circle);
    }

    holder.appendChild(circle);

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
    return sec.querySelector('[class*="376px"]');
  }

  function villa() {
    var path = location.pathname.replace(/\/+$/, '');
    var i = path.indexOf('/villa/');
    if (i < 0) return Promise.resolve(null);
    var slug = path.slice(i + 7);

    return fetch('/data/villas.json', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        return (list || []).filter(function (x) { return x.slug === slug; })[0] || null;
      });
  }
})();
