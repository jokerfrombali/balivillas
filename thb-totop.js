/* thb-totop.js — floating "back to top" circle.
   Same look as the villa back button; appears once the page is scrolled down,
   and lifts itself above the WhatsApp pill / mobile booking bar when they are on screen. */
(function () {
  if (window.__thbToTop) return;
  window.__thbToTop = 1;

  function init() {
    if (document.getElementById('thbToTop')) return;

    var css = document.createElement('style');
    css.id = 'thb-totop-css';
    css.textContent =
      '#thbToTop{position:fixed;right:20px;bottom:24px;z-index:58;display:inline-flex;align-items:center;justify-content:center;' +
      'width:44px;height:44px;padding:0;box-sizing:border-box;background:rgba(255,255,255,.94);border:1px solid #e6e3dc;' +
      'border-radius:999px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 4px 14px rgba(0,0,0,.10);' +
      'color:#0a0a0a;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;' +
      'opacity:0;visibility:hidden;transform:translateY(10px);' +
      'transition:opacity .22s ease,transform .26s cubic-bezier(.22,.61,.36,1),visibility .22s,border-color .16s,box-shadow .16s,bottom .26s cubic-bezier(.22,.61,.36,1)}' +
      '#thbToTop.is-on{opacity:1;visibility:visible;transform:none}' +
      '#thbToTop:hover{border-color:#0a0a0a;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.14)}' +
      '#thbToTop svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}' +
      '@media(max-width:768px){#thbToTop{right:14px;width:42px;height:42px}}' +
      'body.thb-menu-open #thbToTop{display:none!important}' +
      '@media print{#thbToTop{display:none}}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'thbToTop';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    });

    /* keep clear of anything docked at the bottom right (WhatsApp pill, booking bar) */
    function place() {
      var lift = 0;
      ['thbWaPill', 'thbBookBar'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        var r = el.getBoundingClientRect();
        if (!r.height || r.right < window.innerWidth - 76) return;
        lift = Math.max(lift, window.innerHeight - r.top + 10);
      });
      btn.style.bottom = 'calc(' + (24 + lift) + 'px + env(safe-area-inset-bottom))';
    }

    var ticking = false;
    function apply() {
      ticking = false;
      place();
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var doc = document.documentElement;
      var max = Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight;
      /* shows up once the page is more than half scrolled */
      btn.classList.toggle('is-on', max > 200 && y > max * 0.5);
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
