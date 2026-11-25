#!/usr/bin/env python3
"""
Генератор страницы виллы из эталонного шаблона.

Клонирует /villa/sanur/modern-2br-pool-townhouse-sanur/ (канонический дизайн
Sanur-виллы, сам он склонирован с /villa/premier-umalas-16-3br-pool-townhouse/)
и подставляет данные виллы из data/villas.json. Вёрстку не меняет.

    python3 tools/villa-page/make_villa_page.py own-serenity-3 [own-serenity-9 ...]
    python3 tools/villa-page/make_villa_page.py            # все 5 Serenity
"""
import json, os, re, sys, html, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TPL  = os.path.join(ROOT, 'villa', 'sanur', 'modern-2br-pool-townhouse-sanur', 'index.html')
SITE = 'https://balivillas.ai'

T_SLUG = 'modern-2br-pool-townhouse-sanur'
T_BASE = 'sanur-modern-2br-townhouse'
T_NAME = 'Modern 2BR Pool Townhouse in Sanur'
T_SHORT = 'Modern 2BR Pool Townhouse'
T_META = '2 bed · 2.5 bath · 4 guests'
T_META_DESC = ('Modern 2BR pool townhouse in Sanur, Bali — private pool, enclosed living room, full kitchen '
               'and fast Wi-Fi, a short walk from the beach. Sleeps 4.')
T_DESC = ('New 110 m2 two-storey townhouse in a quiet part of Sanur, a 15-minute walk from the beach. '
          'Two en-suite king bedrooms (one with a workspace), a private enclosed pool and terrace, a Smart TV '
          'living room, a fully equipped kitchen, 300 Mbps Wi-Fi and housekeeping 3x a week. Ideal for families, '
          'couples and long-term stays.')

SLIDE = ('<div class="relative shrink-0 w-[89vw] h-[112vw] max-h-55vh my-4 snap-start">'
         '<button type="button" class="w-full h-full p-0 bg-transparent border-none"><picture>'
         '<source srcset="{a}" type="image/avif">'
         '<img alt="{alt}" loading="{load}"{prio} decoding="async" data-nimg="fill" '
         'class="animate-fade-in duration-300 w-full h-full object-cover rounded-xl '
         'shadow-[0_4px_8px_0px_rgba(0,0,0,0.16)]" '
         'style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent" '
         'src="{j}" width="1200" height="800"></picture></button></div>')

CAROUSEL_HEAD = ('class="overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth overscroll-x-contain '
                 'w-screen lg:mx-0 -m-5 relative scroll-px-5"><div class="flex items-start self-stretch px-5 gap-2 w-fit">')

ICONS = [
    ('private pool',      'am-pool'),    ('pool',          'am-pool'),
    ('wi-fi',             'am-wifi'),    ('wifi',          'am-wifi'),
    ('internet',          'am-wifi'),
    ('air conditioning',  'am-ac'),      ('climate',       'am-ac'),
    ('kitchen',           'am-kitchen'), ('cooking',       'am-kitchen'),
    ('dishes',            'am-dining'),  ('dining',        'am-dining'),
    ('bedroom',           'am-bed'),     ('bed linens',    'am-bed'),
    ('bathroom',          'am-bath'),    ('shower',        'am-shower'),
    ('tv',                'am-tv'),
    ('workspace',         'am-workspace'),
    ('parking',           'am-parking'), ('motorbike',     'am-motorbike'),
    ('beach',             'am-beach'),
    ('garden',            'am-garden'),  ('greenery',      'am-garden'),
    ('terrace',           'am-patio'),   ('patio',         'am-patio'),
    ('balcony',           'am-balcony'),
    ('sunbath',           'am-sun'),     ('sun terrace',   'am-sun'),
    ('coffee',            'am-coffee'),
    ('refrigerator',      'am-fridge'),  ('fridge',        'am-fridge'),
    ('microwave',         'am-microwave'),
    ('washer',            'am-washer'),  ('laundry',       'am-washer'),
    ('stove',             'am-stove'),   ('kettle',        'am-stove'),
    ('safe',              'am-safe'),
    ('hanger',            'am-hanger'),
    ('hair dryer',        'am-hairdryer'),
    ('shampoo',           'am-toiletries'), ('cleaning products','am-toiletries'),
    ('hot water',         'am-shower'),
    ('security',          'am-shield'),  ('camera',        'am-shield'),
    ('housekeeping',      'am-housekeeping'), ('cleaning', 'am-housekeeping'),
    ('entrance',          'am-check'),   ('essentials',    'am-check'),
    ('floor',             'am-view'),    ('view',          'am-view'),
    ('family',            'am-family'),
]
def icon_for(text):
    t = text.lower()
    for key, ic in ICONS:
        if key in t:
            return ic
    return 'am-check'

AM_ITEM = ('<div class="flex items-center gap-2.5 self-stretch">'
           '<svg class="shrink-0 size-5 text-primary" aria-hidden="true">'
           '<use href="/brand/amenities.svg#{ic}"></use></svg>'
           '<p class="text-body-lg-long text-primary font-normal" data-slot="text">{txt}</p></div>')

