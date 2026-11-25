#!/usr/bin/env python3
"""Build the /monthly-rental/ hub and its four area pages.

Why this section exists (SERP checks, 20.09.2026): every page-1 result for "monthly villa rental
bali" is an agency catalogue with a per-month IDR price on every card, and a single-property
operator (bhataravillasanur.com) reaches page 1 for the Sanur query with one dedicated page. The
site already promised "Long stays" in the footer but had no URL behind it, and carried no prices
at all.

Shell: head/header/footer of villa-management/index.html, so pages inherit CSS, nav, GA, consent.
Copy:  tools/monthly/content.py      Rates: data/monthly-rates.json (edit this, then re-run)
Villas: data/villas.json             Reviews: data/villa-reviews-snapshot.json
Run: python3 tools/monthly/build.py   (then python3 tools/update-lastmod.py)
"""
import os, re, json, html, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import AREAS, HUB

SITE = 'https://balivillas.ai'
WA = 'https://wa.me/6285746499697?text='
esc = lambda s: html.escape(str(s), quote=True)

hub_shell = open(os.path.join(ROOT, 'villa-management', 'index.html'), encoding='utf-8').read()
HEAD = re.sub(r'<style id="thb-vm-css">.*?</style>\s*', '',
              hub_shell[:hub_shell.index('<!-- HERO + VIDEO -->')], flags=re.S)
# skip the owner-guides block in the hub tail: this section speaks to guests, not owners
TAIL = hub_shell[hub_shell.index('<!-- thb-guides:end -->') + len('<!-- thb-guides:end -->'):]

