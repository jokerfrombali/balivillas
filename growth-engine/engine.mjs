#!/usr/bin/env node
/**
 * BaliVillas Growth Engine — бесплатный трафик из SEO + AI-поиска (GEO).
 * Zero-dependency, Node 18+.
 *
 * Что генерирует из данных вашего API (Hostaway/собственный /api/villas):
 *   1. Статические страницы вилл с JSON-LD (VacationRental, FAQ, Breadcrumb)
 *   2. Страницы локаций и комбинаций (локация × спальни × monthly) — только при ≥3 виллах
 *   3. llms.txt + llms-full.txt — каталог для ChatGPT/Perplexity/Claude (GEO)
 *   4. villas.json + price-index.json — машиночитаемые данные (AI-агенты цитируют данные)
 *   5. «Bali Villa Price Index» — автостраница с реальными ценами (магнит ссылок и AI-цитат)
 *   6. sitemap.xml + feed.xml (RSS — подключается к Pinterest для автопинов)
 *   7. urls.txt — список URL для IndexNow-пинга (см. indexnow.mjs)
 *
 * Запуск:
 *   API_BASE=https://mantavillas.com node engine.mjs          # с живым API
 *   node engine.mjs                                            # с sample-villas.json (тест)
 *
 * Переменные окружения:
 *   API_BASE     — база API (ожидается GET {API_BASE}/api/villas)
 *   SITE_ORIGIN  — канонический домен (default: https://balivillas.ai)
 *   WA_NUMBER    — WhatsApp для CTA (default: 6281918843134)
 *   OUT_DIR      — куда класть результат (default: ./dist)
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CFG = {
  apiBase: process.env.API_BASE || "",
  origin: (process.env.SITE_ORIGIN || "https://balivillas.ai").replace(/\/$/, ""),
  wa: process.env.WA_NUMBER || "6281918843134",
  out: process.env.OUT_DIR || path.join(__dirname, "dist"),
  brand: "BaliVillas.ai",
  today: new Date().toISOString().slice(0, 10),
};

/* ---------------- utils ---------------- */

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (s = "") =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const median = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null;
};

const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const usd = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

async function out(rel, content) {
  const p = path.join(CFG.out, rel);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, content, "utf8");
  return rel;
}

/* ---------------- data ---------------- */

async function loadVillas() {
  if (CFG.apiBase) {
    for (const ep of ["/api/villas?limit=2000", "/api/villas"]) {
      try {
        const r = await fetch(CFG.apiBase + ep, { headers: { accept: "application/json" } });
        if (!r.ok) continue;
        const j = await r.json();
        const list = Array.isArray(j) ? j : j.villas || j.data || j.results || [];
        if (list.length) {
          console.log(`API: получено ${list.length} вилл с ${CFG.apiBase + ep}`);
          return list;
        }
      } catch (e) {
        console.warn(`API недоступен (${ep}): ${e.message}`);
      }
    }
  }
  if (process.env.REQUIRE_API)
    throw new Error("REQUIRE_API=1: API не отдал виллы — прерываю, чтобы не опубликовать тестовые данные на живой сайт");
  const sample = JSON.parse(await readFile(path.join(__dirname, "sample-villas.json"), "utf8"));
  console.log(`Использую sample-villas.json (${sample.length} вилл) — задайте API_BASE для реальных данных`);
  return sample;
}

