/* thb-filters.js — the Filters drawer on the rental / district pages.

   The markup for the drawer shipped long ago, but the functions its buttons call
   (openFilters, closeFilters, clearAllFilters, toggleFilter, setPill, setPrice)
   were never defined — every click threw a ReferenceError and nothing happened.
   This file implements them and filters the card grid from the data already on
   the cards: data-type, data-beds, data-location, data-amenities.
*/
(function () {
  'use strict';

  var drawer = document.getElementById('filterDrawer');
  var panel = document.getElementById('filterPanel');

  function cards() {
    return [].slice.call(document.querySelectorAll('#cardGrid .prop-card'));
  }
  function inputs(name) {
    if (!panel) return [];
    return [].slice.call(panel.querySelectorAll('input[data-filter="' + name + '"]'));
  }
  function checkedOne(name, fallback) {
    var on = inputs(name).filter(function (i) { return i.checked; });
    return on.length ? on[on.length - 1].value : fallback;
  }
  function checkedMany(name) {
    return inputs(name).filter(function (i) { return i.checked; })
      .map(function (i) { return i.value; });
  }
  function quickPills() {
    /* the row ships an "All" pill pre-activated — it is a reset, not an amenity */
    return [].slice.call(document.querySelectorAll('.pill.active[data-amenity]'))
      .map(function (p) { return p.getAttribute('data-amenity'); })
      .filter(function (v) { return v && v !== 'all' && v !== 'any'; });
  }

  function state() {
    var am = checkedMany('amenity').concat(quickPills());
    return {
      type: checkedOne('type', 'all'),
      beds: checkedOne('beds', 'any'),
      loc: checkedMany('location'),
      am: am.filter(function (v, i) { return v && am.indexOf(v) === i; })
    };
  }

  function fits(card, s) {
    if (s.type && s.type !== 'all') {
      if ((card.getAttribute('data-type') || '').indexOf(s.type) < 0) return false;
    }
    if (s.beds && s.beds !== 'any') {
      var b = parseInt(card.getAttribute('data-beds') || '0', 10) || 0;
      if (s.beds === '5' ? b < 5 : b !== parseInt(s.beds, 10)) return false;
    }
    if (s.loc.length && s.loc.indexOf(card.getAttribute('data-location')) < 0) return false;
    if (s.am.length) {
      var have = (card.getAttribute('data-amenities') || '').split(/\s+/);
      for (var i = 0; i < s.am.length; i++) {
        if (have.indexOf(s.am[i]) < 0) return false;
      }
    }
    return true;
  }

  function activeCount(s) {
    return (s.type && s.type !== 'all' ? 1 : 0) +
           (s.beds && s.beds !== 'any' ? 1 : 0) +
           s.loc.length + s.am.length;
  }

  function word(n) { return n === 1 ? ' villa' : ' villas'; }

  /* keep the single-choice groups single, and mirror state onto the chips */
  function syncChips(changed) {
    ['type', 'beds', 'period'].forEach(function (group) {
      var list = inputs(group);
      if (changed && changed.getAttribute('data-filter') === group && changed.checked) {
        list.forEach(function (i) { if (i !== changed) i.checked = false; });
      }
      if (!list.some(function (i) { return i.checked; }) && list.length) {
        list[0].checked = true;               // fall back to "All" / "Any"
      }
    });
    if (!panel) return;
    [].forEach.call(panel.querySelectorAll('.f-chip'), function (chip) {
      var i = chip.querySelector('input');
      if (i) chip.classList.toggle('active', i.checked);
    });
  }

  function apply() {
    var s = state(), n = 0, total = 0;
    cards().forEach(function (c) {
      total++;
      var ok = fits(c, s);
      c.style.display = ok ? '' : 'none';
      if (ok) n++;
    });

    var title = document.getElementById('resultsTitle');
    if (title) {
      title.textContent = activeCount(s)
        ? n + word(n) + ' found'
        : total + word(total) + ' available';
    }

    var badge = document.getElementById('filterCountBadge');
    if (badge) {
      var c = activeCount(s);
      badge.textContent = c;
      badge.style.display = c ? 'inline-flex' : 'none';
    }

    var cta = panel && panel.querySelector('.btn-primary');
    if (cta) cta.textContent = 'Show ' + n + word(n);

    var empty = document.getElementById('thbNoMatch');
    if (empty) empty.hidden = n > 0;
    return n;
  }

  /* ---------- the functions the markup calls ---------- */
  window.openFilters = function () {
    if (!drawer) return;
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    syncChips(null);
    apply();
  };
  window.closeFilters = function () {
    if (!drawer) return;
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.toggleFilter = function (el) {
    var body = el.parentElement && el.parentElement.querySelector('.filter-body');
    if (!body) return;
    var collapsed = el.classList.toggle('collapsed');
    body.style.maxHeight = collapsed ? '0px' : '';
  };
  window.clearAllFilters = function () {
    if (panel) {
      [].forEach.call(panel.querySelectorAll('input[type="checkbox"]'), function (i) { i.checked = false; });
      var min = document.getElementById('priceMin'), max = document.getElementById('priceMax');
      if (min) min.value = '';
      if (max) max.value = '';
    }
    [].forEach.call(document.querySelectorAll('.pill.active[data-amenity]'), function (p) {
      p.classList.remove('active');
    });
    syncChips(null);
    apply();
  };
  window.setPill = function (el) {
    if (!el) return;
    var v = el.getAttribute('data-amenity');
    var all = [].slice.call(document.querySelectorAll('.pill[data-amenity]'));
    if (v === 'all' || v === 'any') {
      all.forEach(function (p) { p.classList.toggle('active', p === el); });
    } else {
      el.classList.toggle('active');
      all.forEach(function (p) {
        var pv = p.getAttribute('data-amenity');
        if (pv === 'all' || pv === 'any') p.classList.remove('active');
      });
      if (!quickPills().length) {
        all.forEach(function (p) {
          var pv = p.getAttribute('data-amenity');
          if (pv === 'all' || pv === 'any') p.classList.add('active');
        });
      }
    }
    apply();
  };
  window.setPrice = function (from, to) {
    var min = document.getElementById('priceMin'), max = document.getElementById('priceMax');
    if (min) min.value = from;
    if (max) max.value = to;
  };

  /* live updates while the drawer is open */
  if (panel) {
    panel.addEventListener('change', function (e) {
      var i = e.target;
      if (!i || i.tagName !== 'INPUT') return;
      syncChips(i);
      apply();
    });
  }
  if (drawer) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) window.closeFilters();
    });
  }

  syncChips(null);
})();