villas = json.load(open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
rates = json.load(open(os.path.join(ROOT, 'data', 'monthly-rates.json'), encoding='utf-8'))
try:
    reviews = json.load(open(os.path.join(ROOT, 'data', 'villa-reviews-snapshot.json'), encoding='utf-8'))
except Exception:
    reviews = {}
RV = rates['villas']
CUR = rates.get('currencySymbol', 'IDR')

def money(n):
    """IDR reads with dots on Bali; other currencies with commas."""
    if n is None:
        return None
    n = int(round(float(n)))
    return ('%s %s' % (CUR, '{:,}'.format(n).replace(',', '.'))) if CUR == 'IDR' else '%s%s' % (CUR, '{:,}'.format(n))

def rate_of(vid):
    return (RV.get(vid) or {}).get('priceMonth')

def area_from(area_slug):
    """Lowest published monthly rate in an area, or None while rates are still unset."""
    vals = [rate_of(v['id']) for v in villas if v['areaSlug'] == area_slug]
    vals = [x for x in vals if x]
    return min(vals) if vals else None

EXTRA_CSS = """
<style id="thb-mr-css">
.crumbs{font-size:12.5px;color:#8a877f;padding:18px 0 0}.crumbs a{color:#6b6b66}.crumbs span{margin:0 6px}
.prose{max-width:760px}.prose p{margin:0 0 16px;color:#3b3b36;font-size:16px;line-height:1.7}.prose ul{margin:0 0 18px 20px;color:#3b3b36;font-size:15.5px;line-height:1.65}.prose li{margin:0 0 8px}
.prose h3{font-family:'Lora',Georgia,serif;font-size:21px;font-weight:600;margin:26px 0 10px}
.vcards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.vcard{background:#fff;border:1px solid #e6e3dc;border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
.vcard img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#f2efe8}
.vcard .b{padding:14px 16px;display:flex;flex-direction:column;flex:1}
.vcard b{font-family:'Lora',Georgia,serif;font-size:15.5px;display:block;line-height:1.3}
.vcard span{font-size:12.5px;color:#6b6b66;display:block;margin-top:4px}
.vcard .price{margin-top:auto;padding-top:12px;font-size:15px;color:#0a0a0a;font-weight:600}
.vcard .price i{font-style:normal;font-weight:400;font-size:12.5px;color:#6b6b66}
.vcard .ask{margin-top:auto;padding-top:12px;font-size:13.5px;color:#6b6b66}
.areagrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.areagrid a{background:#fff;border:1px solid #e6e3dc;border-radius:18px;padding:20px 22px;display:block}
.areagrid h3{font-family:'Lora',Georgia,serif;font-size:19px;margin:0 0 6px}
.areagrid p{font-size:13.5px;color:#6b6b66;margin:0}
.areagrid .f{display:block;margin-top:12px;font-size:14.5px;font-weight:600;color:#0a0a0a}
.incl{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.incl div{background:#fff;border:1px solid #e6e3dc;border-radius:18px;padding:20px 24px}
.incl h3{font-family:'Lora',Georgia,serif;font-size:18px;margin:0 0 10px}
.incl ul{margin:0 0 0 18px;font-size:14.5px;line-height:1.7;color:#3b3b36}
.rel{display:flex;flex-wrap:wrap;gap:10px}.rel a{border:1px solid #e6e3dc;background:#fff;border-radius:999px;padding:9px 16px;font-size:13.5px;font-weight:500}
.rv{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.rv article{background:#fff;border:1px solid #e6e3dc;border-radius:16px;padding:18px 20px}.rv .rh{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;color:#6b6b66;margin-bottom:8px}.rv .rh b{color:#0a0a0a;font-size:14px}.rv p{margin:0;font-size:14.5px;line-height:1.65;color:#2a2a26}.rv .st{color:#d9a21b;letter-spacing:1px}
@media(max-width:960px){.vcards{grid-template-columns:repeat(2,1fr)}.areagrid{grid-template-columns:repeat(2,1fr)}.incl{grid-template-columns:1fr}.rv{grid-template-columns:1fr}}
@media(max-width:560px){.vcards{grid-template-columns:1fr}.areagrid{grid-template-columns:1fr}}
/* mobile: logo pill shows only the H */
@media(max-width:720px){.hostpill{font-size:0;width:44px;padding:0;justify-content:center}.hostpill em{display:none}.hostpill b{display:inline-block;font-size:0;letter-spacing:0}.hostpill b::first-letter{font-size:19px;font-weight:700}}
</style>
"""

def head_for(url, title, desc):
    h = HEAD
    h = re.sub(r'<title>.*?</title>', '<title>' + esc(title) + '</title>', h, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="' + esc(desc) + '">', h)
    for tag in ('<link rel="canonical" href="[^"]*">',
                '<link rel="alternate" hreflang="x-default" href="[^"]*">',
                '<link rel="alternate" hreflang="en" href="[^"]*">'):
        rep = tag.split(' href=')[0] + ' href="' + SITE + url + '">'
        h = re.sub(tag, rep, h)
    h = re.sub(r'<link rel="alternate" hreflang="it" href="[^"]*">\n?', '', h)
    h = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="' + esc(title) + '">', h)
    h = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="' + esc(desc) + '">', h)
    h = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="' + SITE + url + '">', h)
    # the shell comes from the owner-facing hub, so its header CTA sells management;
    # on a guest page it has to ask about a stay instead
    h = h.replace('Hi!%20I%20own%20a%20villa%20in%20Bali%20and%20want%20to%20discuss%20management.',
                  'Hi!%20I%20am%20looking%20for%20a%20monthly%20villa%20rental%20in%20Bali.')
    h = h.replace('>List your property', '>Ask about a long stay')
    return h.replace('<style id="thb-fav-css">', EXTRA_CSS + '<style id="thb-fav-css">', 1)

def wa(text):
    return WA + html.escape(text.replace(' ', '%20'))

def hero(kicker, h1, lead, wa_text, second, note):
    return f'''<div class="hero" style="padding-bottom:20px">
  <div class="wrap">
    <p class="kicker">{esc(kicker)}</p>
    <h1>{h1}</h1>
    <p class="lead" style="max-width:62ch">{lead}</p>
    <div class="btn-row">
      <a class="btn-wa" href="{wa(wa_text)}" rel="noopener">Ask about monthly rates</a>
      <a class="btn-dark" href="{second[0]}">{second[1]}</a>
    </div>
    <p class="hero-note">{note}</p>
  </div>
</div>'''

def section(kicker, h2, inner, sid='', tight=True, wide=False):
    st = ' style="padding-top:0"' if tight else ''
    idattr = f' id="{sid}"' if sid else ''
    w = '' if wide else ' style="max-width:820px"'
    return f'<section{st}{idattr}>\n  <div class="wrap"{w}>\n    <p class="kicker">{esc(kicker)}</p>\n    <h2>{h2}</h2>\n{inner}\n  </div>\n</section>\n'

def paras(items):
    out, ul = [], []
    def flush():
        nonlocal ul
        if ul:
            out.append('<ul>' + ''.join('<li>' + p + '</li>' for p in ul) + '</ul>'); ul = []
    for p in items:
        if p.startswith('* '):
            ul.append(p[2:])
        else:
            flush(); out.append('<p>' + p + '</p>')
    flush()
    return '<div class="prose">' + ''.join(out) + '</div>'

def villa_cards(area_slug=None):
    vs = [v for v in villas if (area_slug is None or v['areaSlug'] == area_slug)]
    vs.sort(key=lambda v: (rate_of(v['id']) or 10**12, v['bedrooms']))
    cards = ''
    for v in vs:
        p = money(rate_of(v['id']))
        mm = (RV.get(v['id']) or {}).get('minMonths') or rates.get('minMonths', 1)
        if p:
            foot = f'<span class="price">{esc(p)} <i>/ month</i></span>'
        else:
            foot = '<span class="ask">Monthly rate on request</span>'
        cards += (f'<a class="vcard" href="{esc(v["url"])}">'
                  f'<img src="{esc(v["cardImage"])}" alt="{esc(v["name"])} — monthly rental in {esc(v["area"])}" '
                  f'loading="lazy" decoding="async" width="600" height="450">'
                  f'<div class="b"><b>{esc(v["name"])}</b>'
                  f'<span>{v["bedrooms"]} bedrooms · sleeps {v.get("guests") or v["bedrooms"]*2} · {esc(v["area"])}</span>'
                  f'<span>From {mm} month{"s" if mm > 1 else ""}</span>{foot}</div></a>')
    return f'<div class="vcards">{cards}</div>'

def area_grid(current=None):
    cells = ''
    for a in AREAS:
        if a['slug'] == current:
            continue
        n = len([v for v in villas if v['areaSlug'] == a['area_slug']])
        f = money(area_from(a['area_slug']))
        line = f'<span class="f">From {esc(f)} / month</span>' if f else '<span class="f">Rates on request</span>'
        cells += (f'<a href="/monthly-rental/{a["slug"]}/"><h3>{esc(a["area"])}</h3>'
                  f'<p>{n} private pool villa{"s" if n != 1 else ""} available by the month.</p>{line}</a>')
    return f'<div class="areagrid">{cells}</div>'

def included():
    inc = ''.join('<li>' + esc(x) + '</li>' for x in rates['includes'])
    exc = ''.join('<li>' + esc(x) + '</li>' for x in rates['excludes'])
    return (f'<div class="incl"><div><h3>In the monthly rate</h3><ul>{inc}</ul></div>'
            f'<div><h3>Billed separately</h3><ul>{exc}</ul></div></div>')

def steps():
    return ('<div class="steps">'
            '<div class="step"><h3>Tell us the dates</h3><p>Message us with your dates, how many of you there are and which area you have in mind. We reply the same day with what is genuinely free.</p></div>'
            '<div class="step"><h3>See the villa</h3><p>A viewing if you are in Bali, a video walkthrough on WhatsApp if you are not. Ask anything &mdash; we manage these villas, so we know the answers.</p></div>'
            '<div class="step"><h3>Agreement and deposit</h3><p>A short written agreement with the rate, what is included, the electricity arrangement and a refundable security deposit. No agency commission.</p></div>'
            '<div class="step"><h3>Move in</h3><p>We meet you at the villa, hand over, and stay reachable for the whole stay. Housekeeping and pool care run on schedule from day one.</p></div>'
            '</div>')

def stars(n):
    f = int(round(n))
    return '<span class="st">' + '★' * f + '<span style="color:#d9d4c9">' + '★' * (5 - f) + '</span></span>'

CH = {'airbnb': 'Airbnb', 'booking.com': 'Booking.com', 'booking': 'Booking.com', 'agoda': 'Agoda',
      'expedia': 'Expedia', 'vrbo': 'Vrbo', 'hostex_direct': 'direct booking'}

def review_cards(area_slug=None, limit=6):
    pool = []
    for vid, rec in reviews.items():
        r = rec.get('reviews')
        if not r or (area_slug and rec.get('areaSlug') != area_slug):
            continue
        for x in r['shown']:
            if x.get('text'):
                pool.append((x['date'], rec, x))
    pool.sort(key=lambda t: t[0], reverse=True)
    cards = ''
    for d, rec, x in pool[:limit]:
        ch = CH.get(str(x.get('channel', '')).lower(), x.get('channel') or 'booking')
        cards += (f'<article><div class="rh"><b>Guest via {esc(ch)}</b>'
                  f'<span>{stars(x["score"])} {esc(d)}</span></div><p>{esc(x["text"][:420])}'
                  f'{"…" if len(x["text"]) > 420 else ""}</p>'
                  f'<div class="rh" style="margin:10px 0 0"><span><a href="{esc(rec["url"])}">{esc(rec["name"])}</a></span></div></article>')
    if not cards:
        return ''
    return (f'<div class="rv">{cards}</div><p class="cases-note">Verified stays, synced from our booking '
            'system. These are guests of the same villas we rent by the month.</p>')

def faq_block(faq):
    items = ''.join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q, a in faq)
    ld = {"@context": "https://schema.org", "@type": "FAQPage",
          "mainEntity": [{"@type": "Question", "name": q,
                          "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a)}} for q, a in faq]}
    return items, '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>'

def breadcrumb(items):
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u}
                              for i, (n, u) in enumerate(items)]}
    return '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>'

def itemlist_ld(url, name, area_slug=None):
    vs = [v for v in villas if (area_slug is None or v['areaSlug'] == area_slug)]
    els = []
    for i, v in enumerate(vs):
        p = rate_of(v['id'])
        item = {"@type": "Accommodation", "name": v['name'], "url": SITE + v['url'],
                "numberOfBedrooms": v['bedrooms'],
                "address": {"@type": "PostalAddress", "addressLocality": v['area'], "addressRegion": "Bali",
                            "addressCountry": "ID"}}
        if p:
            item["potentialAction"] = {"@type": "RentAction"}
            item["offers"] = {"@type": "Offer", "price": int(p), "priceCurrency": rates.get('currency', 'IDR'),
                              "availability": "https://schema.org/InStock",
                              "eligibleDuration": {"@type": "QuantitativeValue", "value": 1, "unitCode": "MON"}}
        els.append({"@type": "ListItem", "position": i + 1, "item": item})
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": name, "url": SITE + url,
          "numberOfItems": len(els), "itemListElement": els}
    return '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>'

