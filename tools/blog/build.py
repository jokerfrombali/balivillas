#!/usr/bin/env python3
"""Build the /blog/ section of balivillas.ai from markdown sources.

Source: content/blog/<hub>/<slug>.md  (frontmatter "key: value" lines between --- markers,
then markdown body; a "## FAQ" section with "### question" + answer paragraphs is turned
into <details> blocks and FAQPage JSON-LD).
Output: blog/<hub>/<slug>/index.html, blog/<hub>/index.html, blog/index.html, sitemap-blog.xml.

Site shell (nav, footer, scripts) is taken from tools/blog/shell/*, extracted from the
canonical area page /villas/umalas/ on 2026-09-18. Re-extract if the nav changes.

Run: python3 tools/blog/build.py [--check]   (--check validates without writing)
"""
import os, re, sys, json, glob, html, datetime
import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHELL = os.path.join(ROOT, 'tools', 'blog', 'shell')
SRC = os.path.join(ROOT, 'content', 'blog')
SITE = 'https://balivillas.ai'
CHECK = '--check' in sys.argv
TODAY = datetime.date.today().isoformat()

HUBS = {
    'renting':   {'name': 'Renting a villa in Bali', 'short': 'Renting',
                  'lead': 'How villa rental in Bali actually works: prices, what is included, booking direct instead of through platforms, and how to pick the right villa for a family, a couple, a group or a remote-work stay.',
                  'cta': '/property-rental/'},
    'areas':     {'name': 'Bali area guides', 'short': 'Areas',
                  'lead': 'Sanur, Canggu, Umalas, Ungasan and the areas around them, written by the team that manages villas there: who each area suits, what it costs, and how the neighbourhoods compare.',
                  'cta': '/villas/'},
    'long-term': {'name': 'Long-term rental & living in Bali', 'short': 'Long-term',
                  'lead': 'Monthly and yearly villa rental in Bali: real costs, contracts and deposits, utilities, visas for long stays, and the practical side of relocating to Bali.',
                  'cta': '/property-rental/'},
    'buying':    {'name': 'Buying & selling villas in Bali', 'short': 'Buying',
                  'lead': 'What foreigners can own in Bali, leasehold versus freehold, due diligence, permits and zoning, taxes and purchase costs, and how to sell a villa later.',
                  'cta': '/villas-for-sale/'},
    'owners':    {'name': 'Villa management for owners', 'short': 'Owners',
                  'lead': 'Owner economics of a Bali villa: management fees and contracts, occupancy and pricing, staff and running costs, licences and taxes, and what a good management company should report.',
                  'cta': '/villa-management/'},
    'travel':    {'name': 'Bali trip practicalities', 'short': 'Travel',
                  'lead': 'The practical part of a Bali villa holiday: arrival and visas, transport, money, weather by month, Nyepi and holidays, packing and staying healthy.',
                  'cta': '/property-rental/'},
}
HUB_ORDER = ['renting', 'areas', 'long-term', 'buying', 'owners', 'travel']

