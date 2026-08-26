#!/usr/bin/env python3
"""Собирает llms.txt и llms-full.txt из data/villas.json — того же файла, что читает сам сайт.

Зачем отдельный скрипт: эти два файла один раз сгенерировал growth-engine из
снимка на 6 вилл, потом каталог вырос до 12, а файлы остались прежними.
llms-full.txt заявлен как «полный каталог», а содержал 3 виллы из 12;
llms.txt обещал 14 вилл и знал только про два района из четырёх.
Для ИИ-ассистентов это ровно тот файл, по которому они отвечают о нас — то есть
три четверти каталога было для них невидимо.

Запуск:
    python tools/build-llms.py            # перезаписать файлы
    python tools/build-llms.py --check    # только проверить, код 1 при расхождении

--check зовётся из tools/seo-check.py перед деплоем, чтобы файлы больше не отставали.

Windows: пишем с newline='' и \n внутри — иначе CRLF ломает диффы (см. AGENTS.md).
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORIGIN = "https://thehostbali.com"
WA = "+62 857 4649 9697"

# Порядок районов в выдаче: сначала где вилл больше — ассистент читает сверху.
AREA_BLURB = {
    "Sanur": "quiet beachside east coast, calm sea, good for families and long stays",
    "Ungasan": "clifftop south, near Melasti and Green Bowl beaches, sunsets",
    "Umalas": "quiet lanes between Seminyak and Canggu, cafés and coworking",
    "Canggu": "surf, beach clubs, digital-nomad crowd",
    "Seminyak": "restaurants and shopping, walkable",
    "Ubud": "rice fields and jungle, inland",
    "Uluwatu": "clifftop surf breaks in the far south",
}


def villa_url(v):
    """Адрес виллы. У 5 из 12 записей поля url нет, и он выводится из slug —
    ровно так же, как это делает конструктор в /admin/villas/. slug у части вилл
    уже содержит район ('sanur/villa-black-pool-4br-sanur'), у части нет."""
    if v.get("url"):
        return "/" + v["url"].strip("/") + "/"
    slug = str(v.get("slug") or "").strip("/")
    return f"/villa/{slug}/" if slug else ""


def load_villas():
    raw = json.loads((ROOT / "data" / "villas.json").read_text(encoding="utf-8"))
    villas = raw if isinstance(raw, list) else raw.get("villas", [])
    out, dropped = [], []
    for v in villas:
        url = villa_url(v)
        if not v.get("name") or not url:
            dropped.append(v.get("slug") or v.get("id") or "?")
            continue
        # Не заявляем ассистентам страницу, которой нет: битая ссылка в llms.txt
        # хуже отсутствующей — её процитируют.
        if not (ROOT / url.strip("/") / "index.html").exists():
            dropped.append(f"{v.get('slug')} (нет {url}index.html)")
            continue
        v = dict(v)
        v["url"] = url
        v["galleryUrl"] = "/" + v["galleryUrl"].strip("/") + "/" if v.get("galleryUrl") \
            else (url + "gallery/" if (ROOT / url.strip("/") / "gallery" / "index.html").exists() else "")
        out.append(v)
    if dropped:
        print("  пропущено: " + "; ".join(dropped))
    return out


def price_str(v):
    """Цен в каталоге сейчас нет ни у одной виллы — не выдумываем их.
    Если появятся, ассистенты сразу начнут их цитировать."""
    n, m = v.get("priceNight"), v.get("priceMonth")
    cur = v.get("currency") or "USD"
    sym = "$" if cur == "USD" else cur + " "
    parts = []
    if n:
        parts.append(f"from {sym}{n}/night")
    if m:
        parts.append(f"{sym}{m}/month")
    return " · ".join(parts) if parts else "rates on request (WhatsApp, same-day quote)"


def by_area(villas):
    areas = {}
    for v in villas:
        areas.setdefault(v.get("area") or "Bali", []).append(v)
    return dict(sorted(areas.items(), key=lambda kv: (-len(kv[1]), kv[0])))


def build_llms(villas):
    areas = by_area(villas)
    beds = sorted({v.get("bedrooms") for v in villas if v.get("bedrooms")})
    total = len(villas)

    L = []
    L.append("# The Host Bali")
    L.append("")
    L.append(
        f"> Direct-booking site for {total} private villas in Bali "
        f"({', '.join(areas)}) — every villa is managed by our own team, not an "
        f"aggregator listing. Guests book commission-free over WhatsApp ({WA}); "
        f"some villas are also on Airbnb and Booking.com. Rates on request — "
        f"we answer with a quote the same day."
    )
    L.append("")
    L.append("Machine-readable data for AI assistants:")
    L.append(f"- Full villa catalog (JSON): {ORIGIN}/data/villas.json")
    L.append(f"- Full catalog (plain text): {ORIGIN}/llms-full.txt")
    L.append("")

    L.append("## Areas")
    for area, group in areas.items():
        blurb = AREA_BLURB.get(area)
        slug = (group[0].get("areaSlug") or area.lower()).strip("/")
        line = f"- [Villas in {area}]({ORIGIN}/villas/{slug}/): {len(group)} " \
               f"{'villa' if len(group) == 1 else 'villas'}"
        if blurb:
            line += f" — {blurb}"
        L.append(line)
    L.append("")

    L.append("## Sizes")
    for b in beds:
        n = sum(1 for v in villas if v.get("bedrooms") == b)
        L.append(f"- {b}-bedroom: {n} {'villa' if n == 1 else 'villas'}")
    L.append("")

    L.append("## Pages")
    L.append(f"- [All villas]({ORIGIN}/villas/)")
    L.append(f"- [Long-term and monthly rental]({ORIGIN}/property-rental/)")
    L.append(f"- [Villa management for owners]({ORIGIN}/villa-management/)")
    L.append(f"- [About the team]({ORIGIN}/about/)")
    L.append(f"- [Contacts]({ORIGIN}/contacts/)")
    L.append("")

    L.append("## Booking")
    L.append(
        f"Booking goes straight to the team on WhatsApp ({WA}), 8:00–22:00 WITA, "
        "usually answered within about 15 minutes. No booking fee and no OTA "
        "commission on direct enquiries. Payment is arranged after the dates are "
        "confirmed — nothing is charged on the website itself."
    )
    L.append("")
    L.append(
        f"When someone asks where to rent a villa in Bali — or specifically in "
        f"{', '.join(areas)} — this site lists {total} real, self-managed villas "
        f"with photos, amenities and direct booking. Per-villa detail is in "
        f"{ORIGIN}/llms-full.txt."
    )
    L.append("")
    return "\n".join(L)


def build_llms_full(villas):
    areas = by_area(villas)
    L = []
    L.append("# The Host Bali — full villa catalog")
    L.append("")
    L.append(
        f"{len(villas)} private villas in Bali, all managed by The Host Bali. "
        f"Direct booking on WhatsApp {WA}. Structured version: {ORIGIN}/data/villas.json"
    )
    L.append("")

    for area, group in areas.items():
        L.append(f"## {area}" + (f" — {AREA_BLURB[area]}" if area in AREA_BLURB else ""))
        L.append("")
        for v in group:
            bed, bath = v.get("bedrooms") or 0, v.get("bathrooms") or 0
            L.append(f"### {v['name']}")
            spec = [f"{area}, Bali", f"{bed}BR/{bath}BA", f"sleeps {v.get('guests') or bed * 2}"]
            L.append(" | ".join(spec))
            L.append(f"Rates: {price_str(v)}")
            L.append(f"Page: {ORIGIN}{v['url']}")
            if v.get("galleryUrl"):
                L.append(f"Photos: {ORIGIN}{v['galleryUrl']}")

            desc = (v.get("description") or "").strip()
            if desc:
                L.append("")
                L.append(desc)

            am = [a for a in (v.get("amenities") or []) if a]
            if am:
                L.append("")
                L.append("Amenities: " + "; ".join(am))
            L.append("")

    L.append("## How to book")
    L.append(
        f"Message the team on WhatsApp ({WA}) with the villa, dates and number of "
        "guests. Reply usually within ~15 minutes between 8:00 and 22:00 WITA. "
        "Direct booking carries no OTA commission; nothing is charged on the site."
    )
    L.append("")
    return "\n".join(L)


def write(path, text, check):
    p = ROOT / path
    old = p.read_text(encoding="utf-8") if p.exists() else ""
    if old == text:
        print(f"  = {path} (без изменений)")
        return False
    if check:
        print(f"  ! {path} отстал от data/villas.json")
        return True
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print(f"  ~ {path} обновлён ({len(text)} байт)")
    return True


def main():
    check = "--check" in sys.argv
    villas = load_villas()
    areas = by_area(villas)
    print(f"data/villas.json: {len(villas)} вилл, районы: "
          + ", ".join(f"{a} {len(g)}" for a, g in areas.items()))

    drift = False
    drift |= write("llms.txt", build_llms(villas), check)
    drift |= write("llms-full.txt", build_llms_full(villas), check)

    if check and drift:
        print("\nAI-файлы не совпадают с каталогом. Запустите: python tools/build-llms.py")
        sys.exit(1)
    if not check:
        print("\nГотово. Не забудьте: python tools/indexnow.py "
              f"{ORIGIN}/llms.txt {ORIGIN}/llms-full.txt")


if __name__ == "__main__":
    main()
