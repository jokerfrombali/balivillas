#!/usr/bin/env python3
"""Stop the two mega-menu tiles from competing with the hero for bandwidth.

PageSpeed Insights 20.09.2026 (mobile home page) listed /images/sanur.avif as the single heaviest
resource on the page, 136 KiB. Both mega-menu tiles sit in a fixed `width:180px` box, yet the files
are 1080 px and 736 px wide, and neither carried `loading`, so they were fetched eagerly - on mobile,
where `#thbNavLinks` is `display:none`, the menu is never even shown.

  1. build <name>-360.(avif|jpg): 180 CSS px at DPR 2, the size the tile actually needs;
  2. point the markup at them and add loading="lazy" decoding="async".

Run from the repo root:  python3 tools/perf/fix-mega-menu-images.py [--dry]
Idempotent: files already pointing at -360 are left alone.
"""
import glob, io, os, re, sys

DRY = '--dry' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
TILES = ('sanur', 'all-bali')      # only these two live in the 180 px mega-menu box
WIDTH = 360
SKIP_DIRS = ('node_modules/', 'worker/')

# ---------------------------------------------------------------- build the 360 px variants
from PIL import Image, ImageOps
made = 0
for name in TILES:
    src = 'images/%s.jpg' % name
    if not os.path.exists(src):
        print('  ! missing', src); continue
    base = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    small = base.resize((WIDTH, round(base.height * WIDTH / base.width)), Image.LANCZOS)
    for ext, fmt, kw in (('jpg', 'JPEG', dict(quality=80, optimize=True, progressive=True)),
                         ('avif', 'AVIF', dict(quality=58))):
        out = 'images/%s-%d.%s' % (name, WIDTH, ext)
        if os.path.exists(out):
            continue
        if DRY:
            made += 1; continue
        buf = io.BytesIO(); small.save(buf, format=fmt, **kw)
        open(out, 'wb').write(buf.getvalue()); made += 1
        print('  + %s  %.0f KB' % (out, buf.tell() / 1024))
print('variants created: %d' % made)

# ---------------------------------------------------------------- rewrite the markup
def lazify(tag):
    if 'loading=' not in tag:
        tag = tag.replace('<img ', '<img loading="lazy" decoding="async" ', 1)
    return tag

changed = 0
for f in sorted(glob.glob('**/*.html', recursive=True) + ['tools/blog/shell/body-top.html']):
    if f.startswith(SKIP_DIRS) or not os.path.exists(f):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if not any('images/%s.' % n in h for n in TILES):
        continue
    orig = h
    for name in TILES:
        small_avif = '/images/%s-%d.avif' % (name, WIDTH)
        small_jpg = '/images/%s-%d.jpg' % (name, WIDTH)
        if not (os.path.exists(small_avif.lstrip('/')) or DRY):
            continue
        h = h.replace('srcset="/images/%s.avif"' % name, 'srcset="%s"' % small_avif)
        h = re.sub(r'<img[^>]*src="/images/%s\.jpg"[^>]*>' % re.escape(name),
                   lambda m: lazify(m.group(0).replace('/images/%s.jpg' % name, small_jpg)), h)
    if h != orig:
        changed += 1
        if not DRY:
            open(f, 'w', encoding='utf-8').write(h)
print('pages rewritten: %d%s' % (changed, ' (dry run)' if DRY else ''))
