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
    { c: 'en', label: 'EN', name: 'English',  offer: 'This site is available in English',  go: 'Switch to English',  no: 'Stay here' },
    { c: 'it', label: 'IT', name: 'Italiano', offer: 'Questo sito è disponibile in italiano', go: 'Passa all\'italiano', no: 'Resta qui' },
    { c: 'ru', label: 'RU', name: 'Русский',  offer: 'Сайт есть на русском',                 go: 'Перейти на русский',  no: 'Остаться' },
    { c: 'de', label: 'DE', name: 'Deutsch',  offer: 'Diese Seite gibt es auf Deutsch',      go: 'Auf Deutsch ansehen', no: 'Hier bleiben' },
    { c: 'fr', label: 'FR', name: 'Français', offer: 'Ce site existe en français',           go: 'Voir en français',    no: 'Rester ici' },
    { c: 'es', label: 'ES', name: 'Español',  offer: 'Este sitio está disponible en español', go: 'Ver en español',     no: 'Quedarme aquí' },
    { c: 'nl', label: 'NL', name: 'Nederlands', offer: 'Deze site is beschikbaar in het Nederlands', go: 'Naar het Nederlands', no: 'Hier blijven' },
    { c: 'ja', label: 'JA', name: '日本語',    offer: 'このサイトは日本語でもご覧いただけます',      go: '日本語で見る',        no: 'このまま' },
    { c: 'ko', label: 'KO', name: '한국어',    offer: '이 사이트는 한국어로도 제공됩니다',          go: '한국어로 보기',       no: '그대로 보기' },
    { c: 'zh-hans', label: 'ZH', name: '简体中文', offer: '本网站有简体中文版',                  go: '切换到中文',          no: '留在此页' },
    { c: 'zh-hant', label: 'ZH', name: '繁體中文', offer: '本網站有繁體中文版',                  go: '切換到繁體中文',      no: '留在此頁' },
    { c: 'ar', label: 'AR', name: 'العربية',  offer: 'هذا الموقع متاح بالعربية',              go: 'التبديل إلى العربية', no: 'البقاء هنا' }
  ];

  var PICKED = 'thb_lang_v1';       /* язык, выбранный гостем руками */
  var HIDDEN = 'thb_langbar_v1';    /* плашку закрыли, больше не показываем */

  function altUrl(code) {
    var sel = code === 'en'
      ? 'link[rel="alternate"][hreflang="x-default"]'
      : 'link[rel="alternate"][hreflang="' + code + '"], ' +
        'link[rel="alternate"][hreflang="' + code.toUpperCase() + '"], ' +
        'link[rel="alternate"][hreflang="' + code.replace('zh-hans', 'zh-Hans')
                                                 .replace('zh-hant', 'zh-Hant') + '"]';
    var l = document.querySelector(sel);
    if (!l) return null;
    var href = l.getAttribute('href') || '';
    /* главная: x-default = "/", остальные локали — свои посадочные */
    return href || null;
  }

  /* Какие версии есть именно у этой страницы. На странице виллы это английская
     и итальянская, на главной — все языковые посадочные. */
  function available() {
    var out = [];
    for (var i = 0; i < LANGS.length; i++) {
      var u = altUrl(LANGS[i].c);
      if (u) out.push({ lang: LANGS[i], url: u });
    }
    return out;
  }

  function cur() {
    var l = (document.documentElement.lang || 'en').toLowerCase();
    for (var i = 0; i < LANGS.length; i++) if (l === LANGS[i].c || l.slice(0, 2) === LANGS[i].c) return LANGS[i].c;
    return 'en';
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
    var have = available();
    if (have.length < 2) return false;                 /* переключать не на что */
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
    btn.setAttribute('aria-label', ({ it: 'Lingua', ru: 'Язык' })[me] || 'Language');
    btn.innerHTML =
      '<svg class="g" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>' +
      '<span>' + me.toUpperCase() + '</span>' +
      '<svg class="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    var menu = document.createElement('div');
    menu.id = 'thbLangMenu';
    menu.setAttribute('role', 'menu');
    have.forEach(function (x) {
      var a = document.createElement('a');
      a.href = x.lang.c === me ? location.pathname : x.url;
      a.setAttribute('hreflang', x.lang.c);
      a.setAttribute('lang', x.lang.c);
      a.setAttribute('role', 'menuitem');
      if (x.lang.c === me) a.setAttribute('aria-current', 'true');
      a.innerHTML = '<b>' + x.lang.label + '</b><span>' + x.lang.name + '</span>';
      /* выбор языка руками запоминаем: дальше открываем сразу на нём */
      a.addEventListener('click', function () {
        try { localStorage.setItem(PICKED, x.lang.c); } catch (e) {}
      });
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

  /* ---------- плашка «сайт есть на вашем языке» ---------- */

  function barCss() {
    if (document.getElementById('thb-langbar-css')) return;
    var st = document.createElement('style');
    st.id = 'thb-langbar-css';
    st.textContent =
      '#thbLangBar{position:fixed;left:12px;right:12px;bottom:12px;z-index:1400;' +
        'display:flex;align-items:center;gap:14px;max-width:560px;margin:0 auto;' +
        'padding:13px 16px;background:#fff;border:1px solid #e6e3dc;border-radius:16px;' +
        'box-shadow:0 18px 44px rgba(0,0,0,.18);font-family:Inter,system-ui,sans-serif;' +
        'transform:translateY(8px);opacity:0;transition:opacity .25s,transform .25s}' +
      '#thbLangBar.in{opacity:1;transform:none}' +
      '#thbLangBar .t{flex:1;min-width:0;font:500 13.5px/1.35 Inter,system-ui,sans-serif;color:#0a0a0a}' +
      '#thbLangBar .go{flex:0 0 auto;border:0;background:#0a0a0a;color:#fff;border-radius:999px;' +
        'cursor:pointer;height:38px;padding:0 16px;font:600 13px/1 Inter,system-ui,sans-serif;' +
        'text-decoration:none;display:inline-flex;align-items:center}' +
      '#thbLangBar .no{flex:0 0 auto;border:0;background:transparent;cursor:pointer;' +
        'font:500 12.5px/1 Inter,system-ui,sans-serif;color:#6b6b66;text-decoration:underline;padding:8px 2px}' +
      '@media(max-width:520px){#thbLangBar{flex-wrap:wrap;gap:10px}#thbLangBar .t{flex:1 0 100%}}';
    document.head.appendChild(st);
  }

  /* Язык гостя из браузера: берём первый из списка, для которого у страницы
     есть версия. zh-CN -> zh-hans, pt-BR -> pt и так далее. */
  function guess(have) {
    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i] || '').toLowerCase();
      if (!tag) continue;
      var base = tag.split('-')[0];
      var wanted = base === 'zh'
        ? (/hant|tw|hk|mo/.test(tag) ? 'zh-hant' : 'zh-hans')
        : base;
      for (var j = 0; j < have.length; j++) {
        if (have[j].lang.c === wanted) return have[j];
      }
    }
    return null;
  }

  function bar() {
    var me = cur();
    var have = available();
    if (have.length < 2) return;

    var picked = null;
    try { picked = localStorage.getItem(PICKED); } catch (e) {}

    /* Гость уже выбирал язык руками — уважаем выбор и молчим. Если он выбрал
       другой язык, чем открыт сейчас, сразу ведём туда: это его решение, а не
       догадка по браузеру. */
    if (picked) {
      if (picked === me) return;
      for (var k = 0; k < have.length; k++) {
        if (have[k].lang.c === picked) { location.replace(have[k].url); return; }
      }
      return;
    }

    try { if (localStorage.getItem(HIDDEN) === '1') return; } catch (e) {}

    var want = guess(have);
    if (!want || want.lang.c === me) return;

    barCss();
    var box = document.createElement('div');
    box.id = 'thbLangBar';
    box.setAttribute('role', 'region');
    box.setAttribute('lang', want.lang.c);
    box.innerHTML = '<span class="t">' + want.lang.offer + '</span>' +
      '<a class="go" href="' + want.url + '" hreflang="' + want.lang.c + '">' + want.lang.go + '</a>' +
      '<button type="button" class="no">' + want.lang.no + '</button>';
    /* куки-плашка стоит в том же углу: пока она висит, поднимаемся над ней */
    var cookie = document.getElementById('thbCookie');
    if (cookie && cookie.offsetParent) {
      box.style.bottom = (cookie.offsetHeight + 22) + 'px';
      var watch = setInterval(function () {
        if (!cookie.offsetParent) { box.style.bottom = '12px'; clearInterval(watch); }
      }, 500);
      setTimeout(function () { clearInterval(watch); }, 60000);
    }

    document.body.appendChild(box);
    setTimeout(function () { box.classList.add('in'); }, 60);

    box.querySelector('.go').addEventListener('click', function () {
      try { localStorage.setItem(PICKED, want.lang.c); } catch (e) {}
    });
    box.querySelector('.no').addEventListener('click', function () {
      try { localStorage.setItem(HIDDEN, '1'); localStorage.setItem(PICKED, me); } catch (e) {}
      box.classList.remove('in');
      setTimeout(function () { box.remove(); }, 250);
    });
  }

  function init() {
    setTimeout(bar, 900);        /* не мешаем первой отрисовке */
    if (build()) return;
    /* шапка могла ещё не отрисоваться (thb-currency ставит свой блок позже) */
    var tries = 0;
    var t = setInterval(function () { if (build() || ++tries > 20) clearInterval(t); }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