CTA = {
    '/villa-management/': ('Own a villa in Bali?', 'We manage 20 villas in Sanur, Canggu, Umalas and Ungasan ourselves — marketing, guests, staff and monthly owner reports on one commission. Send us the location and a couple of photos for an honest assessment.', 'Talk about villa management', 'Hi The Host Bali! I own a villa in Bali and would like to discuss management.'),
    '/villas-for-sale/': ('Looking at villas for sale?', 'Our listings come with rental history, running costs and documents, because most of them are villas our own team already manages. Ask for the current list.', 'See villas for sale', 'Hi The Host Bali! I am interested in villas for sale in Bali.'),
    '/property-rental/': ('Need a villa in Bali?', 'Every villa on this site is managed by our own team. Tell us your dates, area and group size on WhatsApp and we reply the same day with availability and a direct price, no platform fees.', 'Browse villas for rent', 'Hi The Host Bali! I am looking for a villa in Bali.'),
    '/villas/sanur/': ('Staying in Sanur?', 'We manage 11 private pool villas in Sanur, from 2-bedroom townhouses to 4-bedroom family villas near the beach path. Direct booking, same-day reply.', 'See villas in Sanur', 'Hi The Host Bali! I am looking for a villa in Sanur.'),
    '/villas/canggu/': ('Staying in Canggu?', 'Our Canggu villas are large beachside houses for groups and families, managed by our own team. Ask for dates and a direct price.', 'See villas in Canggu', 'Hi The Host Bali! I am looking for a villa in Canggu.'),
    '/villas/umalas/': ('Staying in Umalas?', 'Quiet pool townhouses between Canggu and Seminyak, set up for weeks and months: kitchens, desks, fast Wi-Fi and parking. Direct booking, same-day reply.', 'See villas in Umalas', 'Hi The Host Bali! I am looking for a villa in Umalas.'),
    '/villas/ungasan/': ('Staying in Ungasan?', 'Teak eco villas with private pools on the Bukit, minutes from Melasti and Green Bowl beaches, managed by our own team. Ask for dates and a direct price.', 'See villas in Ungasan', 'Hi The Host Bali! I am looking for a villa in Ungasan.'),
    '/villas/': ('Choosing an area?', 'We manage villas in four areas of Bali and know them street by street. Tell us what matters for your stay and we will suggest the right area and villa.', 'Compare villas by area', 'Hi The Host Bali! Can you help me choose an area and a villa in Bali?'),
    '/contacts/': ('Talk to the team', 'One WhatsApp message reaches the people who hold the keys, not a call centre. We answer 8:00–22:00 Bali time, usually within about 15 minutes.', 'Contact us', 'Hi The Host Bali!'),
}
for k in ('/villas-for-sale/sanur/', '/villas-for-sale/umalas/', '/villas-for-sale/canggu/', '/villas-for-sale/ungasan/'):
    CTA[k] = CTA['/villas-for-sale/']

def read(p):
    return open(os.path.join(SHELL, p), encoding='utf-8').read()

def esc(s):
    return html.escape(str(s or ''), quote=True)

def parse(path):
    txt = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', txt, re.S)
    if not m:
        raise ValueError('no frontmatter: ' + path)
    meta = {}
    for line in m.group(1).splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    body = m.group(2).strip()
    # split FAQ
    faq = []
    fm = re.search(r'\n## FAQ\s*\n(.*)$', '\n' + body, re.S)
    if fm:
        body = body[:body.rfind('## FAQ')].rstrip()
        for qm in re.finditer(r'### (.+?)\n(.*?)(?=\n### |\Z)', fm.group(1).strip() + '\n', re.S):
            faq.append((qm.group(1).strip(), qm.group(2).strip()))
    meta['_faq'] = faq
    meta['_body'] = body
    meta['_path'] = path
    hub = os.path.basename(os.path.dirname(path))
    slug = os.path.basename(path)[:-3]
    meta.setdefault('hub', hub); meta.setdefault('slug', slug)
    if meta['hub'] != hub or meta['slug'] != slug:
        raise ValueError(f'hub/slug mismatch in {path}: {meta["hub"]}/{meta["slug"]}')
    meta['url'] = f'/blog/{hub}/{slug}/'
    return meta

