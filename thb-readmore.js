/* Кнопки «Read more» на странице виллы.
 *
 * Их три, и ни одна не работает. Первая, под описанием, должна раскрывать
 * текст: он обрезан на три строки (line-clamp-3 плюс max-height у обёртки), а
 * обработчика к кнопке нет. Две другие, в «Things to know», — остатки чужого
 * компонента: у них aria-controls на диалог, которого в разметке нет, клик
 * уходит в никуда.
 *
 * Первую раскрываем на месте и разрешаем свернуть обратно. Две другие ведут на
 * /terms/ — там как раз про отмену, возврат и правила проживания. Кнопка,
 * которая обещает подробности и молчит, хуже отсутствующей.
 *
 * Слушаем на фазе захвата у document: как и с фототуром, собственный обработчик
 * страницы гасит клик раньше, чем он дойдёт до кнопки.
 */
(function () {
  'use strict';

  if (document.documentElement.dataset.thbReadmore) return;
  document.documentElement.dataset.thbReadmore = '1';

  var LABEL_MORE = 'Read more', LABEL_LESS = 'Read less';

  /* Обрезанный блок над кнопкой: обёртка с max-height и текст с line-clamp. */
  function clampedNear(btn) {
    var scope = btn.closest('section, div');
    for (var i = 0; i < 4 && scope; i++) {
      var clamp = scope.querySelector('[class*="line-clamp"]');
      if (clamp) return clamp;
      scope = scope.parentElement;
    }
    return null;
  }

  function expand(btn, clamp) {
    var wrap = clamp.parentElement;
    var open = btn.getAttribute('data-thb-open') === '1';

    if (open) {
      clamp.style.removeProperty('-webkit-line-clamp');
      clamp.style.webkitLineClamp = '3';
      if (wrap) wrap.style.maxHeight = '4.5rem';
      btn.setAttribute('data-thb-open', '0');
      setLabel(btn, LABEL_MORE);
    } else {
      /* снимаем оба ограничения: без обоих текст не раскроется */
      clamp.style.webkitLineClamp = 'unset';
      clamp.style.display = 'block';
      if (wrap) wrap.style.maxHeight = 'none';
      btn.setAttribute('data-thb-open', '1');
      setLabel(btn, LABEL_LESS);
    }
  }

  /* Подпись лежит во вложенном span, а рядом ещё спиннер — правим тот узел,
     где действительно текст. */
  function setLabel(btn, text) {
    var spans = btn.querySelectorAll('span');
    for (var i = spans.length - 1; i >= 0; i--) {
      var t = (spans[i].textContent || '').trim();
      if (t === LABEL_MORE || t === LABEL_LESS) { spans[i].textContent = text; return; }
    }
    btn.textContent = text;
  }

  /* Кнопка-пустышка: ссылается на диалог, которого нет в документе. */
  function isDeadDialog(btn) {
    if (btn.getAttribute('aria-haspopup') !== 'dialog') return false;
    var id = btn.getAttribute('aria-controls');
    return !id || !document.getElementById(id);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var btn = t.closest('button');
    if (!btn) return;

    var label = (btn.textContent || '').trim();
    if (label !== LABEL_MORE && label !== LABEL_LESS) return;

    if (isDeadDialog(btn)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      location.href = '/terms/';
      return;
    }

    var clamp = clampedNear(btn);
    if (!clamp) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    expand(btn, clamp);
  }, true);
})();
