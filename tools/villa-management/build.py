#!/usr/bin/env python3
"""Build /villa-management/<slug>/ landing pages and refresh the hub.

Shell: the head, header and footer of villa-management/index.html (the live hub) are reused verbatim, so
every landing page inherits the hub's CSS, nav, consent, GA and bot scripts.
Data: tools/villa-management/content_geo.py, content_pages.py (copy), data/villas.json (villa cards),
data/villa-reviews-snapshot.json (guest reviews pulled from /api/reviews on 2026-09-19).
Run: python3 tools/villa-management/build.py   (then python3 tools/update-lastmod.py before committing)
"""
import os, re, json, html, datetime, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content_geo import GEO
from content_pages import PAGES
SITE = 'https://balivillas.ai'
TODAY = datetime.date.today().isoformat()
COMMISSION = '20%'
WA = 'https://wa.me/6285746499697?text='
HUB = os.path.join(ROOT, 'villa-management', 'index.html')
hub = open(HUB, encoding='utf-8').read()
head_end = hub.index('<!-- HERO + VIDEO -->')
tail_start = hub.index('<!-- thb-guides:begin -->')
HEAD = re.sub(r'<style id="thb-vm-css">.*?</style>\s*', '', hub[:head_end], flags=re.S)
TAIL = hub[tail_start:]
villas = json.load(open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
reviews = json.load(open(os.path.join(ROOT, 'data', 'villa-reviews-snapshot.json'), encoding='utf-8'))
esc = lambda s: html.escape(str(s), quote=True)
CH = {'airbnb': 'Airbnb', 'booking.com': 'Booking.com', 'booking': 'Booking.com', 'agoda': 'Agoda', 'expedia': 'Expedia', 'vrbo': 'Vrbo', 'hostex_direct': 'direct booking'}

EXTRA_CSS = """
<style id="thb-vm-css">
.crumbs{font-size:12.5px;color:#8a877f;padding:18px 0 0}.crumbs a{color:#6b6b66}.crumbs span{margin:0 6px}
.prose{max-width:760px}.prose p{margin:0 0 16px;color:#3b3b36;font-size:16px;line-height:1.7}.prose ul{margin:0 0 18px 20px;color:#3b3b36;font-size:15.5px;line-height:1.65}.prose li{margin:0 0 8px}
.prose h3{font-family:'Lora',Georgia,serif;font-size:21px;font-weight:600;margin:26px 0 10px}
.vcards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.vcard{background:#fff;border:1px solid #e6e3dc;border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
.vcard img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#f2efe8}.vcard div{padding:14px 16px}.vcard b{font-family:'Lora',Georgia,serif;font-size:15.5px;display:block;line-height:1.3}.vcard span{font-size:12.5px;color:#6b6b66;display:block;margin-top:4px}
.rv{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.rv article{background:#fff;border:1px solid #e6e3dc;border-radius:16px;padding:18px 20px}.rv .rh{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;color:#6b6b66;margin-bottom:8px}.rv .rh b{color:#0a0a0a;font-size:14px}.rv p{margin:0;font-size:14.5px;line-height:1.65;color:#2a2a26}.rv .st{color:#d9a21b;letter-spacing:1px}
.rel{display:flex;flex-wrap:wrap;gap:10px}.rel a{border:1px solid #e6e3dc;background:#fff;border-radius:999px;padding:9px 16px;font-size:13.5px;font-weight:500}
.feebox{background:#fff;border:1px solid #e6e3dc;border-radius:20px;padding:22px 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.feebox b{font-family:'Lora',Georgia,serif;font-size:30px;display:block}.feebox span{font-size:13px;color:#6b6b66}
.calc{background:#fff;border:1px solid #e6e3dc;border-radius:20px;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px}.calc label{display:block;font-size:12.5px;color:#6b6b66;margin:0 0 4px}.calc input,.calc select{width:100%;border:1px solid #d9d4c9;border-radius:12px;padding:11px 12px;font-size:15px;margin-bottom:14px;background:#fafaf7}.calc .out{background:#f4f2ed;border-radius:16px;padding:20px}.calc .out b{font-family:'Lora',Georgia,serif;font-size:26px;display:block}.calc .out p{font-size:13.5px;color:#55524b;margin:6px 0 12px}
@media(max-width:960px){.vcards{grid-template-columns:repeat(2,1fr)}.rv{grid-template-columns:1fr}.feebox{grid-template-columns:1fr}.calc{grid-template-columns:1fr}}
@media(max-width:560px){.vcards{grid-template-columns:1fr}}
/* mobile: logo pill shows only the H */
@media(max-width:720px){.hostpill{font-size:0;width:44px;padding:0;justify-content:center}.hostpill em{display:none}.hostpill b{display:inline-block;font-size:0;letter-spacing:0}.hostpill b::first-letter{font-size:19px;font-weight:700}}
</style>
"""

def head_for(url, title, desc):
    h = HEAD
    h = re.sub(r'<title>.*?</title>', '<title>' + esc(title) + '</title>', h, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="' + esc(desc) + '">', h)
    h = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="' + SITE + url + '">', h)
    h = re.sub(r'<link rel="alternate" hreflang="x-default" href="[^"]*">', '<link rel="alternate" hreflang="x-default" href="' + SITE + url + '">', h)
    h = re.sub(r'<link rel="alternate" hreflang="en" href="[^"]*">', '<link rel="alternate" hreflang="en" href="' + SITE + url + '">', h)
    h = re.sub(r'<link rel="alternate" hreflang="it" href="[^"]*">\n?', '', h)
    h = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="' + esc(title) + '">', h)
    h = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="' + esc(desc) + '">', h)
    h = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="' + SITE + url + '">', h)
    h = h.replace('<style id="thb-fav-css">', EXTRA_CSS + '<style id="thb-fav-css">', 1)
    return h

def stars(n):
    full = int(round(n)); return '<span class="st">' + '★' * full + '<span style="color:#d9d4c9">' + '★' * (5 - full) + '</span></span>'

def wa(text): return WA + html.escape(text.replace(' ', '%20'))

def hero(kicker, h1, lead, wa_text, second=('#more', 'What you get')):
    return f'''<div class="hero" style="padding-bottom:20px">
  <div class="wrap">
    <p class="kicker">{esc(kicker)}</p>
    <h1>{h1}</h1>
    <p class="lead" style="max-width:62ch">{lead}</p>
    <div class="btn-row">
      <a class="btn-wa" href="{wa(wa_text)}" rel="noopener">Talk to us on WhatsApp</a>
      <a class="btn-dark" href="{second[0]}">{second[1]}</a>
    </div>
    <p class="hero-note">Free villa assessment &middot; {COMMISSION} commission on actual revenue, nothing fixed &middot; reply within hours</p>
  </div>
</div>'''

def crumbs(name):
    return f'<div class="wrap crumbs"><a href="/">Home</a><span>/</span><a href="/villa-management/">Villa management</a><span>/</span>{esc(name)}</div>'

def section(kicker, h2, inner, sid='', tight=True, wide=False):
    st = ' style="padding-top:0"' if tight else ''
    idattr = f' id="{sid}"' if sid else ''
    w = '' if wide else ' style="max-width:820px"'
    return f'<section{st}{idattr}>\n  <div class="wrap"{w}>\n    <p class="kicker">{esc(kicker)}</p>\n    <h2>{h2}</h2>\n{inner}\n  </div>\n</section>\n'

def paras(items):
    out = []; ul = []
    def flush():
        nonlocal ul
        if ul: out.append('<ul>' + ''.join('<li>' + p + '</li>' for p in ul) + '</ul>'); ul = []
    for p in items:
        if p.startswith('* '): ul.append(p[2:])
        else: flush(); out.append('<p>' + p + '</p>')
    flush(); return '<div class="prose">' + ''.join(out) + '</div>'

SERVICES = [('airbnb-management', 'Airbnb management', 'Listings, pricing, guests and turnovers on Airbnb and every other channel.'),
            ('holiday-rental-management', 'Holiday rental management', 'Nightly and weekly stays across Airbnb, Booking.com, Agoda and direct.'),
            ('long-term-rental-management', 'Long-term rentals', 'Monthly and yearly tenants: screening, contracts, deposits, rent.'),
            ('dynamic-pricing-and-revenue-management', 'Pricing & revenue', 'Seasonal rates, minimum stays, gap nights, reviewed weekly.'),
            ('housekeeping-and-cleaning', 'Housekeeping', 'Turnover cleaning to a checklist, linen, amenities, photo checks.'),
            ('maintenance-and-pool-care', 'Maintenance & pool', 'Weekly pool care, AC, garden, wet-season checks, approved repairs.'),
            ('guest-services-and-concierge', 'Guest care & concierge', 'A 24/7 line for guests; owners never take the call.'),
            ('owner-reporting-and-payouts', 'Reports & payouts', 'One monthly statement with every booking, receipt and the payout.')]

def services_grid(exclude=''):
    cards = ''.join(f'<a class="svc-card" href="/villa-management/{s}/" style="display:block"><h3>{esc(n)}</h3><p>{esc(d)}</p></a>' for s, n, d in SERVICES if s != exclude)
    return f'<div class="svc" style="margin-top:8px">{cards}</div>'

def fee_band():
    return f'''<section style="padding-top:0"><div class="wrap"><div class="band">
  <div><p class="kicker" style="color:#C1B59D">Owner-first terms</p><h2>{COMMISSION} of actual revenue.<br>Nothing fixed.</h2>
  <p style="margin-top:12px">We earn only when you earn: a single {COMMISSION} commission on the bookings your villa actually makes. No monthly fee, no onboarding fee, no markup on repairs.</p>
  <a class="btn-dark" style="margin-top:22px;background:#fff;color:#0a0a0a" href="/villa-management/pricing/">See what the {COMMISSION} covers</a></div>
  <ul><li>{COMMISSION} on real revenue, nightly and monthly alike</li><li>Expenses pre-approved and shown with receipts</li><li>Your villa, your rules: owner stays, house limits, floor price</li><li>Direct-booking site cuts platform fees on part of bookings</li><li>Clear exit terms: leave if we do not deliver</li></ul>
</div></div></section>'''

def villa_cards(area_slug, near=None, area_name=''):
    vs = [v for v in villas if v['areaSlug'] == area_slug] if area_slug else []
    note = ''
    if not vs and near:
        vs = [v for v in villas if v['areaSlug'] == near][:4]
        note = f'<p class="sec-sub">No villa of ours is live in {esc(area_name)} yet; these are the nearest homes we run, in {esc(near.capitalize())}, served by the same team.</p>'
    cards = ''
    for v in vs:
        r = reviews.get(v['id'], {}).get('reviews')
        rt = f"{stars(r['ratingValue'])} {r['ratingValue']} · {r['reviewCount']} reviews" if r else 'New on the site'
        cards += f'<a class="vcard" href="{esc(v["url"])}"><img src="{esc(v["cardImage"])}" alt="{esc(v["name"])}" loading="lazy" decoding="async" width="600" height="450"><div><b>{esc(v["name"])}</b><span>{v["bedrooms"]} bedrooms · {esc(v["area"])}</span><span>{rt}</span></div></a>'
    return note + f'<div class="vcards">{cards}</div>'

def review_cards(area_slug=None, near=None, limit=6):
    pool = []
    for vid, rec in reviews.items():
        r = rec.get('reviews')
        if not r: continue
        if area_slug and rec['areaSlug'] != area_slug: continue
        for x in r['shown']:
            if x.get('text'): pool.append((x['date'], rec, x))
    if not pool and near:
        return review_cards(near, None, limit)
    pool.sort(key=lambda t: t[0], reverse=True)
    cards = ''
    for d, rec, x in pool[:limit]:
        cards += f'<article><div class="rh"><b>Guest via {esc(CH.get(str(x.get("channel","")).lower(), x.get("channel") or "booking"))}</b><span>{stars(x["score"])} {esc(d)}</span></div><p>{esc(x["text"][:420])}{"…" if len(x["text"])>420 else ""}</p><div class="rh" style="margin:10px 0 0"><span><a href="{esc(rec["url"])}">{esc(rec["name"])}</a></span></div></article>'
    if not cards: return ''
    return f'<div class="rv">{cards}</div><p class="cases-note">Verified stays, synced from our booking system (Airbnb, Booking.com, direct). Each villa page shows its full rating and review count; the average is calculated over all reviews, not only those shown.</p>'

def faq_block(faq):
    items = ''.join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q, a in faq)
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a)}} for q, a in faq]}
    return items, '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>'

