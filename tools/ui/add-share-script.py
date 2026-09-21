#!/usr/bin/env python3
"""Load thb-share.js on every villa page.

The share button is created by the script rather than written into the markup:
villa pages come from a generated template, so a button added by hand would be
lost on the next import.

Run from the repo root: python3 tools/ui/add-share-script.py [--dry]   Idempotent.
"""
import glob, os, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

TAG = '<script defer src="/thb-share.js?v=20260921"></script>'
ANCHOR = '<script defer src="/thb-fav.js"'      # the heart: same pages, same place

hit = []
for f in sorted(glob.glob('villa/**/index.html', recursive=True)
                + glob.glob('it/villa/**/index.html', recursive=True)):
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'thb-share.js' in h:
        continue
    i = h.find(ANCHOR)
    if i < 0:
        continue
    h = h[:i] + TAG + '\n' + h[i:]
    if not DRY:
        open(f, 'w', encoding='utf-8').write(h)
    hit.append(f)

print('thb-share.js added to %d villa page(s)%s' % (len(hit), ' (dry run)' if DRY else ''))
