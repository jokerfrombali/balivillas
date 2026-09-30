/* Языковые версии сайта.
 *
 * Английский — основной и лежит в корне. Каждый другой язык — те же страницы
 * по тем же путям, но с префиксом: /ru/villa/..., /it/property-rental/ и так
 * далее. Отсюда список берут и воркер, и скрипты страниц, чтобы добавление
 * языка не превращалось в поиск по коду.
 */

export const LANGS = ['it', 'ru', 'de', 'fr', 'es', 'nl', 'ja', 'ko', 'zh-hans', 'zh-hant', 'ar'];

/* /ru/villa/x/ -> /villa/x/ ; / и /villa/x/ остаются как есть */
export const STRIP = /^\/(it|ru|de|fr|es|nl|ja|ko|zh-hans|zh-hant|ar)(?=\/)/;

export function langOf(pathname) {
  const m = String(pathname || '').match(/^\/([a-z-]+)(?=\/)/);
  return m && LANGS.indexOf(m[1]) >= 0 ? m[1] : 'en';
}
