# -*- coding: utf-8 -*-
"""Итальянская версия сайта, шаг 1: собрать всё, что надо перевести.

Идём по страницам, которые получат итальянских близнецов, и вынимаем уникальные
текстовые узлы и переводимые атрибуты (alt, title, placeholder, aria-label,
meta description/og). Из <script> и <style> ничего не берём, кроме строковых
значений name/description в JSON-LD — их переводим той же таблицей.

Результат — data/i18n/it.json: {английская строка: ""} для ручного перевода
и файл со статистикой, чтобы понимать объём.
"""
import io, json, os, re, glob, collections

ROOT = r'D:\Projects\thebalihost'
OUT = os.path.join(ROOT, 'data', 'i18n')
os.makedirs(OUT, exist_ok=True)

PAGES = ['index.html', 'property-rental/index.html', 'villas/index.html',
         'about/index.html', 'contacts/index.html', 'villa-management/index.html', 'saved/index.html']
PAGES += sorted(glob.glob(os.path.join(ROOT, 'villas', '*', 'index.html')))
PAGES += sorted(glob.glob(os.path.join(ROOT, 'villa', '**', 'index.html'), recursive=True))
PAGES += sorted(glob.glob(os.path.join(ROOT, 'villas-for-sale', '**', 'index.html'), recursive=True))

SKIP_TAGS = ('script', 'style', 'noscript', 'svg', 'code', 'pre')
ATTRS = ('alt', 'title', 'placeholder', 'aria-label', 'data-t', 'data-m', 'data-a')


def strip_scripts(html):
    """Убираем скрипты и стили, но JSON-LD оставляем — его читаем отдельно."""
    ld = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    body = re.sub(r'<(script|style|noscript|svg)\b.*?</\1>', ' ', html, flags=re.S | re.I)
    return body, ld


def norm(t):
    return ' '.join(t.replace('&nbsp;', ' ').split())


seen = collections.OrderedDict()
where = collections.defaultdict(set)
per_page = {}
for f in PAGES:
    f = f if os.path.isabs(f) else os.path.join(ROOT, f)
    rel = os.path.relpath(f, ROOT).replace('\\', '/')
    html = io.open(f, encoding='utf-8').read()
    body, ld = strip_scripts(html)
    n = 0
    # текстовые узлы
    for m in re.finditer(r'>([^<>]+)<', body):
        t = norm(m.group(1))
        if not t or not re.search(r'[A-Za-z]{2}', t):
            continue
        if re.fullmatch(r'[\d\s.,:;%$€£¥+\-–—/()·•×|&;#]+|Rp [\d,]+|\$[\d,]+', t):
            continue
        seen.setdefault(t, None); where[t].add(rel); n += 1
    # атрибуты
    for a in ATTRS:
        for m in re.finditer(a + r'="([^"]{2,})"', body):
            t = norm(m.group(1))
            if re.search(r'[A-Za-z]{2}', t) and not t.startswith(('/', 'http')):
                seen.setdefault(t, None); where[t].add(rel); n += 1
    for m in re.finditer(r'<meta (?:name|property)="(?:description|og:description|twitter:description|og:title|twitter:title)" content="([^"]+)"', html):
        t = norm(m.group(1)); seen.setdefault(t, None); where[t].add(rel); n += 1
    m = re.search(r'<title>(.*?)</title>', html, re.S)
    if m:
        t = norm(m.group(1)); seen.setdefault(t, None); where[t].add(rel); n += 1
    # JSON-LD: строковые значения name/description/text/headline
    for x in ld:
        try:
            j = json.loads(x)
        except Exception:
            continue
        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in ('name', 'description', 'text', 'headline') and isinstance(v, str) and re.search(r'[A-Za-z]{2}', v):
                        seen.setdefault(norm(v), None); where[norm(v)].add(rel)
                    else:
                        walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(j)
    per_page[rel] = n

words = sum(len(t.split()) for t in seen)
print('страниц:', len(PAGES), '| уникальных строк:', len(seen), '| слов:', words)
buckets = collections.Counter()
for t in seen:
    w = len(t.split())
    buckets['1-3' if w <= 3 else '4-12' if w <= 12 else '13-40' if w <= 40 else '40+'] += 1
print('по длине:', dict(buckets))
# самые «общие» строки — на многих страницах: это интерфейс
common = sorted(seen, key=lambda t: -len(where[t]))[:40]
print('самые частые (страниц):', [(t[:40], len(where[t])) for t in common[:25]])

io.open(os.path.join(OUT, 'it.todo.json'), 'w', encoding='utf-8').write(
    json.dumps({t: {'it': '', 'pages': len(where[t])} for t in seen}, ensure_ascii=False, indent=1))
print('записано:', os.path.join(OUT, 'it.todo.json'))
