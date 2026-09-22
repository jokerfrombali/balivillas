#!/usr/bin/env python3
"""Wire /monthly-rental/ into the site-wide header and footer.

The footer already promised long stays but pointed at /property-rental/ and at a /#longterm
anchor, so both were dead ends for the query. They now point at the section that exists.
Run from the repo root: python3 tools/monthly/link-in.py [--dry]   Idempotent.
"""
import glob, os, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

MEGA_ANCHOR = '<a href="/property-rental/" class="mega-item">All properties'
MEGA_NEW = ('<a href="/monthly-rental/" class="mega-item" style="font-weight:600">Monthly rentals &rarr;</a>\n'
            '              ')
SWAPS = [
    ('<li><a href="/property-rental/">Long stays</a></li>',
     '<li><a href="/monthly-rental/">Long stays</a></li>'),
    ('<li><a href="/#longterm">Monthly &amp; Yearly</a></li>',
     '<li><a href="/monthly-rental/">Monthly &amp; Yearly</a></li>'),
]
SKIP = ('node_modules/', 'worker/', 'tools/', 'saved/', 'it/saved/')

foot = mega = 0
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(SKIP):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    o = h
    for old, new in SWAPS:
        if old in h:
            h = h.replace(old, new)
    if h != o:
        foot += 1
    if MEGA_ANCHOR in h and '/monthly-rental/" class="mega-item"' not in h:
        h = h.replace(MEGA_ANCHOR, MEGA_NEW + MEGA_ANCHOR, 1)
        mega += 1
    if h != o and not DRY:
        open(f, 'w', encoding='utf-8').write(h)
print('footer links fixed on %d pages, mega-menu item added on %d%s'
      % (foot, mega, ' (dry run)' if DRY else ''))