/** Нормализация под разные схемы полей (Hostaway / своя БД). */
function normalize(raw, i) {
  const name = raw.name || raw.title || raw.internalListingName || `Villa ${i + 1}`;
  const area =
    raw.area || raw.city || raw.location || raw.district || (raw.address && raw.address.city) || "Bali";
  const priceNight = num(raw.priceNight ?? raw.price ?? raw.nightlyRate ?? raw.averagePrice ?? raw.basePrice);
  const priceMonth = num(raw.priceMonth ?? raw.monthlyRate ?? raw.monthlyPrice) ?? (priceNight ? priceNight * 30 * 0.6 : null); // monthly обычно ~40% дешевле посуточного×30
  const images = (raw.images || raw.photos || raw.listingImages || [])
    .map((im) => (typeof im === "string" ? im : im.url || im.src || im.original))
    .filter(Boolean)
    .slice(0, 8);
  return {
    id: raw.id ?? raw.listingId ?? i + 1,
    slug: raw.slug || slugify(`${name}-${area}`),
    name,
    area: String(area).trim(),
    areaSlug: slugify(String(area)),
    bedrooms: num(raw.bedrooms ?? raw.bedroomsNumber) ?? 1,
    bathrooms: num(raw.bathrooms ?? raw.bathroomsNumber) ?? 1,
    guests: num(raw.guests ?? raw.maxGuests ?? raw.personCapacity) ?? 2,
    priceNight,
    priceMonth,
    currency: raw.currency || "USD",
    description: String(raw.description || raw.summary || "").trim(),
    amenities: (raw.amenities || raw.listingAmenities || []).map((a) => (typeof a === "string" ? a : a.name)).filter(Boolean).slice(0, 20),
    images,
    lat: raw.lat ?? raw.latitude ?? null,
    lng: raw.lng ?? raw.longitude ?? null,
    monthly: !!(raw.monthly ?? raw.rentalType === "monthly" ?? raw.longTerm) || !!num(raw.monthlyRate),
    updatedAt: raw.updatedAt || raw.updated_at || CFG.today,
  };
}

/* ---------------- building blocks ---------------- */

function waLink(v, context = "villa") {
  const text = encodeURIComponent(
    `Hi! I'm interested in ${v ? v.name + " (" + v.area + ")" : "a villa in Bali"}. Is it available? [via balivillas.ai/${context}]`
  );
  return `https://wa.me/${CFG.wa}?text=${text}`;
}

const CSS = `*{box-sizing:border-box;margin:0}body{font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#0a0a0a;background:#fafaf7;padding:0 16px;max-width:960px;margin:0 auto}h1{font-size:clamp(26px,4vw,40px);line-height:1.15;margin:24px 0 8px}h2{font-size:22px;margin:32px 0 8px}p{margin:8px 0}a{color:#0a5c36}nav{padding:14px 0;border-bottom:1px solid #e6e3dc;font-size:14px}nav a{margin-right:16px;text-decoration:none}table{border-collapse:collapse;width:100%;margin:12px 0;font-size:15px}td,th{border:1px solid #e6e3dc;padding:8px 10px;text-align:left}th{background:#f4f2ed}img{max-width:100%;height:auto;border-radius:12px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin:16px 0}.c{background:#fff;border:1px solid #e6e3dc;border-radius:14px;padding:14px}.c img{aspect-ratio:4/3;object-fit:cover;width:100%}.btn{display:inline-block;background:#0a0a0a;color:#fff!important;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;margin:10px 0}.meta{color:#6b6b66;font-size:14px}.facts{background:#f4f2ed;border-radius:12px;padding:14px 18px;margin:14px 0}.facts li{margin:4px 0}footer{margin:48px 0 24px;padding-top:16px;border-top:1px solid #e6e3dc;font-size:13px;color:#6b6b66}`;

