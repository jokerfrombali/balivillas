# -*- coding: utf-8 -*-
"""sitemap.xml: для каждой страницы с итальянским близнецом — xhtml:link на
обе версии, плюс отдельный <url> для /it/…. Идемпотентно."""
import io, json, os, re

ROOT = r'D:\Projects\thebalihost'
SITE = 'https://thehostbali.com'
TW = set(json.load(io.open(os.path.join(ROOT, 'data', 'i18n', 'it.pages.json'), encoding='utf-8')))
p = os.path.join(ROOT, 'sitemap.xml')
s = io.open(p, encoding='utf-8').read()

# снять прошлый прогон
s = re.sub(r'\s*<xhtml:link[^>]*/>', '', s)
s = re.sub(r'\s*<url>\s*<loc>https://thehostbali\.com/it/(?!</loc>)[^<]*</loc>.*?</url>', '', s, flags=re.S)
s = s.replace(' xmlns:xhtml="http://www.w3.org/1999/xhtml"', '')

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
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('it-urls добавлено:', len(extra))