def related(slugs, names):
    return '<div class="rel">' + ''.join(f'<a href="/villa-management/{s}/">{esc(names.get(s, s.replace("-", " ").capitalize()))}</a>' for s in slugs) + '<a href="/villa-management/">All villa management</a></div>'

def steps():
    return '''<div class="steps"><div class="step"><h3>Villa visit &amp; assessment</h3><p>We walk the villa, check licence and paperwork and give you an honest view of what it can earn.</p></div><div class="step"><h3>Simple agreement</h3><p>Scope, the 20% commission, expense approvals, owner dates and exit terms on a few pages.</p></div><div class="step"><h3>Launch</h3><p>Photos, listings on every channel and our site, pricing, staff briefing; most villas go live within about two weeks.</p></div><div class="step"><h3>Guests in, report out</h3><p>We host, clean, maintain and report; you receive one monthly statement and the payout.</p></div></div>'''

def service_ld(url, name, area):
    ld = {"@context": "https://schema.org", "@type": "Service", "name": name, "serviceType": "Villa management", "url": SITE + url,
          "provider": {"@type": "Organization", "name": "BaliVillas", "url": SITE + "/", "telephone": "+62 857 4649 9697"},
          "areaServed": area, "offers": {"@type": "Offer", "description": "20% commission on actual booking revenue, no fixed fees"}}
    bc = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}, {"@type": "ListItem", "position": 2, "name": "Villa management", "item": SITE + "/villa-management/"}, {"@type": "ListItem", "position": 3, "name": name, "item": SITE + url}]}
    return '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script><script type="application/ld+json">' + json.dumps(bc, ensure_ascii=False) + '</script>'

