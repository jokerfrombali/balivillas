/* thb-events.js — what we actually want to measure: contact intent.
   GA4 pageviews come from the gtag snippet in <head>; this file adds the events
   that matter for a site whose conversion is a WhatsApp message. */
(function () {
  'use strict';
  if (window.__thbEvents) return;
  window.__thbEvents = 1;

  function send(name, params) {
    try {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
      else window.dataLayer.push(Object.assign({ event: name }, params || {}));
    } catch (e) {}
  }

  /* which villa / page the click happened on */
  function pageName() {
    var t = (document.title || '').split('|')[0].trim();
    return t || location.pathname;
  }

  /* where on the page the button sits — so we learn which CTA earns the clicks */
  function spotOf(el) {
    if (el.closest('#thbHdrWa')) return 'header';
    if (el.closest('#thbBookBar')) return 'bottom_bar';
    if (el.closest('#thbWaPill')) return 'floating_pill';
    if (el.closest('#thbEnq')) return 'request_sheet';
    if (el.closest('#property-booking')) return 'booking_card';
    if (el.closest('footer, .ft')) return 'footer';
    if (el.closest('header, .site-header, .hd')) return 'header';
    return 'page';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var wa = t.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (wa) {
      send('whatsapp_click', {
        spot: spotOf(wa),
        page_name: pageName(),
        page_path: location.pathname,
        has_dates: /Check-in:/.test(decodeURIComponent(wa.getAttribute('href') || '')) ? 'yes' : 'no'
      });
      return;
    }

    var tel = t.closest('a[href^="tel:"]');
    if (tel) {
      send('phone_click', { spot: spotOf(tel), page_name: pageName() });
      return;
    }

    var enq = t.closest('.thb-enq-send');
    if (enq) {
      /* the same class is the sheet's submit button and the CTA that opens it */
      var inSheet = !!enq.closest('#thbEnq');
      send(inSheet ? 'booking_submit' : 'booking_open', {
        spot: spotOf(enq),
        page_name: pageName(),
        page_path: location.pathname
      });
      return;
    }

    var fav = t.closest('.thb-fav, [data-fav-link]');
    if (fav) {
      send('villa_saved', { page_name: pageName() });
      return;
    }

    var filters = t.closest('.filters-btn');
    if (filters) send('filters_open', { page_path: location.pathname });
  }, false);

  /* dates picked in the availability calendar — strong intent signal */
  var label = document.getElementById('selectedDateRange');
  if (label && window.MutationObserver) {
    var last = '';
    new MutationObserver(function () {
      var v = (label.textContent || '').trim();
      if (v === last || !/~/.test(v)) return;      /* only complete ranges */
      last = v;
      send('dates_selected', { page_name: pageName(), page_path: location.pathname });
    }).observe(label, { childList: true, characterData: true, subtree: true });
  }
})();
