# -*- coding: utf-8 -*-
"""Итальянская версия, шаг 2: что переводится правилом, а что руками.

Имена вилл, районов, почта, бренды — остаются как есть. Подписи с именами
(«Bedroom 2 — Villa Papat», «Villa Sakura for sale in Sanur, Bali») собираются
по шаблону. Остальное — в it.manual.json на ручной перевод, по кускам.
"""
import io, json, os, re

ROOT = r'D:\Projects\thebalihost'
D = os.path.join(ROOT, 'data', 'i18n')
todo = json.load(io.open(os.path.join(D, 'it.todo.json'), encoding='utf-8'))
V = json.load(io.open(os.path.join(ROOT, 'data', 'villas.json'), encoding='utf-8'))
S = json.load(io.open(os.path.join(ROOT, 'data', 'for-sale.json'), encoding='utf-8'))

NAMES = set()
for v in V:
    NAMES.add(v['name']); NAMES.add(v['name'].split(' — ')[0]); NAMES.add(v['name'].split(' — ')[0])
for x in S:
    NAMES.add(x['shortName']); NAMES.add(x['name'])
NAMES |= {'Sanur', 'Canggu', 'Umalas', 'Ungasan', 'Pererenan', 'Bali', 'BaliVillas', 'The HOST', 'WhatsApp',
          'Instagram', 'Email', 'Bosch', 'Hostex', 'Airbnb', 'Booking.com', 'Google', 'Wi-Fi', 'IDR', 'USD', 'EUR',
          'hello@balivillas.ai', 'THB-001', 'THB-002', 'THB-003', 'THB-004', 'THB-005', 'THB-006',
          'Jl. Kesari II, Sanur, South Denpasar', 'Jl. Kesari II, Sanur, Denpasar Selatan',
          'Jl. Danau Tamblingan No.21, Sanur, Denpasar Selatan', 'Jalan Umalas Klecung, Kerobokan Kelod, Kuta Utara',
          'Sanur Kauh, South Denpasar', 'Sanur, South Denpasar', 'PT Premier Development Group',
          'PT Eleviate Catalyst Management', 'AdvanceCM', 'Melasti', 'Green Bowl', 'Uluwatu', 'Seminyak', 'Berawa',
          'EN English', 'RU Русский', 'DE Deutsch', 'FR Français', 'JA 日本語', 'ZH 中文', 'IT Italiano'}
SHORT_NAMES = sorted({n for n in NAMES if len(n) < 40}, key=len, reverse=True)

