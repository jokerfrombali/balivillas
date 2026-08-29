/* Цена на карточках вилл — главная, каталог, подборки по районам.
 *
 * Сейчас на каждой карточке стоит «On request»: гость видит подборку и не
 * понимает, сколько это стоит, а значит уходит сравнивать на Airbnb. Ставим
 * туда ту же цену «от», что и на странице виллы, — из Hostfully, одним
 * запросом на всю страницу (/api/prices, зеркало в KV).
 *
 * Виллы, у которой в Hostfully нет объекта, в ответе не будет — её карточка
 * останется с «On request». Придумывать цену, чтобы карточка выглядела
 * заполненной, нельзя: по ней гость принимает решение.
 *
 * Карточек на сайте две породы:
 *   .thb-acard  — ссылка, адрес виллы в href, цена текстом в <p class="p">;
 *   .prop-card  — div с onclick="window.location='/villa/...'", цена в span.
 * Обе находим по самому тексту «On request», а не по вёрстке: она разная.
 */
(function () {
  'use strict';

  if (document.documentElement.dataset.thbCards) return;
  document.documentElement.dataset.thbCards = '1';

  var st = document.createElement('style');
  st.textContent =
    '.thb-card-per{font-size:13px;font-weight:400;color:#706b61;margin-left:5px;' +
      'letter-spacing:0;font-family:inherit}';
  document.head.appendChild(st);

  var SEL = '.thb-acard, .prop-card';

  waitFor(function () { return !!document.querySelector(SEL); }, run, 12000);

  function waitFor(ready, go, limitMs) {
    if (ready()) { go(); return; }
    var obs = new MutationObserver(function () {
      if (!ready()) return;
      obs.disconnect();
      go();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, limitMs);
  }

  /* Адрес виллы: у ссылки в href, у div — внутри onclick. */
  function pathOf(card) {
    var href = card.getAttribute && card.getAttribute('href');
    if (href && href.indexOf('/villa/') === 0) return href;
    var oc = String(card.getAttribute('onclick') || '');
    var m = oc.match(/\/villa\/[^'"]+/);
    return m ? m[0] : null;
  }

  function slugOf(card) {
    var p = pathOf(card);
    return p ? p.replace(/\/+$/, '').slice(7) : null;   /* без '/villa/' */
  }

  /* Текстовый узел со словами «On request» — он и есть место под цену. */
  function priceText(card) {
    var walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walk.nextNode())) {
      if (/^\s*on request\s*$/i.test(n.nodeValue || '')) return n;
    }
    return null;
  }

  function money(v, cur) {
    var s = String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (cur ? cur + ' ' : '') + s;
  }

  function run() {
    Promise.all([
      fetch('/data/villas.json', { cache: 'force-cache' }).then(function (r) { return r.json(); }),
      fetch('/api/prices').then(function (r) { return r.ok ? r.json() : null; })
    ]).then(function (res) {
      var list = res[0] || [];
      var data = res[1];
      if (!data || !data.ok || !data.prices) return;

      var bySlug = {};
      list.forEach(function (v) { if (v.slug) bySlug[v.slug] = v.id; });

      var cards = document.querySelectorAll(SEL);
      for (var i = 0; i < cards.length; i++) {
        var slug = slugOf(cards[i]);
        var id = slug ? bySlug[slug] : null;
        var p = id ? data.prices[id] : null;
        if (!p || !p.price) continue;            /* нет цены — «On request» */

        var node = priceText(cards[i]);
        if (!node) continue;

        node.nodeValue = money(p.price, p.currency);
        var per = document.createElement('span');
        per.className = 'thb-card-per';
        per.textContent = 'night';
        if (node.parentNode) node.parentNode.insertBefore(per, node.nextSibling);
      }
    }).catch(function () { /* нет данных — карточки остаются как были */ });
  }
})();
