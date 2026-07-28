# -*- coding: utf-8 -*-
"""
Заполняет "богатый" шаблон villa/index.html (дизайн в стиле Airbnb) данными реальных вилл
из growth-engine/real-villas.json и пишет villa/<slug>/index.html.

Запуск:  python3 growth-engine/fill-rich-template.py [slug ...]
Без аргументов обрабатывает все виллы.
"""
import json, re, os, sys, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "growth-engine", "rich-villa-template.html")
DATA = os.path.join(ROOT, "growth-engine", "real-villas.json")
ORIGIN = "https://balivillas.ai"
WA = "6281239081021"

BEDS_WORD = {1: "1 bed", 2: "2 beds", 3: "3 beds", 4: "4 beds", 5: "5 beds", 6: "6 beds"}

def build(v, tpl):
    h = tpl
    slug = v["slug"]
    name_short = v["name"].split("—")[0].strip()
    area = v["city"]
    bd, ba, g = v["bedrooms"], v["bathrooms"], v["maxGuests"]
    desc_full = v["description"].replace("\n\n", " ").replace("\n", " ").strip()
    desc_first = v["description"].split("\n\n")[0].strip()

    # 1) Индексация и мета
    h = h.replace('<meta name="robots" content="noindex, nofollow">',
                  '<meta name="robots" content="index, follow">')
    h = h.replace('<meta name="googlebot" content="noindex, nofollow">',
                  '<meta name="googlebot" content="index, follow">')
    h = h.replace("<title>BaliVillas.ai</title>",
                  f"<title>{html.escape(v['name'])} | {area}, Bali — BaliVillas.ai</title>")

    # 2) Имя, район, цифры
    h = h.replace("Umalas Premier Villa", name_short)
    h = h.replace("Home in Umalas", f"Home in {area}")
    h = h.replace("3 Bedrooms", f"{bd} Bedrooms")
    h = h.replace("3 beds", BEDS_WORD.get(bd, f"{bd} beds"))
    h = h.replace("4.3 bathrooms", f"{ba} bathrooms")
    h = h.replace("6 guests", f"{g} guests")

    # 3) Описание (везде: и в HTML, и в RSC-payload)
    h = re.sub(r'%s is a tropical oasis[^<"\\\\]*' % re.escape(name_short),
               lambda m: desc_full, h)

    # 4) Локация
    loc_text = (f"{name_short} is located in {area}, Bali — a peaceful area with cafes, "
                f"restaurants and beaches nearby. Message us on WhatsApp for directions and travel tips.")
    h = re.sub(r'Immerse yourself in Umalas[^<"\\\\]*', lambda m: loc_text, h)
    h = re.sub(r'Immerse yourself in %s[^<"\\\\]*' % re.escape(area), lambda m: loc_text, h)
    h = h.replace("Kecamatan Kuta, Indonesia 92253, United States", f"{area}, Bali, Indonesia")

    # 5) Цена и лицензия
    h = h.replace("from $3,588 / night", "best direct rate via WhatsApp")
    h = h.replace("$3,588", "")
    h = re.sub(r'Property License: \d*', "Hosted by BaliVillas.ai", h)

    # 6) Фото: mainfoto -> slug-1, photo_N -> slug-(2..6) циклично
    h = h.replace("assets/images/mainfoto.webp", f"/public-objects/images/{slug.split('-')[0]}__MAIN__")
    photo_names = sorted(set(re.findall(r'assets/images/photo_\d+\.\w+', h)))
    for i, p in enumerate(photo_names):
        h = h.replace(p, f"/public-objects/images/{slug.split('-')[0]}__P{2 + (i % 5)}__")
    pref = photo_prefix(v)
    h = h.replace(f"/public-objects/images/{slug.split('-')[0]}__MAIN__", f"/public-objects/images/{pref}-1.jpg")
    for n in range(2, 7):
        h = h.replace(f"/public-objects/images/{slug.split('-')[0]}__P{n}__", f"/public-objects/images/{pref}-{n}.jpg")

    # 6b) Лишние карточки спален (в шаблоне их 4) — быстрая строковая хирургия
    CARD_START = '<div class="flex min-w-[40%]'
    for n in range(bd + 1, 5):
        marker = f'"Bedroom {n} image"'   # только настоящие HTML-атрибуты (в payload кавычки экранированы)
        search_from = 0
        while True:
            pos = h.find(marker, search_from)
            if pos < 0:
                break
            start = h.rfind(CARD_START, 0, pos)
            end_anchor = h.find(f'>Bedroom {n}<', pos)
            end = h.find('</div></div>', end_anchor) if end_anchor > 0 else -1
            # защита: карточка компактна; если якоря далеко — это не карточка, пропускаем
            if start < 0 or end_anchor < 0 or end < 0 or pos - start > 3000 or end - pos > 3000:
                search_from = pos + 1
                continue
            h = h[:start] + h[end + len('</div></div>'):]
            search_from = 0
    # добор: карточки с blur-заглушкой (alt отличается) — ищем по видимому тексту
    for n in range(bd + 1, 5):
        search_from = 0
        while True:
            pos = h.find(f'>Bedroom {n}<', search_from)
            if pos < 0:
                break
            start = max(h.rfind(CARD_START, 0, pos),
                        h.rfind('<div class="flex min-w-[60vw]', 0, pos))
            end = h.find('</div></div>', pos)
            if start < 0 or end < 0 or pos - start > 8000 or end - pos > 500:
                search_from = pos + 1
                continue
            h = h[:start] + h[end + len('</div></div>'):]
            search_from = 0
    # 6c) Типы кроватей: приводим к реальности (по описаниям вилл)
    bed_label = "1 double bed" if v["id"].startswith("own-mudra") else "1 king bed"
    h = h.replace("1 queen bed", bed_label).replace("2 twin beds", bed_label).replace("1 king bed", bed_label)

    # 7) Остальные assets -> абсолютный путь
    h = h.replace('"assets/', '"/villa/assets/')
    h = h.replace('\\"assets/', '\\"/villa/assets/')
    h = h.replace("'assets/", "'/villa/assets/")

    # 8) Хлебные крошки
    h = h.replace(">United States<", ">Bali<")
    h = h.replace('href="/united-states"', 'href="/villas/"')
    h = h.replace(">Bali, Indonesia<", f">{area}<")
    h = h.replace('href="/california"', 'href="/villas/"')

    # 9) SEO-вставка в head: canonical + description + JSON-LD + OG
    qa_wa = f"https://wa.me/{WA}?text=" + "Hi!%20I'm%20interested%20in%20" + name_short.replace(" ", "%20")
    ld = {
        "@context": "https://schema.org", "@type": "VacationRental",
        "name": v["name"], "url": f"{ORIGIN}/villa/{slug}/", "identifier": str(v["id"]),
        "containsPlace": {"@type": "Accommodation",
                          "occupancy": {"@type": "QuantitativeValue", "maxValue": g},
                          "numberOfBedrooms": bd, "numberOfBathroomsTotal": ba},
        "address": {"@type": "PostalAddress", "addressLocality": area,
                    "addressRegion": "Bali", "addressCountry": "ID"},
        "image": [f"{ORIGIN}/public-objects/images/{pref}-{i}.jpg" for i in range(1, 7)],
    }
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": ORIGIN},
        {"@type": "ListItem", "position": 2, "name": "Villas", "item": f"{ORIGIN}/villas/"},
        {"@type": "ListItem", "position": 3, "name": v["name"], "item": f"{ORIGIN}/villa/{slug}/"}]}
    meta_desc = html.escape(f"{v['name']}: {bd}-bedroom private villa in {area}, Bali. Sleeps {g}. "
                            f"Book direct via WhatsApp, Airbnb or Booking.com.")
    inject = (f'<link rel="canonical" href="{ORIGIN}/villa/{slug}/">\n'
              f'<meta name="description" content="{meta_desc}">\n'
              f'<meta property="og:title" content="{html.escape(v["name"])}">\n'
              f'<meta property="og:description" content="{meta_desc}">\n'
              f'<meta property="og:image" content="{ORIGIN}/public-objects/images/{pref}-1.jpg">\n'
              f'<meta property="og:url" content="{ORIGIN}/villa/{slug}/">\n'
              f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n'
              f'<script type="application/ld+json">{json.dumps(crumbs, ensure_ascii=False)}</script>\n')
    h = h.replace("</head>", inject + "</head>", 1)

    if v["id"] == "own-premier-umalas-16":
        real_photos = {
            "premier-umalas-16-1.jpg": "new_img_1.webp",
            "premier-umalas-16-2.jpg": "new_img_2.webp",
            "premier-umalas-16-3.jpg": "new_img_3.webp",
            "premier-umalas-16-4.jpg": "new_img_4.webp",
            "premier-umalas-16-5.jpg": "new_img_5.webp",
            "premier-umalas-16-6.jpg": "img_155.webp",
        }
        for old_name, new_name in real_photos.items():
            h = h.replace(f"/public-objects/images/{old_name}", f"/villa/assets/images/{new_name}")
            h = h.replace(f"{ORIGIN}/public-objects/images/{old_name}", f"{ORIGIN}/villa/assets/images/{new_name}")
    return h

def photo_prefix(v):
    m = {"own-lucky-lily": "lucky-lily", "own-mudra-1": "mudra-1", "own-mudra-2": "mudra-2",
         "own-mudra-3": "mudra-3", "own-mudra-4": "mudra-4",
         "own-premier-umalas-16": "premier-umalas-16", "own-premier-umalas-17": "premier-umalas-17",
         "own-pungutan-1": "pungutan-1", "own-pungutan-2": "pungutan-2",
         "own-tanjung-sari-2": "tanjung-sari-2", "own-tanjung-sari-3": "tanjung-sari-3",
         "own-the-wave": "the-wave", "own-villa-black-pool": "villa-black-pool",
         "own-villa-kesari-4": "villa-kesari-4"}
    return m[v["id"]]

def main():
    tpl = open(TPL, encoding="utf-8").read()
    villas = json.load(open(DATA, encoding="utf-8"))
    only = set(sys.argv[1:])
    for v in villas:
        if only and v["slug"] not in only:
            continue
        out_dir = os.path.join(ROOT, "villa", v["slug"])
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, "index.html")
        open(out, "w", encoding="utf-8").write(build(v, tpl))
        print("OK", v["slug"])

if __name__ == "__main__":
    main()
