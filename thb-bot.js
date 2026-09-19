/* thb-bot.js — bridge between the site and the Telegram admin chat.

   Sends three things to /api/* (the Worker, which holds the bot token):
     - every WhatsApp click as a numbered lead, with the exact text the guest is
       about to send, the villa and the picked dates;
     - an anonymous pageview ping for the weekly digest;
     - JavaScript errors, so a broken page reaches the chat instead of nobody.

   If the API is not deployed yet, the first call fails and everything goes quiet
   for the rest of the session — the site keeps working exactly as before. */
(function () {
  'use strict';
  if (window.__thbBot) return;
  window.__thbBot = 1;

  var off = false;                    /* set once the API answers 404 */

  function post(path, data, beacon) {
    if (off) return;
    var body = JSON.stringify(data);
    try {
      /* a blocked/failed beacon (ad/tracker blockers drop these) falls back to fetch,
         instead of silently losing whatever was being sent */
      if (beacon && navigator.sendBeacon &&
          navigator.sendBeacon(path, new Blob([body], { type: 'application/json' }))) {
        return;
      }
      fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body,
        keepalive: true
      }).then(function (r) {
        if (r.status === 404 || r.status === 405) off = true;
      }).catch(function () { off = true; });
    } catch (e) { off = true; }
  }

  function villaName() {
    var t = (document.title || '').split('|')[0].trim();
    return t || location.pathname;
  }

  function dates() {
    try {
      var d = window.thbGetDates && window.thbGetDates();
      if (!d || !d.start || !d.end) return null;
      var fmt = function (x) {
        try {
          return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return x.toDateString(); }
      };
      return {
        checkin: fmt(d.start),
        checkout: fmt(d.end),
        nights: Math.round((d.end - d.start) / 86400000)
      };
    } catch (e) { return null; }
  }

  function guests() {
    try {
      var g = window.thbGetGuests && window.thbGetGuests();
      return g && g.count ? g.count : null;
    } catch (e) { return null; }
  }

  /* ---- WhatsApp clicks become numbered leads ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;

    /* the request sheet posts its own, richer lead — do not double count */
    if (window.__thbLeadSent && Date.now() - window.__thbLeadSent < 8000) return;

    var text = '';
    try { text = new URL(a.href, location.href).searchParams.get('text') || ''; } catch (err) {}

    var payload = {
      source: 'whatsapp',
      villa: villaName(),
      page: location.href,
      text: text
    };
    var d = dates();
    if (d) { payload.checkin = d.checkin; payload.checkout = d.checkout; payload.nights = d.nights; }
    var g = guests();
    if (g) payload.guests = g;

    /* fetch, not sendBeacon: a lead is worth money, and ad/tracker blockers
       (Brave Shields, several privacy extensions) silently drop beacons —
       the WhatsApp chat still opens fine, so nobody notices the lead vanished. */
    post('/api/lead', payload, false);
  }, true);

  /* ---- pageview ping for the daily digest ---- */
  function hit() {
    post('/api/hit', { path: location.pathname, ref: document.referrer || '' }, true);
  }

  /* ---- broken page -> chat ---- */
  function alertOnce(message) {
    post('/api/alert', {
      message: message,
      page: location.href,
      ua: navigator.userAgent
    });
  }

  window.addEventListener('error', function (e) {
    if (!e) return;
    if (e.target && e.target.tagName && /^(IMG|SCRIPT|LINK)$/.test(e.target.tagName)) {
      var src = e.target.src || e.target.href || '';
      /* only report our own missing files, not third-party blockers */
      if (src.indexOf(location.origin) !== 0) return;
      /* A dropped connection (mobile crawlers, flaky Wi-Fi, a deploy in progress) also fires
         this event. Re-check the file before waking the chat: alert only when the server
         really answers 4xx/5xx or the file is unreachable twice (19.09.2026). */
      try {
        fetch(src, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
          if (r.status >= 400) alertOnce('Не загрузился файл (' + r.status + '): ' + src);
        }).catch(function () {
          setTimeout(function () {
            fetch(src, { method: 'HEAD', cache: 'no-store' })
              .catch(function () { alertOnce('Файл недоступен дважды: ' + src); });
          }, 3000);
        });
      } catch (err) {}
      return;
    }
    alertOnce((e.message || 'script error') + ' @ ' +
              (e.filename || '?') + ':' + (e.lineno || 0));
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    alertOnce('Необработанная ошибка: ' + ((r && (r.message || r)) || 'unknown'));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hit);
  else hit();
})();
