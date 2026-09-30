# -*- coding: utf-8 -*-
"""sitemap.xml: для каждой страницы с переводами — xhtml:link на все версии
(en + каждый язык, у которого есть data/i18n/<lang>.pages.json), плюс
отдельный <url> для каждой языковой копии. Аргумент не нужен: собирает все
языки разом, иначе прогон для одного языка стирал бы связки другого.
Идемпотентно."""
import glob, io, json, os, re

ROOT = r'D:\Projects\thebalihost'
SITE = 'https://thehostbali.com'
LANGS = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'i18n', '*.pages.json'))):
    LANGS[os.path.basename(f).split('.')[0]] = set(json.load(io.open(f, encoding='utf-8')))
ALL = set().union(*LANGS.values()) if LANGS else set()
PREF = tuple('/' + l + '/' for l in LANGS)

p = os.path.join(ROOT, 'sitemap.xml')
s = io.open(p, encoding='utf-8').read()

# Снимаем прошлый прогон — только свои связки. У других разделов
# (/villa-management/*, /blog/*) альтернативы ставит другой генератор.
def drop_ours(m):
    block = m.group(0)
    path = re.search(r'<loc>([^<]+)</loc>', block).group(1).replace(SITE, '', 1)
    if path in ALL:
        block = re.sub(r'\s*<xhtml:link[^>]*/>', '', block)
    return block

s = re.sub(r'\s*<url>.*?</url>', drop_ours, s, flags=re.S)
for l in LANGS:
    s = re.sub(r'\s*<url>\s*<loc>' + re.escape(SITE) + '/' + l + r'/[^<]*</loc>.*?</url>', '', s, flags=re.S)

def alts(path):
    out = ['\n    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % (SITE + path),
           '\n    <xhtml:link rel="alternate" hreflang="en" href="%s"/>' % (SITE + path)]
    for l, tw in LANGS.items():
        if path in tw:
            out.append('\n    <xhtml:link rel="alternate" hreflang="%s" href="%s/%s%s"/>' % (l, SITE, l, path))
    return ''.join(out)

extra = []
def fix(m):
    block = m.group(0)
    path = re.search(r'<loc>([^<]+)</loc>', block).group(1).replace(SITE, '', 1)
    if path not in ALL:
        return block
    a = alts(path)
    for l, tw in LANGS.items():
        if path in tw:
            b = block.replace('<loc>' + SITE + path + '</loc>', '<loc>' + SITE + '/' + l + path + '</loc>' + a, 1)
            extra.append(b.replace('<priority>1.0</priority>', '<priority>0.9</priority>'))
    return block.replace('</loc>', '</loc>' + a, 1)

s = re.sub(r'<url>.*?</url>', fix, s, flags=re.S)
if 'xmlns:xhtml' not in s:
    s = s.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">', 1)
s = s.replace('</urlset>', '\n'.join(extra) + '\n</urlset>')

# По одному блоку на адрес, предпочитая тот, где есть xhtml:link.
seen, out = set(), []
for b in re.findall(r'\s*<url>.*?</url>', s, re.S):
    loc = re.search(r'<loc>([^<]+)</loc>', b).group(1)
    if loc in seen:
        i = [k for k, x in enumerate(out) if '<loc>' + loc + '</loc>' in x][0]
        if 'xhtml:link' in b and 'xhtml:link' not in out[i]:
            out[i] = b
        continue
    seen.add(loc)
    out.append(b)
s = (s[:s.index('<url>')].rstrip() + '\n' +
     ''.join(x.lstrip('\n') if i == 0 else x for i, x in enumerate(out)) + '\n</urlset>\n')

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('языки:', ', '.join(LANGS), '| копий добавлено:', len(extra))
