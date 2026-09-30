/* Переход в фототур со страницы виллы.
 *
 * На странице уже есть свой обработчик «Show all photos», но он не работает ни
 * на одной вилле: вешается на всплытии, а клик перехватывают раньше — кнопка
 * лежит внутри чужой разметки, которая гасит событие. Проверено на эталонной
 * Villa Kesari 4: клик по кнопке не делает ничего.
 *
 * Поэтому слушаем на фазе захвата у самого document: этот обработчик получает
 * клик первым, до всех, кто мог бы его погасить.
 *
 * Адрес фототура не зашиваем: он всегда равен адресу страницы виллы плюс
 * gallery/. Так файл работает и на виллах, которых ещё нет.
 *
 * Возврат: в фототур передаём returnTo — галерея умеет по нему вернуть гостя
 * на ту же страницу и то же место (см. gallerySmartBack в её разметке).
 */
(function () {
  'use strict';

  /* Только страница виллы: /villa/<район>/<вилла>/ или /villa/<вилла>/.
     На самом фототуре и в каталоге файл молча выходит. */
  var path = location.pathname;
  /* итальянские близнецы под /it/: проверяем путь без префикса, а ссылки
     строим от настоящего */
  if (!/^\/villa\/[^/]+\/([^/]+\/)?$/.test(path.replace(/^\/(it|ru|de|fr|es|nl|ja|ko|zh-hans|zh-hant|ar)(?=\/)/, ''))) return;
  if (/\/gallery\/$/.test(path)) return;

  var GALLERY = path + 'gallery/';

  function go(e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    location.href = GALLERY + '?returnTo=' +
      encodeURIComponent(path + location.search + location.hash);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* Кнопка «Show all photos» — она же единственная кнопка в блоке фотографий. */
    var btn = t.closest('button, a, [role="button"]');
    if (btn && (btn.textContent || '').indexOf('Show all photos') >= 0) { go(e); return; }

    /* Сами фотографии в шапке страницы: гость жмёт по снимку, а не по кнопке.
       Ограничиваемся секцией фотографий, чтобы не перехватывать клики по
       карточке брони, календарю и карте. */
    var photos = document.getElementById('section-photos');
    if (photos && photos.contains(t) && t.closest('picture, img, button')) { go(e); }
  }, true);
})();