def slugify(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s[:70] or 'section'

def render_body(md_text):
    h = markdown.markdown(md_text, extensions=['tables', 'sane_lists', 'smarty'])
    toc = []
    used = set()
    def add_id(m):
        level, inner = m.group(1), m.group(2)
        i = slugify(inner); base = i; n = 2
        while i in used:
            i = f'{base}-{n}'; n += 1
        used.add(i)
        if level == '2':
            toc.append((i, re.sub(r'<[^>]+>', '', inner)))
        return f'<h{level} id="{i}">{inner}</h{level}>'
    h = re.sub(r'<h([23])>(.*?)</h\1>', add_id, h, flags=re.S)
    # tables: wrap for horizontal scroll on phones
    h = h.replace('<table>', '<div class="tbl"><table>').replace('</table>', '</table></div>')
    return h, toc

def words(md_text):
    return len(re.sub(r'[#*`>|\-]', ' ', md_text).split())

ARTICLE_CSS = '''
<style id="thb-article-css">
.art-wrap{max-width:1180px;margin:0 auto;padding:104px 40px 56px}
.art-crumbs{font-size:13px;color:#6b6b66;margin:0 0 18px;display:flex;flex-wrap:wrap;gap:6px}
.art-crumbs a{color:#6b6b66;text-decoration:none}.art-crumbs a:hover{color:#0a0a0a;text-decoration:underline;text-underline-offset:3px}
.art-grid{display:grid;grid-template-columns:minmax(0,760px) 320px;gap:48px;align-items:start}
.art-kicker{font-size:12px;color:#6b6b66;text-transform:uppercase;letter-spacing:.18em;font-weight:700;margin:0 0 12px}
.art h1{font-family:'Lora',Georgia,serif;font-size:44px;line-height:1.08;font-weight:700;letter-spacing:-.01em;margin:0 0 16px}
.art-lead{font-size:18px;line-height:1.7;color:#3b3b36;margin:0 0 18px}
.art-meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:#6b6b66;margin:0 0 28px;padding:0 0 22px;border-bottom:1px solid #e6e3dc}
.art-meta b{color:#0a0a0a;font-weight:600}
.art-toc{background:#f2efe8;border:1px solid #e6e3dc;border-radius:20px;padding:20px 22px;margin:0 0 30px}
.art-toc p{font-size:12px;text-transform:uppercase;letter-spacing:.16em;font-weight:700;color:#6b6b66;margin:0 0 10px}
.art-toc ol{margin:0;padding:0 0 0 18px;font-size:14.5px;line-height:1.75}.art-toc a{color:#0a0a0a;text-decoration:none}.art-toc a:hover{text-decoration:underline;text-underline-offset:3px}
.art-body{font-size:16.5px;line-height:1.8;color:#2a2a26}
.art-body h2{font-family:'Lora',Georgia,serif;font-size:29px;line-height:1.15;font-weight:700;margin:44px 0 14px;letter-spacing:-.01em;scroll-margin-top:90px}
.art-body h3{font-family:'Lora',Georgia,serif;font-size:21px;line-height:1.25;font-weight:700;margin:30px 0 10px;scroll-margin-top:90px}
.art-body p{margin:0 0 16px}.art-body ul,.art-body ol{margin:0 0 18px;padding-left:24px}.art-body li{margin:0 0 6px}
.art-body a{color:#0a0a0a;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#b8b3a8}.art-body a:hover{text-decoration-color:#0a0a0a}
.art-body blockquote{margin:22px 0;padding:16px 22px;border-left:3px solid #0a0a0a;background:#f2efe8;border-radius:0 16px 16px 0;color:#3b3b36}
.art-body .tbl{overflow-x:auto;margin:0 0 22px;border:1px solid #e6e3dc;border-radius:14px}
.art-body table{border-collapse:collapse;width:100%;font-size:14.5px;line-height:1.5}
.art-body th,.art-body td{padding:10px 14px;border-bottom:1px solid #e6e3dc;text-align:left;vertical-align:top}
.art-body th{background:#f2efe8;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.06em}
.art-body tr:last-child td{border-bottom:0}
.art-body strong{font-weight:600;color:#0a0a0a}
.art-cta{background:#0a0a0a;color:#fff;border-radius:24px;padding:30px 32px;margin:40px 0}
.art-cta h2{font-family:'Lora',Georgia,serif;font-size:26px;margin:0 0 10px;color:#fff}
.art-cta p{color:rgba(255,255,255,.72);font-size:15px;line-height:1.7;margin:0 0 18px}
.art-cta .row{display:flex;flex-wrap:wrap;gap:10px}
.art-cta a{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:12px 22px;font-size:14px;font-weight:600;text-decoration:none}
.art-cta a.wa{background:#b8f04a;color:#0a0a0a}.art-cta a.pg{border:1px solid rgba(255,255,255,.35);color:#fff}
.art-cta a.wa:hover{background:#c9ff5c}.art-cta a.pg:hover{background:rgba(255,255,255,.08)}
.art-faq{margin:40px 0 0}.art-faq h2{font-family:'Lora',Georgia,serif;font-size:26px;margin:0 0 16px}
.art-faq details{border:1px solid #e5e0d6;border-radius:12px;padding:14px 18px;margin:0 0 10px;background:#fff}
.art-faq summary{cursor:pointer;font-weight:600;font-size:16px}.art-faq details p{margin:10px 0 2px;color:#4c473f;line-height:1.6}
.art-side{position:sticky;top:96px;display:flex;flex-direction:column;gap:18px}
.side-card{background:#f2efe8;border:1px solid #e6e3dc;border-radius:22px;padding:22px}
.side-card h3{font-family:'Lora',Georgia,serif;font-size:19px;margin:0 0 8px}
.side-card p{font-size:14px;line-height:1.65;color:#4b4b45;margin:0 0 14px}
.side-card .btn{display:inline-flex;align-items:center;justify-content:center;width:100%;background:#0a0a0a;color:#fff;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:600;text-decoration:none}
.side-card .btn.wa{background:#0a7d43}.side-card .btn+.btn{margin-top:8px}
.side-card ul{list-style:none;margin:0;padding:0}.side-card li{padding:8px 0;border-top:1px solid #e6e3dc;font-size:14px;line-height:1.45}.side-card li:first-child{border-top:0;padding-top:0}
.side-card li a{color:#0a0a0a;text-decoration:none}.side-card li a:hover{text-decoration:underline;text-underline-offset:3px}
.art-related{max-width:1180px;margin:0 auto;padding:0 40px 64px}
.art-related h2{font-family:'Lora',Georgia,serif;font-size:28px;margin:0 0 18px}
.rel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.rel-card{display:block;background:#fff;border:1px solid #e6e3dc;border-radius:20px;padding:22px;text-decoration:none;color:#0a0a0a;transition:transform .3s}
.rel-card:hover{transform:translateY(-3px)}
.rel-card .k{font-size:11px;text-transform:uppercase;letter-spacing:.16em;font-weight:700;color:#6b6b66;margin:0 0 8px}
.rel-card h3{font-family:'Lora',Georgia,serif;font-size:19px;line-height:1.25;margin:0 0 8px}
.rel-card p{font-size:14px;line-height:1.6;color:#4b4b45;margin:0}
.art-note{font-size:13.5px;line-height:1.6;color:#6b6b66;border-top:1px solid #e6e3dc;margin:36px 0 0;padding:18px 0 0}
@media(max-width:1023px){.art-grid{grid-template-columns:1fr}.art-side{position:static}.rel-grid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.art-wrap{padding:92px 20px 40px}.art h1{font-size:32px}.art-related{padding:0 20px 48px}.rel-grid{grid-template-columns:1fr}.art-body h2{font-size:24px}.art-cta{padding:24px}}
.hub-wrap{max-width:1180px;margin:0 auto;padding:104px 40px 64px}
.hub-wrap h1{font-family:'Lora',Georgia,serif;font-size:46px;line-height:1.06;letter-spacing:-.01em;margin:0 0 14px}
.hub-lead{font-size:17px;line-height:1.75;color:#3b3b36;max-width:760px;margin:0 0 28px}
.hub-nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 36px}
.hub-nav a{font-size:13px;color:#0a0a0a;text-decoration:none;background:#fff;border:1px solid #e6e3dc;border-radius:999px;padding:8px 14px}
.hub-nav a.on,.hub-nav a:hover{background:#0a0a0a;color:#fff;border-color:#0a0a0a}
.hub-sec h2{font-family:'Lora',Georgia,serif;font-size:26px;margin:36px 0 14px}
@media(max-width:640px){.hub-wrap{padding:92px 20px 40px}.hub-wrap h1{font-size:34px}}
</style>
'''

def head_html(title, desc, url, ldjson, ogtype='article'):
    return (
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + read('head-gtag.html') +
        '\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f'<title>{esc(title)}</title>\n<meta name="description" content="{esc(desc)}">\n'
        f'<link rel="canonical" href="{SITE}{url}">\n'
        f'<link rel="alternate" hreflang="x-default" href="{SITE}{url}">\n<link rel="alternate" hreflang="en" href="{SITE}{url}">\n'
        f'<meta property="og:title" content="{esc(title)}">\n<meta property="og:description" content="{esc(desc)}">\n'
        f'<meta property="og:url" content="{SITE}{url}">\n<meta property="og:type" content="{ogtype}">\n<meta property="og:site_name" content="The Host Bali">\n'
        f'<meta property="og:image" content="{SITE}/public-objects/hero/slide-05-1200.jpg">\n<meta name="twitter:card" content="summary_large_image">\n'
        '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
        '<link rel="stylesheet" href="/fonts/fonts.css">\n'  # blog pages do not load thb-tw.css, so they keep the separate font file
        + read('head-tailwind.html') +
        '<script type="application/ld+json">' + json.dumps(ldjson, ensure_ascii=False) + '</script>\n' +
        read('head-css.html') + ARTICLE_CSS + '</head>\n'
    )

def crumbs(items):
    return '<nav class="art-crumbs" aria-label="Breadcrumb">' + ' <span aria-hidden="true">›</span> '.join(
        (f'<a href="{u}">{esc(t)}</a>' if u else f'<span>{esc(t)}</span>') for t, u in items) + '</nav>'

def crumbs_ld(items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': t, **({'item': SITE + u} if u else {})} for i, (t, u) in enumerate(items)]}

def cta_block(target, meta):
    t = CTA.get(target) or CTA['/property-rental/']
    wa = 'https://wa.me/6285746499697?text=' + esc(t[3]).replace(' ', '%20').replace("'", '%27')
    return (f'<aside class="art-cta" aria-label="Next step"><h2>{esc(t[0])}</h2><p>{esc(t[1])}</p>'
            f'<div class="row"><a class="wa" href="{wa}" rel="noopener">WhatsApp the team</a><a class="pg" href="{target}">{esc(t[2])} →</a></div></aside>')

def build_article(a, by_key):
    body_html, toc = render_body(a['_body'])
    hub = HUBS[a['hub']]
    title = a['title'] + ' | The Host Bali'
    crumb_items = [('Home', '/'), ('Guides', '/blog/'), (hub['short'], f'/blog/{a["hub"]}/'), (a['h1'], None)]
    faq = a['_faq']
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Article', 'headline': a['h1'], 'description': a['description'], 'url': SITE + a['url'],
         'mainEntityOfPage': SITE + a['url'], 'datePublished': a.get('published', a.get('updated', TODAY)),
         'dateModified': a.get('updated', TODAY), 'inLanguage': 'en',
         'author': {'@type': 'Organization', 'name': 'The Host Bali', 'url': SITE + '/about/'},
         'publisher': {'@type': 'Organization', 'name': 'The Host Bali', 'url': SITE + '/', 'logo': {'@type': 'ImageObject', 'url': SITE + '/favicon.png'}},
         'image': SITE + '/public-objects/hero/slide-05-1200.jpg', 'about': a.get('primary_query', '')},
        crumbs_ld(crumb_items)]}
    if faq:
        ld['@graph'].append({'@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': re.sub(r'<[^>]+>', '', markdown.markdown(ans))}} for q, ans in faq]})
    target = a.get('commercial_target', hub['cta'])
    rel = []
    for r in re.split(r'[;,]\s*', a.get('related', '')):
        r = r.strip().strip('/')
        if r in by_key and r != f'{a["hub"]}/{a["slug"]}':
            rel.append(by_key[r])
    wc = words(a['_body'])
    mins = max(3, round(wc / 220))
    toc_html = ''
    if len(toc) >= 3:
        toc_html = '<nav class="art-toc" aria-label="Contents"><p>In this guide</p><ol>' + ''.join(f'<li><a href="#{i}">{esc(t)}</a></li>' for i, t in toc) + '</ol></nav>'
    faq_html = ''
    if faq:
        faq_html = '<section class="art-faq" aria-label="FAQ"><h2 id="faq">Frequently asked questions</h2>' + ''.join(
            f'<details><summary>{esc(q)}</summary>{markdown.markdown(ans)}</details>' for q, ans in faq) + '</section>'
    # insert CTA after the 3rd h2 (or at end)
    parts = re.split(r'(?=<h2 )', body_html)
    if len(parts) > 3:
        body_html = ''.join(parts[:3]) + cta_block(target, a) + ''.join(parts[3:])
    else:
        body_html += cta_block(target, a)
    side_cta = CTA.get(target) or CTA['/property-rental/']
    wa = 'https://wa.me/6285746499697?text=' + esc(side_cta[3]).replace(' ', '%20').replace("'", '%27')
    side = (f'<aside class="art-side"><div class="side-card"><h3>{esc(side_cta[0])}</h3><p>{esc(side_cta[1])}</p>'
            f'<a class="btn wa" href="{wa}" rel="noopener">WhatsApp +62 857 4649 9697</a><a class="btn" href="{target}">{esc(side_cta[2])}</a></div>')
    if rel:
        side += '<div class="side-card"><h3>Related guides</h3><ul>' + ''.join(f'<li><a href="{r["url"]}">{esc(r["h1"])}</a></li>' for r in rel[:6]) + '</ul></div>'
    side += f'<div class="side-card"><h3>More in {esc(hub["short"].lower())}</h3><p>{esc(hub["lead"][:140])}…</p><a class="btn" href="/blog/{a["hub"]}/">All {esc(hub["short"].lower())} guides</a></div></aside>'
    rel_html = ''
    if rel:
        rel_html = '<section class="art-related" aria-label="Related guides"><h2>Keep reading</h2><div class="rel-grid">' + ''.join(
            f'<a class="rel-card" href="{r["url"]}"><p class="k">{esc(HUBS[r["hub"]]["short"])}</p><h3>{esc(r["h1"])}</h3><p>{esc(r["description"][:120])}…</p></a>' for r in rel[:3]) + '</div></section>'
    updated = a.get('updated', TODAY)
    note = a.get('note', 'Written by The Host Bali team, who manage villas in Sanur, Canggu, Umalas and Ungasan. Prices, rules and visa details change; we date every guide and update it when something moves. Nothing here is legal or tax advice — for a purchase or a licence, check the specifics with a licensed notary or adviser in Bali.')
    page = (head_html(title, a['description'], a['url'], ld) + read('body-top.html') +
            '<main class="art-wrap"><div class="art">' + crumbs(crumb_items) +
            f'<div class="art-grid"><article><p class="art-kicker">{esc(hub["name"])}</p><h1>{esc(a["h1"])}</h1>'
            f'<p class="art-lead">{esc(a.get("lead", a["description"]))}</p>'
            f'<div class="art-meta"><span>By <b>The Host Bali team</b></span><span>Updated <b>{esc(updated)}</b></span><span><b>{mins} min</b> read</span></div>'
            + toc_html + '<div class="art-body">' + body_html + '</div>' + faq_html +
            f'<p class="art-note">{esc(note)}</p></article>' + side + '</div></div></main>' + rel_html +
            read('footer.html') + read('body-tail.html'))
    return page

