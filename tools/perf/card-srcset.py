"""Make 640px variants of villa photos used in catalogue cards and add srcset/sizes to those <img>.
Why: cards render at ~350–450 CSS px but loaded the 1200px file (Lighthouse 18.09.2026: 20 images ×
200–320 KB on the home page). Villa detail pages / galleries are NOT touched (they need full size).
Run: python3 tools/perf/card-srcset.py
"""
import re,os,glob
from PIL import Image,ImageOps
PAGES=['index.html','property-rental/index.html','villas/index.html']+glob.glob('villas/*/index.html')+['villas-for-sale/index.html']+glob.glob('villas-for-sale/*/index.html')+glob.glob('it/villas/*/index.html')+['it/index.html','it/property-rental/index.html','it/villas/index.html','it/villas-for-sale/index.html']+glob.glob('it/villas-for-sale/*/index.html')
made=0;patched=0
def variant(src):
    global made
    p=src.lstrip('/'); base,ext=os.path.splitext(p); out=f'{base}-640{ext}'
    if not os.path.exists(p): return None
    if not os.path.exists(out):
        im=ImageOps.exif_transpose(Image.open(p)).convert('RGB')
        if im.width<=700: return None
        im=im.resize((640,round(im.height*640/im.width)),Image.LANCZOS); im.save(out,'JPEG',quality=76,optimize=True,progressive=True); made+=1
    return '/'+out
for f in PAGES:
    if not os.path.exists(f): continue
    h=open(f,encoding='utf-8').read()
    def fix(m):
        global patched
        tag=m.group(0)
        if 'srcset=' in tag: return tag
        src=re.search(r'src="(/public-objects/images/[^"]+\.jpe?g)"',tag)
        if not src: return tag
        v=variant(src.group(1))
        if not v: return tag
        patched+=1
        return tag.replace(src.group(0),src.group(0)+f' srcset="{v} 640w, {src.group(1)} 1200w" sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 420px"')
    h2=re.sub(r'<img[^>]*>',fix,h)
    if h2!=h: open(f,'w',encoding='utf-8').write(h2)
print('variants made',made,'img patched',patched)
