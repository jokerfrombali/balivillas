#!/usr/bin/env python3
"""Version the filter script so browsers pick up the new logic.

thb-filters.js shipped without a version query, so a returning visitor keeps the
copy in their cache — including the old single-choice bedrooms. Other scripts on
the site already carry ?v=YYYYMMDD; this brings the filters in line.

Run from the repo root: python3 tools/ui/bust-filters-cache.py [--dry]  Idempotent.
"""
import glob, os, re, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
VER = '20260921'

OLD = re.compile(r'src="/thb-filters\.js(?:\?v=\d+)?"')
NEW = 'src="/thb-filters.js?v=%s"' % VER

n = 0
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(('node_modules/', 'worker/', 'saved/')):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'thb-filters.js' not in h or NEW in h:
        continue
    h2 = OLD.sub(NEW, h)
    if h2 != h:
        n += 1
        if not DRY:
            open(f, 'w', encoding='utf-8').write(h2)
print('thb-filters.js versioned on %d page(s)%s' % (n, ' (dry run)' if DRY else ''))
