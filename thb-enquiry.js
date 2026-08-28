/* thb-enquiry.js — booking request sheet for villa pages.
   Gives the guest a choice: leave a structured request, or jump straight to WhatsApp.

   WHERE REQUESTS GO
   -----------------
   Set ENDPOINT below to a URL that accepts POST + JSON and the form submits there.
   While it is empty the form falls back to WhatsApp: the same structured request is
   handed to WhatsApp as a prefilled message, so nothing is ever lost.
*/
(function () {
  var ENDPOINT = '/api/lead';        // Cloudflare Worker -> Telegram (worker/index.js)
  var WA = '6285746499697';
  var TERMS = '/terms/';

  if (window.__thbEnquiry) return;
  window.__thbEnquiry = 1;

  var CODES = [
    ['+62', 'ID'], ['+7', 'RU'], ['+1', 'US'], ['+44', 'UK'], ['+61', 'AU'],
    ['+65', 'SG'], ['+60', 'MY'], ['+33', 'FR'], ['+49', 'DE'], ['+39', 'IT'],
    ['+34', 'ES'], ['+31', 'NL'], ['+81', 'JP'], ['+82', 'KR'], ['+86', 'CN'],
    ['+91', 'IN'], ['+971', 'AE'], ['+972', 'IL'], ['+64', 'NZ'], ['+27', 'ZA']
  ];

  var CSS = [
    '#thbEnq,#thbEnqScrim{position:fixed;inset:0;z-index:120}',
    '#thbEnqScrim{background:rgba(10,10,10,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .28s ease}',
    '#thbEnq{display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none;max-width:100vw;overflow-x:hidden}',
    '#thbEnq[hidden],#thbEnqScrim[hidden]{display:none}',
    '.thb-enq-card{position:relative;pointer-events:auto;width:100%;max-width:452px;max-height:calc(100vh - 48px);display:flex;flex-direction:column;',
    'background:#fdfdfb;border:1px solid rgba(10,10,10,.08);border-radius:24px;box-shadow:0 24px 60px -12px rgba(10,10,10,.32),0 2px 8px rgba(10,10,10,.06);',
    'opacity:0;transform:translateY(14px) scale(.985);transition:opacity .26s ease,transform .34s cubic-bezier(.22,1,.36,1)}',
    '#thbEnq.is-on .thb-enq-card{opacity:1;transform:none}',
    '#thbEnqScrim.is-on{opacity:1}',

    '.thb-enq-head{display:flex;align-items:flex-start;gap:12px;padding:22px 22px 14px}',
    '.thb-enq-head h2{margin:0;font-family:Lora,Georgia,serif;font-size:21px;line-height:1.2;letter-spacing:-.01em;color:#0a0a0a;font-weight:600}',
    '.thb-enq-head p{margin:5px 0 0;font-size:13px;line-height:1.45;color:#6b6b66}',
    '.thb-enq-x{margin-left:auto;flex:none;width:34px;height:34px;border-radius:999px;border:1px solid #e6e3dc;background:#fff;color:#0a0a0a;',
    'display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .16s,background .16s}',
    '.thb-enq-x:hover{border-color:#0a0a0a}',
    '.thb-enq-x svg{width:15px;height:15px;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round}',

    '.thb-enq-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 22px 6px;display:flex;flex-direction:column;gap:12px}',
    '.thb-enq-row{border:1px solid #e6e3dc;border-radius:16px;background:#fff;padding:13px 15px}',
    '.thb-enq-row.is-tap{cursor:pointer;transition:border-color .16s,box-shadow .16s}',
    '.thb-enq-row.is-tap:hover{border-color:#0a0a0a}',
    '.thb-enq-k{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8a877f}',
    '.thb-enq-v{margin-top:3px;font-size:15px;font-weight:600;color:#0a0a0a;display:flex;align-items:center;gap:8px}',
    '.thb-enq-v small{font-weight:500;color:#6b6b66;font-size:13px}',
    '.thb-enq-v .thb-enq-miss{color:#b3261e}',

    '.thb-enq-step{display:flex;align-items:center;justify-content:space-between;padding:9px 0}',
    '.thb-enq-step+.thb-enq-step{border-top:1px solid #f0eee8}',
    '.thb-enq-step b{font-size:15px;font-weight:600;color:#0a0a0a;display:block}',
    '.thb-enq-step span{font-size:12.5px;color:#8a877f}',
    '.thb-enq-pm{display:flex;align-items:center;gap:6px}',
    '.thb-enq-pm button{width:34px;height:34px;border-radius:999px;border:1px solid #e6e3dc;background:#fff;color:#0a0a0a;font-size:18px;line-height:1;',
    'display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .16s,background .16s,opacity .16s}',
    '.thb-enq-pm button:hover:not(:disabled){border-color:#0a0a0a}',
    '.thb-enq-pm button:disabled{opacity:.32;cursor:default}',
    '.thb-enq-pm output{min-width:22px;text-align:center;font-size:15px;font-weight:700;color:#0a0a0a}',
    '.thb-enq-note{font-size:12.5px;line-height:1.45;color:#8a877f;padding-top:9px;border-top:1px solid #f0eee8}',

    '.thb-enq-f{position:relative}',
    '.thb-enq-f input,.thb-enq-f textarea,.thb-enq-f select{width:100%;box-sizing:border-box;font:inherit;font-size:15px;color:#0a0a0a;background:#fff;',
    'border:1px solid #e6e3dc;border-radius:16px;padding:21px 15px 9px;outline:none;transition:border-color .16s,box-shadow .16s;-webkit-appearance:none;appearance:none}',
    '.thb-enq-f textarea{min-height:74px;resize:vertical;padding-top:22px;line-height:1.45}',
    '.thb-enq-f label{position:absolute;left:16px;top:8px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8a877f;pointer-events:none}',
    '.thb-enq-f input:focus,.thb-enq-f textarea:focus,.thb-enq-f select:focus{border-color:#0a0a0a;box-shadow:0 0 0 3px rgba(10,10,10,.07)}',
    '.thb-enq-f.has-err input,.thb-enq-f.has-err textarea{border-color:#b3261e;box-shadow:0 0 0 3px rgba(179,38,30,.08)}',
    '.thb-enq-f em{display:none;margin:5px 0 0 4px;font-style:normal;font-size:12px;font-weight:600;color:#b3261e}',
    '.thb-enq-f.has-err em{display:block}',
    '.thb-enq-tel{display:grid;grid-template-columns:104px 1fr;gap:8px}',
    '.thb-enq-tel select{padding:21px 9px 9px;font-weight:600;background-image:none}',

    '.thb-enq-agree{display:flex;align-items:flex-start;gap:10px;padding:2px 4px 0;font-size:13px;line-height:1.45;color:#4b4a45;cursor:pointer}',
    '.thb-enq-agree input{flex:none;width:19px;height:19px;margin:1px 0 0;accent-color:#0a0a0a;cursor:pointer}',
    '.thb-enq-agree a{color:#0a0a0a;text-decoration:underline;text-underline-offset:2px}',
    '.thb-enq-agree.has-err{color:#b3261e}',

    '.thb-enq-foot{padding:14px 22px calc(18px + env(safe-area-inset-bottom));border-top:1px solid #f0eee8;display:flex;flex-direction:column;gap:9px;background:#fdfdfb;border-radius:0 0 24px 24px}',
    '.thb-enq-send,.thb-enq-wa{position:relative;width:100%;box-sizing:border-box;border:0;border-radius:999px;padding:15px 20px;font:inherit;font-size:15px;font-weight:700;',
    'display:inline-flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;text-decoration:none;transition:transform .16s ease,background .18s ease,box-shadow .18s ease}',
    '.thb-enq-send{background:#0a0a0a;color:#fff;box-shadow:0 8px 20px -8px rgba(10,10,10,.5)}',
    '.thb-enq-send:hover{background:#232320;transform:translateY(-1px)}',
    '.thb-enq-send:disabled{opacity:.6;cursor:default;transform:none}',
    '.thb-enq-wa{background:#fff;color:#0a7d43;border:1px solid #bfe6cf}',
    '.thb-enq-wa:hover{background:#f2fbf6;border-color:#0a7d43;transform:translateY(-1px)}',
    '.thb-enq-wa svg{width:17px;height:17px;fill:currentColor}',
    '.thb-enq-hint{margin:1px 0 0;text-align:center;font-size:12px;color:#8a877f}',
    '.thb-enq-spin{width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:thbEnqSpin .7s linear infinite;display:none}',
    '.is-busy .thb-enq-spin{display:block}',
    '@keyframes thbEnqSpin{to{transform:rotate(360deg)}}',

    '.thb-enq-done{display:none;padding:34px 26px 30px;text-align:center}',
    '.is-done .thb-enq-body,.is-done .thb-enq-foot{display:none}',
    '.is-done .thb-enq-done{display:block}',
    '.thb-enq-done .tick{width:62px;height:62px;margin:0 auto 16px;border-radius:999px;background:#eafaf1;display:flex;align-items:center;justify-content:center}',
    '.thb-enq-done .tick svg{width:28px;height:28px;stroke:#0a7d43;stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:32;stroke-dashoffset:32;animation:thbEnqTick .5s .1s cubic-bezier(.22,1,.36,1) forwards}',
    '@keyframes thbEnqTick{to{stroke-dashoffset:0}}',
    '.thb-enq-done h3{margin:0 0 7px;font-family:Lora,Georgia,serif;font-size:21px;font-weight:600;color:#0a0a0a}',
    '.thb-enq-done p{margin:0 auto 18px;max-width:300px;font-size:13.5px;line-height:1.5;color:#6b6b66}',
    '.thb-enq-done .thb-enq-wa{max-width:260px;margin:0 auto}',

    /* the two choices, injected into the booking card and the mobile bar */
    '.thb-enq-cta{display:flex;flex-direction:column;gap:9px;margin-top:14px}',
    '.thb-enq-cta .thb-enq-send,.thb-enq-cta .thb-enq-wa{font-size:15px;padding:15px 20px}',
    '.thb-enq-or{display:flex;align-items:center;gap:10px;margin:1px 0;font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#a8a59d}',
    '.thb-enq-or::before,.thb-enq-or::after{content:"";height:1px;flex:1;background:#eae7e0}',
    '#thbBookBar .thb-enq-bar{display:flex;align-items:center;gap:8px;flex:none}',
    '#thbBookBar .thb-enq-bar .thb-enq-send{width:auto;padding:14px 24px;font-size:15px;letter-spacing:.04em}',
    /* WhatsApp lives in the header now, right-aligned next to the menu */
    '#thbHdrWa{flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;',
    'border-radius:999px;background:#22c55e;color:#fff;text-decoration:none;',
    'box-shadow:0 6px 16px -6px rgba(22,163,74,.6);transition:background .16s ease,transform .16s ease}',
    '#thbHdrWa:hover{background:#16a34a;transform:translateY(-1px)}',
    '#thbHdrWa svg{width:20px;height:20px;fill:currentColor}',
    '@media(max-width:1023px){#thbHdrWa{width:38px;height:38px}#thbHdrWa svg{width:19px;height:19px}}',

    /* iOS Safari zooms the whole page when a focused field is under 16px —
       that is what shifted the sheet sideways on the phone */
    '@media(max-width:900px){.thb-enq-f input,.thb-enq-f textarea,.thb-enq-f select{font-size:16px}}',
    '@media(max-width:600px){',
    '#thbEnq{padding:0;align-items:flex-end}',
    '.thb-enq-card{max-width:none;border-radius:24px 24px 0 0;max-height:92vh;transform:translateY(26px)}',
    '.thb-enq-foot{border-radius:0}',
    '.thb-enq-head{padding-top:26px}',
    '.thb-enq-card::before{content:"";position:absolute;top:9px;left:50%;transform:translateX(-50%);width:38px;height:4px;border-radius:999px;background:#e0ddd5}',
    '}',
    '@media(prefers-reduced-motion:reduce){#thbEnq *,#thbEnqScrim{transition:none!important;animation:none!important}}',
    '@media print{#thbEnq,#thbEnqScrim{display:none!important}}'
  ].join('');

  /* ---------- page facts ---------- */
  function villaName() {
    var t = (document.title || '').split('|')[0].trim();
    if (t) return t;
    var h = document.querySelector('h1');
    return h ? h.textContent.trim() : 'this villa';
  }
  function villaUrl() {
    var c = document.querySelector('link[rel="canonical"]');
    return c && c.href ? c.href.split('?')[0] : 'https://thehostbali.com' + location.pathname;
  }
  function maxGuests() {
    try { var g = window.thbGetGuests && window.thbGetGuests(); return (g && g.max) || 0; } catch (e) { return 0; }
  }
  function dates() {
    try { return (window.thbGetDates && window.thbGetDates()) || {}; } catch (e) { return {}; }
  }
  function fmt(d) {
    try { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return d.toDateString(); }
  }
  function nights() {
    var d = dates();
    return d.start && d.end ? Math.round((d.end - d.start) / 86400000) : 0;
  }

  /* ---------- build ---------- */
  var scrim, wrap, card, els = {};

  function build() {
    var st = document.createElement('style');
    st.id = 'thb-enquiry-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    scrim = document.createElement('div');
    scrim.id = 'thbEnqScrim';
    scrim.hidden = true;

    wrap = document.createElement('div');
    wrap.id = 'thbEnq';
    wrap.hidden = true;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Booking request');

    var opts = CODES.map(function (c) {
      return '<option value="' + c[0] + '">' + c[1] + ' ' + c[0] + '</option>';
    }).join('');

    wrap.innerHTML =
      '<form class="thb-enq-card" novalidate>' +
        '<div class="thb-enq-head">' +
          '<div><h2>Request this villa</h2><p data-enq="villa"></p></div>' +
          '<button type="button" class="thb-enq-x" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div>' +

        '<div class="thb-enq-body">' +
          '<div class="thb-enq-row is-tap" data-enq="datesRow" role="button" tabindex="0">' +
            '<div class="thb-enq-k">Your check-in &amp; check-out</div>' +
            '<div class="thb-enq-v" data-enq="datesText"></div>' +
          '</div>' +

          '<div class="thb-enq-row">' +
            '<div class="thb-enq-step"><div><b>Adults</b><span>13 years or older</span></div>' +
              '<div class="thb-enq-pm"><button type="button" data-enq="adultsMinus" aria-label="Fewer adults">−</button>' +
              '<output data-enq="adults">2</output>' +
              '<button type="button" data-enq="adultsPlus" aria-label="More adults">+</button></div></div>' +
            '<div class="thb-enq-step"><div><b>Children</b><span>12 and under</span></div>' +
              '<div class="thb-enq-pm"><button type="button" data-enq="kidsMinus" aria-label="Fewer children">−</button>' +
              '<output data-enq="kids">0</output>' +
              '<button type="button" data-enq="kidsPlus" aria-label="More children">+</button></div></div>' +
            '<div class="thb-enq-note" data-enq="cap"></div>' +
          '</div>' +

          '<div class="thb-enq-f"><label for="thbEnqName">Full name</label>' +
            '<input id="thbEnqName" name="name" type="text" autocomplete="name" placeholder="Anna Ivanova">' +
            '<em>Please tell us your name</em></div>' +

          '<div class="thb-enq-f"><label for="thbEnqMail">Email</label>' +
            '<input id="thbEnqMail" name="email" type="email" autocomplete="email" placeholder="you@email.com">' +
            '<em>Check the email address</em></div>' +

          '<div class="thb-enq-f"><div class="thb-enq-tel">' +
            '<div class="thb-enq-f" style="margin:0"><label for="thbEnqCode">Code</label>' +
              '<select id="thbEnqCode" name="code">' + opts + '</select></div>' +
            '<div class="thb-enq-f" style="margin:0"><label for="thbEnqTel">WhatsApp / phone</label>' +
              '<input id="thbEnqTel" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="812 3456 7890"></div>' +
            '</div><em>Add a number we can reach you on</em></div>' +

          '<div class="thb-enq-f"><label for="thbEnqNote">Anything we should know? (optional)</label>' +
            '<textarea id="thbEnqNote" name="note" placeholder="Airport pickup, early check-in, long stay…"></textarea></div>' +

          '<label class="thb-enq-agree" data-enq="agreeWrap">' +
            '<input type="checkbox" name="agree">' +
            '<span>I agree with the <a href="' + TERMS + '" target="_blank" rel="noopener">terms of use</a> and to being contacted about this request.</span>' +
          '</label>' +
        '</div>' +

        '<div class="thb-enq-foot">' +
          '<button type="submit" class="thb-enq-send"><span class="thb-enq-spin"></span><span data-enq="sendLabel">Send request</span></button>' +
          '<div class="thb-enq-or">or</div>' +
          '<button type="button" class="thb-enq-wa" data-enq="waInSheet">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.4 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8S17.4 2.2 12 2.2zm5.5 12.2c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.6-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.2.5-.6.6-.8.2-.2.2-.4.3-.6.1-.2 0-.4 0-.5 0-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.1 3.3 5.2 4.5 3.1 1.2 3.1.8 3.7.8.6-.1 1.9-.8 2.1-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4z"/></svg>' +
            'Chat on WhatsApp instead</button>' +
          '<p class="thb-enq-hint">We reply within ~15 minutes, 8:00–22:00 WITA.</p>' +
        '</div>' +

        '<div class="thb-enq-done">' +
          '<div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg></div>' +
          '<h3 data-enq="doneTitle">Request sent</h3>' +
          '<p data-enq="doneText"></p>' +
          '<button type="button" class="thb-enq-wa" data-enq="waAfter">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.4 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8S17.4 2.2 12 2.2z"/></svg>' +
            'Continue on WhatsApp</button>' +
        '</div>' +
      '</form>';

    document.body.appendChild(scrim);
    document.body.appendChild(wrap);
    card = wrap.querySelector('.thb-enq-card');

    [].forEach.call(wrap.querySelectorAll('[data-enq]'), function (el) { els[el.getAttribute('data-enq')] = el; });

    els.villa.textContent = villaName();

    /* guests */
    var cap = maxGuests();
    var adults = 2, kids = 0;
    try {
      var g = window.thbGetGuests && window.thbGetGuests();
      if (g && g.count) adults = Math.max(1, g.count);
    } catch (e) {}
    if (cap) adults = Math.min(adults, cap);

    function paintGuests() {
      els.adults.textContent = adults;
      els.kids.textContent = kids;
      els.cap.textContent = cap
        ? 'This villa takes up to ' + cap + ' guests. Bringing more? Tell us in the note.'
        : 'Bringing a bigger group? Tell us in the note.';
      els.adultsMinus.disabled = adults <= 1;
      els.adultsPlus.disabled = !!cap && adults + kids >= cap;
      els.kidsMinus.disabled = kids <= 0;
      els.kidsPlus.disabled = !!cap && adults + kids >= cap;
    }
    els.adultsMinus.onclick = function () { adults = Math.max(1, adults - 1); paintGuests(); };
    els.adultsPlus.onclick = function () { if (!cap || adults + kids < cap) { adults++; paintGuests(); } };
    els.kidsMinus.onclick = function () { kids = Math.max(0, kids - 1); paintGuests(); };
    els.kidsPlus.onclick = function () { if (!cap || adults + kids < cap) { kids++; paintGuests(); } };
    paintGuests();

    /* dates row -> the real calendar, then straight back here */
    function toCalendar() {
      pendingReopen = true;
      close();
      var jump = document.querySelector('[data-thb-cta="check-availability"]');
      var sec = document.getElementById('section-availability');
      if (!sec) return;
      setTimeout(function () {
        if (jump) { jump.click(); return; }
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
    }
    els.datesRow.addEventListener('click', toCalendar);
    els.datesRow.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toCalendar(); }
    });

    /* payload + validation */
    function payload() {
      var d = dates();
      return {
        villa: villaName(),
        url: villaUrl(),
        checkin: d.start ? fmt(d.start) : '',
        checkout: d.end ? fmt(d.end) : '',
        nights: nights(),
        adults: adults,
        children: kids,
        name: card.name.value.trim(),
        email: card.email.value.trim(),
        phone: card.code.value + ' ' + card.phone.value.trim(),
        note: card.note.value.trim(),
        page: location.href
      };
    }
    function asText(p) {
      var s = 'Booking request — ' + p.villa;
      if (p.checkin) s += '\nCheck-in: ' + p.checkin + '\nCheck-out: ' + p.checkout + '\nNights: ' + p.nights;
      s += '\nGuests: ' + p.adults + ' adult' + (p.adults > 1 ? 's' : '') + (p.children ? ' + ' + p.children + ' child' + (p.children > 1 ? 'ren' : '') : '');
      s += '\nName: ' + p.name + '\nEmail: ' + p.email + '\nPhone: ' + p.phone;
      if (p.note) s += '\nNote: ' + p.note;
      return s + '\nLink: ' + p.url;
    }
    function flag(el, bad) {
      var f = el.closest('.thb-enq-agree');
      if (!f) {
        f = el.closest('.thb-enq-f');
        /* the phone row nests two field boxes — the message lives on the outer one */
        while (f && !f.querySelector('em')) {
          var up = f.parentElement ? f.parentElement.closest('.thb-enq-f') : null;
          if (!up) break;
          f = up;
        }
      }
      if (f) f.classList.toggle('has-err', !!bad);
      return !bad;
    }
    function validate() {
      var p = payload(), ok = true, first = null;
      if (!p.name || p.name.length < 2) { flag(card.name, 1); ok = false; first = first || card.name; } else flag(card.name, 0);
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(p.email)) { flag(card.email, 1); ok = false; first = first || card.email; } else flag(card.email, 0);
      if (card.phone.value.replace(/\D/g, '').length < 6) { flag(card.phone, 1); ok = false; first = first || card.phone; } else flag(card.phone, 0);
      if (!card.agree.checked) { flag(card.agree, 1); ok = false; first = first || card.agree; } else flag(card.agree, 0);
      if (!dates().start || !dates().end) {
        els.datesText.innerHTML = '<span class="thb-enq-miss">Dates are required — tap to choose</span>';
        ok = false;
        if (!first) { els.datesRow.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
      if (first) first.focus();
      return ok;
    }
    function waSend(p) {
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(asText(p));
      var w = window.open(url, '_blank', 'noopener');
      if (!w) location.href = url;
    }

    card.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var p = payload();
      var btn = card.querySelector('.thb-enq-send');

      function done(viaWa) {
        card.classList.add('is-done');
        els.doneTitle.textContent = viaWa ? 'Request ready' : 'Request sent';
        els.doneText.textContent = viaWa
          ? 'We opened WhatsApp with your request — press send there and our team picks it up right away.'
          : 'Thanks, ' + (p.name.split(' ')[0] || 'friend') + '! We are checking the dates for ' + p.villa + ' and will come back to you shortly.';
      }

      window.__thbLeadSent = Date.now();   /* thb-bot.js: do not double count */
      if (!ENDPOINT) { waSend(p); done(true); return; }

      btn.disabled = true;
      card.classList.add('is-busy');
      els.sendLabel.textContent = 'Sending…';
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        done(false);
      }).catch(function () {
        waSend(p);
        done(true);
      }).then(function () {
        btn.disabled = false;
        card.classList.remove('is-busy');
        els.sendLabel.textContent = 'Send request';
      });
    });

    els.waInSheet.onclick = function () { waSend(payload()); };
    els.waAfter.onclick = function () { waSend(payload()); };
    els.x = wrap.querySelector('.thb-enq-x');
    els.x.onclick = close;
    scrim.addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !wrap.hidden) close();
    });
  }

  var pendingReopen = false;

  function paintDates() {
    if (!els.datesText) return;
    var d = dates();
    els.datesText.innerHTML = d.start && d.end
      ? fmt(d.start) + ' → ' + fmt(d.end) + ' <small>· ' + nights() + ' night' + (nights() > 1 ? 's' : '') + '</small>'
      : '<span class="thb-enq-miss">Tap to choose your dates</span>';
    /* the guest left the sheet only to pick dates — bring it back */
    if (pendingReopen && d.start && d.end) {
      pendingReopen = false;
      setTimeout(open, 420);
    }
  }

  var lastFocus = null, lockY = 0;
  function open() {
    if (!card) build();
    paintDates();
    lastFocus = document.activeElement;
    scrim.hidden = false;
    wrap.hidden = false;
    /* real iOS scroll lock: overflow:hidden alone is ignored by Safari, so the
       page behind the sheet crept downwards while typing */
    lockY = window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = -lockY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    var reveal = function () {
      scrim.classList.add('is-on');
      wrap.classList.add('is-on');
      var f = card.querySelector('input[name="name"]');
      if (f && window.innerWidth > 600 && document.activeElement !== f) f.focus();
    };
    /* both, so a throttled rAF can never leave the sheet invisible */
    requestAnimationFrame(reveal);
    setTimeout(reveal, 30);
  }
  function close() {
    if (!card) return;
    scrim.classList.remove('is-on');
    wrap.classList.remove('is-on');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, lockY);
    setTimeout(function () { scrim.hidden = true; wrap.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.thbOpenEnquiry = open;

  /* ---------- the two choices on the page ---------- */
  function waSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.4 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8S17.4 2.2 12 2.2zm5.5 12.2c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.6-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.2.5-.6.6-.8.2-.2.2-.4.3-.6.1-.2 0-.4 0-.5 0-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.1 3.3 5.2 4.5 3.1 1.2 3.1.8 3.7.8.6-.1 1.9-.8 2.1-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4z"/></svg>';
  }
  function quickWa() {
    var d = dates(), s = 'Hi The Host Bali! I\'d like to book ' + villaName() + '.';
    if (d.start && d.end) s += '\nCheck-in: ' + fmt(d.start) + '\nCheck-out: ' + fmt(d.end) + '\nNights: ' + nights();
    s += '\nLink: ' + villaUrl();
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(s);
    var w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
  }

  function mountPanel() {
    var panel = document.querySelector('#property-booking [data-slot="booking-panel"]');
    if (!panel || panel.querySelector('.thb-enq-cta')) return;

    /* retire the template's own submit block — it never did anything */
    var tpl = panel.querySelector('[data-testid="booking-submit-button"]');
    if (tpl) {
      var box = tpl;
      while (box.parentElement && box.parentElement !== panel && !box.parentElement.classList.contains('flex-col')) box = box.parentElement;
      var hide = box.parentElement && box.parentElement.classList.contains('flex-col') ? box : tpl;
      hide.style.display = 'none';
    }

    var cta = document.createElement('div');
    cta.className = 'thb-enq-cta';
    cta.innerHTML =
      '<button type="button" class="thb-enq-send">Request to book</button>' +
      '<div class="thb-enq-or">or</div>' +
      '<button type="button" class="thb-enq-wa">' + waSvg() + 'WhatsApp us now</button>' +
      '<p class="thb-enq-hint">No payment now — we confirm the dates first.</p>';
    (panel.querySelector('.flex.flex-col.gap-6') || panel).appendChild(cta);
    cta.querySelector('.thb-enq-send').onclick = open;
    cta.querySelector('.thb-enq-wa').onclick = quickWa;
  }

  function mountBar() {
    var bar = document.getElementById('thbBookBar');
    if (!bar || bar.querySelector('.thb-enq-bar')) return;
    var old = bar.querySelector('a[href*="wa.me"]');
    var group = document.createElement('div');
    group.className = 'thb-enq-bar';
    group.innerHTML = '<button type="button" class="thb-enq-send">BOOKING</button>';
    if (old) old.parentNode.replaceChild(group, old); else bar.appendChild(group);
    group.querySelector('.thb-enq-send').onclick = open;
  }

  /* WhatsApp button in the header, hard right next to the menu */
  function mountHeaderWa() {
    if (document.getElementById('thbHdrWa')) return;
    var row = document.querySelector('.site-header .col-span-full');
    var group = row && row.lastElementChild;
    if (!group) return;
    var d = dates(), text = "Hi The Host Bali! I'd like to book " + villaName() + '.';
    if (d.start && d.end) text += '\nCheck-in: ' + fmt(d.start) + '\nCheck-out: ' + fmt(d.end);
    text += '\nLink: ' + villaUrl();
    var a = document.createElement('a');
    a.id = 'thbHdrWa';
    a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
    a.rel = 'noopener';
    a.target = '_blank';
    a.setAttribute('aria-label', 'Chat with us on WhatsApp');
    a.innerHTML = waSvg();
    group.insertBefore(a, group.firstChild);
  }

  function mount() {
    if (!document.getElementById('section-availability')) return;   // villa pages only
    if (!document.getElementById('thb-enquiry-css')) build();
    mountPanel();
    mountBar();
    mountHeaderWa();
    var label = document.getElementById('selectedDateRange');
    if (label && window.MutationObserver) {
      new MutationObserver(paintDates).observe(label, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();

/* Календарь занятости из Hostfully — отдельным файлом thb-avail.js.
 * Грузим только там, где на странице есть сам календарь, то есть на
 * страницах вилл. На остальных условие просто не срабатывает.
 */
(function () {
  function load() {
    if (!document.getElementById('section-availability')) return;
    var s = document.createElement('script');
    s.src = '/thb-avail.js';
    s.defer = true;
    document.head.appendChild(s);
  }
  /* тем же способом, что и mount() выше: разметки может ещё не быть */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
