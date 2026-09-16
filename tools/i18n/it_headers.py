# -*- coding: utf-8 -*-
"""Английские страницы: убрать мёртвый статический #langSwitcher и добавить
hreflang на итальянского близнеца. Идемпотентно — можно гонять после любого
генератора; запускать ДО gen_it.py."""
import io, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from gen_it import PAGES, path_of, remove_lang_switcher, hreflang_block, SITE

n = 0
for f in PAGES:
    p = path_of(f)
    html = io.open(f, encoding='utf-8').read()
    orig = html
    html = remove_lang_switcher(html)
    if p != '/' and 'hreflang="it"' not in html:
        html = re.sub(r'(<link rel="canonical" href="[^"]*">)',
                      r'\1\n' + hreflang_block(SITE + p, SITE + '/it' + p), html, count=1)
    if html != orig:
        io.open(f, 'w', encoding='utf-8', newline='').write(html)
        n += 1
print('английских страниц изменено:', n)