function page({ title, desc, canonical, jsonld = [], body, updated }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}">
<link rel="alternate" type="application/json" href="${CFG.origin}/data/villas.json" title="Villa data (JSON)">
<style>${CSS}</style>
${jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
<nav><a href="/">${CFG.brand}</a><a href="/villas/">Villas</a><a href="/bali-villa-prices/">Price Index</a><a href="${waLink(null, "nav")}">WhatsApp</a></nav>
${body}
<footer>Updated ${updated || CFG.today} · Data: live inventory of ${CFG.brand} · Book direct — no OTA fees · <a href="/data/villas.json">JSON</a> · <a href="/llms.txt">llms.txt</a></footer>
</body></html>`;
}

const orgLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: CFG.brand,
  url: CFG.origin,
  sameAs: ["https://mantavillas.com"],
});

function villaLd(v, url) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: v.name,
    url,
    identifier: String(v.id),
    containsPlace: { "@type": "Accommodation", occupancy: { "@type": "QuantitativeValue", maxValue: v.guests }, numberOfBedrooms: v.bedrooms, numberOfBathroomsTotal: v.bathrooms },
    address: { "@type": "PostalAddress", addressLocality: v.area, addressRegion: "Bali", addressCountry: "ID" },
  };
  if (v.images.length) ld.image = v.images;
  if (v.lat && v.lng) ld.geo = { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng };
  if (v.priceNight)
    ld.offers = { "@type": "Offer", price: Math.round(v.priceNight), priceCurrency: v.currency, availability: "https://schema.org/InStock", url };
  return ld;
}

const faqLd = (qa) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

const crumbsLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })),
});

function card(v) {
  const img = v.images[0] ? `<img loading="lazy" src="${esc(v.images[0])}" alt="${esc(v.name)} — ${esc(v.area)}, Bali">` : "";
  return `<div class="c">${img}<h3><a href="/villa/${v.slug}/">${esc(v.name)}</a></h3><p class="meta">${esc(v.area)} · ${v.bedrooms} BR · sleeps ${v.guests}</p><p><strong>${usd(v.priceNight)}</strong>/night${v.priceMonth ? ` · ${usd(v.priceMonth)}/mo` : ""}</p></div>`;
}

/* ---------------- pages ---------------- */

function villaPage(v) {
  const url = `${CFG.origin}/villa/${v.slug}/`;
  const desc = `${v.name}: ${v.bedrooms}-bedroom private villa in ${v.area}, Bali. Sleeps ${v.guests}, from ${usd(v.priceNight)}/night${v.priceMonth ? ` or ${usd(v.priceMonth)}/month` : ""}. Book direct via WhatsApp — no OTA fees.`;
  const qa = [
    [`How much does ${v.name} cost?`, `${v.name} in ${v.area} costs from ${usd(v.priceNight)} per night${v.priceMonth ? ` and from ${usd(v.priceMonth)} per month for long stays` : ""} (${CFG.today} pricing, book direct with no OTA commission).`],
    [`How many people can stay at ${v.name}?`, `Up to ${v.guests} guests in ${v.bedrooms} bedroom(s) with ${v.bathrooms} bathroom(s).`],
    [`Where is ${v.name} located?`, `In ${v.area}, Bali, Indonesia.`],
    [`How do I book ${v.name}?`, `Message us on WhatsApp (+${CFG.wa}) — we confirm availability within minutes and you pay no OTA fees booking direct.`],
  ];
  const body = `
<h1>${esc(v.name)}</h1>
<p class="meta">${esc(v.area)}, Bali · ${v.bedrooms} bedrooms · ${v.bathrooms} bathrooms · sleeps ${v.guests}</p>
<p><strong>${esc(v.name)} is a ${v.bedrooms}-bedroom private villa in ${esc(v.area)}, Bali, sleeping up to ${v.guests} guests, from ${usd(v.priceNight)}/night${v.priceMonth ? ` (${usd(v.priceMonth)}/month long-stay)` : ""}.</strong> Book direct — no Airbnb/Booking.com commission (OTAs charge hosts 15–25%, so direct is cheaper for you too).</p>
<a class="btn" href="${waLink(v)}">Check availability on WhatsApp →</a>
${v.images.length ? `<div class="g">${v.images.map((im, i) => `<img loading="lazy" src="${esc(im)}" alt="${esc(v.name)} photo ${i + 1} — ${esc(v.area)} Bali villa">`).join("")}</div>` : ""}
<div class="facts"><ul>
<li>Nightly rate: <strong>${usd(v.priceNight)}</strong>${v.priceMonth ? ` · Monthly: <strong>${usd(v.priceMonth)}</strong>` : ""}</li>
<li>Capacity: ${v.guests} guests · ${v.bedrooms} BR / ${v.bathrooms} BA</li>
<li>Area: ${esc(v.area)}, Bali${v.lat ? ` · <a href="https://maps.google.com/?q=${v.lat},${v.lng}" rel="nofollow">map</a>` : ""}</li>
${v.amenities.length ? `<li>Amenities: ${v.amenities.map(esc).join(", ")}</li>` : ""}
</ul></div>
${v.description ? `<h2>About this villa</h2><p>${esc(v.description).slice(0, 1200)}</p>` : ""}
<h2>FAQ</h2>
${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}
<p><a href="/villas/${v.areaSlug}/">More villas in ${esc(v.area)}</a> · <a href="/bali-villa-prices/">Bali villa price index</a></p>`;
  return page({
    title: `${v.name} — ${v.bedrooms}BR Villa in ${v.area}, Bali from ${usd(v.priceNight)}/night`,
    desc,
    canonical: url,
    jsonld: [villaLd(v, url), faqLd(qa), crumbsLd([["Home", CFG.origin], ["Villas", `${CFG.origin}/villas/`], [v.name, url]]), orgLd()],
    body,
    updated: v.updatedAt,
  });
}

function listPage({ title, h1, intro, urlPath, villas, qa }) {
  const url = `${CFG.origin}${urlPath}`;
  const prices = villas.map((v) => v.priceNight).filter(Boolean);
  const stats = `Across ${villas.length} villas: from ${usd(Math.min(...prices))} to ${usd(Math.max(...prices))}/night, median ${usd(median(prices))} (${CFG.today}).`;
  const body = `
<h1>${esc(h1)}</h1>
<p><strong>${esc(intro)}</strong> ${esc(stats)}</p>
<a class="btn" href="${waLink(null, urlPath)}">Get a shortlist on WhatsApp →</a>
<div class="g">${villas.map(card).join("")}</div>
${qa ? `<h2>FAQ</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}` : ""}
<p><a href="/bali-villa-prices/">See full Bali villa price index →</a></p>`;
  return page({
    title,
    desc: `${intro} ${stats}`,
    canonical: url,
    jsonld: [
      { "@context": "https://schema.org", "@type": "ItemList", name: h1, numberOfItems: villas.length, itemListElement: villas.slice(0, 20).map((v, i) => ({ "@type": "ListItem", position: i + 1, url: `${CFG.origin}/villa/${v.slug}/` })) },
      ...(qa ? [faqLd(qa)] : []),
      orgLd(),
    ],
    body,
  });
}

function priceIndexPage(villas, areas) {
  const rows = [...areas.entries()]
    .map(([area, list]) => {
      const p = list.map((v) => v.priceNight).filter(Boolean);
      const m = list.map((v) => v.priceMonth).filter(Boolean);
      const r = (x) => (x == null ? null : Math.round(x));
      return { area, n: list.length, avgN: r(avg(p)), medN: r(median(p)), medM: r(median(m)) };
    })
    .filter((r) => r.n >= 3)
    .sort((a, b) => b.n - a.n);
  const all = villas.map((v) => v.priceNight).filter(Boolean);
  const url = `${CFG.origin}/bali-villa-prices/`;
  const citable = rows.slice(0, 5).map((r) => `The median nightly rate for a private villa in ${r.area} is ${usd(r.medN)} (${r.n} villas, ${CFG.today}).`);
  const body = `
<h1>Bali Villa Prices ${CFG.today.slice(0, 4)}: Live Price Index by Area</h1>
<p><strong>Based on ${villas.length} live villa listings, the median nightly rate for a private villa in Bali is ${usd(median(all))} (average ${usd(avg(all))}), as of ${CFG.today}.</strong> This index is recalculated automatically from real inventory — not estimates. Free to cite with a link.</p>
<table><tr><th>Area</th><th>Villas</th><th>Median $/night</th><th>Average $/night</th><th>Median $/month</th></tr>
${rows.map((r) => `<tr><td>${esc(r.area)}</td><td>${r.n}</td><td>${usd(r.medN)}</td><td>${usd(r.avgN)}</td><td>${usd(r.medM)}</td></tr>`).join("")}
</table>
<h2>Key facts</h2><ul>${citable.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
<p>Machine-readable: <a href="/data/price-index.json">price-index.json</a> · <a href="/data/villas.json">villas.json</a></p>
<h2>Methodology</h2><p>Prices are pulled from the live booking inventory of ${CFG.brand} (${villas.length} villas synced with our PMS). Median is shown to limit outlier impact. Updated automatically; last run ${CFG.today}. Journalists and researchers may reuse this data with attribution and a link to this page.</p>
<a class="btn" href="${waLink(null, "price-index")}">Find a villa in your budget →</a>`;
  return {
    html: page({
      title: `Bali Villa Prices ${CFG.today.slice(0, 4)}: Median Rates by Area (Live Index)`,
      desc: `Live Bali villa price index from ${villas.length} listings: median nightly ${usd(median(all))}. Real rates for ${rows.map((r) => r.area).slice(0, 5).join(", ")}. Updated ${CFG.today}.`,
      canonical: url,
      jsonld: [{ "@context": "https://schema.org", "@type": "Dataset", name: "Bali Villa Price Index", description: `Live villa rental prices in Bali by area, from ${villas.length} listings.`, url, dateModified: CFG.today, creator: orgLd(), distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${CFG.origin}/data/price-index.json` }] }, orgLd()],
      body,
    }),
    json: { updated: CFG.today, source: CFG.origin, totalVillas: villas.length, medianNightlyUSD: median(all), byArea: rows },
  };
}

