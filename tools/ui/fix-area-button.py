#!/usr/bin/env python3
"""Make "Learn more about the area" do something.

The button came from the imported template as a Radix dialog trigger
(aria-haspopup="dialog", aria-controls="radix-…"). That dialog's JavaScript was
never part of this site, so the button had no handler at all: clicking it did
nothing. Reported 21.09.2026.

Replaced with a plain <details> — it works without JavaScript, it is open to
Google, and it holds what a guest actually wants: what is nearby and how far.
Copy lives in tools/ui/area-content.py.

Run from the repo root: python3 tools/ui/fix-area-button.py [--dry]   Idempotent.
"""
import glob, importlib.util, json, os, re, sys

DRY = '--dry' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

spec = importlib.util.spec_from_file_location('area_content', 'tools/ui/area-content.py')
ac = importlib.util.module_from_spec(spec); spec.loader.exec_module(ac)
AREAS = ac.AREAS
AREAS_IT = ac.AREAS_IT

villas = json.load(open('data/villas.json', encoding='utf-8'))
area_of = {}
for v in villas:
    area_of[v['slug']] = v['areaSlug']

CSS = ('<style id="thb-area-css">'
       '.thb-area{margin-top:14px;border:1px solid #e6e3dc;border-radius:16px;background:#fafaf7;overflow:hidden}'
       '.thb-area>summary{list-style:none;cursor:pointer;padding:13px 18px;font-family:Inter,system-ui,sans-serif;'
       'font-size:14.5px;font-weight:600;color:#0a0a0a;display:flex;align-items:center;justify-content:space-between;gap:10px}'
       '.thb-area>summary::-webkit-details-marker{display:none}'
       '.thb-area>summary::after{content:"";width:8px;height:8px;border-right:2px solid #6b6b66;'
       'border-bottom:2px solid #6b6b66;transform:rotate(45deg);transition:transform .2s;flex:0 0 auto;margin-right:4px}'
       '.thb-area[open]>summary::after{transform:rotate(-135deg)}'
       '.thb-area .in{padding:0 18px 18px}'
       '.thb-area p{font-size:14.5px;line-height:1.7;color:#3b3b36;margin:0 0 12px}'
       '.thb-area dl{margin:0 0 12px;font-size:14.5px;line-height:1.6}'
       '.thb-area dt{font-weight:600;color:#0a0a0a;margin-top:10px}'
       '.thb-area dd{margin:2px 0 0;color:#55524b}'
       '.thb-area .lk{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}'
       '.thb-area .lk a{border:1px solid #e6e3dc;background:#fff;border-radius:999px;'
       'padding:8px 14px;font-size:13px;font-weight:500;color:#0a0a0a;text-decoration:none}'
       '</style>')

def block(a, summary):
    items = ''.join('<dt>%s</dt><dd>%s</dd>' % (n, d) for n, d in a['near'])
    links = '<div class="lk"><a href="%s">%s</a><a href="%s">%s</a></div>' % (
        a['link'][0], a['link'][1], a['monthly'][0], a['monthly'][1])
    return ('<details class="thb-area"><summary>%s</summary>'
            '<div class="in"><p>%s</p><dl>%s</dl><p>%s</p>%s</div></details>'
            % (summary, a['lead'], items, a['good'], links))

def btn_re(label):
    return re.compile(r'<button[^>]*aria-haspopup="dialog"[^>]*>(?:(?!</button>).)*?'
                      + re.escape(label) + r'</(?:span|button)>(?:</button>)?', re.S)

EN = btn_re('Learn more about the area')
IT = btn_re('Scopri la zona')

hit, miss = [], []
for f in sorted(glob.glob('villa/**/index.html', recursive=True)
                + glob.glob('it/villa/**/index.html', recursive=True)):
    if '/gallery/' in f:
        continue
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'class="thb-area"' in h:
        continue
    it = f.startswith('it/')
    slug = re.sub(r'^(it/)?villa/', '', f).replace('/index.html', '')
    a = (AREAS_IT if it else AREAS).get(area_of.get(slug, ''))
    if not a:
        miss.append(f); continue
    summary = ('Scopri la zona: ' if it else 'Learn more about ') + a['name']
    new, n = (IT if it else EN).subn(lambda m: block(a, summary), h, count=1)
    if not n:
        miss.append(f); continue
    if 'thb-area-css' not in new:
        new = new.replace('</head>', CSS + '\n</head>', 1)
    if not DRY:
        open(f, 'w', encoding='utf-8').write(new)
    hit.append(f)

print('area block added to %d page(s); skipped %d%s'
      % (len(hit), len(miss), ' (dry run)' if DRY else ''))
for f in miss[:8]:
    print('  skipped:', f)