def final_cta(text):
    return f'''<div class="final"><p class="kicker k">Start with a conversation</p><h2 style="margin-bottom:10px">Let&rsquo;s look at your villa.</h2>
  <p style="color:#6b6b66;max-width:52ch;margin:0 auto 26px">Send us the location and a couple of photos; we come back with an honest assessment and our terms.</p>
  <a class="btn-dark" href="{wa(text)}" rel="noopener">Message us on WhatsApp</a>&nbsp; <a class="btn-dark" style="background:#fff;color:#0a0a0a;border:1px solid #d9d4c9" href="/villa-management/income-calculator/">Estimate your income</a></div>'''

NAMES = {g['slug']: 'Villa management in ' + g['area'] for g in GEO}
NAMES.update({p['slug']: re.sub('<[^>]+>', '', p['h1']) for p in PAGES})
NAMES['income-calculator'] = 'Income calculator'

def write(url, content):
    path = os.path.join(ROOT, url.strip('/'), 'index.html')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(content)

built = []
# ---------------- geo pages ----------------
for g in GEO:
    url = f"/villa-management/{g['slug']}/"
    name = 'Villa management in ' + g['area']
    body = crumbs(g['area']) + hero(g['kicker'], g['h1'], g['lead'], f"Hi! I own a villa in {g['area']} and want to discuss management.", ('#market', 'How we work here'))
    body += section('What we take over', f'Villa management in {esc(g["area"])}: <span class="serif" style="font-style:italic">everything under one roof</span>', paras([f'For owners in {g["area"]} we run the whole villa: marketing and listings on every channel, seasonal pricing, guest messaging around the clock, check-in, housekeeping, maintenance and pool care, staff, licence checks and one monthly statement with the payout. One {COMMISSION} commission on the revenue the villa actually makes, nothing fixed.']) + services_grid(), 'more', tight=False, wide=True)
    inner = paras(g['market']) + '<div class="prose"><h3>Which villas rent best in ' + esc(g['area']) + '</h3><ul>' + ''.join('<li>' + b + '</li>' for b in g['best']) + '</ul></div>'
    body += section('The market, honestly', f'The {esc(g["area"])} rental market <span class="serif" style="font-style:italic">for owners</span>', inner, 'market')
    body += section('Proof', f'Our villas <span class="serif" style="font-style:italic">in {esc(g["area"])}</span>', villa_cards(g['area_slug'], g.get('near'), g['area']), 'villas', wide=True)
    body += section('How it runs', f'A villa in {esc(g["area"])}, <span class="serif" style="font-style:italic">day to day</span>', paras(['A local housekeeping crew on changeover days, a maintenance and pool round every week, a guest line staffed 24/7 and a named villa manager who visits the villa and answers your WhatsApp. Repairs above your monthly budget are quoted with photos and approved by you first. See <a href="/villa-management/housekeeping-and-cleaning/">housekeeping</a>, <a href="/villa-management/maintenance-and-pool-care/">maintenance</a> and <a href="/villa-management/owner-reporting-and-payouts/">reporting</a> for the detail.']), 'ops')
    for h2, ps in g['extra']:
        body += section('Specific to the area', esc(h2), paras(ps))
    body += fee_band()
    rv = review_cards(g['area_slug'] or None, g.get('near'))
    if rv: body += section('Guest reviews', f'What guests say about our villas <span class="serif" style="font-style:italic">{"in " + esc(g["area"]) if g["area_slug"] else "nearby"}</span>', rv, 'reviews', wide=True)
    body += section('Onboarding', f'From first visit to first guest <span class="serif" style="font-style:italic">in four steps</span>', steps(), 'steps', wide=True)
    faq_html, faq_ld = faq_block(g['faq'] + [('What does management cost?', f'A single {COMMISSION} commission on actual bookings, nothing fixed. Consumables, repairs and utilities are billed at cost with receipts; see <a href="/villa-management/pricing/">pricing</a>.'), ('Can I still stay in my own villa?', 'Yes. Owner dates are blocked first and the calendar is priced around them.')])
    body += section('Questions owners ask', f'{esc(g["area"])} villa management FAQ', faq_html, 'faq')
    others = [x['slug'] for x in GEO if x['slug'] != g['slug']]
    body += section('Other areas', 'Villa management <span class="serif" style="font-style:italic">across south Bali</span>', related(others + ['pricing', 'income-calculator', 'rent-out-my-villa'], NAMES), 'areas', wide=True)
    body += final_cta(f"Hi! I own a villa in {g['area']} and want to discuss management.")
    doc = head_for(url, g['title'], g['description']) + service_ld(url, name, g['area'] + ', Bali') + faq_ld + '\n' + body + '\n' + TAIL
    write(url, doc); built.append((url, g['title']))