def card(a):
    return (f'<a class="rel-card" href="{a["url"]}"><p class="k">{esc(HUBS[a["hub"]]["short"])}</p><h3>{esc(a["h1"])}</h3><p>{esc(a["description"][:130])}…</p></a>')

def build_hub(hub, arts, all_arts):
    h = HUBS[hub]
    url = f'/blog/{hub}/'
    title = f'{h["name"]} — guides | The Host Bali'
    desc = (h['lead'][:150] + '…') if len(h['lead']) > 155 else h['lead']
    crumb_items = [('Home', '/'), ('Guides', '/blog/'), (h['short'], None)]
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'CollectionPage', 'name': h['name'], 'description': desc, 'url': SITE + url,
         'isPartOf': {'@type': 'WebSite', 'name': 'The Host Bali', 'url': SITE + '/'}},
        crumbs_ld(crumb_items),
        {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': SITE + a['url'], 'name': a['h1']} for i, a in enumerate(arts)]}]}
    nav = '<nav class="hub-nav" aria-label="Guide sections">' + ''.join(
        f'<a href="/blog/{k}/" class="{"on" if k == hub else ""}">{esc(HUBS[k]["short"])}</a>' for k in HUB_ORDER) + '</nav>'
    pri = [a for a in arts if a.get('priority', '2') == '1']
    rest = [a for a in arts if a not in pri]
    body = f'<main class="hub-wrap">{crumbs(crumb_items)}<h1>{esc(h["name"])}</h1><p class="hub-lead">{esc(h["lead"])}</p>{nav}'
    if pri:
        body += '<section class="hub-sec"><h2>Start here</h2><div class="rel-grid">' + ''.join(card(a) for a in pri) + '</div></section>'
    if rest:
        body += '<section class="hub-sec"><h2>All guides</h2><div class="rel-grid">' + ''.join(card(a) for a in rest) + '</div></section>'
    body += cta_block(h['cta'], {}) + '</main>'
    return head_html(title, desc, url, ld, 'website') + read('body-top.html') + body + read('footer.html') + read('body-tail.html')

def build_index(all_arts):
    url = '/blog/'
    title = 'Bali villa guides: renting, living, buying and villa management | The Host Bali'
    desc = 'Practical guides from a Bali villa management team: renting villas in Sanur, Canggu, Umalas and Ungasan, long-term stays, buying property and managing a villa.'
    crumb_items = [('Home', '/'), ('Guides', None)]
    ld = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'CollectionPage', 'name': 'Bali villa guides', 'description': desc, 'url': SITE + url,
         'isPartOf': {'@type': 'WebSite', 'name': 'The Host Bali', 'url': SITE + '/'}}, crumbs_ld(crumb_items)]}
    body = f'<main class="hub-wrap">{crumbs(crumb_items)}<h1>Bali villa guides</h1><p class="hub-lead">{esc(desc)} Everything is written by the people who manage the villas, not by a content agency.</p>'
    body += '<nav class="hub-nav" aria-label="Guide sections">' + ''.join(f'<a href="/blog/{k}/">{esc(HUBS[k]["short"])}</a>' for k in HUB_ORDER) + '</nav>'
    for k in HUB_ORDER:
        arts = [a for a in all_arts if a['hub'] == k]
        if not arts:
            continue
        top = [a for a in arts if a.get('priority', '2') == '1'][:6] or arts[:6]
        body += f'<section class="hub-sec"><h2><a href="/blog/{k}/" style="text-decoration:none;color:inherit">{esc(HUBS[k]["name"])}</a> <span style="font-size:14px;color:#6b6b66;font-family:Inter,sans-serif;font-weight:500">({len(arts)})</span></h2><div class="rel-grid">' + ''.join(card(a) for a in top) + f'</div><p style="margin:14px 0 0"><a href="/blog/{k}/" style="font-size:14px;font-weight:600;color:#0a0a0a">All {len(arts)} {esc(HUBS[k]["short"].lower())} guides →</a></p></section>'
    body += cta_block('/property-rental/', {}) + '</main>'
    return head_html(title, desc, url, ld, 'website') + read('body-top.html') + body + read('footer.html') + read('body-tail.html')

