#!/usr/bin/env python3
"""Preload the two Lora latin files the <h1> is set in.

PSI 20.09.2026 (mobile home page) named the LCP element: the heading text
"Find your perfect Bali villa.", with 2 380 ms of "element render delay" and a critical path of
  thb-tw.css 365 ms -> lora-ecda3beb.woff2 711 ms / lora-6d4ac4a9.woff2 713 ms
The heading is Lora, so it repaints when the webfont arrives and LCP moves to that repaint. The font
is only discovered once the stylesheet has parsed; preloading starts both downloads during HTML parse.

Only the two latin Lora faces are preloaded - normal for "Find your perfect", italic for "Bali villa."
Inter is deliberately left alone so it does not compete for bandwidth with the LCP font.

Run from the repo root:  python3 tools/perf/preload-display-font.py [--dry]
Idempotent.
"""
import glob, os, re, sys

DRY = '--dry' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

# resolved from fonts/fonts.css: family Lora, weight 400, subset latin
FACES = ['/fonts/lora-ecda3beb.woff2',   # normal
         '/fonts/lora-6d4ac4a9.woff2']   # italic
for f in FACES:
    if not os.path.exists(f.lstrip('/')):
        sys.exit('missing font file: ' + f)

TAGS = ''.join('<link rel="preload" as="font" type="font/woff2" href="%s" crossorigin>\n' % f
               for f in FACES)
FIRST_CSS = re.compile(r'[ \t]*<link rel="stylesheet" href="/(?:thb-tw|fonts/fonts)\.css">')

changed = skipped = 0
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(('node_modules/', 'worker/')):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'lora-ecda3beb' in h and 'rel="preload" as="font"' in h:
        skipped += 1; continue
    m = FIRST_CSS.search(h)
    if not m:
        continue                      # page has no stylesheet of ours, so no Lora either
    if DRY:
        changed += 1; continue
    h = h[:m.start()] + TAGS + h[m.start():]
    open(f, 'w', encoding='utf-8').write(h)
    changed += 1
print('preload added to %d pages (already present: %d)%s'
      % (changed, skipped, ' (dry run)' if DRY else ''))
