import datetime as dt
import html
import json
import os
import re
import traceback
import urllib.parse
from pathlib import Path

import requests
from flask import Flask, jsonify, render_template_string, request

APP_ROOT = Path(__file__).resolve().parent
WORKSPACE = Path(os.environ.get("BALIVILLAS_WORKSPACE", "/workspace"))
IMPORTS_DIR = Path(os.environ.get("BALIVILLAS_IMPORTS_DIR", str(WORKSPACE / "imports")))
HOST_WORKSPACE = os.environ.get("BALIVILLAS_HOST_WORKSPACE", "D:\\Projects\\balivillas")
TIMEOUT = int(os.environ.get("AIRBNB_TIMEOUT", "60"))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

app = Flask(__name__)

PAGE = r"""
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Airbnb Villa Extractor</title>
  <style>
    :root{--bg:#f7f3ea;--card:#fffdf8;--ink:#111;--muted:#706b61;--line:#e4d9c9;--accent:#a8ff3e;--dark:#080808}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink)}
    main{max-width:980px;margin:0 auto;padding:42px 22px}.card{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:28px;box-shadow:0 18px 45px rgba(24,18,8,.08)}
    h1{font:800 42px/1.05 Georgia,serif;margin:0 0 10px}p{color:var(--muted);line-height:1.55}label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;margin:22px 0 8px;color:#5f594f}
    input{width:100%;border:1px solid var(--line);border-radius:16px;padding:15px 16px;font:inherit;background:white}button{border:0;border-radius:999px;background:var(--dark);color:white;font-weight:850;padding:14px 20px;cursor:pointer;margin-top:16px}button:disabled{opacity:.5;cursor:not-allowed}
    .row{display:flex;gap:10px;flex-wrap:wrap}.pill{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 12px;font-size:13px;margin:4px 4px 0 0}.ok{background:var(--accent);color:#111;border:0}.err{color:#b43d2a}.log{white-space:pre-wrap;background:#111;color:#dfffbd;border-radius:18px;padding:18px;max-height:460px;overflow:auto;font:13px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:18px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px}.metric b{display:block;font-size:24px}.small{font-size:13px;color:var(--muted)}.pathbox{background:#111;color:#dfffbd;border-radius:16px;padding:14px;margin-top:14px;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}.pathbox b{color:#b8f04a;font-family:Inter,system-ui,sans-serif}
  </style>
</head>
<body><main><section class="card"><h1>Airbnb Villa Extractor</h1><p>Вставь ссылку Airbnb. Программа создаст папку импорта, сохранит сырой HTML, bootstrap JSON, все фото, listing.json, manifest.json и README.md. Файлы сайта не меняет.</p>
<label>Airbnb URL</label><input id="url" placeholder="https://ru.airbnb.com/rooms/1640382948484924036" autofocus>
<div class="row"><button id="run">Скачать виллу</button><button id="open" disabled>Показать путь</button></div>
<div id="result"></div><h3>Лог</h3><div class="log" id="log">Готов.</div></section></main>
<script>
const $=id=>document.getElementById(id); let lastFolder='';
$('run').onclick=async()=>{const url=$('url').value.trim(); if(!url){alert('Вставь Airbnb URL');return} $('run').disabled=true; $('log').textContent='Работаю... это может занять 1-3 минуты.\n'; $('result').innerHTML=''; try{const r=await fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}); const data=await r.json(); if(!r.ok) throw new Error(data.error||'error'); lastFolder=data.folderHost||data.folder; $('open').disabled=false; $('log').textContent=JSON.stringify(data,null,2); $('result').innerHTML=`<div class="summary"><div class="metric"><span>Фото</span><b>${data.photosDownloaded}/${data.photosFound}</b></div><div class="metric"><span>Группы</span><b>${data.groups}</b></div><div class="metric"><span>Ошибки</span><b>${data.failures}</b></div></div><span class="pill ok">${data.title||'Imported'}</span><span class="pill">${data.folderHost||data.folder}</span><div class="pathbox"><b>Папка на компьютере</b><br>${data.folderHost||data.folder}<br><br><b>Фото</b><br>${data.photosFolderHost||""}<br><br><b>Файлы</b><br>${data.filesFolderHost||data.folderHost||data.folder}</div><p class="small">${data.notes||''}</p>`}catch(e){$('log').textContent=e.stack||String(e); $('result').innerHTML='<p class="err">Ошибка: '+e.message+'</p>'}finally{$('run').disabled=false}}
$('open').onclick=()=>{navigator.clipboard.writeText(lastFolder); alert('Путь скопирован: '+lastFolder)};
</script></body></html>
"""