# ---------------- service / owner pages ----------------
for p in PAGES:
    url = f"/villa-management/{p['slug']}/"
    name = re.sub('<[^>]+>', '', p['h1'])
    body = crumbs(name) + hero(p['kicker'], p['h1'], p['lead'], f"Hi! I own a villa in Bali and want to talk about {name.lower()}.")
    first = True
    for h2, ps in p['sections']:
        h2h = esc(h2)
        body += section('' if not first else 'In detail', h2h, paras(ps), 'more' if first else '', tight=not first)
        first = False
    if p['slug'] != 'pricing': body += fee_band()
    else:
        body += section('In numbers', 'The fee, <span class="serif" style="font-style:italic">at a glance</span>', f'<div class="feebox"><div><b>{COMMISSION}</b><span>of actual booking revenue, nightly and monthly</span></div><div><b>0</b><span>fixed monthly, onboarding or exit fees</span></div><div><b>at cost</b><span>repairs, consumables, utilities, with receipts</span></div></div>', 'fee', wide=True)
    if p['slug'] in ('owner-reviews-and-case-studies', 'foreign-and-overseas-owners', 'luxury-villa-management', 'guest-services-and-concierge'):
        rv = review_cards(None, None, 9 if p['slug'] == 'owner-reviews-and-case-studies' else 6)
        if rv: body += section('Guest reviews', 'What guests say about villas <span class="serif" style="font-style:italic">we manage</span>', rv, 'reviews', wide=True)
    faq_html, faq_ld = faq_block(p['faq'])
    body += section('Questions owners ask', esc(name) + ': FAQ', faq_html, 'faq')
    body += section('Related', 'More on <span class="serif" style="font-style:italic">villa management</span>', related(p['related'], NAMES), 'related', wide=True)
    body += final_cta(f"Hi! I own a villa in Bali and want to talk about {name.lower()}.")
    doc = head_for(url, p['title'], p['description']) + service_ld(url, name, 'Bali') + faq_ld + '\n' + body + '\n' + TAIL
    write(url, doc); built.append((url, p['title']))

