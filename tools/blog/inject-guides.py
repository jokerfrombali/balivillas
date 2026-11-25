#!/usr/bin/env python3
"""Insert/refresh a "Guides" link block on the commercial pages, so the 500 guides are reachable
from the money pages (and vice versa). Block is delimited by <!-- thb-guides:begin/end --> and
placed just before the footer CSS. Picks priority-1 articles whose commercial_target is the page.
Run after tools/blog/build.py.  python3 tools/blog/inject-guides.py
"""
import os,re,glob,sys,html
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import build as B
ROOT=B.ROOT
arts=[B.parse(f) for f in sorted(glob.glob(os.path.join(B.SRC,'*','*.md'))) if not os.path.basename(f).startswith('_')]
PAGES={'index.html':('/property-rental/','Guides from the team that runs the villas','/blog/'),
 'property-rental/index.html':('/property-rental/','Before you book: guides for villa guests','/blog/renting/'),
 'villas/index.html':('/villas/','Choosing an area: our guides','/blog/areas/'),
 'villas/sanur/index.html':('/villas/sanur/','Sanur guides','/blog/areas/'),
 'villas/canggu/index.html':('/villas/canggu/','Canggu guides','/blog/areas/'),
 'villas/umalas/index.html':('/villas/umalas/','Umalas guides','/blog/areas/'),
 'villas/ungasan/index.html':('/villas/ungasan/','Ungasan guides','/blog/areas/'),
 'villas-for-sale/index.html':('/villas-for-sale/','Buying a villa in Bali: read first','/blog/buying/'),
 'villas-for-sale/sanur/index.html':('/villas-for-sale/sanur/','Buying in Sanur: guides','/blog/buying/'),
 'villas-for-sale/umalas/index.html':('/villas-for-sale/umalas/','Buying in Umalas: guides','/blog/buying/'),
 'villas-for-sale/canggu/index.html':('/villas-for-sale/canggu/','Buying in Canggu: guides','/blog/buying/'),
 'villas-for-sale/ungasan/index.html':('/villas-for-sale/ungasan/','Buying in Ungasan: guides','/blog/buying/'),
 'villa-management/index.html':('/villa-management/','Owner guides: fees, contracts, occupancy','/blog/owners/'),
 'about/index.html':('/contacts/','What we write about','/blog/'),
 'contacts/index.html':('/contacts/','Answers before you message','/blog/')}
CSS='<style id="thb-guides-css">.thb-guides{max-width:1320px;margin:0 auto;padding:0 40px 56px}.thb-guides h2{font-family:Lora,Georgia,serif;font-size:28px;font-weight:700;margin:0 0 6px}.thb-guides p.l{font-size:14px;color:#6b6b66;margin:0 0 18px}.thb-guides ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.thb-guides li a{display:block;background:#fff;border:1px solid #e6e3dc;border-radius:16px;padding:16px 18px;color:#0a0a0a;text-decoration:none;font-size:15px;line-height:1.4;font-weight:600}.thb-guides li a:hover{border-color:#0a0a0a}.thb-guides li a span{display:block;font-size:12.5px;color:#6b6b66;font-weight:400;margin-top:4px}.thb-guides .all{display:inline-block;margin-top:16px;font-size:14px;font-weight:600;color:#0a0a0a}@media(max-width:900px){.thb-guides ul{grid-template-columns:1fr 1fr}}@media(max-width:600px){.thb-guides{padding:0 20px 40px}.thb-guides ul{grid-template-columns:1fr}}</style>'
def pick(target,n=6):
    c=[a for a in arts if a.get('commercial_target')==target]
    if len(c)<n and target.startswith('/villas-for-sale/'): c+=[a for a in arts if a.get('commercial_target')=='/villas-for-sale/' and a not in c]
    if len(c)<n and target.startswith('/villas/'): c+=[a for a in arts if a['hub']=='areas' and a not in c]
    if len(c)<n: c+=[a for a in arts if a['hub']=='renting' and a not in c]
    c.sort(key=lambda a:(a.get('priority','2'),a['h1']))
    return c[:n]
done=0
for f,(target,title,hub) in PAGES.items():
    p=os.path.join(ROOT,f)
    if not os.path.exists(p): continue
    h=open(p,encoding='utf-8').read()
    items=''.join(f'<li><a href="{a["url"]}">{html.escape(a["h1"])}<span>{html.escape(a["description"][:90])}…</span></a></li>' for a in pick(target))
    block=f'<!-- thb-guides:begin -->{CSS}<section class="thb-guides" aria-label="Guides"><h2>{html.escape(title)}</h2><p class="l">Written by BaliVillas team, who manage the villas on this site.</p><ul>{items}</ul><a class="all" href="{hub}">All guides →</a></section><!-- thb-guides:end -->'
    if '<!-- thb-guides:begin -->' in h:
        h=re.sub(r'<!-- thb-guides:begin -->.*?<!-- thb-guides:end -->',lambda m:block,h,flags=re.S)
    else:
        anchor=h.find('<style id="thb-footer-css">')
        if anchor<0: anchor=h.find('<!-- =============== FOOTER')
        if anchor<0: anchor=h.find('<footer')
        if anchor<0: print('no anchor',f); continue
        h=h[:anchor]+block+'\n'+h[anchor:]
    open(p,'w',encoding='utf-8').write(h); done+=1
print('guides block on',done,'pages')
