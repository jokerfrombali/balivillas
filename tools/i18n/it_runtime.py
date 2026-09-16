# -*- coding: utf-8 -*-
"""Итальянская версия, шаг 3: скрипты и воркер понимают префикс /it/.

Все страницы-близнецы лежат под /it/ с теми же путями. Скрипты и воркер
узнают страницу по адресу, поэтому префикс надо снимать в одном месте у
каждого: воркер — при выборе скриптов и подшивке цен, скрипты — при разборе
location.pathname. Данные (villas.json, for-sale.json) общие.
"""
import io, os, re

ROOT = r'D:\Projects\thebalihost'


def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, encoding='utf-8').read()
    for old, new in pairs:
        assert old in s, (rel, old[:60])
        s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print(rel, 'ок')


# --- воркер: выбор скриптов и подшивка цен по пути без /it ---
patch('worker/index.js', [
    ("""    const isVilla = /^\\/villa\\/[^/]+\\/[^/]+\\/$/.test(url.pathname) ||
                    /^\\/villa\\/[^/]+\\/$/.test(url.pathname);""",
     """    /* Итальянские близнецы лежат под /it/ с теми же путями: для выбора
       скриптов и подшивки цен префикс снимаем. */
    const pathNoLang = url.pathname.replace(/^\\/it(?=\\/)/, '');
    const isVilla = /^\\/villa\\/[^/]+\\/[^/]+\\/$/.test(pathNoLang) ||
                    /^\\/villa\\/[^/]+\\/$/.test(pathNoLang);"""),
    ("const isSale = /^\\/villas-for-sale\\/[^/]+\\/[^/]+\\/$/.test(url.pathname);",
     "const isSale = /^\\/villas-for-sale\\/[^/]+\\/[^/]+\\/$/.test(pathNoLang);"),
    ("""    const isSaleList = /^\\/villas-for-sale\\/$/.test(url.pathname) ||
                       /^\\/villas-for-sale\\/[^/]+\\/$/.test(url.pathname);""",
     """    const isSaleList = /^\\/villas-for-sale\\/$/.test(pathNoLang) ||
                       /^\\/villas-for-sale\\/[^/]+\\/$/.test(pathNoLang);"""),
    ("""    const isRentList = /^\\/property-rental\\/$/.test(url.pathname) ||
                       /^\\/villas\\/$/.test(url.pathname) ||
                       /^\\/villas\\/[^/]+\\/$/.test(url.pathname);""",
     """    const isRentList = /^\\/property-rental\\/$/.test(pathNoLang) ||
                       /^\\/villas\\/$/.test(pathNoLang) ||
                       /^\\/villas\\/[^/]+\\/$/.test(pathNoLang);"""),
    ("try { out = await injectPrices(withScripts, env, url.pathname); }",
     "try { out = await injectPrices(withScripts, env, pathNoLang); }"),
])

patch('worker/price-html.js', [
    ("const norm = (u) => (u || '').split('?')[0].split('#')[0];",
     "/* адреса в карточках итальянских страниц начинаются с /it/ — цены те же */\nconst norm = (u) => (u || '').split('?')[0].split('#')[0].replace(/^\\/it(?=\\/)/, '');"),
])

# --- скрипты ---
patch('thb-cards.js', [
    ("    if (href && href.indexOf('/villa/') === 0) return href;",
     "    if (href) href = href.replace(/^\\/it(?=\\/)/, '');   /* итальянские страницы */\n    if (href && href.indexOf('/villa/') === 0) return href;"),
])
patch('thb-gallery.js', [
    ("  var path = location.pathname;\n  if (!/^\\/villa\\/[^/]+\\/([^/]+\\/)?$/.test(path)) return;",
     "  var path = location.pathname;\n  /* итальянские близнецы под /it/: проверяем путь без префикса, а ссылки\n     строим от настоящего */\n  if (!/^\\/villa\\/[^/]+\\/([^/]+\\/)?$/.test(path.replace(/^\\/it(?=\\/)/, ''))) return;"),
])
patch('thb-map.js', [
    ("  if (location.pathname.indexOf('/villas-for-sale/') === 0) return;",
     "  if (location.pathname.replace(/^\\/it(?=\\/)/, '').indexOf('/villas-for-sale/') === 0) return;"),
])
patch('thb-sale-map.js', [
    ("  var path = location.pathname;\n  if (path.indexOf('/villas-for-sale/') !== 0) return;",
     "  var path = location.pathname.replace(/^\\/it(?=\\/)/, '');   /* итальянские близнецы */\n  if (path.indexOf('/villas-for-sale/') !== 0) return;"),
])
patch('thb-rent-map.js', [
    ("  var path = location.pathname;\n  var mArea = path.match(/^\\/villas\\/([^/]+)\\/$/);",
     "  var path = location.pathname.replace(/^\\/it(?=\\/)/, '');   /* итальянские близнецы */\n  var mArea = path.match(/^\\/villas\\/([^/]+)\\/$/);"),
])
patch('thb-enquiry.js', [
    ("        location.pathname.indexOf('/villas-for-sale/') !== 0) add('/thb-map.js');",
     "        location.pathname.replace(/^\\/it(?=\\/)/, '').indexOf('/villas-for-sale/') !== 0) add('/thb-map.js');"),
])
