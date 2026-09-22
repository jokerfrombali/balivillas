#!/usr/bin/env python3
"""Collapse the SEO block to one column on phones.

The block ships its two-column grid as an inline style
(`grid-template-columns:1.35fr .85fr`), so only a rule with `!important` can
override it. Most pages carry that rule; six never got it, and on a phone the
heading was squeezed into a ~150px column with the side card overlapping it
(reported from an iPhone, 21.09.2026).

Run from the repo root: python3 tools/ui/fix-rgrid-mobile.py [--dry]   Idempotent.
"""
import glob, os, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

RULE = ('@media(max-width:900px){.thb-rgrid2{grid-template-columns:1fr!important;'
        'padding:24px 20px!important}.thb-rgrid3{grid-template-columns:1fr!important}}')
MARK = 'max-width:900px){.thb-rgrid2'

fixed = []
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(('node_modules/', 'worker/', 'tools/', 'saved/')):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'class="thb-rgrid2"' not in h or MARK in h:
        continue
    if '</head>' not in h:
        print('  ! no </head>:', f); continue
    h = h.replace('</head>', '<style id="thb-rgrid-mobile">' + RULE + '</style>\n</head>', 1)
    if not DRY:
        open(f, 'w', encoding='utf-8').write(h)
    fixed.append(f)

print('fixed %d page(s)%s' % (len(fixed), ' (dry run)' if DRY else ''))
for f in fixed:
    print('  ', f)
