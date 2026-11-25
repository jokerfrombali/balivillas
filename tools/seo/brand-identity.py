#!/usr/bin/env python3
"""Tell Google which "Host" on Bali we are.

Search Console, 20.09.2026: for the query "the host bali" balivillas.ai is not in the top 10 at
all. The results belong to The Host Table (thehosttable.com), The Bali Host (thebalihost.com) and
BaliSuperHost. Add the same qualifier - "the host bali" villa sanur - and our pages take positions
1, 2, 3, 5, 7 and 8, so the site ranks fine; Google simply does not connect the brand name to it.

That is the most expensive leak we have for direct bookings: a guest who stayed in one of our villas
and later searches the name lands on somebody else.

The Organization node on 564 pages had no `sameAs`, which is the property that binds a site to its
official profiles and separates same-named businesses. This adds:
  sameAs        - the official Instagram (same handle as the domain)
  alternateName - the spellings people actually type

Run from the repo root:  python3 tools/seo/brand-identity.py [--dry]
Idempotent.
"""
import glob, json, os, re, sys

DRY = '--dry' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

# 21.09.2026: профиль в Instagram не заполнен, ссылку с сайта сняли, и указывать
# на пустую страницу в sameAs нельзя — это сигнал в никуда. Впишите сюда профиль,
# когда он появится: sameAs как раз и разводит одноимённые компании.
SAME_AS = []
ALT_NAMES = ["TheHostBali", "BaliVillas Villas", "Host Bali"]

changed = skipped = 0
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(('node_modules/', 'worker/', 'tools/')):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if '"@type": "Organization"' not in h:
        continue
    if '"alternateName"' in h:
        skipped += 1; continue

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
            if isinstance(n, dict) and n.get('@type') == 'Organization':
                if SAME_AS:
                    n['sameAs'] = SAME_AS
                n['alternateName'] = ALT_NAMES
                hit = True
        if not hit:
            return m.group(0)
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'

    new = re.sub(r'<script type="application/ld\+json">(.*?)</script>', patch, h, flags=re.S)
    if new != h:
        changed += 1
        if not DRY:
            open(f, 'w', encoding='utf-8').write(new)
print('sameAs + alternateName added to %d pages (already had: %d)%s'
      % (changed, skipped, ' (dry run)' if DRY else ''))