def extract_room_id(url: str) -> str:
    m = re.search(r"/rooms/(\d+)", url)
    if not m:
        m = re.search(r"(\d{10,})", url)
    if not m:
        raise ValueError("Не нашёл roomId в ссылке Airbnb")
    return m.group(1)

def canonical_url(room_id: str) -> str:
    return f"https://www.airbnb.com/rooms/{room_id}"

def safe_json_string(raw: str) -> str:
    try:
        return json.loads('"' + raw + '"')
    except Exception:
        return raw.replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&").replace("\\n", "\n")

def clean_html_text(text: str) -> str:
    text = safe_json_string(text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<.*?>", "", text)
    return html.unescape(text).strip()

def meta(content: str, name: str):
    pat = rf'<meta (?:property|name)="{re.escape(name)}" content="([^"]*)"'
    m = re.search(pat, content, re.I)
    return html.unescape(m.group(1)) if m else None

def first(content: str, pattern: str, flags=re.S):
    m = re.search(pattern, content, flags)
    return html.unescape(m.group(1)) if m else None

def extract_listing(content: str, room_id: str, source_url: str):
    scripts = []
    for m in re.finditer(r"<script[^>]*>(.*?)</script>", content, flags=re.S | re.I):
        txt = m.group(1)
        low = txt.lower()
        if room_id in txt or "phototour" in txt or "niobe" in low or "__next_f" in txt or "pdp" in low:
            scripts.append({"length": len(txt), "text": txt})
    scripts.sort(key=lambda x: x["length"], reverse=True)

    records = []
    seen = set()
    img_pat = re.compile(
        r'"id":"(\d+)".*?"accessibilityLabel":"([^"]*)".*?"baseUrl":"(https://a0\.muscache\.com/im/pictures/hosting/Hosting-'
        + re.escape(room_id)
        + r'/original/[^"]+)"',
        re.S,
    )
    for image_id, label, image_url in img_pat.findall(content):
        image_url = html.unescape(image_url).split("?")[0]
        if image_url in seen:
            continue
        seen.add(image_url)
        label = html.unescape(label)
        group = re.sub(r" image \d+$", "", label).strip()
        records.append({"id": image_id, "label": label, "group": group, "caption": "", "url": image_url})

    if True:
        url_pat = re.compile(r"https://a0\.muscache\.com/im/pictures/(?:hosting|miso)/Hosting-" + re.escape(room_id) + r"/original/[^\"\\&<]+")
        for m in url_pat.finditer(content):
            image_url = html.unescape(m.group(0)).split("?")[0]
            if image_url in seen:
                continue
            seen.add(image_url)
            records.append({"id": "", "label": "", "group": "", "caption": "", "url": image_url})

    html_texts = []
    for m in re.finditer(r'"htmlText":"(.*?)"', content, flags=re.S):
        text = clean_html_text(m.group(1))
        if len(text) > 20 and text not in html_texts:
            html_texts.append(text)
    description = "\n\n".join(html_texts)

    og_title = meta(content, "og:title") or ""
    og_desc = meta(content, "og:description") or ""
    title = og_desc or first(content, r"<title>(.*?)</title>") or ""
    property_type = first(content, r'"propertyType":"([^"]+)"') or ""
    city = first(content, r'"city":"([^"]+)"') or ""
    lat = first(content, r'"latitude":(-?\d+(?:\.\d+)?)')
    lng = first(content, r'"longitude":(-?\d+(?:\.\d+)?)')

    person = first(content, r'"personCapacity":(\d+)')
    person = int(person) if person else 0
    bedrooms = beds = bathrooms = 0

    m = re.search(r"(\d+(?:\.\d+)?)\s+bedrooms?", og_title, re.I)
    if m:
        bedrooms = float(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s+(?:private\s+)?baths?", og_title, re.I)
    if m:
        bathrooms = float(m.group(1))

    over = re.search(r'"overview".*?"items":\[(.*?)\]', content, re.S)
    if over:
        items = re.findall(r'"([^"]+)"', over.group(1))
        for item in items:
            mm = re.search(r"(\d+(?:\.\d+)?)\s+guests?", item, re.I)
            if mm: person = int(float(mm.group(1)))
            mm = re.search(r"(\d+(?:\.\d+)?)\s+bedrooms?", item, re.I)
            if mm: bedrooms = float(mm.group(1))
            mm = re.search(r"(\d+(?:\.\d+)?)\s+beds?", item, re.I)
            if mm: beds = float(mm.group(1))
            mm = re.search(r"(\d+(?:\.\d+)?)\s+baths?", item, re.I)
            if mm: bathrooms = float(mm.group(1))

    def norm_num(x):
        return int(x) if isinstance(x, float) and x.is_integer() else x

    # Amenities: Airbnb schema shifts often, so keep best-effort but broad enough.
    titles = []
    for m in re.finditer(r'"title":"([^"]{2,100})"', content):
        t = html.unescape(m.group(1)).strip()
        if t and t not in titles:
            titles.append(t)
    common = ("wifi", "kitchen", "pool", "parking", "washer", "tv", "air conditioning", "workspace", "safe", "hot water", "shampoo", "hair dryer", "iron", "patio", "backyard", "security", "smoke", "carbon", "refrigerator", "microwave", "stove", "coffee", "kettle", "dishes", "cooking", "bed linens", "essentials", "hangers", "private entrance", "cleaning")
    skip = ("share", "save", "close", "photo", "about this", "hosted by", "where you", "reviews", "calendar", "report")
    amenities = []
    for t in titles:
        low = t.lower()
        if any(x in low for x in skip):
            continue
        if any(x in low for x in common) and t not in amenities:
            amenities.append(t)

    photos = []
    groups = []
    for idx, r in enumerate(records, 1):
        photos.append({"index": idx, "filename": f"{idx:02d}.jpg", "url": r["url"], "caption": r["caption"], "groupLabel": r["group"]})
        label = r["group"]
        if not groups or groups[-1]["label"] != label:
            groups.append({"label": label, "photoIndexes": []})
        groups[-1]["photoIndexes"].append(idx)

    sleeping = [{"room": g["label"], "beds": ""} for g in groups if g["label"].lower().startswith("bedroom")]

    rating = None
    m = re.search(r"★\s*([0-9.]+)", og_title)
    if m:
        rating = float(m.group(1))
    reviews = None
    for pat in [r'"reviewCount":(\d+)', r'"ratingCount":"?(\d+)"?']:
        m = re.search(pat, content)
        if m:
            reviews = int(m.group(1)); break

    listing = {
        "roomId": room_id,
        "url": canonical_url(room_id),
        "sourceUrl": source_url,
        "title": title,
        "propertyType": property_type,
        "area": "",
        "city": city,
        "personCapacity": person,
        "bedrooms": norm_num(bedrooms),
        "beds": norm_num(beds),
        "bathrooms": norm_num(bathrooms),
        "lat": float(lat) if lat else None,
        "lng": float(lng) if lng else None,
        "description": description,
        "amenities": amenities,
        "sleepingArrangements": sleeping,
        "rating": rating,
        "reviewsCount": reviews,
        "photos": photos,
        "photoGroups": groups,
    }
    bootstrap = {"roomId": room_id, "sourceUrl": source_url, "scriptsCount": len(scripts), "scripts": scripts[:10]}
    return listing, bootstrap

def download_photos(listing: dict, photos_dir: Path):
    photos_dir.mkdir(parents=True, exist_ok=True)
    failures = []
    downloaded = 0
    session = requests.Session()
    session.headers.update({**HEADERS, "Referer": "https://www.airbnb.com/"})
    for p in listing["photos"]:
        out = photos_dir / p["filename"]
        try:
            if not out.exists() or out.stat().st_size < 10000:
                r = session.get(p["url"], timeout=TIMEOUT)
                r.raise_for_status()
                out.write_bytes(r.content)
            if out.stat().st_size > 10000:
                downloaded += 1
            else:
                failures.append({"filename": p["filename"], "url": p["url"], "error": "file too small"})
        except Exception as e:
            failures.append({"filename": p["filename"], "url": p["url"], "error": str(e)})
    return downloaded, failures

def run_extract(source_url: str):
    room_id = extract_room_id(source_url)
    url = canonical_url(room_id)
    folder = IMPORTS_DIR / f"airbnb-{room_id}"
    raw_dir = folder / "raw"
    photos_dir = folder / "photos"
    raw_dir.mkdir(parents=True, exist_ok=True)
    photos_dir.mkdir(parents=True, exist_ok=True)

    fetch_url = source_url if source_url.startswith("http") else url
    resp = requests.get(fetch_url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
    resp.raise_for_status()
    content = resp.text
    (raw_dir / "listing.html").write_text(content, encoding="utf-8")

    listing, bootstrap = extract_listing(content, room_id, source_url)
    (raw_dir / "bootstrap.json").write_text(json.dumps(bootstrap, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "listing.json").write_text(json.dumps(listing, ensure_ascii=False, indent=2), encoding="utf-8")

    downloaded, failures = download_photos(listing, photos_dir)
    notes = "Extraction completed. Amenities extracted best-effort from embedded HTML."
    if downloaded != len(listing["photos"]):
        notes = "Photo count mismatch; see failures."
    manifest = {
        "roomId": room_id,
        "url": url,
        "sourceUrl": source_url,
        "extractedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "photosFoundOnAirbnb": len(listing["photos"]),
        "photosDownloaded": downloaded,
        "photoGroupsCount": len(listing["photoGroups"]),
        "failures": failures,
        "notes": notes,
    }
    (folder / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    readme = f"""# Airbnb import {room_id}\n\n{listing.get('title') or ''}\n{listing.get('city') or ''} · {listing.get('bedrooms')} bedrooms · {listing.get('bathrooms')} bathrooms · {listing.get('personCapacity')} guests\nPhotos: {downloaded}/{len(listing['photos'])} downloaded · Groups: {len(listing['photoGroups'])}\nNotes: {notes}\n"""
    (folder / "README.md").write_text(readme, encoding="utf-8")
    return {
        "folder": str(folder),
        "folderHost": str(Path(HOST_WORKSPACE) / "imports" / f"airbnb-{room_id}"),
        "photosFolderHost": str(Path(HOST_WORKSPACE) / "imports" / f"airbnb-{room_id}" / "photos"),
        "filesFolderHost": str(Path(HOST_WORKSPACE) / "imports" / f"airbnb-{room_id}"),
        "roomId": room_id,
        "title": listing.get("title"),
        "photosFound": len(listing["photos"]),
        "photosDownloaded": downloaded,
        "groups": len(listing["photoGroups"]),
        "failures": len(failures),
        "notes": notes,
        "manifest": manifest,
    }

@app.get("/")
def home():
    return render_template_string(PAGE)

@app.post("/api/extract")
def api_extract():
    try:
        data = request.get_json(force=True)
        source_url = (data.get("url") or "").strip()
        if not source_url:
            return jsonify({"error": "URL is required"}), 400
        return jsonify(run_extract(source_url))
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8090")))




