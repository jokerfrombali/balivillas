/* Починка выбора гостей в карточке бронирования на странице виллы.
 *
 * Что было не так (замерено на боевой странице):
 *
 * 1. Выпадашка .guest-dropdown стоит position:absolute; top:100%. Ближайший
 *    позиционированный предок — не обёртка кнопки, а вся карточка брони
 *    (position:relative), поэтому "100%" отсчитывалось от низа карточки:
 *    кнопка заканчивалась на 854px, а выпадашка появлялась на 1133px.
 * 2. У карточки overflow:clip, и эти 100px вылезали за её нижний край —
 *    выпадашку срезало целиком. Пользователь жал кнопку и не видел ничего.
 * 3. Счётчик внутри работал (1 → 3 → 2), но подпись на кнопке навсегда
 *    оставалась "1 guest".
 * 4. В выпадашке стоит "Maximum 8 guests" у всех вилл, хотя в data/villas.json
 *    у Villa Kesari 4 указано 6 гостей. Берём настоящий максимум оттуда же,
 *    откуда его берёт остальной сайт.
 *
 * Кнопку и её обработчик не трогаем: открытие/закрытие остаётся их, мы только
 * ставим выпадашку на место, держим подпись в актуальном виде и не даём
 * выбрать больше, чем вилла вмещает.
 */
(function () {
  'use strict';

  var btn = document.getElementById('guestSelector');
  var drop = document.querySelector('.guest-dropdown');
  if (!btn || !drop) return;

  var num = document.getElementById('guestNumber');
  var plus = document.getElementById('guestPlus');

  /* Подпись на кнопке — тот span, где сейчас написано "1 guest". */
  var label = [].slice.call(btn.querySelectorAll('span'))
    .filter(function (s) { return /guest/i.test(s.textContent || ''); }).pop();

  /* ---------- 1 и 2: ставим выпадашку под кнопку ---------- */
  /* offsetParent у кнопки и у выпадашки один и тот же (карточка брони), так
     что координаты кнопки внутри карточки годятся напрямую. Поднятая под
     кнопку выпадашка помещается в карточку целиком, и overflow:clip её уже
     не режет — подпорки вроде position:fixed не нужны. */
  function place() {
    if (btn.offsetParent !== drop.offsetParent) return;   /* вёрстку поменяли — не трогаем */
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

  /* ---------- 3: подпись на кнопке ---------- */
  function syncLabel() {
    if (!label || !num) return;
    var n = parseInt(num.textContent, 10);
    if (!n) return;
    label.textContent = n + (n === 1 ? ' guest' : ' guests');
  }

  if (num) {
    new MutationObserver(syncLabel).observe(num, { childList: true, characterData: true, subtree: true });
    syncLabel();
  }

  /* ---------- 4: настоящий максимум из data/villas.json ---------- */
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

  villaMax().then(function (max) {
    if (!max) return;

    /* строка "Maximum N guests" под заголовком выпадашки */
    var note = [].slice.call(drop.querySelectorAll('div'))
      .filter(function (d) { return /^Maximum \d+ guests?$/i.test((d.textContent || '').trim()); })[0];
    if (note) note.textContent = 'Maximum ' + max + (max === 1 ? ' guest' : ' guests');

    /* их обработчик "+" знает свой максимум и о нашем не в курсе:
       перехватываем клик на стадии погружения и не пускаем дальше */
    if (plus) {
      plus.addEventListener('click', function (e) {
        var n = parseInt(num && num.textContent, 10) || 1;
        if (n >= max) { e.stopImmediatePropagation(); e.preventDefault(); }
      }, true);
    }

    /* если на странице уже стоит больше вместимости — опускаем до максимума */
    var cur = parseInt(num && num.textContent, 10) || 1;
    if (cur > max && num) { num.textContent = String(max); syncLabel(); }
  });
})();
