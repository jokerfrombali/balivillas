# -*- coding: utf-8 -*-
"""Итальянская версия, шаг 4: собрать близнецов под /it/.

Для каждой английской страницы из списка делаем копию по тому же пути под
/it/: lang="it", все текстовые узлы, атрибуты, meta, <title> и строки JSON-LD
берём из словаря (it.auto.json + it.tr.*.json; ручные переводы главнее
правил). Внутренние ссылки на страницы, у которых есть близнец, получают
префикс /it/. Canonical и hreflang указывают друг на друга.

Статический «переключатель языка» (#langSwitcher) на английских страницах
не работает — у него нет обработчика; его убираем и там и там, а живой
переключатель ставит thb-lang.js на всех страницах (см. worker/index.js).
"""
import io, json, os, re, glob

ROOT = r'D:\Projects\thebalihost'
D = os.path.join(ROOT, 'data', 'i18n')
SITE = 'https://balivillas.ai'

PAGES = ['index.html', 'property-rental/index.html', 'villas/index.html',
         'about/index.html', 'contacts/index.html', 'villa-management/index.html', 'saved/index.html']
PAGES += sorted(glob.glob(os.path.join(ROOT, 'villas', '*', 'index.html')))
PAGES += sorted(glob.glob(os.path.join(ROOT, 'villa', '**', 'index.html'), recursive=True))
PAGES += sorted(glob.glob(os.path.join(ROOT, 'villas-for-sale', '**', 'index.html'), recursive=True))
PAGES = [p if os.path.isabs(p) else os.path.join(ROOT, p) for p in PAGES]


def rel_of(f):
    return os.path.relpath(f, ROOT).replace('\\', '/')


def path_of(f):
    """/villa/sanur/x/ для .../villa/sanur/x/index.html, / для index.html."""
    r = rel_of(f)
    return '/' + r[:-len('index.html')]


TWINS = {path_of(f) for f in PAGES}

# --- словарь ---
T = json.load(io.open(os.path.join(D, 'it.auto.json'), encoding='utf-8'))
for f in sorted(glob.glob(os.path.join(D, 'it.tr.*.json'))):
    T.update(json.load(io.open(f, encoding='utf-8')))
T = {k: v for k, v in T.items() if v and v != k}

