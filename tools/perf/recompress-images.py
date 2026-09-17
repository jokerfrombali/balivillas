"""Recompress oversized JPEG/WebP villa photos in place (same path, same pixel size).

Why: Lighthouse on 18.09.2026 showed 'Improve image delivery' savings of 5.3 MB on the
home page and ~0.8 MB on area pages; 1200px photos weighed 0.4–1.0 MB because they were
saved at very high JPEG quality. Same file names, so no HTML changes.

Usage: python3 tools/perf/recompress-images.py [--dry]
Skips files already under the threshold. Never upscales, never crops.
"""
import glob, os, sys, io
from PIL import Image, ImageOps

DRY = '--dry' in sys.argv
THRESHOLD = 180_000          # bytes; below this we leave the file alone
QUALITY = 78
MAX_W = 1600
GLOBS = ['public-objects/images/*.jpg', 'public-objects/images/*.jpeg', 'images/*.jpg',
         'images/**/*.jpg', 'villa/assets/images/*.webp', 'villa/assets/images/*.jpg']

total_before = total_after = n = 0
for g in GLOBS:
    for f in sorted(glob.glob(g, recursive=True)):
        before = os.path.getsize(f)
        if before < THRESHOLD:
            continue
        im = Image.open(f)
        im = ImageOps.exif_transpose(im)
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        ext = f.rsplit('.', 1)[1].lower()
        if ext == 'webp':
            im.save(buf, 'WEBP', quality=QUALITY, method=6)
        else:
            im = im.convert('RGB')
            im.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        after = buf.tell()
        if after < before * 0.85:
            if not DRY:
                open(f, 'wb').write(buf.getvalue())
            n += 1; total_before += before; total_after += after
            print(f'{before/1e3:7.0f} -> {after/1e3:6.0f} KB  {f}')
print(f'files: {n}, {total_before/1e6:.1f} MB -> {total_after/1e6:.1f} MB', '(dry run)' if DRY else '')