# шаблоны с именами: (регулярка по-английски, итальянский формат)
PAT = [
    (r'^Bedroom (\d+) — (.+)$', r'Camera \1 — \2'),
    (r'^Bedroom (\d+)$', r'Camera \1'),
    (r'^Bathroom (\d+)$', r'Bagno \1'),
    (r'^(.+) for sale in (Sanur|Canggu|Umalas|Ungasan), Bali$', r'\1 in vendita a \2, Bali'),
    (r'^Villas for sale in (Sanur|Canggu|Umalas|Ungasan)$', r'Ville in vendita a \1'),
    (r'^Villas for sale in (Sanur|Canggu|Umalas|Ungasan), Bali$', r'Ville in vendita a \1, Bali'),
    (r'^Villas in (Sanur|Canggu|Umalas|Ungasan)$', r'Ville a \1'),
    (r'^Villas in (Sanur|Canggu|Umalas|Ungasan), Bali$', r'Ville a \1, Bali'),
    (r'^Villa in (Sanur|Canggu|Umalas|Ungasan)$', r'Villa a \1'),
    (r'^Villa for sale in (Sanur|Canggu|Umalas|Ungasan), Bali$', r'Villa in vendita a \1, Bali'),
    (r'^(.+) — Photo gallery \| BaliVillas$', r'\1 — Galleria fotografica | BaliVillas'),
    (r'^(.+) photo tour \| BaliVillas$', r'\1 — Galleria fotografica | BaliVillas'),
    (r'^Photo tour of (.+): every room, the pool and the outdoor areas\. Managed and rented direct by BaliVillas\.$',
     r'Tour fotografico di \1: ogni stanza, la piscina e gli spazi esterni. Gestita e affittata direttamente da BaliVillas.'),
    (r'^(\d+) villas$', r'\1 ville'),
    (r'^(\d+) villa$', r'\1 villa'),
    (r'^(\d+) bed$', r'\1 letti'),
    (r'^(\d+) bath$', r'\1 bagni'),
    (r'^(\d+) guests$', r'\1 ospiti'),
    (r'^(\d+) bedrooms$', r'\1 camere'),
    (r'^(\d+) bathrooms$', r'\1 bagni'),
    (r'^(\d+) Bedrooms$', r'\1 camere'),
    (r'^(\d+) m² land$', r'\1 m² di terreno'),
    (r'^(\d+) m² built$', r'\1 m² costruiti'),
    (r'^(\d+) m² house$', r'\1 m² di casa'),
    (r'^(\d+) m²$', r'\1 m²'),
    (r'^(\d+)BR Pool Villa$', r'Villa con piscina, \1 camere'),
    (r'^(\d+) bedroom$', r'\1 camera'),
    (r'^(\d+) bedrooms · (\d+) bathrooms$', r'\1 camere · \2 bagni'),
    (r'^Save (.+)$', r'Salva \1'),
]

# названия помещений в подписях фото (в т.ч. русские из выгрузки Airbnb)
ROOMS = {
    'Pool': 'Piscina', 'Patio': 'Patio', 'Living room': 'Soggiorno', 'Dining area': 'Zona pranzo',
    'Full kitchen': 'Cucina completa', 'Kitchen': 'Cucina', 'Laundry area': 'Zona lavanderia',
    'Half bathroom': 'Bagno di servizio', 'Full bathroom': 'Bagno completo', 'Bedroom': 'Camera',
    'Additional photos': 'Altre foto', 'Exterior': 'Esterni', 'Workspace': 'Postazione di lavoro',
    'Entrance': 'Ingresso', 'Courtyard': 'Cortile', 'Terrace': 'Terrazza', 'Garden': 'Giardino',
    'Bathroom': 'Bagno', 'Toilet': 'WC', 'Balcony': 'Balcone', 'Office': 'Studio',
    'Снаружи': 'Esterni', 'Бассейн': 'Piscina', 'Гостиная': 'Soggiorno', 'Спальня': 'Camera',
    'Обеденная зона': 'Zona pranzo', 'Место для работы': 'Postazione di lavoro',
    'Полноценная кухня': 'Cucina completa', 'Ванная с туалетом': 'Bagno completo',
    'Дополнительные фото': 'Altre foto', 'Кухня': 'Cucina', 'Терраса': 'Terrazza', 'Сад': 'Giardino',
}


def room_it(label):
    """«Bedroom 2», «Ванная с туалетом 3» -> итальянское название с номером."""
    m = re.match(r'^(.*?)(?: (\d+))?$', label.strip())
    base, num = m.group(1), m.group(2)
    it = ROOMS.get(base, base)
    return it + (' ' + num if num else '')


