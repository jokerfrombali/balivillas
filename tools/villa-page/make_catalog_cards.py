#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Врезает карточки новых вилл в каталоги и на главную.

Изменяет ТОЛЬКО эти файлы и только внутри существующих сеток — вёрстка,
стили и порядок остальных карточек не трогаются:
    villas/sanur/index.html      сетка prop-card
    property-rental/index.html   сетка prop-card
    index.html                   ряд thb-arow с виллами Сануру

Карточка целиком собирается из data/villas.json. Токены data-amenities
выводятся по реальному списку amenities (сопоставление ниже), data-type —
villa/apartment по типу объекта. Признак family ставится по числу спален
(3+) — это правило витрины, а не факт из источника.

    python3 tools/villa-page/make_catalog_cards.py --check   # что будет добавлено
    python3 tools/villa-page/make_catalog_cards.py           # врезать
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NEW = ['own-serenity-3', 'own-serenity-9', 'own-serenity-6-1', 'own-serenity-6-2', 'own-serenity-10']

# слово в amenities -> токен фильтра каталога
AMEN = [
    ('pool', 'pool'), ('wi-fi', 'wifi'), ('wifi', 'wifi'), ('kitchen', 'kitchen'),
    ('air conditioning', 'ac'), ('parking', 'parking'), ('workspace', 'work'),
    ('garden', 'garden'), ('greenery', 'garden'), ('beach', 'beach'),
    ('washer', 'washer'), ('terrace', 'outdoor'), ('sunbathing', 'outdoor'),
    ('patio', 'outdoor'), ('balcony', 'outdoor'),
]

SVG_PIN = ('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
           'stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>'
           '<circle cx="12" cy="10" r="3"/></svg>')
SVG_HEART = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0'
             'L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 '
             '5.5 0 0 0 0-7.78z" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def tokens(v):
    low = ' | '.join(v['amenities']).lower()
    out = {tok for word, tok in AMEN if word in low}
    if v['bedrooms'] >= 3:
        out.add('family')          # правило витрины, не факт из Airbnb
    return ' '.join(sorted(out))


def vtype(v):
    return 'apartment' if 'apartment' in v['name'].lower() else 'villa'


def nbath(v):
    b = v['bathrooms']
    return ('%g' % b)


def meta(v, sep=' '):
    return '%d bed%s%s bath%s%d guests' % (v['bedrooms'], sep + '· ' if sep == ' ' else '',
                                           nbath(v), ' · ', v['guests'])


def meta_plain(v):
    return '%d bed · %s bath · %d guests' % (v['bedrooms'], nbath(v), v['guests'])


def fav(v, img):
    return ('<button type="button" class="thb-fav" data-fav-btn aria-pressed="false" '
            'aria-label="Save this villa" data-u="%s" data-t="%s" data-i="%s" data-m="%s" '
            'data-a="%s">%s</button>' % (v['url'], esc(v['name']), img, meta_plain(v),
                                         esc(v['area']), SVG_HEART))


def avif(u):
    return re.sub(r'\.jpg$', '.avif', u)


def prop_card(v):
    img = v.get('cardImage') or v['images'][0]
    return (
        '<div class="prop-card" data-location="%s" data-beds="%d" data-guests="%d" data-type="%s" '
        'data-amenities="%s" onclick="window.location=\'%s\'">\n'
        '          <div class="img-wrap">\n'
        '            <picture><source srcset="%s" type="image/avif"><img src="%s" alt="%s — %s villa" '
        'loading="lazy" decoding="async" width="1200" height="800"></picture>\n'
        '            <span class="badge">%s</span>\n'
        '            %s\n'
        '          </div>\n'
        '          <div style="padding:14px">\n'
        '            <p style="font-family:\'Lora\',Georgia,serif;font-size:16px;font-weight:600;'
        'margin-bottom:6px;line-height:1.2">%s</p>\n'
        '            <div class="prop-meta" style="margin-bottom:10px">\n'
        '              <span>%d bed</span><span>%s bath</span><span>%d guests</span>\n'
        '            </div>\n'
        '            <div style="display:flex;align-items:center;justify-content:space-between">\n'
        '              <div><span style="font-family:\'Lora\',Georgia,serif;font-size:19px;'
        'font-weight:700">On request</span></div>\n'
        '            </div>\n'
        '          </div>\n'
        '        </div>'
        % (v['areaSlug'], v['bedrooms'], v['guests'], vtype(v), tokens(v), v['url'],
           avif(img), img, esc(v['name']), esc(v['area']), esc(v['area']), fav(v, img),
           esc(v['name']), v['bedrooms'], nbath(v), v['guests']))