def main():
    files = sorted(glob.glob(os.path.join(SRC, '*', '*.md')))
    arts = []
    errors = []
    for f in files:
        try:
            a = parse(f)
        except Exception as e:
            errors.append(str(e)); continue
        for k in ('title', 'description', 'h1', 'primary_query'):
            if not a.get(k):
                errors.append(f'{f}: missing {k}')
        if a['hub'] not in HUBS:
            errors.append(f'{f}: unknown hub {a["hub"]}')
        tl = len(a.get('title', '')) + len(' | The Host Bali')
        if tl > 70: errors.append(f'{f}: title too long ({tl})')
        dl = len(a.get('description', ''))
        if dl < 110 or dl > 165: errors.append(f'{f}: description length {dl}')
        if words(a['_body']) < 700: errors.append(f'{f}: body too short ({words(a["_body"])} words)')
        if len(a['_faq']) < 3: errors.append(f'{f}: only {len(a["_faq"])} FAQ')
        if a['_body'].count('\n## ') < 3: errors.append(f'{f}: fewer than 4 H2')
        arts.append(a)
    by_key = {f'{a["hub"]}/{a["slug"]}': a for a in arts}
    # internal links check
    for a in arts:
        for m in re.finditer(r'\]\((/[^)\s]+)\)', a['_body']):
            u = m.group(1).split('#')[0]
            if u.startswith('/blog/'):
                k = u.strip('/').split('/', 1)[1] if u.count('/') >= 3 else ''
                if k and k not in by_key and k not in HUBS:
                    errors.append(f'{a["_path"]}: dead blog link {u}')
            else:
                p = os.path.join(ROOT, u.strip('/'), 'index.html') if u.endswith('/') else os.path.join(ROOT, u.strip('/'))
                if not os.path.exists(p) and not u.startswith('/property-rental/?'):
                    errors.append(f'{a["_path"]}: dead site link {u}')
    seen_h1 = {}
    for a in arts:
        k = a['h1'].lower()
        if k in seen_h1: errors.append(f'duplicate h1: {a["_path"]} vs {seen_h1[k]}')
        seen_h1[k] = a['_path']
    print(f'{len(arts)} articles, {len(errors)} problems')
    for e in errors[:60]:
        print('  !', e)
    if CHECK:
        return 1 if errors else 0
    for a in arts:
        out = os.path.join(ROOT, 'blog', a['hub'], a['slug'], 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8').write(build_article(a, by_key))
    for k in HUB_ORDER:
        hub_arts = sorted([a for a in arts if a['hub'] == k], key=lambda a: (a.get('priority', '2'), a['h1']))
        if not hub_arts:
            continue
        out = os.path.join(ROOT, 'blog', k, 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8').write(build_hub(k, hub_arts, arts))
    open(os.path.join(ROOT, 'blog', 'index.html'), 'w', encoding='utf-8').write(build_index(arts))
    # sitemap
    urls = ['/blog/'] + [f'/blog/{k}/' for k in HUB_ORDER if any(a['hub'] == k for a in arts)] + [a['url'] for a in arts]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        a = next((x for x in arts if x['url'] == u), None)
        lm = a.get('updated', TODAY) if a else TODAY
        sm.append(f'  <url><loc>{SITE}{u}</loc><lastmod>{lm}</lastmod><changefreq>monthly</changefreq><priority>{"0.7" if a else "0.8"}</priority></url>')
    sm.append('</urlset>')
    open(os.path.join(ROOT, 'sitemap-blog.xml'), 'w', encoding='utf-8').write('\n'.join(sm) + '\n')
    print('written', len(arts), 'articles,', len(urls), 'urls in sitemap-blog.xml')
    return 0

if __name__ == '__main__':
    sys.exit(main())