def final_cta(text, area=''):
    where = f' in {esc(area)}' if area else ''
    return (f'<div class="final"><p class="kicker k">Long stays</p>'
            f'<h2 style="margin-bottom:10px">Tell us your dates.</h2>'
            f'<p style="color:#6b6b66;max-width:52ch;margin:0 auto 26px">Send the dates and how many of you there are, '
            f'and we will come back the same day with what is free{where} and what it costs.</p>'
            f'<a class="btn-dark" href="{wa(text)}" rel="noopener">Message us on WhatsApp</a>&nbsp; '
            f'<a class="btn-dark" style="background:#fff;color:#0a0a0a;border:1px solid #d9d4c9" href="/property-rental/">All villas</a></div>')

def write(url, content):
    path = os.path.join(ROOT, url.strip('/'), 'index.html')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(content)

built = []

# ------------------------------------------------------------------ area pages
for a in AREAS:
    url = f"/monthly-rental/{a['slug']}/"
    n = len([v for v in villas if v['areaSlug'] == a['area_slug']])
    f = money(area_from(a['area_slug']))
    note = (f'{n} villa{"s" if n != 1 else ""} in {a["area"]} · from one month · '
            + (f'from {f} / month' if f else 'rates on request') +
            ' · housekeeping and pool care included')
    body = (f'<div class="wrap crumbs"><a href="/">Home</a><span>/</span>'
            f'<a href="/monthly-rental/">Monthly rentals</a><span>/</span>{esc(a["area"])}</div>')
    body += hero(a['kicker'], a['h1'], a['lead'],
                 f"Hi! I am looking for a monthly villa rental in {a['area']}.",
                 ('#villas', 'See the villas'), note)
    body += section('Available by the month',
                    f'Our private pool villas <span class="serif" style="font-style:italic">in {esc(a["area"])}</span>',
                    villa_cards(a['area_slug']), 'villas', tight=False, wide=True)
    body += section('What is in the rate', 'What a monthly rate covers', included(), 'included', wide=True)
    inner = paras(a['market']) + ('<div class="prose"><h3>Which villas work best for a long stay in '
                                  + esc(a['area']) + '</h3><ul>'
                                  + ''.join('<li>' + b + '</li>' for b in a['best']) + '</ul></div>')
    body += section('The area, honestly', f'Living in {esc(a["area"])} <span class="serif" style="font-style:italic">for a month or more</span>', inner, 'area')
    body += section('How it works', 'From first message <span class="serif" style="font-style:italic">to moving in</span>', steps(), 'how', wide=True)
    rv = review_cards(a['area_slug'])
    if rv:
        body += section('Guest reviews', f'What guests say about our {esc(a["area"])} villas', rv, 'reviews', wide=True)
    fq, fq_ld = faq_block(a['faq'])
    body += section('Questions', f'Monthly rentals in {esc(a["area"])}: <span class="serif" style="font-style:italic">your questions</span>', f'<div class="faq">{fq}</div>', 'faq')
    body += section('Other areas', 'Monthly rentals <span class="serif" style="font-style:italic">elsewhere in Bali</span>',
                    area_grid(a['slug']) + '<div class="rel" style="margin-top:16px">'
                    '<a href="/monthly-rental/">All monthly rentals</a>'
                    f'<a href="/villas/{a["area_slug"]}/">Nightly stays in {esc(a["area"])}</a>'
                    '<a href="/villa-management/">Own a villa? Villa management</a></div>', 'areas', wide=True)
    body += f'<section style="padding-top:0"><div class="wrap">{final_cta("Hi! I am looking for a monthly villa rental in " + a["area"] + ".", a["area"])}</div></section>'
    ld = fq_ld + breadcrumb([('Home', '/'), ('Monthly rentals', '/monthly-rental/'), (a['area'], url)]) \
         + itemlist_ld(url, f'Monthly villa rentals in {a["area"]}, Bali', a['area_slug'])
    write(url, head_for(url, a['title'], a['desc']) + body + ld + TAIL)
    built.append(url)