# Полные имена вилл («Villa Kesari 4 — Family 3BR Pool Villa in Sanur») по
# правилам остаются как есть, но описательная часть после тире — это SEO-текст.
# Берём её из переведённого <title> той же виллы: «… | The Host Bali».
for _v in json.load(io.open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8')):
    _n = _v['name']
    _t = T.get(_n + ' | The Host Bali')
    if _t and _t.endswith(' | The Host Bali') and _n not in T:
        T[_n] = _t[:-len(' | The Host Bali')]


def norm(t):
    return ' '.join(t.replace('&nbsp;', ' ').split())


def tr(text):
    """Перевод текстового узла с сохранением пробелов по краям и &nbsp;."""
    m = re.match(r'^(\s*)(.*?)(\s*)$', text, re.S)
    lead, core, trail = m.groups()
    key = norm(core)
    if not key or key not in T:
        return text
    out = T[key]
    if '&nbsp;' in core and ' ' not in core:
        out = out.replace(' ', '&nbsp;')
    return lead + out + trail


def tr_attr(val):
    key = norm(val)
    return T.get(key, val)


ATTRS = ('alt', 'title', 'placeholder', 'aria-label', 'data-t', 'data-m', 'data-a')
SKIP = r'<(?P<t>script|style|noscript|svg|code|pre)\b[^>]*>.*?</(?P=t)>'


def it_path(p):
    """/x/ -> /it/x/ если у страницы есть близнец; иначе как есть."""
    core = re.split(r'[?#]', p, 1)[0]
    if core in TWINS:
        return '/it' + p if p != '/' else '/it/'
    return p


def rewrite_links(seg):
    seg = re.sub(r'href="(/[^"]*)"', lambda m: 'href="%s"' % it_path(m.group(1)), seg)
    seg = re.sub(r"onclick=\"window\.location='(/[^']*)'\"",
                 lambda m: "onclick=\"window.location='%s'\"" % it_path(m.group(1)), seg)
    return seg


def tr_segment(seg):
    """Кусок HTML без скриптов/стилей: тексты, атрибуты, ссылки."""
    seg = re.sub(r'>([^<>]+)<', lambda m: '>' + tr(m.group(1)) + '<', seg)
    for a in ATTRS:
        seg = re.sub(a + r'="([^"]{2,})"', lambda m, a=a: '%s="%s"' % (a, tr_attr(m.group(1))), seg)
    seg = re.sub(r'(<meta (?:name|property)="(?:description|og:description|twitter:description|og:title|twitter:title)" content=")([^"]+)(")',
                 lambda m: m.group(1) + tr_attr(m.group(2)) + m.group(3), seg)
    seg = re.sub(r'<title>(.*?)</title>', lambda m: '<title>' + tr_attr(norm(m.group(1))) + '</title>', seg, flags=re.S)
    seg = rewrite_links(seg)
    return seg


ORG_TYPES = {'Organization', 'RealEstateAgent', 'LocalBusiness', 'Brand', 'LodgingBusiness'}


def tr_ld(txt):
    try:
        j = json.loads(txt)
    except Exception:
        return txt

    def walk(o, parent_type=None):
        if isinstance(o, dict):
            t = o.get('@type')
            for k, v in list(o.items()):
                if isinstance(v, str):
                    if k in ('name', 'description', 'text', 'headline') and norm(v) in T:
                        o[k] = T[norm(v)]
                    elif k in ('url', 'item', '@id') and v.startswith(SITE + '/') and t not in ORG_TYPES:
                        p = v[len(SITE):]
                        o[k] = SITE + it_path(p)
                    elif k == 'inLanguage':
                        o[k] = 'it'
                else:
                    walk(v, t)
        elif isinstance(o, list):
            for v in o:
                walk(v, parent_type)
    walk(j)
    return json.dumps(j, ensure_ascii=False, indent=1)


def tr_script(seg):
    """Обычный inline-скрипт: только адреса страниц-близнецов в кавычках."""
    return re.sub(r"(['\"])(/[A-Za-z0-9\-/]*/)\1",
                  lambda m: m.group(1) + it_path(m.group(2)) + m.group(1), seg)


def remove_lang_switcher(html):
    """Убираем <div ... id="langSwitcher">…</div> с балансом вложенных div."""
    while True:
        m = re.search(r'(<!-- Language(?: switcher)? -->\s*)?<div[^>]*id="langSwitcher"[^>]*>', html)
        if not m:
            return html
        i, depth, pos = m.start(), 0, m.start()
        for tag in re.finditer(r'<div\b|</div>', html[m.start():]):
            depth += 1 if tag.group(0) == '<div' else -1
            if depth == 0:
                pos = m.start() + tag.end()
                break
        html = html[:i] + html[pos:]


def hreflang_block(en_url, it_url):
    return ('<link rel="alternate" hreflang="x-default" href="%s">\n'
            '<link rel="alternate" hreflang="en" href="%s">\n'
            '<link rel="alternate" hreflang="it" href="%s">' % (en_url, en_url, it_url))


def build(f):
    p = path_of(f)
    html = io.open(f, encoding='utf-8').read()
    html = remove_lang_switcher(html)

    # Скрипты/стили/svg вынимаем в плейсхолдеры-комментарии: текст рядом с
    # <svg> («Villas for rent <svg…») остаётся обычным текстовым узлом.
    blocks = []

    def stash(m):
        blocks.append(m.group(0))
        return '<!--@@%d@@-->' % (len(blocks) - 1)
    html = re.sub(SKIP, stash, html, flags=re.S | re.I)
    html = tr_segment(html)

    def restore(m):
        seg = blocks[int(m.group(1))]
        low = seg.lstrip().lower()
        if low.startswith('<script type="application/ld+json"'):
            mm = re.match(r'(<script[^>]*>)(.*)(</script>)$', seg, re.S)
            return mm.group(1) + tr_ld(mm.group(2)) + mm.group(3)
        if low.startswith('<script'):
            return tr_script(seg)
        if low.startswith('<style'):
            # селекторы вида a[href="/property-rental/"] — ссылки теперь с /it/
            return seg.replace('[href="/', '[href$="/')
        return seg
    html = re.sub(r'<!--@@(\d+)@@-->', restore, html)

    html = re.sub(r'<html lang="en"', '<html lang="it"', html, count=1)
    html = html.replace('content="en_US"', 'content="it_IT"').replace('content="en_GB"', 'content="it_IT"')
    en_url, it_url = SITE + p, SITE + '/it' + p
    html = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s">' % it_url, html, count=1)
    html = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="%s">' % it_url, html, count=1)
    if p != '/':
        html = re.sub(r'\s*<link rel="alternate" hreflang="[^"]*"\s+href="[^"]*"\s*/?>', '', html)
        html = re.sub(r'(<link rel="canonical" href="[^"]*">)', r'\1\n' + hreflang_block(en_url, it_url), html, count=1)
    return html


def main():
  n = 0
  for f in PAGES:
    html = build(f)
    dst = os.path.join(ROOT, 'it', rel_of(f))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    io.open(dst, 'w', encoding='utf-8', newline='').write(html)
    n += 1
  print('близнецов:', n)
  json.dump(sorted(TWINS), io.open(os.path.join(D, 'it.pages.json'), 'w', encoding='utf-8'), indent=0)


if __name__ == '__main__':
    main()
