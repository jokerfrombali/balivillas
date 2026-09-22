/* thb-share.js — «Поделиться» на странице виллы.
 *
 * Запрошено 21.09.2026: с телефона виллу нельзя было отправить другу — ни
 * кнопки, ни ссылки, только копировать адрес из строки браузера вручную.
 *
 * Кнопка повторяет сердце из thb-fav.js: на мобиле плавающая, слева от него,
 * на десктопе — рядом с заголовком. Разметка вилл сгенерирована чужим
 * шаблоном, поэтому кнопки создаём скриптом, а не правим 40 файлов.
 *
 * На телефоне открывается системное меню «Поделиться» (navigator.share);
 * где его нет — адрес уходит в буфер обмена, и кнопка говорит об этом.
 */
(function () {
  'use strict';

  var fav = document.querySelector('[data-fav-btn]');
  if (!fav) return;                      /* не страница виллы — выходим */

  var url = location.origin + location.pathname;
  var title = fav.getAttribute('data-t') || document.title;

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  var OK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
    ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 7"/></svg>';

  var css = document.createElement('style');
  css.id = 'thb-share-css';
  css.textContent =
    '.thb-share{display:inline-flex;align-items:center;justify-content:center;padding:0;' +
      'border-radius:999px;cursor:pointer;background:#fff;border:1px solid #e6e3dc;' +
      'color:#0a0a0a;touch-action:manipulation;-webkit-tap-highlight-color:transparent;' +
      'transition:background .18s,transform .18s}' +
    '.thb-share svg{width:19px;height:19px}' +
    '@media(hover:hover){.thb-share:hover{transform:scale(1.08)}}' +
    '.thb-share.thb-share-done{color:#15803d;border-color:#15803d}' +
    /* рядом с заголовком — как .thb-fav-inline */
    '.thb-share-inline{width:44px;height:44px;margin-left:8px}' +
    '.thb-share-inline svg{width:20px;height:20px}' +
    /* плавающая — зеркально #thbFavFloat, на 54px левее */
    '#thbShareFloat{position:fixed;top:88px;right:74px;z-index:60;display:none;' +
      'width:44px;height:44px;box-sizing:border-box;background:rgba(255,255,255,.94);' +
      '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
      'box-shadow:0 4px 14px rgba(0,0,0,.10)}' +
    '@media(max-width:1023px){#thbShareFloat{display:flex}}' +
    '@media(max-width:768px){#thbShareFloat{top:82px;right:64px;width:42px;height:42px}}' +
    'body.thb-menu-open #thbShareFloat{display:none!important}' +
    /* Когда включается липкое меню разделов, страница опускает «назад» и сердце
       на 132px (128px на узких). Кнопка об этом не знала и оставалась наверху,
       наезжая на меню. Значения повторяют правило .villa-floating-back,#thbFavFloat
       в шаблоне виллы — меняются там, поменять и здесь. */
    '#thbShareFloat{transition:top .26s cubic-bezier(.22,.61,.36,1),background .18s,transform .18s}' +
    'body.thb-secnav-on:not(.thb-secnav-inline) #thbShareFloat{top:132px}' +
    '@media(max-width:768px){body.thb-secnav-on:not(.thb-secnav-inline) #thbShareFloat{top:128px}}' +
    /* подсказка «скопировано» */
    '.thb-share-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:80;' +
      'background:#0a0a0a;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:13.5px;' +
      'padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.22);' +
      'opacity:0;pointer-events:none;transition:opacity .2s}' +
    '.thb-share-toast.on{opacity:1}';
  document.head.appendChild(css);

  var toast;
  function say(text) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'thb-share-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout(say.t);
    say.t = setTimeout(function () { toast.classList.remove('on'); }, 2200);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    /* Safari до 13.4 и любой не-https контекст: буфера нет, кладём через textarea */
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject();
      } catch (e) { reject(e); }
    });
  }

  function done(btn) {
    var was = btn.innerHTML;
    btn.innerHTML = OK;
    btn.classList.add('thb-share-done');
    setTimeout(function () {
      btn.innerHTML = was;
      btn.classList.remove('thb-share-done');
    }, 1800);
  }

  function share(btn) {
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {
        /* пользователь закрыл системное меню — это не ошибка, молчим */
      });
      return;
    }
    copy(url).then(function () {
      done(btn);
      say('Link copied');
    }).catch(function () {
      say(url);      /* совсем некуда положить — показываем адрес, его можно выделить */
    });
  }

  function make(id, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    if (id) b.id = id;
    b.className = 'thb-share ' + cls;
    b.setAttribute('aria-label', 'Share this villa');
    b.title = 'Share this villa';
    b.innerHTML = ICON;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      share(b);
    });
    return b;
  }

  /* плавающая — рядом с плавающим сердцем */
  if (document.getElementById('thbFavFloat')) {
    document.body.appendChild(make('thbShareFloat', ''));
  }

  /* у заголовка — рядом с сердцем в строке */
  var inline = document.querySelector('.thb-fav-inline');
  if (inline && inline.parentNode) {
    inline.parentNode.insertBefore(make('', 'thb-share-inline'), inline.nextSibling);
  }
})();