def acard(v):
    img = v.get('cardImage') or v['images'][0]
    return (
        '<div class="thb-acw"><a class="thb-acard" href="%s">\n'
        '      <img src="%s" alt="%s" loading="lazy" decoding="async" width="600" height="450">\n'
        '      <div class="in">\n'
        '        <p class="t">%s</p>\n'
        '        <p class="a">%s %s, Bali</p>\n'
        '        <p class="m">%d bed &middot; %s bath &middot; %d guests</p>\n'
        '        <p class="p">On request <span>&middot; fast reply on WhatsApp</span></p>\n'
        '      </div>\n'
        '    </a>%s</div>'
        % (v['url'], img, esc(v['name']), esc(v['name']), SVG_PIN, esc(v['area']),
           v['bedrooms'], nbath(v), v['guests'], fav(v, img)))


def close_div(s, i):
    """i — сразу ПОСЛЕ открывающего <div ...>; вернуть индекс конца его </div>."""
    depth = 1
    for m in re.finditer(r'<div\b[^>]*>|</div>', s[i:]):
        depth += 1 if m.group(0) != '</div>' else -1
        if depth == 0:
            return i + m.end()
    raise AssertionError('не нашёл закрывающий </div>')


def insert_after_last(s, opener_re, blocks, indent):
    """Вставить blocks сразу после последнего блока, открывающегося opener_re."""
    last = None
    for m in re.finditer(opener_re, s):
        last = m
    assert last, 'не нашёл якорную карточку: %s' % opener_re
    end = close_div(s, last.end())
    add = ''.join('\n' + indent + b for b in blocks)
    return s[:end] + add + s[end:]


def patch(path, opener_re, blocks, indent, label):
    p = os.path.join(ROOT, path)
    s = io.open(p, encoding='utf-8').read()
    before = len(re.findall(opener_re, s))
    for b in blocks:
        u = re.search(r"(?:window\.location='|thb-acard\" href=\")([^'\"]+)", b).group(1)
        if u in s:
            print('  уже есть, пропуск: %s' % u)
            return
    out = insert_after_last(s, opener_re, blocks, indent)
    io.open(p, 'w', encoding='utf-8').write(out)
    after = len(re.findall(opener_re, out))
    print('  %-28s %s: %d -> %d  (+%d KB)'
          % (path, label, before, after, (len(out) - len(s)) // 1024))


def main():
    data = json.load(io.open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
    by_id = {v['id']: v for v in data}
    vs = [by_id[i] for i in NEW]

    if '--check' in sys.argv:
        for v in vs:
            print('%-24s type=%-9s beds=%d guests=%d\n   amenities=%s'
                  % (v['id'], vtype(v), v['bedrooms'], v['guests'], tokens(v)))
        return

    print('Каталоги:')
    patch('villas/sanur/index.html', r'<div class="prop-card"[^>]*>',
          [prop_card(v) for v in vs], '        ', 'prop-card')
    patch('property-rental/index.html', r'<div class="prop-card"[^>]*>',
          [prop_card(v) for v in vs], '        ', 'prop-card')

    print('Главная (ряд Сануру):')
    # якорь — последняя карточка ряда Сануру: garden-pool-villa-4br-sanur
    p = os.path.join(ROOT, 'index.html')
    s = io.open(p, encoding='utf-8').read()
    if vs[0]['url'] in s:
        print('  уже есть, пропуск')
        return
    anchor = '<div class="thb-acw"><a class="thb-acard" href="/villa/sanur/garden-pool-villa-4br-sanur/">'
    i = s.find(anchor)
    assert i > 0, 'не нашёл якорь ряда Сануру'
    end = close_div(s, i + len('<div class="thb-acw">'))
    add = ''.join('\n    ' + acard(v) for v in vs)
    out = s[:end] + add + s[end:]
    io.open(p, 'w', encoding='utf-8').write(out)
    print('  index.html                   thb-acard: %d -> %d'
          % (s.count('class="thb-acard"'), out.count('class="thb-acard"')))


if __name__ == '__main__':
    main()
