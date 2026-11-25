#!/usr/bin/env python3
"""Cut /about/ back to what is actually true today.

Owner's call, 21.09.2026: the page was built on placeholder content — four
"team members" with Unsplash stock faces and invented biographies, a dozen more
stock photos presented as our own operations, a mission statement, a founding
story and a services essay. Real photos and copy come later; until then the page
keeps one photo, a short description and the figures block.

Kept:    hero photo + heading + short description, the figures, the office
         section, the closing call to action.
Removed: problems/solutions, the founding story, the mission quote, the
         services essay, the team, the photo gallery, the values, the FAQ
         (and its FAQPage structured data, which must not describe content the
         page no longer shows).

Run from the repo root: python3 tools/ui/trim-about.py [--dry]   Idempotent.
"""
import json, os, re, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

CUT_FROM = '<!-- =============== PROBLEMS WE SOLVE'
CUT_TO = '<!-- =============== CONTACT + OFFICE'

PAGES = {
 'about/index.html': dict(
   h1='About <span class="italic">BaliVillas.</span>',
   lead='We rent out and manage private pool villas in Bali — eleven in Sanur, '
        'plus Canggu, Umalas and Ungasan. Every villa on this site is run by our own team: '
        'we clean it, answer the messages and keep the calendar you see.',
   cta_href='/property-rental/', cta_text='See our villas',
   title='About BaliVillas — the team that runs the villas',
   desc='BaliVillas rents out and manages private pool villas in Sanur, Canggu, Umalas '
        'and Ungasan. Run by our own team on the island. Visit us in Canggu.',
 ),
 'it/about/index.html': dict(
   h1='Chi siamo: <span class="italic">BaliVillas.</span>',
   lead='Affittiamo e gestiamo ville con piscina privata a Bali — undici a Sanur, '
        'più Canggu, Umalas e Ungasan. Ogni villa su questo sito è gestita dal nostro team: '
        'la puliamo noi, rispondiamo noi ai messaggi e teniamo noi il calendario che vedete.',
   cta_href='/it/property-rental/', cta_text='Guarda le ville',
   title='Chi siamo — BaliVillas | il team che gestisce le ville',
   desc='BaliVillas affitta e gestisce ville con piscina privata a Sanur, Canggu, Umalas '
        'e Ungasan. Gestite dal nostro team sull&rsquo;isola. Venite a trovarci a Canggu.',
 ),
}

def drop_faq_ld(h):
    """The FAQ block is gone, so its FAQPage node has to go with it."""
    def patch(m):
        try:
            data = json.loads(m.group(1))
        except Exception:
            return m.group(0)
        graph = data.get('@graph') if isinstance(data, dict) and '@graph' in data else None
        if graph is None:
            return m.group(0)
        keep = [n for n in graph if not (isinstance(n, dict) and n.get('@type') == 'FAQPage')]
        if len(keep) == len(graph):
            return m.group(0)
        data['@graph'] = keep
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'
    return re.sub(r'<script type="application/ld\+json">(.*?)</script>', patch, h, flags=re.S)

for f, c in PAGES.items():
    if not os.path.exists(f):
        print('  ! missing', f); continue
    h = open(f, encoding='utf-8').read()
    before = len(h)

    i, j = h.find(CUT_FROM), h.find(CUT_TO)
    if i > 0 and j > i:
        h = h[:i] + h[j:]
    elif CUT_TO not in h:
        print('  ! anchors not found in', f); continue

    # hero: a heading that states what we are, not what we aspire to
    h = re.sub(r'(<h1 class="font-display[^"]*">).*?(</h1>)', lambda m: m.group(1) + c['h1'] + m.group(2), h, count=1, flags=re.S)
    h = re.sub(r'(<p class="text-white/70 text-\[16px\] max-w-md mb-10">).*?(</p>)',
               lambda m: m.group(1) + c['lead'] + m.group(2), h, count=1, flags=re.S)
    # the first button pointed at #story, which no longer exists
    h = re.sub(r'<a href="#story" class="btn-white">[^<]*</a>',
               '<a href="%s" class="btn-white">%s</a>' % (c['cta_href'], c['cta_text']), h, count=1)

    h = drop_faq_ld(h)

    h = re.sub(r'<title>.*?</title>', '<title>' + c['title'] + '</title>', h, count=1, flags=re.S)
    for attr in ('<meta name="description" content="', '<meta property="og:description" content="'):
        h = re.sub(re.escape(attr) + r'[^"]*"', attr + c['desc'] + '"', h, count=1)
    h = re.sub(r'<meta property="og:title" content="[^"]*"',
               '<meta property="og:title" content="' + c['title'] + '"', h, count=1)

    if not DRY:
        open(f, 'w', encoding='utf-8').write(h)
    print('%-24s %6d -> %6d bytes  (-%d%%)' % (f, before, len(h), round(100 * (before - len(h)) / before)))
