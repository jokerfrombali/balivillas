/*! The Host Bali — saved villas (wishlist). Vanilla, no deps, localStorage. */
(function () {
  'use strict';

  var KEY = 'thb_saved_v1';
  var EV = 'thb-saved-change';

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
    } catch (e) { return []; }
  }

  function write(arr) {
    try { window.localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 60))); } catch (e) {}
  }

  function norm(u) {
    if (!u) return '';
    u = String(u).split('?')[0].split('#')[0];
    if (u.charAt(u.length - 1) !== '/') u += '/';
    return u;
  }

  var API = {
    all: function () { return read(); },
    count: function () { return read().length; },
    has: function (u) {
      u = norm(u);
      return read().some(function (x) { return norm(x.u) === u; });
    },
    remove: function (u) {
      u = norm(u);
      write(read().filter(function (x) { return norm(x.u) !== u; }));
      sync();
    },
    clear: function () { write([]); sync(); },
    toggle: function (d) {
      var arr = read(), u = norm(d.u), at = -1;
      arr.forEach(function (x, i) { if (norm(x.u) === u) at = i; });
      if (at > -1) { arr.splice(at, 1); } else { arr.unshift(d); }
      write(arr);
      sync();
      return at < 0; // true = добавили
    }
  };
  window.THBSaved = API;

  /* ---------- стили ---------- */
  var CSS = [
    '.thb-fav{position:absolute;top:10px;right:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;',
    'background:rgba(255,255,255,.92);border:none;border-radius:50%;cursor:pointer;padding:0;z-index:4;',
    '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 8px rgba(0,0,0,.13);',
    'touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background .18s,transform .18s}',
    '.thb-fav svg{width:17px;height:17px;fill:none;stroke:#0a0a0a;stroke-width:2;transition:fill .18s,stroke .18s,transform .18s}',
    '@media(hover:hover){.thb-fav:hover{background:#fff;transform:scale(1.08)}}',
    '.thb-fav[aria-pressed="true"] svg{fill:#e11d48;stroke:#e11d48}',
    '.thb-fav.thb-pop svg{animation:thbHeartPop .38s cubic-bezier(.2,.9,.3,1.4)}',
    '@keyframes thbHeartPop{0%{transform:scale(1)}42%{transform:scale(1.42)}100%{transform:scale(1)}}',
    '.thb-acw{position:relative;display:flex;flex:0 0 76vw;max-width:300px;scroll-snap-align:start}',
    '.thb-acw>.thb-acard{flex:1 1 auto;max-width:none}',
    '@media(min-width:640px){.thb-acw{flex:0 0 300px}}',
    /* сердце в шапке */
    '[data-fav-link]{position:relative;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit}',
    '[data-fav-badge]{position:absolute;top:-1px;right:-1px;min-width:17px;height:17px;padding:0 4px;box-sizing:border-box;',
    'border-radius:999px;background:#e11d48;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:10.5px;font-weight:700;line-height:17px;',
    'text-align:center;border:2px solid #fafaf7;display:none}',
    '[data-fav-link].thb-has svg{fill:#e11d48!important;stroke:#e11d48!important}',
    '[data-fav-link].thb-has [data-fav-badge]{display:block}',
    /* тост */
    '#thbSavedToast{position:fixed;left:50%;transform:translateX(-50%) translateY(18px);bottom:calc(20px + env(safe-area-inset-bottom));',
    'z-index:95;display:flex;align-items:center;gap:12px;background:#0a0a0a;color:#fff;border-radius:999px;padding:11px 12px 11px 18px;',
    'font-family:Inter,system-ui,sans-serif;font-size:13.5px;font-weight:600;box-shadow:0 14px 40px rgba(0,0,0,.3);',
    'opacity:0;visibility:hidden;transition:opacity .22s ease,transform .22s ease,visibility .22s;max-width:92vw}',
    '#thbSavedToast.om{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}',
    '#thbSavedToast a{background:#fff;color:#0a0a0a;border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:700;text-decoration:none;white-space:nowrap}',
    '@media(prefers-reduced-motion:reduce){.thb-fav.thb-pop svg{animation:none}#thbSavedToast{transition:none}}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('thb-fav-css')) return;
    var st = document.createElement('style');
    st.id = 'thb-fav-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- тост ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('thbSavedToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'thbSavedToast';
      t.innerHTML = '<span data-toast-msg></span><a href="' +
        ((document.documentElement.lang || '').slice(0, 2) === 'it' ? '/it' : '') + '/saved/">View</a>';
      document.body.appendChild(t);
    }
    t.querySelector('[data-toast-msg]').textContent = msg;
    t.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  /* ---------- синхЀонизация UI ---------- */
  function sync() {
    var arr = read(), n = arr.length;
    var urls = {};
    arr.forEach(function (x) { urls[norm(x.u)] = 1; });

    [].forEach.call(document.querySelectorAll('[data-fav-btn]'), function (b) {
      var on = !!urls[norm(b.getAttribute('data-u'))];
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? 'Remove from saved' : 'Save this villa');
    });
    [].forEach.call(document.querySelectorAll('[data-fav-count]'), function (e) {
      e.textContent = n ? String(n) : '';
      e.style.display = n ? '' : 'none';
    });
    if (document.body) document.body.classList.toggle('thb-has-saved', n > 0);
    [].forEach.call(document.querySelectorAll('[data-fav-link]'), function (e) {
      e.classList.toggle('thb-has', n > 0);
      var b = e.querySelector('[data-fav-badge]');
      if (b) b.textContent = n > 9 ? '9+' : String(n);
      e.setAttribute('aria-label', n ? ('Saved villas (' + n + ')') : 'Saved villas');
    });
    try {
      document.dispatchEvent(new CustomEvent(EV, { detail: { count: n, items: arr } }));
    } catch (e) {
      var ev = document.createEvent('Event'); ev.initEvent(EV, true, true); document.dispatchEvent(ev);
    }
  }
  API.sync = sync;

  /* ---------- клики ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-fav-btn]') : null;
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    var added = API.toggle({
      u: b.getAttribute('data-u') || '',
      t: b.getAttribute('data-t') || '',
      i: b.getAttribute('data-i') || '',
      m: b.getAttribute('data-m') || '',
      a: b.getAttribute('data-a') || ''
    });
    if (added) {
      b.classList.add('thb-pop');
      setTimeout(function () { b.classList.remove('thb-pop'); }, 420);
      var n = API.count();
      toast('Saved — ' + n + (n === 1 ? ' villa' : ' villas'));
    }
  }, true);

  window.addEventListener('storage', function (e) { if (e.key === KEY) sync(); });
  window.addEventListener('pageshow', sync);

  function boot() { injectCSS(); sync(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