BED_ITEM = ('<div class="flex flex-col items-start gap-1.5"><picture>'
            '<source srcset="{a}" type="image/avif">'
            '<img class="w-full rounded-xl object-cover aspect-136/93" src="{j}" alt="{label}" '
            'width="1200" height="900" loading="lazy" decoding="async"></picture>'
            '<p class="text-body-lg font-medium text-primary mt-2" data-slot="text">{label}</p>'
            '<p class="text-body text-secondary font-normal" data-slot="text">{beds}</p></div>')


def esc(s):
    return html.escape(s, quote=True)


def close_div(s, i):
    """i — индекс сразу ПОСЛЕ открывающего <div ...>; вернуть индекс его </div>."""
    depth = 1
    for m in re.finditer(r'<div\b[^>]*>|</div>', s[i:]):
        depth += 1 if m.group(0) != '</div>' else -1
        if depth == 0:
            return i + m.start()
    raise AssertionError('не нашёл закрывающий </div>')


def replace_between(s, start_marker, end_marker, new, what):
    a = s.find(start_marker)
    assert a >= 0, f'не найден старт: {what}'
    b = s.find(end_marker, a + len(start_marker))
    assert b >= 0, f'не найден конец: {what}'
    return s[:a] + new + s[b:]


def build(v, tpl):
    slug_tail = v['slug'].split('/')[-1]
    base = os.path.basename(v['images'][0]).rsplit('-', 1)[0]
    short = v['name'].split(' — ')[-1] if ' — ' in v['name'] else v['name']
    n = len(v['images'])
    jpg = lambda i: v['images'][i - 1]
    avif = lambda i: v['images'][i - 1][:-4] + '.avif'
    meta = f"{v['bedrooms']} bed · {v['bathrooms']} bath · {v['guests']} guests"
    s = tpl

    # 1) карусель: ровно N слайдов
    a = s.find(CAROUSEL_HEAD)
    assert a >= 0, 'карусель не найдена'
    a += len(CAROUSEL_HEAD)
    TAIL = '</div></div></div><div class="absolute bottom-8'
    b = s.find(TAIL, a)
    assert b > a, 'конец карусели не найден'
    b += len('</div>')          # закрывающий </div> последнего слайда — часть слайда
    slides = []
    for i in range(1, n + 1):
        first = (i == 1)
        slides.append(SLIDE.format(
            a=avif(i), j=jpg(i), alt=esc(short),
            load='eager' if first else 'lazy',
            prio=' fetchpriority="high"' if first else ''))
    s = s[:a] + ''.join(slides) + s[b:]

    # 2) мозаика на 5 фото и остальные точечные ссылки — заменяем базовое имя
    #    (после пересборки карусели в документе остались только валидные индексы
    #     шаблона: мозаика 27/01/09/12/28, кровати 12/16, карточка 16, fav 27)
    tg = [x for x in v['topGallery']]
    while len(tg) < 5:
        tg.append(v['cardImage'])
    mosaic = {27: tg[0], 1: tg[1], 9: tg[2], 12: tg[3], 28: tg[4], 16: tg[1]}
    for idx, target in mosaic.items():
        for ext in ('jpg', 'avif'):
            src = f'/public-objects/images/{T_BASE}-{idx:02d}.{ext}'
            dst = target if ext == 'jpg' else target[:-4] + '.avif'
            s = s.replace(src, dst)
    # cardImage для fav/og
    s = s.replace(f'/public-objects/images/{T_BASE}-27.jpg', v['cardImage'])

    # 3) секция «Where you'll sleep» — по числу спален
    beds = []
    bedgroups = [g for g in v['photoGroups'] if re.match(r'bedroom', g['name'], re.I)]
    for i in range(v['bedrooms']):
        g = bedgroups[i] if i < len(bedgroups) else None
        pic = g['images'][0] if g and g['images'] else v['images'][min(i, n - 1)]
        beds.append(BED_ITEM.format(a=pic[:-4] + '.avif', j=pic,
                                    label=g['name'] if g else f'Bedroom {i+1}',
                                    beds='1 double bed'))
    s = replace_between(s,
        '<h2 class="text-headline text-primary font-medium" data-slot="heading">Where you’ll sleep</h2></div>'
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">', '</div></section>',
        '<h2 class="text-headline text-primary font-medium" data-slot="heading">Where you’ll sleep</h2></div>'
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' + ''.join(beds),
        'секция сна')

    # 4) удобства
    items = ''.join(AM_ITEM.format(ic=icon_for(a), txt=esc(a)) for a in v['amenities'])
    marker = ('<h2 class="text-headline text-primary font-medium" data-slot="heading">Amenities</h2></div>'
              '<div class="grid grid-cols-[1fr] lg:grid-cols-[1fr_1fr] gap-3">')
    a = s.find(marker)
    assert a >= 0, 'секция удобств не найдена'
    a += len(marker)
    b = close_div(s, a)
    s = s[:a] + items + s[b:]

    # 5) сводка: спальни / кровати / ванные / гости
    old = ('>2 Bedrooms</p>', '>2 beds</p>', '>2.5 bathrooms</p>', '>4 guests</p>')
    new = (f">{v['bedrooms']} Bedrooms</p>", f">{v['bedrooms']} beds</p>",
           f">{v['bathrooms']} bathrooms</p>", f">{v['guests']} guests</p>")
    for o, nw in zip(old, new):
        assert s.count(o) == 1, f'сводка: «{o}» встречается {s.count(o)} раз'
        s = s.replace(o, nw)

    # 6) координаты
    s = re.sub(r'(-8\.69347)\b', str(v['lat']), s)
    s = re.sub(r'(115\.259254)\b', str(v['lng']), s)

    # 6b) короткое описание для meta/og/twitter
    ABBR = {'Jl.': 'Jl\u0001', 'No.': 'No\u0001', 'St.': 'St\u0001', 'approx.': 'approx\u0001'}
    tmp = v['description']
    for k, val in ABBR.items():
        tmp = tmp.replace(k, val)
    first = re.split(r'(?<=[.!?])\s+(?=[A-Z])', tmp)[0]
    for k, val in ABBR.items():
        first = first.replace(val, k)
    if len(first) > 158:
        first = first[:155].rsplit(' ', 1)[0] + '…'
    s = s.replace(T_META_DESC, esc(first))

    # 6c) ld+json — пересобираем из данных виллы, а не патчим строками
    ld = {
        '@context': 'https://schema.org', '@type': 'VacationRental',
        'name': v['name'], 'description': v['description'], 'url': SITE + v['url'],
        'image': [SITE + i for i in (v['topGallery'] + v['images'])[:8]],
        'telephone': '+62 857 4649 9697',
        'address': {'@type': 'PostalAddress', 'addressLocality': v['area'],
                    'addressRegion': 'Bali', 'addressCountry': 'ID'},
        'containsPlace': {'@type': 'Accommodation',
                          'occupancy': {'@type': 'QuantitativeValue', 'maxValue': v['guests']},
                          'numberOfBedrooms': v['bedrooms'],
                          'numberOfBathroomsTotal': v['bathrooms']},
        'amenityFeature': [{'@type': 'LocationFeatureSpecification', 'name': a, 'value': True}
                           for a in v['amenities'][:8]],
        'geo': {'@type': 'GeoCoordinates', 'latitude': v['lat'], 'longitude': v['lng']},
        'brand': {'@type': 'Brand', 'name': 'BaliVillas'},
    }
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Villas in Bali', 'item': SITE + '/villas/'},
        {'@type': 'ListItem', 'position': 3, 'name': f"Villas in {v['area']}", 'item': SITE + f"/villas/{v['areaSlug']}/"},
        {'@type': 'ListItem', 'position': 4, 'name': v['name'], 'item': SITE + v['url']}]}
    blocks = re.findall(r'<script type="application/ld\+json">.*?</script>', s, re.S)
    assert len(blocks) == 2, f'ld+json блоков {len(blocks)}, ожидалось 2'
    for old, new in zip(blocks, (ld, crumbs)):
        s = s.replace(old, '<script type="application/ld+json">' +
                      json.dumps(new, ensure_ascii=False) + '</script>', 1)

    # 7) тексты и адреса — в самом конце, чтобы не мешать поиску маркеров
    s = s.replace(T_DESC, esc(v['description']))
    s = s.replace(T_NAME, esc(v['name']))
    s = s.replace(T_SHORT, esc(short))
    s = s.replace(T_META, meta)
    s = s.replace(T_SLUG, slug_tail)
    s = s.replace(T_BASE, base)
    return s


def main():
    data = json.load(open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
    by_id = {v['id']: v for v in data}
    # Виллы, страницы которых генерируются этим скриптом. Остальные страницы
    # сайта написаны вручную — генератор их НЕ ТРОГАЕТ.
    GENERATED = ['own-serenity-3', 'own-serenity-9', 'own-serenity-6-1',
                 'own-serenity-6-2', 'own-serenity-10']
    args = sys.argv[1:]
    force = '--force' in args
    ids = [a for a in args if not a.startswith('--')]
    if not ids:
        ids = list(GENERATED)
    tpl = open(TPL, encoding='utf-8').read()
    for vid in ids:
        if vid not in GENERATED and not force:
            print(f"ПРОПУСК {vid}: не в списке GENERATED (страница написана вручную). "
                  f"Нужно перезаписать — передайте --force явно.")
            continue
        v = by_id[vid]
        out_dir = os.path.join(ROOT, *v['url'].strip('/').split('/'))
        os.makedirs(out_dir, exist_ok=True)
        page = build(v, tpl)
        open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(page)
        print(f"{vid:20s} -> {v['url']}index.html  {len(page)//1024} KB  фото {len(v['images'])}")


if __name__ == '__main__':
    main()