# ---------------- calculator ----------------
url = '/villa-management/income-calculator/'
calc_html = '''<div class="calc" id="calc">
  <div>
    <label for="c_rate">Your expected nightly rate (in USD; check what similar villas nearby actually charge)</label><input id="c_rate" type="number" min="20" step="5" value="150">
    <label for="c_occ">Occupancy scenario (your assumption, not a market figure)</label><select id="c_occ"><option value="0.40">Cautious: 40% of nights booked</option><option value="0.55" selected>Middle: 55%</option><option value="0.70">Strong: 70%</option></select>
    <label for="c_ota">Platform fee on channel bookings (Airbnb, Booking.com etc.), %</label><input id="c_ota" type="number" min="0" max="30" step="1" value="15">
    <label for="c_direct">Share of bookings made direct, without platform fee, %</label><input id="c_direct" type="number" min="0" max="100" step="5" value="20">
    <label for="c_costs">Your monthly running costs (utilities, staff, consumables, repairs), USD</label><input id="c_costs" type="number" min="0" step="50" value="600">
    <p style="font-size:12.5px;color:#8a877f;margin:0">Every input is yours to change. The only fixed number is our 20% commission.</p>
  </div>
  <div class="out">
    <span style="font-size:12.5px;color:#6b6b66">Gross booking revenue per year</span><b id="o_gross">—</b>
    <p>Platform fees: <span id="o_ota">—</span> · BaliVillas 20%: <span id="o_fee">—</span> · Running costs: <span id="o_costs">—</span></p>
    <span style="font-size:12.5px;color:#6b6b66">Estimated net to owner per year</span><b id="o_net">—</b>
    <p id="o_month">—</p>
    <a class="btn-wa" href="#" id="o_wa" rel="noopener">Ask for an exact estimate for my villa</a>
  </div>
</div>
<script>
(function(){var $=function(i){return document.getElementById(i)};var f=function(n){return '$'+Math.round(n).toLocaleString('en-US')};
function run(){var rate=+$('c_rate').value||0,occ=+$('c_occ').value,ota=(+$('c_ota').value||0)/100,dir=(+$('c_direct').value||0)/100,costs=(+$('c_costs').value||0)*12;
var gross=rate*365*occ,otaFee=gross*(1-dir)*ota,fee=gross*0.20,net=gross-otaFee-fee-costs;
$('o_gross').textContent=f(gross);$('o_ota').textContent=f(otaFee);$('o_fee').textContent=f(fee);$('o_costs').textContent=f(costs);$('o_net').textContent=f(net);
$('o_month').textContent='About '+f(net/12)+' per month on these assumptions. Real results depend on area, season, photos, reviews and pricing.';
$('o_wa').href='https://wa.me/6285746499697?text='+encodeURIComponent('Hi! I used your income calculator (rate $'+rate+', '+Math.round(occ*100)+'% occupancy). I own a villa in Bali and would like an exact estimate.');}
['c_rate','c_occ','c_ota','c_direct','c_costs'].forEach(function(i){$(i).addEventListener('input',run);$(i).addEventListener('change',run)});run();})();
</script>'''
body = crumbs('Income calculator') + hero('Income calculator · Bali', 'What could your villa <span class="it">earn?</span>', 'A transparent estimate, not a sales number: you enter the nightly rate you believe your villa can charge and an occupancy scenario, the calculator applies platform fees, our 20% commission and your running costs, and shows what is left. Then ask us for a real estimate after a visit.', 'Hi! I own a villa in Bali and would like an income estimate.', ('#calc', 'Use the calculator'))
body += section('Calculator', 'Estimate for <span class="serif" style="font-style:italic">your villa</span>', calc_html, 'calc-section', tight=False, wide=True)
body += section('Method', 'How the estimate <span class="serif" style="font-style:italic">is calculated</span>', paras(['Gross revenue = your nightly rate × 365 × the occupancy scenario you choose. Platform fees apply to the share of bookings made through Airbnb, Booking.com and similar sites; direct bookings through our site carry none. Our commission is 20% of gross booking revenue. Your running costs are yours to enter: electricity, water, internet, staff, consumables and repairs vary a lot between a two-bedroom townhouse and a nine-bedroom estate.', 'We deliberately do not preload market occupancy or rate figures: they differ by street and by season, and a number pulled from the air is how owners get disappointed. After a visit we give you a written estimate based on the villas we already run in your area, with the assumptions listed.']), 'method')
body += section('What moves the number', 'Four things that change <span class="serif" style="font-style:italic">the result</span>', paras(['* <a href="/villa-management/dynamic-pricing-and-revenue-management/">Pricing</a>: seasonal rates and minimum stays instead of one rate all year.', '* <a href="/villa-management/villa-marketing-and-listings/">Photos and listings</a>: the first photo and the first paragraph decide the click.', '* Reviews: a villa with fifty good reviews books at a higher rate than the same villa with five.', '* Area and access: see the area pages for who books where and why.']), 'moves')
body += fee_band()
faq_html, faq_ld = faq_block([('Is this a guaranteed income?', 'No. It is arithmetic on your own assumptions. A real estimate needs a visit and the data from villas we run nearby.'), ('Why do I have to enter the nightly rate myself?', 'Because rates differ by street, season and condition, and a preloaded average would mislead you. Look at what similar villas nearby charge, then test scenarios.'), ('What is included in the 20%?', 'Marketing, pricing, guests, housekeeping supervision, maintenance scheduling, staff supervision, compliance checks and reporting; see <a href="/villa-management/pricing/">pricing</a>.')])
body += section('Questions owners ask', 'Income calculator: FAQ', faq_html, 'faq')
body += section('Related', 'More on <span class="serif" style="font-style:italic">villa management</span>', related(['pricing', 'rent-out-my-villa', 'holiday-rental-management', 'long-term-rental-management', 'foreign-and-overseas-owners'], NAMES), 'related', wide=True)
body += final_cta('Hi! I own a villa in Bali and would like an income estimate.')
doc = head_for(url, 'Bali Villa Rental Income Calculator | BaliVillas', 'Estimate what your Bali villa could earn under management from your own nightly rate and occupancy assumptions, minus platform fees, our 20% commission and running costs.') + service_ld(url, 'Villa income calculator', 'Bali') + faq_ld + '\n' + body + '\n' + TAIL
write(url, doc); built.append((url, 'Bali Villa Rental Income Calculator | BaliVillas'))

