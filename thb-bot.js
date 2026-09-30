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

  /* Краулеры ходят к нам сотнями и получают от края то же, что и люди, но их
     промахи чинятся не в коде сайта. Помечаем их в сообщении, чтобы было видно
     сразу. */
  var CRAWLER = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview/i
    .test(navigator.userAgent || '');

  /* 4xx — это наш промах: файла нет или он закрыт. 5xx на статике почти всегда
     край: пересборка версии, защита от ботов, сетевой сбой. Такой ответ
     перепроверяем и будим чат, только если он повторился (30.09.2026: за ночь
     пришло девять сообщений про 500/503 на thb-cards.js, хотя файл на месте и
     деплоя в те часы не было). */
  function recheck(src, tries) {
    fetch(src, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      if (r.status < 400) return;                       /* выправилось само */
      if (r.status >= 500 && tries > 0) {
        setTimeout(function () { recheck(src, tries - 1); }, 6000);
        return;
      }
      alertOnce('Не загрузился файл (' + r.status + '): ' + src +
                (CRAWLER ? ' · краулер' : ''));
    }).catch(function () {
      setTimeout(function () {
        fetch(src, { method: 'HEAD', cache: 'no-store' })
          .catch(function () {
            alertOnce('Файл недоступен дважды: ' + src + (CRAWLER ? ' · краулер' : ''));
          });
      }, 3000);
    });
  }

  window.addEventListener('error', function (e) {
    if (!e) return;
    if (e.target && e.target.tagName && /^(IMG|SCRIPT|LINK)$/.test(e.target.tagName)) {
      var src = e.target.src || e.target.href || '';
      /* only report our own missing files, not third-party blockers */
      if (src.indexOf(location.origin) !== 0) return;
      try { recheck(src, 2); } catch (err) {}
      return;
    }

    /* «script error @ ?:0» — это ошибка в чужом скрипте с другого домена:
       браузер не отдаёт ни файла, ни строки, чинить по такому сообщению
       нечего. Пишем только то, где есть адрес файла. */
    var msg = e.message || '';
    if (!e.filename && (!msg || /^script error/i.test(msg))) return;

    alertOnce(msg + ' @ ' + (e.filename || '?') + ':' + (e.lineno || 0) +
              (CRAWLER ? ' · краулер' : ''));
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    alertOnce('Необработанная ошибка: ' + ((r && (r.message || r)) || 'unknown'));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hit);
  else hit();
})();
