/* The Host Bali — переключатель языка в шапке.
 *
 * Сайт на английском, итальянские близнецы лежат под /it/ с теми же путями.
 * Адрес другой версии берём из hreflang в <head>: английская — x-default,
 * итальянская — hreflang="it". Если на странице нет пары, кнопку не ставим.
 *
 * Ставится рядом с валютой перед сердцем «сохранённые» (a[data-fav-link]);
 * там, где сердца нет (about, галерея), — перед бургером или в правый край
 * шапки. Подключает воркер на каждой HTML-странице. */
(function () {
  'use strict';
  if (window.__thbLang) return;
  window.__thbLang = true;

  var LANGS = [
    { c: 'en', label: 'EN', name: 'English' },
    { c: 'it', label: 'IT', name: 'Italiano' }
  ];

  function altUrl(code) {
    var sel = code === 'en'
      ? 'link[rel="alternate"][hreflang="x-default"]'
      : 'link[rel="alternate"][hreflang="' + code + '"]';
    var l = document.querySelector(sel);
    if (!l) return null;
    var href = l.getAttribute('href') || '';
    /* главная: x-default = "/", остальные локали — свои посадочные */
    return href || null;
  }

  function cur() {
    var l = (document.documentElement.lang || 'en').toLowerCase().slice(0, 2);
    return l === 'it' ? 'it' : 'en';
  }

  function css() {
    var st = document.createElement('style');
    st.textContent =
      /* шапка страницы виллы: логотип и ссылки «Villas for rent / For sale» лежат
         в одном строчном блоке и при тесноте переносились на вторую строку */
      'header span:has(> a[data-hostpill]){white-space:nowrap}' +
      '#thbLangBox{position:relative;display:inline-flex;align-items:center;flex-shrink:0}' +
      '#thbLangBtn{display:inline-flex;align-items:center;gap:5px;height:40px;padding:0 10px;' +
        'border:0;background:transparent;border-radius:999px;cursor:pointer;' +
        'font:500 14px/1 Inter,system-ui,sans-serif;color:#0a0a0a;transition:background .18s}' +
      '#thbLangBtn svg{width:15px;height:15px;opacity:.6;flex-shrink:0}' +
      '#thbLangBtn svg.a{width:12px;height:12px;opacity:.45}' +
      '@media(hover:hover){#thbLangBtn:hover{background:rgba(10,10,10,.055)}}' +
      '#thbLangMenu{position:absolute;top:46px;right:0;z-index:1200;width:180px;' +
        'background:#fff;border:1px solid #e6e3dc;border-radius:16px;' +
        'box-shadow:0 18px 44px rgba(0,0,0,.16);padding:6px;display:none}' +
      '#thbLangMenu.open{display:block}' +
      '#thbLangMenu a{display:flex;align-items:center;gap:10px;padding:9px 11px;' +
        'border-radius:10px;text-decoration:none;' +
        'font:400 13.5px/1.25 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '@media(hover:hover){#thbLangMenu a:hover{background:#f4f1ea}}' +
      '#thbLangMenu a[aria-current="true"]{background:#0a0a0a;color:#fff}' +
      '#thbLangMenu b{font-weight:700;min-width:26px}' +
      '@media(max-width:640px){#thbLangBtn{height:36px;padding:0 7px;font-size:13px;gap:4px}' +
        '#thbLangBtn svg.g{display:none}}' +
      '@media(max-width:430px){#thbLangBtn{padding:0 5px;font-size:12.5px}#thbLangBtn svg.a{display:none}}';
    document.head.appendChild(st);
  }

  function anchorEl() {
    var a = document.querySelector('#thbCurBox') ||
            document.querySelector('a[data-fav-link]') ||
            document.querySelector('#thbBurger') ||
            document.querySelector('#mobileMenuBtn') ||
            document.querySelector('.gallery-header .header-actions .book-btn');
    return a;
  }

  function build() {
    var me = cur();
    var links = {};
    LANGS.forEach(function (l) { links[l.c] = l.c === me ? location.pathname : altUrl(l.c); });
    if (!links.en || !links.it) return false;
    var anchor = anchorEl();
    if (!anchor || !anchor.parentElement) return false;

    css();
    var box = document.createElement('div');
    box.id = 'thbLangBox';
    var btn = document.createElement('button');
    btn.id = 'thbLangBtn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', me === 'it' ? 'Lingua' : 'Language');
    btn.innerHTML =
      '<svg class="g" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>' +
      '<span>' + me.toUpperCase() + '</span>' +
      '<svg class="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    var menu = document.createElement('div');
    menu.id = 'thbLangMenu';
    menu.setAttribute('role', 'menu');
    LANGS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = links[l.c];
      a.setAttribute('hreflang', l.c);
      a.setAttribute('lang', l.c);
      a.setAttribute('role', 'menuitem');
      if (l.c === me) a.setAttribute('aria-current', 'true');
      a.innerHTML = '<b>' + l.label + '</b><span>' + l.name + '</span>';
      menu.appendChild(a);
    });

    function open() { menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    function close() { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      menu.classList.contains('open') ? close() : open();
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    box.appendChild(btn);
    box.appendChild(menu);
    anchor.parentElement.insertBefore(box, anchor);
    return true;
  }

  function init() {
    if (build()) return;
    /* шапка могла ещё не отрисоваться (thb-currency ставит свой блок позже) */
    var tries = 0;
    var t = setInterval(function () { if (build() || ++tries > 20) clearInterval(t); }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