def try_extra(t):
    m = re.match(r'^(\d+) photos? · Airbnb: (.+)$', t)
    if m:
        return '%s foto · Airbnb: %s' % (m.group(1), room_it(m.group(2)))
    m = re.match(r'^(.+) — (Sanur|Canggu|Umalas|Ungasan) villa$', t)
    if m:
        return '%s — villa a %s' % (m.group(1), m.group(2))
    m = re.match(r'^(.+) — (.+?) photo (\d+)$', t)
    if m:
        return '%s — %s, foto %s' % (m.group(1), room_it(m.group(2)), m.group(3))
    m = re.match(r'^Photo tour of (.+): every room, the pool and the outdoor areas\. Managed and rented direct(?:ly)? by BaliVillas\.$', t)
    if m:
        return 'Tour fotografico di %s: ogni stanza, la piscina e gli spazi esterni. Gestita e affittata direttamente da BaliVillas.' % m.group(1)
    m = re.match(r'^Frequently asked questions — (.+)$', t)
    if m:
        return 'Domande frequenti — ' + m.group(1)
    m = re.match(r'^(\d+) bed · ([\d.]+) bath · (\d+) guests$', t)
    if m:
        return '%s camere · %s bagni · %s ospiti' % (m.group(1), m.group(2).replace('.', ','), m.group(3))
    m = re.match(r'^(\d+) bed · (\d+) bath · (\d+) m² · (\d+) m² land$', t)
    if m:
        return '%s camere · %s bagni · %s m² · %s m² di terreno' % m.groups()
    m = re.match(r'^1 / (\d+) photos$', t)
    if m:
        return '1 / %s foto' % m.group(1)
    m = re.match(r'^(\d+) photos$', t)
    if m:
        return '%s foto' % m.group(1)
    m = re.match(r'^(\d+) guests maximum$', t)
    if m:
        return 'Massimo %s ospiti' % m.group(1)
    m = re.match(r'^(\d+) villas? — (Sanur|Canggu|Umalas|Ungasan)$', t)
    if m:
        return '%s %s — %s' % (m.group(1), 'villa' if m.group(1) == '1' else 'ville', m.group(2))
    m = re.match(r'^Show (\d+) (Sanur|Canggu|Umalas|Ungasan) villas?$', t)
    if m:
        return 'Mostra %s %s a %s' % (m.group(1), 'villa' if m.group(1) == '1' else 'ville', m.group(2))
    m = re.match(r'^Full bathroom (\d+)$', t)
    if m:
        return 'Bagno completo ' + m.group(1)
    m = re.match(r'^Bedroom (\d+) image$', t)
    if m:
        return 'Foto della camera ' + m.group(1)
    m = re.match(r'^(\d+) beds$', t)
    if m:
        return '%s letti' % m.group(1)
    m = re.match(r'^([\d.]+) bath(rooms)?$', t)
    if m:
        return m.group(1).replace('.', ',') + ' bagni'
    m = re.match(r'^(\d+) photos? · (.+)$', t)
    if m:
        return '%s foto · %s' % (m.group(1), room_it(m.group(2)))
    return None

auto, manual = {}, {}
for t, meta in todo.items():
    if t in NAMES or t.replace('&amp;', '&') in NAMES:
        auto[t] = t; continue
    if not re.search(r'[a-z]', t):           # ЗАГЛАВНЫЕ коды, аббревиатуры
        auto[t] = t; continue
    x = try_extra(t)
    if x is not None:
        auto[t] = x; continue
    done = False
    for pat, rep in PAT:
        m = re.match(pat, t)
        if m:
            out = rep
            for gi, gv in enumerate(m.groups(), 1):
                out = out.replace('\\' + str(gi), gv or '')
            auto[t] = out; done = True; break
    if done:
        continue
    manual[t] = meta

done_tr = {}
import glob as _g
for f in _g.glob(os.path.join(D, 'it.tr.*.json')):
    done_tr.update(json.load(io.open(f, encoding='utf-8')))
manual = {k: v for k, v in manual.items() if k not in done_tr}

# ручной список по убыванию частоты: интерфейс раньше, контент потом
items = sorted(manual.items(), key=lambda kv: (-kv[1]['pages'], len(kv[0])))
json.dump(auto, io.open(os.path.join(D, 'it.auto.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump([k for k, _ in items], io.open(os.path.join(D, 'it.manual.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
words = sum(len(k.split()) for k, _ in items)
print('авто:', len(auto), '| руками:', len(manual), '| слов руками:', words)
