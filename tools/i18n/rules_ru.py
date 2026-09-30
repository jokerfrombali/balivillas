# -*- coding: utf-8 -*-
"""Русский: что переводится правилом, а что руками.

Имена вилл, районы, бренды и почта остаются как есть. Подписи, собранные из
шаблона («Bedroom 2 — Villa Papat», «3 bed · 2 bath · 6 guests»), собираются
обратно по такому же шаблону, но с русскими числительными: у нас «1 спальня»,
«2 спальни» и «5 спален» — три разные формы, и машинально тут не выйдет.

Остальное уходит в ru.manual.json на ручной перевод.
"""
import io, json, os, re, glob

ROOT = r'D:\Projects\thebalihost'
D = os.path.join(ROOT, 'data', 'i18n')
todo = json.load(io.open(os.path.join(D, 'it.todo.json'), encoding='utf-8'))
V = json.load(io.open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
S = json.load(io.open(os.path.join(ROOT, 'data', 'for-sale.json'), encoding='utf-8'))

# ---------- имена, которые не переводятся ----------

NAMES = set()
for v in V:
    NAMES.add(v['name'])
    NAMES.add(v['name'].split(' — ')[0])
for x in S:
    NAMES.add(x['shortName']); NAMES.add(x['name'])
NAMES |= {'Bali', 'The Host Bali', 'The HOST', 'WhatsApp', 'Instagram', 'Email', 'Bosch',
          'Hostex', 'Airbnb', 'Booking.com', 'Agoda', 'Trip.com', 'Google', 'Wi-Fi',
          'IDR', 'USD', 'EUR', 'hello@thehostbali.com', 'Pererenan', 'Berawa', 'Seminyak',
          'Uluwatu', 'Melasti', 'Green Bowl', 'Ubud', 'Jimbaran', 'Pecatu', 'Kerobokan',
          'Batu Bolong', 'Echo Beach', 'Nusa Penida', 'Lembongan', 'Denpasar',
          'THB-001', 'THB-002', 'THB-003', 'THB-004', 'THB-005', 'THB-006',
          'EN English', 'RU Русский', 'IT Italiano', 'DE Deutsch', 'FR Français'}

# ---------- числительные ----------


def plural(n, one, few, many):
    """1 спальня, 2 спальни, 5 спален — по правилам русского счёта."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return few
    return many


def beds(n): return '%s %s' % (n, plural(n, 'спальня', 'спальни', 'спален'))
def baths(n): return '%s %s' % (n, plural(n, 'санузел', 'санузла', 'санузлов'))
def guests(n): return '%s %s' % (n, plural(n, 'гость', 'гостя', 'гостей'))
def nights(n): return '%s %s' % (n, plural(n, 'ночь', 'ночи', 'ночей'))
def villas(n): return '%s %s' % (n, plural(n, 'вилла', 'виллы', 'вилл'))
def photos(n): return '%s %s' % (n, plural(n, 'фото', 'фото', 'фото'))

# ---------- районы склоняются ----------

AREA_IN = {'Sanur': 'Сануре', 'Canggu': 'Чангу', 'Umalas': 'Умаласе', 'Ungasan': 'Унгасане',
           'Pererenan': 'Пререренане', 'Seminyak': 'Семиньяке', 'Bali': 'Бали'}
AREA_NOM = {'Sanur': 'Санур', 'Canggu': 'Чангу', 'Umalas': 'Умалас', 'Ungasan': 'Унгасан'}

# ---------- названия помещений в подписях фото ----------

ROOMS = {
    'Pool': 'Бассейн', 'Patio': 'Патио', 'Living room': 'Гостиная', 'Dining area': 'Обеденная зона',
    'Full kitchen': 'Полноценная кухня', 'Kitchen': 'Кухня', 'Laundry area': 'Прачечная',
    'Half bathroom': 'Гостевой санузел', 'Full bathroom': 'Санузел с душем', 'Bedroom': 'Спальня',
    'Additional photos': 'Дополнительные фото', 'Exterior': 'Снаружи', 'Workspace': 'Рабочее место',
    'Entrance': 'Вход', 'Courtyard': 'Внутренний двор', 'Terrace': 'Терраса', 'Garden': 'Сад',
    'Bathroom': 'Ванная', 'Toilet': 'Туалет', 'Balcony': 'Балкон', 'Office': 'Кабинет',
    'Снаружи': 'Снаружи', 'Бассейн': 'Бассейн', 'Гостиная': 'Гостиная', 'Спальня': 'Спальня',
    'Обеденная зона': 'Обеденная зона', 'Место для работы': 'Рабочее место',
    'Полноценная кухня': 'Полноценная кухня', 'Ванная с туалетом': 'Санузел с душем',
    'Дополнительные фото': 'Дополнительные фото', 'Кухня': 'Кухня', 'Терраса': 'Терраса',
    'Сад': 'Сад',
}


def room_ru(label):
    m = re.match(r'^(.*?)(?: (\d+))?$', (label or '').strip())
    base, num = m.group(1), m.group(2)
    ru = ROOMS.get(base, base)
    return ru + (' ' + num if num else '')


# ---------- шаблоны ----------

def try_pattern(t):
    m = re.match(r'^Bedroom (\d+) — (.+)$', t)
    if m:
        return 'Спальня %s — %s' % (m.group(1), m.group(2))
    m = re.match(r'^Bedroom (\d+)$', t)
    if m:
        return 'Спальня ' + m.group(1)
    m = re.match(r'^Bathroom (\d+)$', t)
    if m:
        return 'Ванная ' + m.group(1)
    m = re.match(r'^Full bathroom (\d+)$', t)
    if m:
        return 'Санузел с душем ' + m.group(1)
    m = re.match(r'^Bedroom (\d+) image$', t)
    if m:
        return 'Фото спальни ' + m.group(1)

    m = re.match(r'^Villas for sale in (Sanur|Canggu|Umalas|Ungasan)(, Bali)?$', t)
    if m:
        return 'Виллы на продажу в %s%s' % (AREA_IN[m.group(1)], ', Бали' if m.group(2) else '')
    m = re.match(r'^Villas in (Sanur|Canggu|Umalas|Ungasan)(, Bali)?$', t)
    if m:
        return 'Виллы в %s%s' % (AREA_IN[m.group(1)], ', Бали' if m.group(2) else '')
    m = re.match(r'^Villa in (Sanur|Canggu|Umalas|Ungasan)$', t)
    if m:
        return 'Вилла в ' + AREA_IN[m.group(1)]
    m = re.match(r'^(.+) for sale in (Sanur|Canggu|Umalas|Ungasan), Bali$', t)
    if m:
        return '%s на продажу в %s, Бали' % (m.group(1), AREA_IN[m.group(2)])
    m = re.match(r'^(.+) — (Sanur|Canggu|Umalas|Ungasan) villa$', t)
    if m:
        return '%s — вилла в %s' % (m.group(1), AREA_IN[m.group(2)])

    m = re.match(r'^(\d+) bed · ([\d.]+) bath · (\d+) guests$', t)
    if m:
        return '%s · %s · %s' % (beds(m.group(1)),
                                 baths(m.group(2)) if '.' not in m.group(2)
                                 else m.group(2).replace('.', ',') + ' санузла',
                                 guests(m.group(3)))
    m = re.match(r'^(\d+) bed · (\d+) bath · (\d+) m² · (\d+) m² land$', t)
    if m:
        return '%s · %s · %s м² · %s м² участок' % (beds(m.group(1)), baths(m.group(2)),
                                                    m.group(3), m.group(4))
    m = re.match(r'^(\d+) bedrooms?$', t)
    if m:
        return beds(m.group(1))
    m = re.match(r'^(\d+) Bedrooms$', t)
    if m:
        return beds(m.group(1))
    m = re.match(r'^(\d+) bathrooms?$', t)
    if m:
        return baths(m.group(1))
    m = re.match(r'^(\d+) guests?$', t)
    if m:
        return guests(m.group(1))
    m = re.match(r'^(\d+) guests maximum$', t)
    if m:
        return 'Не больше ' + guests(m.group(1))
    m = re.match(r'^(\d+) beds$', t)
    if m:
        return '%s %s' % (m.group(1), plural(m.group(1), 'кровать', 'кровати', 'кроватей'))
    m = re.match(r'^(\d+) bed$', t)
    if m:
        return '%s %s' % (m.group(1), plural(m.group(1), 'кровать', 'кровати', 'кроватей'))
    m = re.match(r'^([\d.]+) bath(rooms)?$', t)
    if m:
        return (m.group(1).replace('.', ',') + ' санузла') if '.' in m.group(1) else baths(m.group(1))

    m = re.match(r'^(\d+) villas?$', t)
    if m:
        return villas(m.group(1))
    m = re.match(r'^(\d+) villas? — (Sanur|Canggu|Umalas|Ungasan)$', t)
    if m:
        return '%s — %s' % (villas(m.group(1)), AREA_NOM[m.group(2)])
    m = re.match(r'^Show (\d+) (Sanur|Canggu|Umalas|Ungasan) villas?$', t)
    if m:
        return 'Показать %s в %s' % (villas(m.group(1)), AREA_IN[m.group(2)])
    m = re.match(r'^Show (\d+) villas?$', t)
    if m:
        return 'Показать ' + villas(m.group(1))

    m = re.match(r'^(\d+) m² land$', t)
    if m:
        return m.group(1) + ' м² участок'
    m = re.match(r'^(\d+) m² house$', t)
    if m:
        return m.group(1) + ' м² дом'
    m = re.match(r'^(\d+) m² built$', t)
    if m:
        return m.group(1) + ' м² застройки'
    m = re.match(r'^(\d+) m²$', t)
    if m:
        return m.group(1) + ' м²'

    m = re.match(r'^(\d+) photos?$', t)
    if m:
        return photos(m.group(1))
    m = re.match(r'^1 / (\d+) photos$', t)
    if m:
        return '1 / ' + photos(m.group(1))
    m = re.match(r'^(\d+) photos? · Airbnb: (.+)$', t)
    if m:
        return '%s · Airbnb: %s' % (photos(m.group(1)), room_ru(m.group(2)))
    m = re.match(r'^(\d+) photos? · (.+)$', t)
    if m:
        return '%s · %s' % (photos(m.group(1)), room_ru(m.group(2)))
    m = re.match(r'^(.+) — (.+?) photo (\d+)$', t)
    if m:
        return '%s — %s, фото %s' % (m.group(1), room_ru(m.group(2)), m.group(3))
    m = re.match(r'^(.+) — Photo gallery \| The Host Bali$', t)
    if m:
        return '%s — фотогалерея | The Host Bali' % m.group(1)
    m = re.match(r'^Frequently asked questions — (.+)$', t)
    if m:
        return 'Частые вопросы — ' + m.group(1)
    m = re.match(r'^Save (.+)$', t)
    if m:
        return 'Сохранить ' + m.group(1)
    return None


auto, manual = {}, {}
for t, meta in todo.items():
    if t in NAMES or t.replace('&amp;', '&') in NAMES:
        auto[t] = t
        continue
    if not re.search(r'[a-z]', t):          # коды и аббревиатуры
        auto[t] = t
        continue
    x = try_pattern(t)
    if x is not None:
        auto[t] = x
        continue
    manual[t] = meta

done = {}
for f in glob.glob(os.path.join(D, 'ru.tr.*.json')):
    done.update(json.load(io.open(f, encoding='utf-8')))
manual = {k: v for k, v in manual.items() if k not in done}

items = sorted(manual.items(), key=lambda kv: (-kv[1]['pages'], len(kv[0])))
json.dump(auto, io.open(os.path.join(D, 'ru.auto.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump([k for k, _ in items], io.open(os.path.join(D, 'ru.manual.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('авто:', len(auto), '| руками:', len(manual),
      '| слов руками:', sum(len(k.split()) for k, _ in items))
