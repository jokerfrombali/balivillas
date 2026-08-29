/* Починка выбора гостей в карточке бронирования на странице виллы.
 *
 * Замерено на боевой странице Villa Kesari 4:
 *
 * 1. Выпадашку не видно. `.guest-dropdown` стоит position:absolute; top:100%,
 *    но ближайший позиционированный предок — не обёртка кнопки, а вся карточка
 *    брони. Поэтому «100%» отсчитывалось от низа карточки: кнопка кончается на
 *    854px, выпадашка появлялась на 1133px. А у карточки overflow:clip и низ на
 *    1134px — эти 100px срезало целиком.
 * 2. Нажатие «+» или «−» уничтожает разметку кнопки. До нажатия внутри
 *    <div><span>Guests</span><span>1 guest</span></div> и шеврон, после —
 *    голый текст «2 guests», ноль span-ов: подпись «Guests» и стрелка пропадают.
 * 3. У всех вилл «Maximum 8 guests», хотя в data/villas.json у Villa Kesari 4
 *    стоит guests: 6.
 *
 * Кнопку и её обработчики не трогаем: открытие, закрытие и сам счёт остаются
 * страничными. Мы только ставим выпадашку на место, чиним разметку кнопки
 * после каждого пересчёта и не даём выбрать больше, чем вилла вмещает.
 *
 * Элементы карточки появляются позже DOMContentLoaded, поэтому сначала ждём их.
 */
(function () {
  'use strict';

  waitFor(function () {
    return document.getElementById('guestSelector') && document.querySelector('.guest-dropdown');
  }, start, 15000);

  /* ---------- ожидание разметки ---------- */
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
    var btn = document.getElementById('guestSelector');
    var drop = document.querySelector('.guest-dropdown');
    var num = document.getElementById('guestNumber');
    var plus = document.getElementById('guestPlus');

    /* Разметка кнопки до первого нажатия — она и есть эталон, к которому
       возвращаемся, когда страничный обработчик её затирает. */
    var template = btn.innerHTML;

    /* ---------- 1: ставим выпадашку под кнопку ---------- */
    /* offsetParent у кнопки и у выпадашки один и тот же (карточка брони), так
       что координаты кнопки внутри карточки годятся напрямую. Поднятая под
       кнопку выпадашка помещается в карточку целиком, и overflow:clip её уже
       не режет — костыли вроде position:fixed не нужны. */
    function place() {
      if (btn.offsetParent !== drop.offsetParent) return;   /* вёрстку поменяли — не лезем */
      drop.style.top = (btn.offsetTop + btn.offsetHeight + 8) + 'px';
      drop.style.left = btn.offsetLeft + 'px';
      drop.style.right = 'auto';
      drop.style.width = btn.offsetWidth + 'px';
    }

    function isOpen() { return drop.classList.contains('show'); }

    new MutationObserver(function () { if (isOpen()) place(); })
      .observe(drop, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', function () { if (isOpen()) place(); });
    place();

    /* ---------- 2: чиним разметку кнопки после пересчёта ---------- */
    var repairing = false;

    function labelSpan() {
      var spans = [].slice.call(btn.querySelectorAll('span'));
      return spans.filter(function (s) { return /\d+\s+guests?/i.test(s.textContent || ''); }).pop()
          || spans[spans.length - 1];
    }

    function repair() {
      if (repairing || !num) return;
      var n = parseInt(num.textContent, 10);
      if (!n) return;
      var text = n + (n === 1 ? ' guest' : ' guests');

      repairing = true;
      /* структуру снесли — возвращаем эталон */
      if (!btn.querySelector('span')) btn.innerHTML = template;
      var span = labelSpan();
      if (span && span.textContent !== text) span.textContent = text;
      repairing = false;
    }

    new MutationObserver(repair).observe(btn, { childList: true, subtree: true, characterData: true });
    if (num) new MutationObserver(repair).observe(num, { childList: true, characterData: true, subtree: true });
    repair();

    /* ---------- 3: настоящий максимум из data/villas.json ---------- */
    villaMax().then(function (max) {
      if (!max) return;

      var note = [].slice.call(drop.querySelectorAll('div')).filter(function (d) {
        return /^Maximum \d+ guests?$/i.test((d.textContent || '').trim());
      })[0];
      if (note) note.textContent = 'Maximum ' + max + (max === 1 ? ' guest' : ' guests');

      /* страничный обработчик «+» знает свой максимум и о нашем не в курсе:
         перехватываем клик на стадии погружения и не пускаем дальше */
      if (plus) {
        plus.addEventListener('click', function (e) {
          var n = parseInt(num && num.textContent, 10) || 1;
          if (n >= max) { e.stopImmediatePropagation(); e.preventDefault(); }
        }, true);
      }

      var cur = parseInt(num && num.textContent, 10) || 1;
      if (cur > max && num) { num.textContent = String(max); repair(); }
    });
  }

  /* Вместимость берём оттуда же, откуда её берёт остальной сайт. */
  function villaMax() {
    var path = location.pathname.replace(/\/+$/, '');
    var i = path.indexOf('/villa/');
    if (i < 0) return Promise.resolve(null);
    var slug = path.slice(i + 7);

    return fetch('/data/villas.json', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        var hit = (list || []).filter(function (v) { return v.slug === slug; })[0];
        return hit && hit.guests ? hit.guests : null;
      })
      .catch(function () { return null; });
  }
})();
