/* thb-consent.js — cookie banner wired to Google Consent Mode v2.

   Defaults are set inline in <head> (before gtag config): analytics granted
   worldwide, denied in the EEA/UK/CH until the visitor agrees. This file draws
   the banner for those visitors and records the answer. Anyone can reopen the
   choice from the "Cookies" link added to the footer. */
(function () {
  'use strict';
  if (window.__thbConsent) return;
  window.__thbConsent = 1;

  var KEY = 'thb_consent_v1';
  var EU_TZ = /^(Europe\/|Atlantic\/(Azores|Madeira|Canary|Reykjavik)|Arctic\/Longyearbyen)/;

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function apply(v) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          analytics_storage: v === 'granted' ? 'granted' : 'denied'
        });
      }
    } catch (e) {}
  }

  function inEurope() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return EU_TZ.test(tz);
    } catch (e) { return false; }
  }

  var CSS = [
    '#thbCookie{position:fixed;left:16px;bottom:16px;z-index:130;max-width:390px;',
    'background:#fdfdfb;border:1px solid #e6e3dc;border-radius:20px;padding:18px 20px 16px;',
    'box-shadow:0 20px 50px -18px rgba(10,10,10,.4),0 2px 8px rgba(10,10,10,.06);',
    "font-family:'Inter',system-ui,sans-serif;color:#0a0a0a;",
    'opacity:0;transform:translateY(12px);transition:opacity .26s ease,transform .3s cubic-bezier(.22,1,.36,1)}',
    '#thbCookie.is-on{opacity:1;transform:none}',
    '#thbCookie h3{margin:0 0 6px;font-family:Lora,Georgia,serif;font-size:16px;font-weight:600}',
    '#thbCookie p{margin:0 0 14px;font-size:13px;line-height:1.5;color:#4b4a45}',
    '#thbCookie a{color:#0a0a0a;text-decoration:underline;text-underline-offset:2px}',
    '#thbCookie .row{display:flex;gap:8px}',
    '#thbCookie button{flex:1;height:42px;border-radius:999px;border:0;font:inherit;font-size:14px;font-weight:700;',
    'cursor:pointer;transition:background .16s ease,border-color .16s ease}',
    '#thbCookie .ok{background:#0a0a0a;color:#fff}',
    '#thbCookie .ok:hover{background:#232320}',
    '#thbCookie .no{background:#fff;color:#0a0a0a;border:1px solid #e6e3dc}',
    '#thbCookie .no:hover{border-color:#0a0a0a}',
    '.thb-cookie-link{cursor:pointer;background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:none}',
    '.thb-cookie-link:hover{text-decoration:underline;text-underline-offset:3px}',
    '@media(max-width:600px){#thbCookie{left:12px;right:12px;max-width:none;',
    'bottom:calc(84px + env(safe-area-inset-bottom));border-radius:18px;padding:16px 16px 14px}}',
    '@media print{#thbCookie{display:none}}'
  ].join('');

  var box = null;

  function build() {
    if (box) return box;
    var st = document.createElement('style');
    st.id = 'thb-cookie-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    box = document.createElement('div');
    box.id = 'thbCookie';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookies');
    box.innerHTML =
      '<h3>Cookies</h3>' +
      '<p>We use Google Analytics to see which villas and buttons people actually use. ' +
      'Nothing is sold or used for ads. <a href="/privacy/">Privacy notice</a></p>' +
      '<div class="row"><button type="button" class="no">Decline</button>' +
      '<button type="button" class="ok">Accept</button></div>';
    document.body.appendChild(box);

    box.querySelector('.ok').addEventListener('click', function () { answer('granted'); });
    box.querySelector('.no').addEventListener('click', function () { answer('denied'); });
    return box;
  }

  function show() {
    build();
    requestAnimationFrame(function () { box.classList.add('is-on'); });
    setTimeout(function () { box.classList.add('is-on'); }, 40);
  }

  function hide() {
    if (!box) return;
    box.classList.remove('is-on');
    setTimeout(function () { if (box) box.style.display = 'none'; }, 300);
  }

  function answer(v) {
    remember(v);
    apply(v);
    hide();
  }

  /* let anyone reopen the choice */
  window.thbCookieSettings = function () {
    build();
    box.style.display = '';
    show();
  };

  function addFooterLink() {
    var nav = document.querySelector('footer nav, .ft-nav, footer .ft-nav');
    if (!nav || nav.querySelector('.thb-cookie-link')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'thb-cookie-link';
    b.textContent = 'Cookies';
    b.addEventListener('click', window.thbCookieSettings);
    nav.appendChild(b);
  }

  function start() {
    addFooterLink();
    var s = stored();
    if (s) { apply(s); return; }        /* already answered */
    if (inEurope()) show();             /* EEA/UK/CH: ask before measuring */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
