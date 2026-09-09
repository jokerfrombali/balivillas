/* Вкладка «Hostex» в панели.
 *
 * Показывает связки: слева объект в Hostex, справа вилла на сайте, между ними
 * проводок. Зелёный — календарь свежий, жёлтый — давно не обновлялся, красный
 * — API не отвечает, серый — объект ещё не назначен.
 *
 * Под названием объекта стоит канал, с которого снята цена: в Hostex ставка
 * висит на листинге канала, и базовым считается тот, у которого коэффициент
 * 100 (см. worker/hostex.js). Цену двигает PriceLabs, поэтому цифра в панели —
 * минимум по свободным ночам ближайших 90 дней, а не что-то заданное руками.
 *
 * Живёт отдельным файлом, чтобы не трогать разметку index.html: сам вешает
 * кнопку в меню, сам создаёт секцию и сам следит за переключением вкладок.
 * Данные берёт из /api/admin/hostex — то есть только после входа.
 */
(function () {
  'use strict';

  var TAB = 'hf';
  var DATA = null;
  var busy = false;

  /* ---------- стили ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.hfhead{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:16px}',
    '.hfsum{font:700 19px/1.2 Georgia,serif}',
    '.hfwhen{font-size:12.5px;color:var(--muted)}',
    '.hflist{display:grid;gap:10px}',
    '.hfrow{display:grid;grid-template-columns:1fr 132px 1fr;gap:10px;align-items:center;',
    '  background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:12px 16px}',
    '.hfside{min-width:0}',
    '.hfside b{display:block;font-size:14px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hfside .small{margin-top:2px}',
    '.hfside.right{text-align:right}',
    '.hfwire{position:relative;height:26px}',
    '.hfwire i{position:absolute;left:0;right:0;top:12px;height:2px;border-radius:2px;background:var(--line)}',
    '.hfwire b{position:absolute;top:7px;left:50%;margin-left:-6px;width:12px;height:12px;border-radius:50%;',
    '  background:var(--line);border:2px solid var(--panel);box-shadow:0 0 0 1px var(--line)}',
    '.hfwire.live i{background:#2f7d4f}',
    '.hfwire.live b{background:#2f7d4f;box-shadow:0 0 0 1px #2f7d4f;animation:hfpulse 2.4s ease-in-out infinite}',
    '.hfwire.stale i{background:#a8761c}  .hfwire.stale b{background:#a8761c;box-shadow:0 0 0 1px #a8761c}',
    '.hfwire.down i{background:#b84a31}   .hfwire.down b{background:#b84a31;box-shadow:0 0 0 1px #b84a31}',
    '.hfwire.wait i{background:#a8761c;opacity:.5} .hfwire.wait b{background:#a8761c;opacity:.6;box-shadow:none}',
    '.hfwire.off i{background:var(--line);border-top:0}',
    '.hfwire.off b{background:var(--soft);box-shadow:0 0 0 1px var(--line)}',
    '@keyframes hfpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.75}}',
    '@media (prefers-reduced-motion:reduce){.hfwire.live b{animation:none}}',
    '.hfstate{display:block;text-align:center;font-size:11px;font-weight:800;letter-spacing:.06em;',
    '  text-transform:uppercase;margin-top:3px}',
    '.hfstate.live{color:#2f7d4f} .hfstate.stale,.hfstate.wait{color:#a8761c}',
    '.hfstate.down{color:#b84a31} .hfstate.off{color:var(--muted)}',
    '.hfrow.off{background:transparent;border-style:dashed}',
    '.hfside b.hfnone{color:var(--muted);font-weight:500;font-style:italic}',
    '.hfchips{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}',
    '.hfchip{background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:12.5px}',
    '@media(max-width:720px){.hfrow{grid-template-columns:1fr;gap:6px}',
    '  .hfside.right{text-align:left}.hfwire{height:20px}',
    '  .hfwire i{left:6px;right:auto;top:0;bottom:0;width:2px;height:auto}',
    '  .hfwire b{left:1px;top:4px;margin:0}.hfstate{text-align:left;margin-left:22px}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- каркас ---------- */
  var nav = document.getElementById('nav');
  var btn = document.createElement('button');
  btn.dataset.t = TAB;
  btn.textContent = 'Hostex';
  nav.appendChild(btn);

  var sec = document.createElement('section');
  sec.id = 'vHf';
  sec.hidden = true;
  sec.innerHTML =
    '<div class="hfhead">' +
      '<span class="hfsum" id="hfSum">Связки с Hostex</span>' +
      '<span class="hfwhen" id="hfWhen"></span>' +
      '<span style="margin-left:auto"><button class="btn primary" id="hfNow">Проверить сейчас</button></span>' +
    '</div>' +
    '<div id="hfBody"><p class="loading">Смотрю связки…</p></div>';
  document.querySelector('.wrap').appendChild(sec);

  var OTHERS = ['vDash', 'vLeads', 'vSeo', 'vTools'];

  /* Штатный обработчик в index.html прячет только свои четыре секции и не знает
     про нашу. Дослушиваем то же событие и приводим экран в порядок сами. */
  nav.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-t]');
    if (!b) return;
    var mine = b.dataset.t === TAB;
    sec.hidden = !mine;
    if (mine) {
      OTHERS.forEach(function (id) { var el = document.getElementById(id); if (el) el.hidden = true; });
      b.classList.add('on');
      if (!DATA) load();
    }
  });

  /* ---------- данные ---------- */
  function api(path, post) {
    var opt = { headers: { 'content-type': 'application/json' }, cache: 'no-store' };
    if (post) opt.method = 'POST';
    return fetch('/api/admin/' + path, opt).then(function (r) {
      if (r.status === 401 || r.status === 503) { location.reload(); throw new Error('auth'); }
      return r.json();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function ago(ts) {
    if (!ts) return 'ещё не проверялось';
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин назад';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' ч назад';
    return Math.round(h / 24) + ' дн назад';
  }

  /* «1 бронь», «2 брони», «13 броней» — иначе панель выглядит машинной. */
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return n + ' ' + many;
    if (b > 1 && b < 5) return n + ' ' + few;
    if (b === 1) return n + ' ' + one;
    return n + ' ' + many;
  }

  function inFuture(ts) {
    var m = Math.round((ts - Date.now()) / 60000);
    if (m <= 0) return 'вот-вот';
    if (m < 60) return 'через ' + m + ' мин';
    return 'через ' + Math.round(m / 60) + ' ч';
  }

  var LABEL = {
    live: 'работает', stale: 'давно не обновлялось',
    down: 'нет связи', wait: 'ждёт первой проверки', off: 'не назначено'
  };

  /* Имена вилл берём из того же файла, что и сайт, чтобы в панели стояло
     человеческое название, а не служебный id. */
  var NAMES = null;
  function villaNames() {
    if (NAMES) return Promise.resolve(NAMES);
    return fetch('/data/villas.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        NAMES = {};
        (list || []).forEach(function (v) { NAMES[v.id] = v.name || v.id; });
        return NAMES;
      })
      .catch(function () { NAMES = {}; return NAMES; });
  }

  function render() {
    var d = DATA;
    if (!d) return;

    document.getElementById('hfSum').textContent =
      'Связки с Hostex — ' + d.live + ' из ' + d.total + ' в работе' +
      (d.priced ? ', с ценой ' + d.priced : '');
    document.getElementById('hfWhen').textContent =
      'проверка каждые ' + d.everyMin + ' мин · последняя ' +
      ago(d.lastRunTs) + (d.lastRunTs ? ' · следующая ' + inFuture(d.nextRunTs) : '') +
      (d.lastError ? ' · ошибка: ' + d.lastError : '');

    villaNames().then(function (names) {
      var rows = d.links.map(function (l) {
        var name = names[l.villa] || l.villa;
        var right = l.state === 'off'
          ? '<span class="small">объект в Hostex не назначен</span>'
          : '<span class="small">' +
            plural(l.busyNights90, 'занятая ночь', 'занятые ночи', 'занятых ночей') +
            ' за 90 дней' +
            (l.price ? ' · от ' + l.currency + ' ' +
                       String(l.price).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '') +
            '</span>';

        var left = l.linked
          ? '<b>' + esc(l.hx) + '</b>' + (l.state === 'down' && l.error
              ? '<span class="small" style="color:var(--bad)">' + esc(l.error) + '</span>'
              : '<span class="small">проверено ' + ago(l.checkedAt) +
                (l.channel ? ' · цена с ' + esc(l.channel) : '') + '</span>')
          : '<b class="hfnone">объект не выбран</b>' +
            '<span class="small">назначается в worker/hostex.js</span>';

        return '<div class="hfrow ' + (l.state === 'off' ? 'off' : '') + '">' +
            '<div class="hfside">' + left + '</div>' +
            '<div><div class="hfwire ' + l.state + '"><i></i><b></b></div>' +
              '<span class="hfstate ' + l.state + '">' + LABEL[l.state] + '</span></div>' +
            '<div class="hfside right"><b>' + esc(name) + '</b>' + right + '</div>' +
          '</div>';
      }).join('');

      document.getElementById('hfBody').innerHTML = '<div class="hflist">' + rows + '</div>';
    });
  }

  function load() {
    return api('hostex').then(function (r) {
      if (!r || !r.ok) throw new Error('bad');
      DATA = r.data;
      render();
    }).catch(function () {
      document.getElementById('hfBody').innerHTML =
        '<p class="loading">Не удалось получить состояние связок.</p>';
    });
  }

  document.getElementById('hfNow').addEventListener('click', function () {
    if (busy) return;
    busy = true;
    var b = this;
    b.disabled = true;
    b.textContent = 'Проверяю…';
    api('hostex/sync', true).then(function (r) {
      if (r && r.ok) { DATA = r.data; render(); }
    }).catch(function () {}).then(function () {
      busy = false;
      b.disabled = false;
      b.textContent = 'Проверить сейчас';
    });
  });

  /* Вкладка могла быть открытой в прошлый раз — index.html её не восстановит,
     потому что не знает такого имени. Восстанавливаем сами, после входа. */
  function restore() {
    try { if (localStorage.getItem('thb_admin_tab') === TAB) btn.click(); } catch (e) {}
  }
  if (document.body.classList.contains('locked')) {
    new MutationObserver(function (m, obs) {
      if (!document.body.classList.contains('locked')) { obs.disconnect(); restore(); }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } else {
    restore();
  }
})();
