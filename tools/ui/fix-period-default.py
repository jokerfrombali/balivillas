#!/usr/bin/env python3
"""Default the Rental period filter to Daily.

Every catalogue page shipped with "Monthly" pre-selected, so a visitor opening
the filters on a nightly-rental catalogue saw the wrong period already ticked.
Reported 21.09.2026.

Run from the repo root: python3 tools/ui/fix-period-default.py [--dry]  Idempotent.
"""
import glob, os, re, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

MONTHLY_ON = ('<label class="f-chip active"><input type="checkbox" checked style="display:none" '
              'data-filter="period" value="monthly">')
MONTHLY_OFF = ('<label class="f-chip"><input type="checkbox" style="display:none" '
               'data-filter="period" value="monthly">')
DAILY_OFF = ('<label class="f-chip"><input type="checkbox" style="display:none" '
             'data-filter="period" value="daily">')
DAILY_ON = ('<label class="f-chip active"><input type="checkbox" checked style="display:none" '
            'data-filter="period" value="daily">')

changed = []
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(('node_modules/', 'worker/', 'tools/', 'saved/')):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'data-filter="period"' not in h or DAILY_ON in h:
        continue
    o = h
    h = h.replace(MONTHLY_ON, MONTHLY_OFF).replace(DAILY_OFF, DAILY_ON)
    if h != o:
        changed.append(f)
        if not DRY:
            open(f, 'w', encoding='utf-8').write(h)

print('Rental period defaulted to Daily on %d page(s)%s' % (len(changed), ' (dry run)' if DRY else ''))
