/* BaliVillas — русские подписи для виджетов.
 *
 * Страницы под /ru/ переведены целиком в HTML, но календарь, цены, форма
 * заявки, карта, валюта и куки-плашка рисуются скриптами по-английски.
 * Этот файл подключается воркером только на /ru/ и переводит текст, который
 * скрипты вставляют в DOM: точные строки — по словарю, составные («Minimum
 * stay: 3 nights») — по шаблонам. Сами виджеты не трогаем. */
(function () {
  'use strict';
  if (window.__thbRu) return;
  window.__thbRu = true;

  /* 1 ночь, 2 ночи, 5 ночей */
  function pl(n, one, few, many) {
    n = +n; var a = n % 10, b = n % 100;
    return (a === 1 && b !== 11) ? one : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? few : many;
  }
  function nights(n) { return n + ' ' + pl(n, 'ночь', 'ночи', 'ночей'); }
  function guests(n) { return n + ' ' + pl(n, 'гость', 'гостя', 'гостей'); }
  function villas(n) { return n + ' ' + pl(n, 'вилла', 'виллы', 'вилл'); }
  function listings(n) { return n + ' ' + pl(n, 'объект', 'объекта', 'объектов'); }
  /* «до N гостей»: после «до» родительный падеж — 1 гостя, 2 гостей */
  function upTo(n) { return n + ' ' + pl(n, 'гостя', 'гостей', 'гостей'); }

  var X = {
    'per night': 'за ночь', 'total': 'итого', 'Total': 'Итого', 'night': 'ночь', 'nights': 'ночей',
    'Cleaning fee': 'Уборка', 'Taxes': 'Налоги', 'Guests': 'Гости',
    'On request': 'По запросу', 'Prices on request': 'Цены по запросу',
    'Select dates for pricing': 'Выберите даты, чтобы увидеть цену', 'Select dates': 'Выберите даты',
    'Select check-out date': 'Выберите дату выезда', 'Select check-in date': 'Выберите дату заезда',
    'Clear dates': 'Сбросить даты', 'Add date': 'Добавить дату',
    'Crossed-out dates are already booked': 'Зачёркнутые даты уже заняты',
    'Those dates include nights that are already booked. Please pick a range without them.':
      'В эти даты есть уже занятые ночи. Выберите период без них.',
    'January': 'Январь', 'February': 'Февраль', 'March': 'Март', 'April': 'Апрель', 'May': 'Май',
    'June': 'Июнь', 'July': 'Июль', 'August': 'Август', 'September': 'Сентябрь',
    'October': 'Октябрь', 'November': 'Ноябрь', 'December': 'Декабрь',
    'Mo': 'Пн', 'Tu': 'Вт', 'We': 'Ср', 'Th': 'Чт', 'Fr': 'Пт', 'Sa': 'Сб', 'Su': 'Вс',
    'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб', 'Sun': 'Вс',
    /* форма заявки */
    'Request this villa': 'Запросить эту виллу', 'Booking request': 'Запрос на бронирование',
    'Your check-in & check-out': 'Заезд и выезд', 'Adults': 'Взрослые', '13 years or older': '13 лет и старше',
    'Children': 'Дети', '12 and under': '12 лет и младше', 'Full name': 'Имя и фамилия',
    'Please tell us your name': 'Укажите ваше имя', 'Email': 'Email', 'Check the email address': 'Проверьте адрес email',
    'Add a number we can reach you on': 'Добавьте номер, по которому с вами можно связаться',
    'Anything we should know? (optional)': 'Что нам стоит знать? (необязательно)',
    'Airport pickup, early check-in, long stay…': 'Трансфер из аэропорта, ранний заезд, долгое проживание…',
    'I agree with the': 'Я согласен с', 'terms of use': 'условиями использования',
    'and to being contacted about this request.': 'и на связь со мной по этому запросу.',
    'Send request': 'Отправить запрос', 'or': 'или', 'Chat on WhatsApp instead': 'Написать в WhatsApp',
    'We reply within ~15 minutes, 8:00–22:00 WITA.': 'Отвечаем в течение ~15 минут, 8:00–22:00 по Бали (WITA).',
    'Request sent': 'Запрос отправлен', 'Request ready': 'Запрос готов', 'Continue on WhatsApp': 'Продолжить в WhatsApp',
    'Sending…': 'Отправляем…', 'Request to book': 'Запросить бронирование', 'WhatsApp us now': 'Написать в WhatsApp',
    'No payment now — we confirm the dates first.': 'Сейчас платить не нужно — сначала подтвердим даты.',
    'BOOKING': 'БРОНЬ', 'Chat with us on WhatsApp': 'Написать нам в WhatsApp', 'Close': 'Закрыть',
    'Fewer adults': 'Меньше взрослых', 'More adults': 'Больше взрослых', 'Fewer children': 'Меньше детей', 'More children': 'Больше детей',
    'Dates are required — tap to choose': 'Нужны даты — нажмите, чтобы выбрать',
    'Tap to choose your dates': 'Нажмите, чтобы выбрать даты',
    'Bringing a bigger group? Tell us in the note.': 'Вас больше? Напишите об этом в комментарии.',
    'We opened WhatsApp with your request — press send there and our team picks it up right away.':
      'Мы открыли WhatsApp с вашим запросом — нажмите «отправить», и команда сразу возьмёт его в работу.',
    /* форма по продаже */
    'Request details': 'Запросить подробности',
    'Please leave a name and a way to reach you.': 'Оставьте имя и способ связи.',
    'Thank you — we will come back to you today with the details.': 'Спасибо — сегодня же вернёмся к вам с подробностями.',
    'Could not send it. Please write to us on WhatsApp.': 'Не удалось отправить. Напишите нам в WhatsApp.',
    /* карты */
    'See where they are': 'Посмотреть на карте', 'See where the villas are': 'Где находятся виллы',
    'All our listings on one map': 'Все наши объекты на одной карте', 'All our villas on one map': 'Все наши виллы на одной карте',
    'Show map': 'Показать карту', 'Hide map': 'Скрыть карту', 'View this villa': 'Смотреть виллу',
    'Price on request': 'Цена по запросу', 'Locations are approximate': 'Расположение примерное',
    'Villas are shown as an area, not an exact address': 'Виллы показаны районом, а не точным адресом',
    'Full screen': 'Во весь экран', 'zoom in': 'приблизить', 'zoom out': 'отдалить',
    /* избранное, валюта, куки, прочее */
    'Save this villa': 'Сохранить виллу', 'Remove from saved': 'Убрать из сохранённых', 'Saved villas': 'Сохранённые виллы', 'View': 'Смотреть',
    'Change currency': 'Сменить валюту', 'Currency': 'Валюта',
    'Indicative rates. Villas are priced and paid in rupiah.': 'Курсы ориентировочные. Цены на виллы устанавливаются и оплачиваются в рупиях.',
    'Indonesian rupiah': 'Индонезийская рупия', 'US dollar': 'Доллар США', 'Euro': 'Евро', 'Australian dollar': 'Австралийский доллар',
    'British pound': 'Британский фунт', 'Singapore dollar': 'Сингапурский доллар', 'Malaysian ringgit': 'Малайзийский ринггит',
    'Indian rupee': 'Индийская рупия', 'Chinese yuan': 'Китайский юань', 'Japanese yen': 'Японская иена', 'Korean won': 'Корейская вона',
    'Russian ruble': 'Российский рубль', 'Thai baht': 'Тайский бат', 'Taiwan dollar': 'Тайваньский доллар', 'New Zealand dollar': 'Новозеландский доллар',
    'Cookies': 'Cookies', 'Decline': 'Отказаться', 'Accept': 'Принять', 'Privacy notice': 'Политика конфиденциальности',
    'We use Google Analytics to see which villas and buttons people actually use.':
      'Мы используем Google Analytics, чтобы видеть, какими виллами и кнопками действительно пользуются.',
    'We use Google Analytics to see which villas and buttons people actually use. Nothing is sold or used for ads.':
      'Мы используем Google Analytics, чтобы видеть, какими виллами и кнопками действительно пользуются. Данные не продаются и не используются для рекламы.',
    'Nothing is sold or used for ads.': 'Данные не продаются и не используются для рекламы.',
    'Read more': 'Читать дальше', 'Read less': 'Свернуть', 'back to top': 'наверх',
    'All': 'Все', 'Any': 'Любые', 'found': 'найдено', 'available': 'свободно', 'for': 'за'
  };

  var MON = { January: 'Январь', February: 'Февраль', March: 'Март', April: 'Апрель', May: 'Май', June: 'Июнь',
    July: 'Июль', August: 'Август', September: 'Сентябрь', October: 'Октябрь', November: 'Ноябрь', December: 'Декабрь' };
  var P = [
    [/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/,
      function (m, mo, y) { return MON[mo] + ' ' + y; }],
    [/^([A-Za-z]{3}) (\d{1,2}), (\d{4}) ~ ([A-Za-z]{3}) (\d{1,2}), (\d{4})$/, '$2 $1 $3 ~ $5 $4 $6'],
    [/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/, '$2 $1 $3'],
    /* поля «Заезд/Выезд» формы: «Oct 5» -> «5 окт» */
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/, '$2 $1'],
    [/^from (.+?) per night$/, 'от $1 за ночь'],
    [/^(.+?) per night$/, '$1 за ночь'],
    [/^(.+?) total$/, '$1 итого'],
    [/^Minimum stay: (\d+) nights?$/, function (m, n) { return 'Минимальный срок: ' + nights(n); }],
    [/^Minimum stay for these dates is (\d+) nights?\.$/, function (m, n) { return 'Минимальный срок на эти даты — ' + nights(n) + '.'; }],
    [/^(.+?) · minimum stay (\d+) nights$/, function (m, a, n) { return a + ' · минимум ' + nights(n); }],
    [/^(.+?) × (\d+) nights?$/, function (m, a, n) { return a + ' × ' + nights(n); }],
    [/^(\d+) nights? · (.+)$/, function (m, n, a) { return nights(n) + ' · ' + a; }],
    [/^for (\d+) nights?$/, function (m, n) { return 'за ' + nights(n); }],
    [/^(\d+) nights?$/, function (m, n) { return nights(n); }],
    [/^Maximum (\d+) guests?$/, function (m, n) { return 'Максимум ' + guests(n); }],
    [/^(\d+) guests?$/, function (m, n) { return guests(n); }],
    [/^Saved — (\d+) villas?$/, function (m, n) { return 'Сохранено: ' + villas(n); }],
    [/^Saved villas \((\d+)\)$/, 'Сохранённые виллы ($1)'],
    [/^Show (\d+) villas?$/, function (m, n) { return 'Показать ' + villas(n); }],
    [/^(\d+) villas? here · shown as an area, not a doorstep$/, function (m, n) { return villas(n) + ' здесь · показано районом, а не адресом'; }],
    [/^(\d+) villas? · shown as an area, not a doorstep$/, function (m, n) { return villas(n) + ' · показано районом, а не адресом'; }],
    [/^(\d+) villas? here · streets shown as an area, not a doorstep$/, function (m, n) { return villas(n) + ' здесь · улицы показаны районом, а не адресом'; }],
    [/^(\d+) listings? · streets shown as an area, not a doorstep$/, function (m, n) { return listings(n) + ' · улицы показаны районом, а не адресом'; }],
    [/^(\d+) villas? here$/, function (m, n) { return villas(n) + ' здесь'; }],
    [/^(\d+) villas?$/, function (m, n) { return villas(n); }],
    [/^(\d+) listings?$/, function (m, n) { return listings(n); }],
    [/^· streets shown as an area, not a doorstep$/, '· улицы показаны районом, а не адресом'],
    [/^· shown as an area, not a doorstep$/, '· показано районом, а не адресом'],
    [/^(\d+) yrs lease$/, 'лизхолд $1 лет'],
    [/^lease to (\d+)$/, 'лизхолд до $1'],
    [/^This villa takes up to (\d+) guests\. Bringing more\? Tell us in the note\.$/,
      function (m, n) { return 'Вилла вмещает до ' + upTo(n) + '. Вас больше? Напишите в комментарии.'; }],
    [/^Thanks, (.+?)! We are checking the dates for (.+?) and will come back to you shortly\.$/, 'Спасибо, $1! Проверяем даты для $2 и скоро вернёмся к вам.'],
    [/^Booking request — (.+)$/, 'Запрос на бронирование — $1']
  ];

  /* Названия месяцев и дней в датах вида «3 Oct – 6 Oct», «Sat, 3 Oct 2026»:
     меняем только рядом с числом, чтобы не задеть имена вилл. */
  var MS = { Jan: 'янв', Feb: 'фев', Mar: 'мар', Apr: 'апр', May: 'мая', Jun: 'июн',
             Jul: 'июл', Aug: 'авг', Sep: 'сен', Oct: 'окт', Nov: 'ноя', Dec: 'дек' };
  var DS = { Mon: 'пн', Tue: 'вт', Wed: 'ср', Thu: 'чт', Fri: 'пт', Sat: 'сб', Sun: 'вс' };

  function dateish(s) {
    if (!/\d/.test(s) || !/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(s)) return null;
    var out = s.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m) { return MS[m]; })
               .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, function (m) { return DS[m]; });
    return out === s ? null : out;
  }

  function tr(s) {
    var k = s.trim();
    if (!k) return null;
    if (X.hasOwnProperty(k)) return s.replace(k, X[k]);
    for (var i = 0; i < P.length; i++) {
      if (P[i][0].test(k)) {
        var out = k.replace(P[i][0], P[i][1]);
        return s.replace(k, dateish(out) || out);
      }
    }
    var d = dateish(k);
    return d === null ? null : s.replace(k, d);
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 };
  /* внутри textarea текст — это то, что ввёл гость, его не трогаем;
     атрибуты (placeholder) переводим */
  var SKIP_TEXT = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  var ATTRS = ['aria-label', 'placeholder', 'title'];

  function node(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode;
      if (!p || SKIP_TEXT[p.nodeName]) return;
      var t = tr(n.nodeValue);
      if (t !== null && t !== n.nodeValue) n.nodeValue = t;
    } else if (n.nodeType === 1) {
      if (SKIP[n.nodeName]) return;
      for (var i = 0; i < ATTRS.length; i++) {
        var v = n.getAttribute(ATTRS[i]);
        if (v) { var t2 = tr(v); if (t2 !== null) n.setAttribute(ATTRS[i], t2); }
      }
      if (n.nodeName === 'INPUT' && n.type === 'submit' && n.value) {
        var t3 = tr(n.value); if (t3 !== null) n.value = t3;
      }
      var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false), c;
      while ((c = w.nextNode())) {
        if (c.nodeType === 3) node(c);
        else if (c.nodeType === 1 && !SKIP[c.nodeName]) {
          for (var j = 0; j < ATTRS.length; j++) {
            var av = c.getAttribute(ATTRS[j]);
            if (av) { var at = tr(av); if (at !== null) c.setAttribute(ATTRS[j], at); }
          }
        }
      }
    }
  }

  /* уже вставленное сервером (цены «from … per night») и виджеты, успевшие
     отрисоваться до нас */
  function sweep(root) { node(root || document.body); }

  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') node(m.target);
      else if (m.type === 'attributes') node(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) node(m.addedNodes[j]);
    }
  });

  function start() {
    sweep();
    mo.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
