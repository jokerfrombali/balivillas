/* Заявка по объекту на продажу.
 *
 * Форма стоит в карточке справа, рядом с ценой — как на страницах агентств,
 * где покупатель не ищет кнопку, а пишет прямо оттуда, где смотрит цену.
 *
 * Уходит в тот же POST /api/lead, что и заявка на аренду: одна труба, один
 * Telegram-тред, один сквозной номер. Отличает их поле source — в чате видно
 * «Продажа», а не «Форма на сайте».
 *
 * Карта, фототур и «Read more» на этой странице работают теми же скриптами,
 * что и на странице виллы: вёрстка одна.
 */
(function () {
  'use strict';

  var form = document.getElementById('saleEnquiry');
  if (!form) return;

  var note = document.getElementById('saleEnquiryNote');
  var btn = form.querySelector('button[type="submit"]');
  var sending = false;

  function say(text, bad) {
    if (!note) return;
    note.textContent = text;
    note.style.color = bad ? '#b84a31' : '#2f7d4f';
  }

  /* Название и цена берём со страницы, а не из отдельного файла: что видит
     гость, то и уходит менеджеру. */
  function subject() {
    var h1 = document.querySelector('h1');
    var price = document.querySelector('[data-sale-price]');
    return {
      villa: h1 ? h1.textContent.trim() : document.title,
      price: price ? price.textContent.trim() : ''
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;

    var name = (form.name && form.name.value || '').trim();
    var contact = (form.contact && form.contact.value || '').trim();
    var text = (form.note && form.note.value || '').trim();

    if (!name || !contact) {
      say('Please leave a name and a way to reach you.', true);
      return;
    }

    sending = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    say('');

    var s = subject();
    var body = {
      source: 'sale',
      villa: s.villa,
      name: name,
      note: (text ? text + ' — ' : '') + 'Asking price on the page: ' + s.price,
      page: location.pathname
    };
    /* Одно поле на почту и телефон: гость сам решает, как ему удобнее. */
    if (contact.indexOf('@') > 0) body.email = contact; else body.phone = contact;

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) throw new Error('bad');
      form.reset();
      say('Thank you — we will come back to you today with the details.');
    }).catch(function () {
      say('Could not send it. Please write to us on WhatsApp.', true);
    }).then(function () {
      sending = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Request details'; }
    });
  });
})();
