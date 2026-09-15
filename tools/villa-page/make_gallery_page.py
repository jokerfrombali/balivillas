#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор вложенных gallery-страниц /villa/<area>/<slug>/gallery/.

Клонирует эталон (gallery Modern 2BR Pool Townhouse in Sanur) и подставляет
данные виллы из data/villas.json. Группы фото-тура Airbnb сохраняются как есть
(AGENTS.md: не схлопывать группы и подписи).

    python3 tools/villa-page/make_gallery_page.py            # все 5 Serenity
    python3 tools/villa-page/make_gallery_page.py own-serenity-3
"""
import json
import os
import re
import sys
import urllib.parse

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TPL = os.path.join(ROOT, 'villa', 'sanur', 'modern-2br-pool-townhouse-sanur', 'gallery', 'index.html')

T_NAME = 'Modern 2BR Pool Townhouse in Sanur'
T_SLUG = 'modern-2br-pool-townhouse-sanur'
T_BASE = 'sanur-modern-2br-townhouse'
T_URL = '/villa/sanur/modern-2br-pool-townhouse-sanur/'
T_COUNT = 32

GENERATED = ['own-serenity-3', 'own-serenity-9', 'own-serenity-6-1',
             'own-serenity-6-2', 'own-serenity-10']

_dim_cache = {}


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def dims(img_url):
    """Реальные размеры файла с диска — не выдумываем."""
    if img_url not in _dim_cache:
        path = os.path.join(ROOT, *img_url.strip('/').split('/'))
        with Image.open(path) as im:
            _dim_cache[img_url] = im.size
    return _dim_cache[img_url]


def sect_id(name):
    s = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return s or 'section'


def build_tabs(groups):
    out = ['<nav class="category-tabs">']
    for g in groups:
        out.append('<span class="tab" data-target="%s">%s</span>' % (sect_id(g['name']), esc(g['name'])))
    out.append('</nav>')
    return ''.join(out)


def build_main(groups, name):
    out = ['<main class="gallery-content">']
    for g in groups:
        gid = sect_id(g['name'])
        n = len(g['images'])
        label = g.get('airbnbLabel') or g['name']
        out.append('<section class="category-section" id="%s">' % gid)
        out.append('<div class="section-header"><h2 class="section-title">%s</h2>'
                   '<span class="section-count">%d photo%s · Airbnb: %s</span></div>'
                   % (esc(g['name']), n, '' if n == 1 else 's', esc(label)))
        out.append('<div class="photo-grid">')
        for i, img in enumerate(g['images'], 1):
            w, h = dims(img)
            avif = re.sub(r'\.jpg$', '.avif', img)
            out.append(
                '<div class="photo-item"><picture>'
                '<source srcset="%s" type="image/avif">'
                '<img loading="lazy" src="%s" alt="%s — %s photo %d" width="%d" height="%d">'
                '</picture><span class="photo-caption">%s</span></div>'
                % (avif, img, esc(name), esc(g['name']), i, w, h, esc(g['name'])))
        out.append('</div></section>')
    out.append('</main>')
    return ''.join(out)


def build(v, tpl):
    name = v['name']
    groups = [g for g in v.get('photoGroups', []) if g.get('images')]
    assert groups, 'нет photoGroups у %s' % v['id']
    total = sum(len(g['images']) for g in groups)
    slug_tail = v['url'].strip('/').split('/')[-1]
    base = os.path.basename(v['images'][0]).rsplit('-', 1)[0]

    s = tpl
    # 1. навигация по группам
    a = s.find('<nav class="category-tabs">')
    b = s.find('</nav>', a) + len('</nav>')
    s = s[:a] + build_tabs(groups) + s[b:]
    # 2. сами секции с фото
    a = s.find('<main class="gallery-content">')
    b = s.find('</main>', a) + len('</main>')
    s = s[:a] + build_main(groups, name) + s[b:]
    # 3. счётчики
    s = s.replace('1 / %d photos' % T_COUNT, '1 / %d photos' % total)
    s = s.replace('<span id="totalCount">%d</span>' % T_COUNT, '<span id="totalCount">%d</span>' % total)
    # 4. og:image — карточное фото виллы
    card = v.get('cardImage') or v['images'][0]
    s = re.sub(r'(https://thehostbali\.com)/public-objects/images/' + re.escape(T_BASE) + r'-\d+\.jpg',
               lambda m: m.group(1) + card, s)
    # 5. имя виллы (обычное и url-encoded в ссылке WhatsApp)
    s = s.replace(urllib.parse.quote(T_NAME), urllib.parse.quote(name))
    s = s.replace(esc(T_NAME), esc(name))
    s = s.replace(T_NAME, name)
    # 6. пути
    s = s.replace(T_SLUG, slug_tail)
    s = s.replace(T_URL, v['url'])
    s = s.replace(T_BASE, base)
    # 7. описание — строго по реальным группам фото, без выдуманных бассейнов
    gnames = {g['name'].lower() for g in groups}
    if any(n.startswith('pool') for n in gnames):
        what = 'every room, the pool and the outdoor areas'
    elif any(n.startswith('exterior') or n.startswith('garden') or n.startswith('terrace')
             for n in gnames):
        what = 'every room and the outdoor areas'
    else:
        what = 'every room, photographed on site'
    s = s.replace('every room, the pool and the outdoor areas', what)
    return s


def main():
    data = json.load(open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
    by_id = {v['id']: v for v in data}
    args = sys.argv[1:]
    force = '--force' in args
    ids = [a for a in args if not a.startswith('--')] or list(GENERATED)
    tpl = open(TPL, encoding='utf-8').read()
    for vid in ids:
        if vid not in GENERATED and not force:
            print('ПРОПУСК %s: не в списке GENERATED (страница написана вручную). '
                  'Нужно перезаписать — передайте --force явно.' % vid)
            continue
        v = by_id[vid]
        out_dir = os.path.join(ROOT, *v['url'].strip('/').split('/'), 'gallery')
        os.makedirs(out_dir, exist_ok=True)
        page = build(v, tpl)
        open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(page)
        print('%-20s -> %sgallery/index.html  %d KB  фото %d  групп %d'
              % (vid, v['url'], len(page) // 1024,
                 sum(len(g['images']) for g in v['photoGroups'] if g.get('images')),
                 len([g for g in v['photoGroups'] if g.get('images')])))


if __name__ == '__main__':
    main()
