/* The Host Bali — итальянские подписи для виджетов.
 *
 * Страницы под /it/ переведены целиком в HTML, но календарь, цены, форма
 * заявки, карта, валюта и куки-плашка рисуются скриптами по-английски.
 * Этот файл подключается воркером только на /it/ и переводит текст, который
 * скрипты вставляют в DOM: точные строки — по словарю, составные («Minimum
 * stay: 3 nights») — по шаблонам. Сами виджеты не трогаем. */
(function () {
  'use strict';
  if (window.__thbIt) return;
  window.__thbIt = true;

  var X = {
    'per night': 'a notte', 'total': 'totale', 'Total': 'Totale', 'night': 'notte', 'nights': 'notti',
    'Cleaning fee': 'Pulizie finali', 'Taxes': 'Tasse', 'Guests': 'Ospiti',
    'On request': 'Su richiesta', 'Prices on request': 'Prezzi su richiesta',
    'Select dates for pricing': 'Scegli le date per vedere il prezzo', 'Select dates': 'Scegli le date',
    'Select check-out date': 'Scegli la data di check-out', 'Select check-in date': 'Scegli la data di check-in',
    'Clear dates': 'Cancella le date', 'Add date': 'Aggiungi la data',
    'Crossed-out dates are already booked': 'Le date barrate sono già prenotate',
    'Those dates include nights that are already booked. Please pick a range without them.':
      'Queste date includono notti già prenotate. Scegli un intervallo senza di esse.',
    'January': 'Gennaio', 'February': 'Febbraio', 'March': 'Marzo', 'April': 'Aprile', 'May': 'Maggio',
    'June': 'Giugno', 'July': 'Luglio', 'August': 'Agosto', 'September': 'Settembre',
    'October': 'Ottobre', 'November': 'Novembre', 'December': 'Dicembre',
    'Mo': 'Lu', 'Tu': 'Ma', 'We': 'Me', 'Th': 'Gi', 'Fr': 'Ve', 'Sa': 'Sa', 'Su': 'Do',
    'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Gio', 'Fri': 'Ven', 'Sat': 'Sab', 'Sun': 'Dom',
    /* форма заявки */
    'Request this villa': 'Richiedi questa villa', 'Booking request': 'Richiesta di prenotazione',
    'Your check-in & check-out': 'Check-in e check-out', 'Adults': 'Adulti', '13 years or older': '13 anni o più',
    'Children': 'Bambini', '12 and under': '12 anni o meno', 'Full name': 'Nome e cognome',
    'Please tell us your name': 'Dicci il tuo nome', 'Email': 'Email', 'Check the email address': 'Controlla l\'indirizzo email',
    'Add a number we can reach you on': 'Aggiungi un numero a cui possiamo contattarti',
    'Anything we should know? (optional)': 'C\'è qualcosa che dovremmo sapere? (facoltativo)',
    'Airport pickup, early check-in, long stay…': 'Transfer dall\'aeroporto, check-in anticipato, soggiorno lungo…',
    'I agree with the': 'Accetto i', 'terms of use': 'termini di utilizzo',
    'and to being contacted about this request.': 'e di essere contattato riguardo a questa richiesta.',
    'Send request': 'Invia richiesta', 'or': 'oppure', 'Chat on WhatsApp instead': 'Scrivici su WhatsApp',
    'We reply within ~15 minutes, 8:00–22:00 WITA.': 'Rispondiamo entro ~15 minuti, 8:00–22:00 WITA.',
    'Request sent': 'Richiesta inviata', 'Request ready': 'Richiesta pronta', 'Continue on WhatsApp': 'Continua su WhatsApp',
    'Sending…': 'Invio…', 'Request to book': 'Richiedi la prenotazione', 'WhatsApp us now': 'Scrivici su WhatsApp',
    'No payment now — we confirm the dates first.': 'Nessun pagamento ora: prima confermiamo le date.',
    'BOOKING': 'PRENOTA', 'Chat with us on WhatsApp': 'Scrivici su WhatsApp', 'Close': 'Chiudi',
    'Fewer adults': 'Meno adulti', 'More adults': 'Più adulti', 'Fewer children': 'Meno bambini', 'More children': 'Più bambini',
    'Dates are required — tap to choose': 'Le date sono obbligatorie: tocca per scegliere',
    'Tap to choose your dates': 'Tocca per scegliere le date',
    'Bringing a bigger group? Tell us in the note.': 'Siete un gruppo più numeroso? Scrivilo nella nota.',
    'We opened WhatsApp with your request — press send there and our team picks it up right away.':
      'Abbiamo aperto WhatsApp con la tua richiesta: premi invia e il nostro team se ne occupa subito.',
    /* форма по продаже */
    'Request details': 'Richiedi i dettagli',
    'Please leave a name and a way to reach you.': 'Lascia un nome e un modo per contattarti.',
    'Thank you — we will come back to you today with the details.': 'Grazie: ti risponderemo oggi stesso con i dettagli.',
    'Could not send it. Please write to us on WhatsApp.': 'Invio non riuscito. Scrivici su WhatsApp.',
    /* карты */
    'See where they are': 'Guarda dove si trovano', 'See where the villas are': 'Guarda dove sono le ville',
    'All our listings on one map': 'Tutti i nostri annunci su una mappa', 'All our villas on one map': 'Tutte le nostre ville su una mappa',
    'Show map': 'Mostra la mappa', 'Hide map': 'Nascondi la mappa', 'View this villa': 'Vedi questa villa',
    'Price on request': 'Prezzo su richiesta', 'Locations are approximate': 'Le posizioni sono approssimative',
    'Villas are shown as an area, not an exact address': 'Le ville sono indicate come zona, non come indirizzo esatto',
    'Full screen': 'Schermo intero', 'zoom in': 'ingrandisci', 'zoom out': 'riduci',
    /* избранное, валюта, куки, прочее */
    'Save this villa': 'Salva questa villa', 'Remove from saved': 'Rimuovi dai salvati', 'Saved villas': 'Ville salvate', 'View': 'Vedi',
    'Change currency': 'Cambia valuta', 'Currency': 'Valuta', 'Indicative rates. Villas are priced and paid in rupiah.': 'Tassi indicativi. Le ville sono quotate e pagate in rupie.',
    'Indonesian rupiah': 'Rupia indonesiana', 'US dollar': 'Dollaro USA', 'Euro': 'Euro', 'Australian dollar': 'Dollaro australiano',
    'British pound': 'Sterlina britannica', 'Singapore dollar': 'Dollaro di Singapore', 'Malaysian ringgit': 'Ringgit malese',
    'Indian rupee': 'Rupia indiana', 'Chinese yuan': 'Yuan cinese', 'Japanese yen': 'Yen giapponese', 'Korean won': 'Won coreano',
    'Russian ruble': 'Rublo russo', 'Thai baht': 'Baht thailandese', 'Taiwan dollar': 'Dollaro taiwanese', 'New Zealand dollar': 'Dollaro neozelandese',
    'Cookies': 'Cookie', 'Decline': 'Rifiuta', 'Accept': 'Accetta', 'Privacy notice': 'Informativa sulla privacy',
    'We use Google Analytics to see which villas and buttons people actually use.': 'Usiamo Google Analytics per capire quali ville e pulsanti vengono davvero usati.',
    'We use Google Analytics to see which villas and buttons people actually use. Nothing is sold or used for ads.': 'Usiamo Google Analytics per capire quali ville e pulsanti vengono davvero usati. Nulla viene venduto o usato per la pubblicità.',
    'Nothing is sold or used for ads.': 'Nulla viene venduto o usato per la pubblicità.',
    'Read more': 'Leggi di più', 'Read less': 'Mostra meno', 'back to top': 'torna su',
    'All': 'Tutte', 'Any': 'Qualsiasi', 'found': 'trovate', 'available': 'disponibili', 'for': 'per'
  };

  var MON = { January: 'Gennaio', February: 'Febbraio', March: 'Marzo', April: 'Aprile', May: 'Maggio', June: 'Giugno',
    July: 'Luglio', August: 'Agosto', September: 'Settembre', October: 'Ottobre', November: 'Novembre', December: 'Dicembre' };
  var P = [
    [/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/,
      function (m, mo, y) { return MON[mo] + ' ' + y; }],
    /* «Oct 3, 2026 ~ Oct 6, 2026» -> «3 ott 2026 ~ 6 ott 2026»: порядок
       день-месяц, названия месяцев подменит dateish */
    [/^([A-Za-z]{3}) (\d{1,2}), (\d{4}) ~ ([A-Za-z]{3}) (\d{1,2}), (\d{4})$/, '$2 $1 $3 ~ $5 $4 $6'],
    [/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/, '$2 $1 $3'],
    [/^from (.+?) per night$/, 'da $1 a notte'],
    [/^(.+?) per night$/, '$1 a notte'],
    [/^(.+?) total$/, '$1 totale'],
    [/^Minimum stay: (\d+) nights?$/, 'Soggiorno minimo: $1 notti'],
    [/^Minimum stay for these dates is (\d+) nights?\.$/, 'Il soggiorno minimo per queste date è di $1 notti.'],
    [/^(.+?) · minimum stay (\d+) nights$/, '$1 · soggiorno minimo $2 notti'],
    [/^(.+?) × (\d+) nights?$/, '$1 × $2 notti'],
    [/^(\d+) nights? · (.+)$/, '$1 notti · $2'],
    [/^Maximum (\d+) guests?$/, 'Massimo $1 ospiti'],
    [/^(\d+) guests?$/, '$1 ospiti'],
    [/^Saved — (\d+) villas?$/, 'Salvate: $1 ville'],
    [/^Saved villas \((\d+)\)$/, 'Ville salvate ($1)'],
    [/^Show (\d+) villas?$/, 'Mostra $1 ville'],
    [/^(\d+) villas? here · shown as an area, not a doorstep$/, '$1 ville qui · indicate come zona, non come indirizzo'],
    [/^(\d+) villas? · shown as an area, not a doorstep$/, '$1 ville · indicate come zona, non come indirizzo'],
    [/^(\d+) villas? here · streets shown as an area, not a doorstep$/, '$1 ville qui · le vie sono indicate come zona, non come indirizzo'],
    [/^(\d+) listings? · streets shown as an area, not a doorstep$/, '$1 annunci · le vie sono indicate come zona, non come indirizzo'],
    [/^(\d+) villas? here$/, '$1 ville qui'],
    [/^(\d+) villas?$/, '$1 ville'],
    [/^(\d+) listings?$/, '$1 annunci'],
    [/^· streets shown as an area, not a doorstep$/, '· le vie sono indicate come zona, non come indirizzo'],
    [/^· shown as an area, not a doorstep$/, '· indicata come zona, non come indirizzo'],
    [/^(\d+) yrs lease$/, 'leasehold $1 anni'],
    [/^lease to (\d+)$/, 'leasehold fino al $1'],
    [/^This villa takes up to (\d+) guests\. Bringing more\? Tell us in the note\.$/, 'Questa villa accoglie fino a $1 ospiti. Siete di più? Scrivilo nella nota.'],
    [/^Thanks, (.+?)! We are checking the dates for (.+?) and will come back to you shortly\.$/, 'Grazie, $1! Stiamo verificando le date per $2 e ti risponderemo a breve.'],
    [/^Booking request — (.+)$/, 'Richiesta di prenotazione — $1']
  ];

  /* Даты виджеты печатают по-английски («3 Oct – 6 Oct», «Sat, 3 Oct 2026»):
     формат задан в thb-price.js и thb-enquiry.js одинаково для всех языков.
     Меняем только названия месяцев и дней недели, и только там, где рядом
     стоит число, — чтобы не задеть имена вилл. */
  var MS = { Jan: 'gen', Feb: 'feb', Mar: 'mar', Apr: 'apr', May: 'mag', Jun: 'giu',
             Jul: 'lug', Aug: 'ago', Sep: 'set', Oct: 'ott', Nov: 'nov', Dec: 'dic' };
  var DS = { Mon: 'lun', Tue: 'mar', Wed: 'mer', Thu: 'gio', Fri: 'ven', Sat: 'sab', Sun: 'dom' };

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
