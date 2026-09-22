#!/usr/bin/env python3
"""Make villa card photos load at the size they are actually displayed.

Problem found by PageSpeed Insights on 20.09.2026 (mobile home page, performance 64, LCP 15,5 s):
card photos were served as the 1200 px JPEG into a 300 px box. The card is
`.thb-acw{flex:0 0 76vw;max-width:300px}` / `flex:0 0 300px` above 640 px, so it is never wider
than 300 CSS px, but `sizes="(max-width: 640px) 92vw, ..."` claimed ~379 px, which at DPR 1.75
asks for 663 px and makes the browser pick the 1200 w file. Twenty photos x ~300 KB = 4.9 MB.

This script:
  1. builds the missing 640/960 px JPEG and AVIF variants of every card photo;
  2. rewrites every card <img> into <picture> with an AVIF source and a `sizes` that matches
     the layout the card is actually in (carousel = 300 px, area grid = 1/2/4 columns).

Run from the repo root:  python3 tools/perf/fix-card-images.py [--dry]
Idempotent: a card that already sits inside <picture> is skipped.
"""
import glob, io, os, re, sys

DRY = '--dry' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
OLD_SIZES = '(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 420px'
AVIF_QUALITY = 55            # visually indistinguishable from the 78-quality JPEG at this size
WIDTHS = (640, 960)          # 960 is the step the 1-column mobile grid on area pages needs

# The same card component is used in two layouts, so one `sizes` cannot fit both:
#   A. home / carousel  -> .thb-acw is capped at 300 CSS px in every breakpoint
#   B. area listing grid -> #cardGrid is 4 cols, 2 cols under 1024 px, 1 col under 640 px
SIZES_CAROUSEL = '300px'
SIZES_GRID = '(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 300px'
SKIP_DIRS = ('saved/', 'it/saved/', 'tools/', 'node_modules/', 'worker/')

# ---------------------------------------------------------------- collect card images
card_imgs = set()
pages = []
for f in sorted(glob.glob('**/*.html', recursive=True)):
    if f.startswith(SKIP_DIRS):
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if OLD_SIZES not in h:
        continue
    pages.append(f)
    for tag in re.findall(r'<img[^>]*>', h):
        if OLD_SIZES not in tag:
            continue
        m = re.search(r'src="([^"]+\.jpg)"', tag)
        if m:
            card_imgs.add(m.group(1))
print('pages: %d, unique card photos: %d' % (len(pages), len(card_imgs)))

# ---------------------------------------------------------------- generate -640.avif
made = skipped = 0
if card_imgs:
    from PIL import Image, ImageOps
    for src in sorted(card_imgs):
        full = src.lstrip('/')
        if not os.path.exists(full):
            print('  ! missing', src); continue
        base = ImageOps.exif_transpose(Image.open(full)).convert('RGB')
        for w in WIDTHS:
            for ext, fmt, kw in (('jpg', 'JPEG', dict(quality=78, optimize=True, progressive=True)),
                                 ('avif', 'AVIF', dict(quality=AVIF_QUALITY))):
                out = re.sub(r'\.jpg$', '-%d.%s' % (w, ext), src).lstrip('/')
                if os.path.exists(out):
                    skipped += 1; continue
                if DRY:
                    made += 1; continue
                if base.width <= w and ext == 'jpg':
                    skipped += 1; continue          # never upscale the JPEG step
                im = base if base.width <= w else base.resize(
                    (w, round(base.height * w / base.width)), Image.LANCZOS)
                buf = io.BytesIO(); im.save(buf, format=fmt, **kw)
                if buf.tell() < os.path.getsize(full):
                    open(out, 'wb').write(buf.getvalue()); made += 1
                else:
                    print('  = not smaller, skipped', out)
print('variants created: %d (already there: %d)' % (made, skipped))

# ---------------------------------------------------------------- rewrite markup
def srcset_for(base_jpg, ext):
    """Responsive srcset for a card photo in one format, using only files that exist."""
    have = []
    for w in WIDTHS:
        p = re.sub(r'\.jpg$', '-%d.%s' % (w, ext), base_jpg)
        if os.path.exists(p.lstrip('/')):
            have.append('%s %dw' % (p, w))
    full = base_jpg if ext == 'jpg' else re.sub(r'\.jpg$', '.avif', base_jpg)
    if os.path.exists(full.lstrip('/')):
        have.append('%s 1200w' % full)
    return ', '.join(have)

def fixed_img(tag, sizes):
    base = re.search(r'src="([^"]+\.jpg)"', tag)
    out = tag.replace('sizes="%s"' % OLD_SIZES, 'sizes="%s"' % sizes)
    if base:
        ss = srcset_for(base.group(1), 'jpg')
        if ss:
            out = re.sub(r'srcset="[^"]*"', 'srcset="%s"' % ss, out)
    return out

# Shape A: a bare card <img> (home carousel) -> wrap in <picture>, sizes = 300px.
# Shape B: <picture><source srcset="one-full-size.avif"><img ...> (area grid) -> that source has no
#          widths, so it always served the 1200 px AVIF; give it the grid srcset + sizes.
IMG_RE = r'<img[^>]*sizes="%s"[^>]*>' % re.escape(OLD_SIZES)
SRC_RE = r'<source[^>]*type="image/avif"[^>]*>'
PIC_RE = r'<picture>\s*(%s)\s*(%s)' % (SRC_RE, IMG_RE)

changed = imgs_a = imgs_b = 0
for f in pages:
    h = open(f, encoding='utf-8').read()
    orig = h

    def fix_pair(m):
        global imgs_b
        source, img = m.group(1), m.group(2)
        base = re.search(r'src="([^"]+\.jpg)"', img)
        ss = srcset_for(base.group(1), 'avif') if base else ''
        if ss:
            source = '<source type="image/avif" sizes="%s" srcset="%s">' % (SIZES_GRID, ss)
        imgs_b += 1
        return '<picture>%s%s' % (source, fixed_img(img, SIZES_GRID))

    h = re.sub(PIC_RE, fix_pair, h)

    def wrap_bare(m):
        global imgs_a
        tag = m.group(0)
        before = h[:m.start()]
        if before.rfind('<picture') > before.rfind('</picture>'):
            return tag            # already handled above
        base = re.search(r'src="([^"]+\.jpg)"', tag)
        ss = srcset_for(base.group(1), 'avif') if base else ''
        imgs_a += 1
        if not ss:
            return fixed_img(tag, SIZES_CAROUSEL)
        return ('<picture><source type="image/avif" sizes="%s" srcset="%s">%s</picture>'
                % (SIZES_CAROUSEL, ss, fixed_img(tag, SIZES_CAROUSEL)))

    h = re.sub(IMG_RE, wrap_bare, h)
    if h != orig:
        changed += 1
        if not DRY:
            open(f, 'w', encoding='utf-8').write(h)
print('pages rewritten: %d (bare imgs wrapped: %d, existing <picture> upgraded: %d)%s'
      % (changed, imgs_a, imgs_b, ' (dry run)' if DRY else ''))
