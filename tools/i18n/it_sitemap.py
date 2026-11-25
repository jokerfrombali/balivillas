# -*- coding: utf-8 -*-
"""sitemap.xml: для каждой страницы с итальянским близнецом — xhtml:link на
обе версии, плюс отдельный <url> для /it/…. Идемпотентно."""
import io, json, os, re

ROOT = r'D:\Projects\thebalihost'
SITE = 'https://balivillas.ai'
TW = set(json.load(io.open(os.path.join(ROOT, 'data', 'i18n', 'it.pages.json'), encoding='utf-8')))
p = os.path.join(ROOT, 'sitemap.xml')
s = io.open(p, encoding='utf-8').read()

# Снимаем прошлый прогон — но только свои связки. У других разделов
# (/villa-management/*, /blog/*) альтернативы ставит другой генератор, и
# вычищать их отсюда нельзя: они пропадали из карты после каждого прогона.
def drop_ours(m):
    block = m.group(0)
    loc = re.search(r'<loc>([^<]+)</loc>', block).group(1)
    path = loc[len(SITE):] if loc.startswith(SITE) else loc
    if path in TW or path.startswith('/it/'):
        block = re.sub(r'\s*<xhtml:link[^>]*/>', '', block)
    return block

s = re.sub(r'\s*<url>.*?</url>', drop_ours, s, flags=re.S)
s = re.sub(r'\s*<url>\s*<loc>https://thehostbali\.com/it/(?!</loc>)[^<]*</loc>.*?</url>', '', s, flags=re.S)

def alts(path):
    en, it = SITE + path, SITE + '/it' + path
    return ('\n    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>'
            '\n    <xhtml:link rel="alternate" hreflang="en" href="%s"/>'
            '\n    <xhtml:link rel="alternate" hreflang="it" href="%s"/>' % (en, en, it))

extra = []
def fix(m):
    block = m.group(0)
    loc = re.search(r'<loc>https://thehostbali\.com(/[^<]*)</loc>', block).group(1)
    if loc not in TW:
        return block
    block2 = block.replace('</loc>', '</loc>' + alts(loc), 1)
    it_block = block.replace('<loc>' + SITE + loc + '</loc>', '<loc>' + SITE + '/it' + loc + '</loc>' + alts(loc), 1)
    it_block = it_block.replace('<lastmod>', '<lastmod>').replace('<priority>1.0</priority>', '<priority>0.9</priority>')
    extra.append(it_block)
    return block2

s = re.sub(r'<url>.*?</url>', fix, s, flags=re.S)
s = s.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">', 1)
s = s.replace('</urlset>', '\n'.join(extra) + '\n</urlset>')
s = s.replace('\n\n</urlset>', '\n</urlset>')

# Главная уже стоит в карте как /it/ — это итальянская посадочная страница.
# Добавлять её вторым блоком нельзя: дубль <loc> ломает карту. Поэтому в конце
# оставляем по одному блоку на адрес, предпочитая тот, где есть xhtml:link.
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
print('it-urls добавлено:', len(extra))
