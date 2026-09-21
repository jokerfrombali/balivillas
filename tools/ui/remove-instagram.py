#!/usr/bin/env python3
"""Take the Instagram link off the site.

The account exists but is not filled in, so every link sent people to an empty
profile — worse for trust than no link at all (owner's call, 21.09.2026).

Removes: the footer social link, the card on the contacts page, and the
`sameAs` entry in the Organization JSON-LD. `alternateName` stays: it is what
tells Google which "Host" on Bali we are, and it does not depend on a profile.
Mentions of Instagram in articles and in the owner FAQ are left alone — they
describe a service, not a profile of ours.

Run from the repo root: python3 tools/ui/remove-instagram.py [--dry]  Idempotent.
"""
import glob, json, os, re, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

LINK = re.compile(r'\s*<a href="https://(?:www\.)?instagram\.com/[^"]*"[^>]*>.*?</a>', re.S)
CARD = re.compile(r'\s*<a class="card" href="https://(?:www\.)?instagram\.com/[^"]*"[^>]*>.*?</a>', re.S)

def drop_same_as(h):
    def patch(m):
        raw = m.group(1)
        try:
            data = json.loads(raw)
        except Exception:
            return m.group(0)
        nodes = data.get('@graph') if isinstance(data, dict) and '@graph' in data else (
            data if isinstance(data, list) else [data])
        hit = False
        for n in nodes:
            if isinstance(n, dict) and 'sameAs' in n:
                keep = [u for u in (n['sameAs'] if isinstance(n['sameAs'], list) else [n['sameAs']])
                        if 'instagram.com' not in u]
                if keep:
                    n['sameAs'] = keep
                else:
                    n.pop('sameAs')
                hit = True
        if not hit:
            return m.group(0)
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'
    return re.sub(r'<script type="application/ld\+json">(.*?)</script>', patch, h, flags=re.S)

targets = sorted(glob.glob('**/*.html', recursive=True)) + ['tools/blog/shell/footer.html']
links = cards = ld = 0
for f in targets:
    if f.startswith(('node_modules/', 'worker/')) or not os.path.exists(f):
        continue
    if f.startswith('tools/') and f != 'tools/blog/shell/footer.html':
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'instagram.com' not in h.lower():
        continue
    o = h
    n0 = len(CARD.findall(h)); h = CARD.sub('', h); cards += n0
    n1 = len(LINK.findall(h)); h = LINK.sub('', h); links += n1
    before = h
    h = drop_same_as(h)
    if h != before:
        ld += 1
    if h != o and not DRY:
        open(f, 'w', encoding='utf-8').write(h)

print('removed: %d footer links, %d contact cards, sameAs cleaned on %d page(s)%s'
      % (links, cards, ld, ' (dry run)' if DRY else ''))