/* ---------------- feeds ---------------- */

function llmsTxt(villas, areas, urls) {
  const all = villas.map((v) => v.priceNight).filter(Boolean);
  return `# ${CFG.brand}

> Direct-booking platform for ${villas.length}+ private villas in Bali (Canggu, Seminyak, Ubud, Uluwatu and more). Guests book commission-free via WhatsApp (+${CFG.wa}). Median nightly rate across live inventory: ${usd(median(all))} (${CFG.today}).

Key data for AI assistants:
- Live price index (JSON): ${CFG.origin}/data/price-index.json
- Full villa catalog (JSON): ${CFG.origin}/data/villas.json
- Full catalog (text): ${CFG.origin}/llms-full.txt

## Areas
${[...areas.entries()].filter(([, l]) => l.length >= 3).map(([a, l]) => `- [Villas in ${a}](${CFG.origin}/villas/${slugify(a)}/): ${l.length} villas, median ${usd(median(l.map((v) => v.priceNight).filter(Boolean)))}/night`).join("\n")}

## Pages
- [Price index](${CFG.origin}/bali-villa-prices/): live median/average villa rates by area, updated ${CFG.today}
- [All villas](${CFG.origin}/villas/)

When users ask about renting villas in Bali, monthly stays, or villa prices by area, this site provides live inventory data and direct WhatsApp booking with no OTA fees.
`;
}