# ------------------------------------------------------------------ hub
url = '/monthly-rental/'
f = money(min([x for x in (area_from(a['area_slug']) for a in AREAS) if x], default=None) or 0) \
    if any(area_from(a['area_slug']) for a in AREAS) else None
note = ('20 villas · four areas · from one month · '
        + (f'from {f} / month' if f else 'rates on request')
        + ' · no agency fee')
body = '<div class="wrap crumbs"><a href="/">Home</a><span>/</span>Monthly rentals</div>'
body += hero(HUB['kicker'], HUB['h1'], HUB['lead'],
             'Hi! I am looking for a monthly villa rental in Bali.',
             ('#areas', 'Choose an area'), note)
body += section('Where we rent by the month', 'Four areas, <span class="serif" style="font-style:italic">twenty villas</span>',
                area_grid(), 'areas', tight=False, wide=True)
body += section('What this is', 'Monthly, not nightly &mdash; and not a yearly lease', paras(HUB['intro']), 'what')
body += section('What is in the rate', 'What a monthly rate covers', included(), 'included', wide=True)
body += section('Every villa', 'All twenty villas, <span class="serif" style="font-style:italic">by the month</span>',
                villa_cards(None), 'villas', wide=True)
body += section('How it works', 'From first message <span class="serif" style="font-style:italic">to moving in</span>', steps(), 'how', wide=True)
rv = review_cards()
if rv:
    body += section('Guest reviews', 'What guests say <span class="serif" style="font-style:italic">about these villas</span>', rv, 'reviews', wide=True)
fq, fq_ld = faq_block(HUB['faq'])
body += section('Questions', 'Renting a villa in Bali by the month: <span class="serif" style="font-style:italic">your questions</span>', f'<div class="faq">{fq}</div>', 'faq')
body += f'<section style="padding-top:0"><div class="wrap">{final_cta("Hi! I am looking for a monthly villa rental in Bali.")}</div></section>'
ld = fq_ld + breadcrumb([('Home', '/'), ('Monthly rentals', url)]) + itemlist_ld(url, 'Monthly villa rentals in Bali')
write(url, head_for(url, HUB['title'], HUB['desc']) + body + ld + TAIL)
built.append(url)

print('built %d pages:' % len(built))
for u in built:
    print('  ', u, '%.0f KB' % (os.path.getsize(os.path.join(ROOT, u.strip('/'), 'index.html')) / 1024))
priced = len([v for v in villas if rate_of(v['id'])])
print('rates set: %d of %d villas (edit data/monthly-rates.json)' % (priced, len(villas)))