# ---------------- hub update ----------------
h = hub
n_villas = len(villas)
h = h.replace('<div class="stat"><b>12</b><span>villas under our care</span></div>', f'<div class="stat"><b>{n_villas}</b><span>villas under our care</span></div>')
h = h.replace('<div class="stat"><b>4</b><span>areas: Sanur, Canggu, Umalas, Ungasan</span></div>', '<div class="stat"><b>8</b><span>areas across south Bali, from Sanur to Uluwatu</span></div>')
h = h.replace('<h2>One commission.<br>Nothing hidden.</h2>', f'<h2>{COMMISSION} of actual revenue.<br>Nothing hidden.</h2>')
h = h.replace('We earn only when you earn — a single commission on actual bookings. No fixed monthly fees, no surprise charges, no markup games on repairs.', f'We earn only when you earn: a single {COMMISSION} commission on actual bookings. No fixed monthly fees, no onboarding fee, no markup on repairs. <a href="/villa-management/pricing/" style="text-decoration:underline">What the {COMMISSION} covers</a>.')
h = h.replace('A single commission on actual bookings — nothing when the villa doesn&rsquo;t earn. The exact rate depends on the villa and the scope of work; message us on WhatsApp and you&rsquo;ll have our terms the same day.', f'{COMMISSION} of actual booking revenue, nothing fixed and nothing when the villa doesn&rsquo;t earn. Repairs, consumables and utilities are billed at cost with receipts. See the <a href="/villa-management/pricing/">pricing page</a> for what the {COMMISSION} covers.')
# replace placeholder success stories with real guest reviews
s0 = h.index('<!-- SUCCESS STORIES') if '<!-- SUCCESS STORIES' in h else h.index('<!-- AREAS (generated'); s1 = h.index('<!-- FAQ -->')
rv = review_cards(None, None, 6)
areas_grid = ''.join(f'<a class="svc-card" href="/villa-management/{g["slug"]}/" style="display:block"><h3>{esc(g["area"])}</h3><p>{esc(g["lead"][:120])}…</p></a>' for g in GEO)
svc_links = services_grid()
new_block = f'''<!-- AREAS (generated by tools/villa-management/build.py) -->
<section style="padding-top:0" id="areas">
  <div class="wrap">
    <p class="kicker">Where we work</p>
    <h2>Villa management <span class="serif" style="font-style:italic">by area</span></h2>
    <p class="sec-sub">Villas, townhouses and apartments: we manage property across south Bali from two bases, Sanur and Ungasan. Each area page explains who books there, which streets rent and how we run the house.</p>
    <div class="svc">{areas_grid}</div>
  </div>
</section>
<section style="padding-top:0" id="services-detail">
  <div class="wrap">
    <p class="kicker">Property management in Bali, in detail</p>
    <h2>Every part of the service <span class="serif" style="font-style:italic">on its own page</span></h2>
    {svc_links}
    <p class="sec-sub" style="margin-top:18px">Also: <a href="/villa-management/pricing/">fees</a>, <a href="/villa-management/foreign-and-overseas-owners/">overseas owners</a>, <a href="/villa-management/switch-to-the-host-bali/">switching manager</a>, <a href="/villa-management/new-villa-launch/">launching a new villa</a>, <a href="/villa-management/rent-out-my-villa/">renting out for the first time</a>, <a href="/villa-management/villa-investment-management/">investors</a>, <a href="/villa-management/licensing-and-compliance-help/">licences</a>, <a href="/villa-management/luxury-villa-management/">luxury villas</a>, <a href="/villa-management/airbnb-co-hosting/">co-hosting</a>, <a href="/villa-management/villa-staff-management/">staff</a>, <a href="/villa-management/your-villa-manager/">your villa manager</a>, <a href="/villa-management/owner-reviews-and-case-studies/">reviews</a> and the <a href="/villa-management/income-calculator/">income calculator</a>.</p>
  </div>
</section>
<section style="padding-top:0" id="results">
  <div class="wrap">
    <p class="kicker">Guest reviews</p>
    <h2>What guests say about villas <span class="serif" style="font-style:italic">we manage</span></h2>
    <p class="sec-sub">Straight from our booking system, with the platform and the date. Owner references are given personally, on request.</p>
    {rv}
  </div>
</section>

'''
h = h[:s0] + new_block + h[s1:]
h = re.sub(r'<style id="thb-vm-css">.*?</style>\s*', '', h, flags=re.S)
h = h.replace('<style id="thb-fav-css">', EXTRA_CSS + '<style id="thb-fav-css">', 1)
open(HUB, 'w', encoding='utf-8').write(h)

# ---------------- sitemap ----------------
sm_path = os.path.join(ROOT, 'sitemap.xml'); sm = open(sm_path, encoding='utf-8').read()
entries = ''
for u, t in built:
    if SITE + u in sm: continue
    entries += f'  <url>\n    <loc>{SITE}{u}</loc>\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{u}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="{SITE}{u}"/>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n'
if entries: sm = sm.replace('</urlset>', entries + '</urlset>'); open(sm_path, 'w', encoding='utf-8').write(sm)
print('built', len(built), 'pages; sitemap entries added:', entries.count('<url>'))