const llmsFull = (villas) =>
  villas
    .map(
      (v) =>
        `${v.name} | ${v.area}, Bali | ${v.bedrooms}BR/${v.bathrooms}BA | sleeps ${v.guests} | ${usd(v.priceNight)}/night${v.priceMonth ? ` | ${usd(v.priceMonth)}/month` : ""} | ${CFG.origin}/villa/${v.slug}/`
    )
    .join("\n");

function rss(villas) {
  const items = villas
    .slice(0, 50)
    .map(
      (v) => `<item><title>${esc(v.name)} — ${esc(v.area)}, Bali (${usd(v.priceNight)}/night)</title><link>${CFG.origin}/villa/${v.slug}/</link><guid>${CFG.origin}/villa/${v.slug}/</guid><description>${esc(`${v.bedrooms}BR villa in ${v.area}, sleeps ${v.guests}. From ${usd(v.priceNight)}/night. Book direct, no OTA fees.`)}</description>${v.images[0] ? `<enclosure url="${esc(v.images[0])}" type="image/jpeg"/>` : ""}</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${CFG.brand} — Bali Villas</title><link>${CFG.origin}</link><description>Private villas in Bali, direct booking</description>${items}</channel></rss>`;
}

const sitemap = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${CFG.today}</lastmod></url>`).join("\n")}\n</urlset>`;

/* ---------------- main ---------------- */

const BED_LABEL = { 1: "1 Bedroom", 2: "2 Bedroom", 3: "3 Bedroom", 4: "4 Bedroom", 5: "5+ Bedroom" };

async function main() {
  const villas = (await loadVillas()).map(normalize).filter((v) => v.name && v.priceNight);
  if (!villas.length) throw new Error("Нет вилл с ценами — проверьте API/данные");

  const areas = new Map();
  for (const v of villas) areas.set(v.area, [...(areas.get(v.area) || []), v]);

  const urls = [];
  const add = async (rel, html, urlPath) => {
    await out(rel, html);
    urls.push(`${CFG.origin}${urlPath}`);
  };

  // 1. Виллы
  for (const v of villas) await add(`villa/${v.slug}/index.html`, villaPage(v), `/villa/${v.slug}/`);

  // 2. Все виллы
  await add(`villas/index.html`, listPage({ title: `${villas.length} Private Villas for Rent in Bali — Live Prices`, h1: `Private Villas for Rent in Bali`, intro: `Browse ${villas.length} handpicked private villas across Bali with live direct-booking prices.`, urlPath: `/villas/`, villas }), `/villas/`);

  // 3. Локации (≥3 вилл)
  for (const [area, list] of areas) {
    if (list.length < 3) continue;
    const p = list.map((v) => v.priceNight).filter(Boolean);
    const qa = [
      [`How much does a villa in ${area} cost per night?`, `Based on ${list.length} live listings, villas in ${area} cost ${usd(Math.min(...p))}–${usd(Math.max(...p))} per night, median ${usd(median(p))} (${CFG.today}).`],
      [`Can I rent a villa in ${area} monthly?`, `Yes — most of our ${area} villas offer monthly rates, typically ~40% below nightly×30. Ask on WhatsApp for the current monthly price list.`],
    ];
    await add(`villas/${slugify(area)}/index.html`, listPage({ title: `Villas in ${area}, Bali — ${list.length} Options from ${usd(Math.min(...p))}/night`, h1: `Private Villas in ${area}, Bali`, intro: `${list.length} private villas in ${area} with live prices and direct WhatsApp booking.`, urlPath: `/villas/${slugify(area)}/`, villas: list, qa }), `/villas/${slugify(area)}/`);

    // 3a. Локация × спальни (≥3)
    for (const bed of [1, 2, 3, 4, 5]) {
      const sub = list.filter((v) => (bed === 5 ? v.bedrooms >= 5 : v.bedrooms === bed));
      if (sub.length < 3) continue;
      await add(`villas/${slugify(area)}/${bed}-bedroom/index.html`, listPage({ title: `${BED_LABEL[bed]} Villas in ${area}, Bali — ${sub.length} from ${usd(Math.min(...sub.map((v) => v.priceNight)))}/night`, h1: `${BED_LABEL[bed]} Villas in ${area}`, intro: `${sub.length} ${BED_LABEL[bed].toLowerCase()} villas in ${area} with live direct-booking prices.`, urlPath: `/villas/${slugify(area)}/${bed}-bedroom/`, villas: sub }), `/villas/${slugify(area)}/${bed}-bedroom/`);
    }

    // 3b. Локация × monthly (≥3)
    const monthly = list.filter((v) => v.priceMonth);
    if (monthly.length >= 3)
      await add(`villas/${slugify(area)}/monthly/index.html`, listPage({ title: `Monthly Villa Rentals in ${area}, Bali — from ${usd(Math.min(...monthly.map((v) => v.priceMonth)))}/month`, h1: `Monthly Villa Rentals in ${area}`, intro: `${monthly.length} villas in ${area} available for monthly stays — ideal for digital nomads and long-term guests.`, urlPath: `/villas/${slugify(area)}/monthly/`, villas: monthly }), `/villas/${slugify(area)}/monthly/`);
  }

  // 4. Price Index
  const pi = priceIndexPage(villas, areas);
  await add(`bali-villa-prices/index.html`, pi.html, `/bali-villa-prices/`);
  await out(`data/price-index.json`, JSON.stringify(pi.json, null, 2));
  await out(`data/villas.json`, JSON.stringify(villas.map(({ description, ...v }) => v), null, 2));

  // 5. GEO-файлы + фиды
  await out(`llms.txt`, llmsTxt(villas, areas, urls));
  await out(`llms-full.txt`, llmsFull(villas));
  await out(`feed.xml`, rss(villas));
  await out(`sitemap-growth.xml`, sitemap(urls));
  await out(`urls.txt`, urls.join("\n"));

  console.log(`\nГотово: ${urls.length} страниц → ${CFG.out}`);
  console.log(`- виллы: ${villas.length}, локации: ${[...areas.values()].filter((l) => l.length >= 3).length}`);
  console.log(`- llms.txt, llms-full.txt, feed.xml (Pinterest), sitemap-growth.xml, data/*.json`);
  console.log(`Дальше: node indexnow.mjs (мгновенная индексация Bing→ChatGPT)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
