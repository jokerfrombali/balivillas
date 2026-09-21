#!/usr/bin/env python3
"""Drop the template's own Share button from villa pages.

The imported template ships its own share control next to the heart on desktop —
a different icon, a different place, and its own behaviour. Now that thb-share.js
puts one consistent button on every screen size, two of them only confuse
(owner's call, 21.09.2026).

The button sits alone inside a tooltip-trigger span, so the whole span goes.

Run from the repo root: python3 tools/ui/remove-template-share.py [--dry]  Idempotent.
"""
import glob, os, re, sys

DRY = '--dry' in sys.argv
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# <span …tooltip-trigger><button … aria-label="Share|Condividi">…</button></span>
PAT = re.compile(
    r'<span[^>]*data-slot="tooltip-trigger"[^>]*>\s*'
    r'<button(?:(?!</button>).)*?aria-label="(?:Share|Condividi)"(?:(?!</button>).)*?</button>\s*'
    r'</span>', re.S)

n = 0
for f in sorted(glob.glob('villa/**/index.html', recursive=True)
                + glob.glob('it/villa/**/index.html', recursive=True)):
    h = open(f, encoding='utf-8', errors='ignore').read()
    h2, k = PAT.subn('', h)
    if k:
        n += 1
        if not DRY:
            open(f, 'w', encoding='utf-8').write(h2)
print('template Share button removed from %d page(s)%s' % (n, ' (dry run)' if DRY else ''))
