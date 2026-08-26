/* On-site SEO audit, run from inside the Worker.
 *
 * Reads pages through the ASSETS binding — no public round trip, so it cannot
 * trip the 522 loop that once produced false outage alerts, and it works even
 * while Cloudflare is caching aggressively.
 *
 * Deliberately batched: the free plan allows 50 subrequests per request and the
 * sitemap already holds 60+ URLs, so the panel walks the list in slices and
 * stitches the report together on the client. That also keeps each response fast
 * enough to render progress.
 */

const MAX_BATCH = 25;

/* Sitemap -> list of paths. Both sitemaps, deduplicated, in file order. */
export async function sitemapPaths(env) {
  const out = [];
  const seen = {};
  for (const file of ['/sitemap.xml', '/sitemap-growth.xml']) {
    let xml = '';
    try {
      const r = await env.ASSETS.fetch(new Request('https://thehostbali.com' + file));
      if (r.status !== 200) continue;
      xml = await r.text();
    } catch (e) { continue; }

    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
    let m;
    while ((m = re.exec(xml))) {
      let p;
      try { p = new URL(m[1]).pathname; } catch (e) { continue; }
      if (!seen[p]) { seen[p] = 1; out.push(p); }
    }
  }
  return out;
}

function tag(html, re) {
  const m = re.exec(html);
  return m ? m[1].trim() : '';
}

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function meta(html, name) {
  /* attribute order varies across our pages, so try both directions */
  const a = new RegExp('<meta[^>]+name=["\']' + name + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  const b = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*name=["\']' + name + '["\']', 'i');
  return decode(tag(html, a) || tag(html, b));
}

function prop(html, name) {
  const a = new RegExp('<meta[^>]+property=["\']' + name + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
  const b = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*property=["\']' + name + '["\']', 'i');
  return decode(tag(html, a) || tag(html, b));
}

/* One page, fully audited. */
async function auditOne(env, path) {
  const row = { path: path, status: 0, issues: [] };
  let html = '';
  try {
    const r = await env.ASSETS.fetch(new Request('https://thehostbali.com' + path));
    row.status = r.status;
    if (r.status !== 200) {
      row.issues.push({ level: 'error', code: 'status', text: 'Страница отвечает ' + r.status });
      return row;
    }
    html = await r.text();
  } catch (e) {
    row.issues.push({ level: 'error', code: 'fetch', text: 'Не удалось прочитать страницу' });
    return row;
  }

  row.bytes = html.length;
  const headEnd = html.indexOf('</head>');
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 60000);

  /* ---- title ---- */
  row.title = decode(tag(head, /<title[^>]*>([\s\S]*?)<\/title>/i));
  if (!row.title) {
    row.issues.push({ level: 'error', code: 'title', text: 'Нет <title>' });
  } else if (row.title.length > 60) {
    row.issues.push({ level: 'warn', code: 'title_long', text: 'Title ' + row.title.length + ' симв. — в выдаче обрежется (лучше до 60)' });
  } else if (row.title.length < 20) {
    row.issues.push({ level: 'warn', code: 'title_short', text: 'Title всего ' + row.title.length + ' симв. — слишком коротко' });
  }

  /* ---- description ---- */
  row.description = meta(head, 'description');
  if (!row.description) {
    row.issues.push({ level: 'error', code: 'desc', text: 'Нет meta description' });
  } else if (row.description.length > 165) {
    row.issues.push({ level: 'warn', code: 'desc_long', text: 'Description ' + row.description.length + ' симв. — обрежется (лучше до 160)' });
  } else if (row.description.length < 70) {
    row.issues.push({ level: 'warn', code: 'desc_short', text: 'Description всего ' + row.description.length + ' симв. — есть куда добавить смысла' });
  }

  /* ---- canonical ---- */
  row.canonical = decode(tag(head, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i));
  if (!row.canonical) {
    row.issues.push({ level: 'error', code: 'canonical', text: 'Нет canonical' });
  } else {
    let cp = '';
    try { cp = new URL(row.canonical).pathname; } catch (e) {}
    if (cp && cp !== path) {
      row.issues.push({ level: 'warn', code: 'canonical_other', text: 'Canonical ведёт на ' + cp + ', а не на саму страницу' });
    }
  }

  /* ---- robots / indexability ---- */
  const robots = meta(head, 'robots').toLowerCase();
  row.robots = robots;
  if (/noindex/.test(robots)) {
    row.issues.push({ level: 'error', code: 'noindex', text: 'Страница закрыта от индексации (noindex), но лежит в sitemap' });
  }

  /* ---- Open Graph — как ссылка выглядит в WhatsApp ---- */
  row.ogTitle = prop(head, 'og:title');
  row.ogImage = prop(head, 'og:image');
  if (!row.ogTitle) row.issues.push({ level: 'warn', code: 'og_title', text: 'Нет og:title — в WhatsApp ссылка будет без заголовка' });
  if (!row.ogImage) row.issues.push({ level: 'warn', code: 'og_image', text: 'Нет og:image — в WhatsApp ссылка будет без картинки' });

  /* ---- h1 ---- */
  const h1s = html.match(/<h1[\s>]/gi) || [];
  row.h1count = h1s.length;
  if (!h1s.length) row.issues.push({ level: 'warn', code: 'h1_none', text: 'Нет <h1>' });
  else if (h1s.length > 1) row.issues.push({ level: 'warn', code: 'h1_many', text: h1s.length + ' штук <h1> — должен быть один' });

  /* ---- structured data ---- */
  const ld = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  row.schema = [];
  ld.forEach(function (block) {
    const body = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const j = JSON.parse(body);
      const t = j['@type'] || (j['@graph'] && j['@graph'].map(function (x) { return x['@type']; }).join('+'));
      row.schema.push(String(t || 'unknown'));
    } catch (e) {
      row.issues.push({ level: 'error', code: 'schema_broken', text: 'Битая JSON-LD разметка — Google её не прочитает' });
    }
  });
  if (!ld.length) row.issues.push({ level: 'warn', code: 'schema_none', text: 'Нет JSON-LD разметки' });

  /* ---- images without alt ---- */
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  row.images = imgs.length;
  row.noAlt = imgs.filter(function (t) { return !/\balt\s*=/i.test(t); }).length;
  if (row.noAlt) {
    row.issues.push({
      level: 'warn', code: 'img_alt',
      text: row.noAlt + ' из ' + imgs.length + ' картинок без alt — теряем поиск по картинкам'
    });
  }

  /* ---- weight ---- */
  if (html.length > 400000) {
    row.issues.push({ level: 'warn', code: 'heavy', text: 'Страница ' + Math.round(html.length / 1024) + ' КБ — тяжело для мобильных' });
  }

  row.errors = row.issues.filter(function (i) { return i.level === 'error'; }).length;
  row.warnings = row.issues.filter(function (i) { return i.level === 'warn'; }).length;
  return row;
}

/* One slice of the crawl. The client keeps calling with a bigger offset until
   done is true, so no single request goes near the subrequest ceiling. */
export async function auditBatch(env, offset, limit) {
  const paths = await sitemapPaths(env);
  const from = Math.max(0, offset | 0);
  const take = Math.min(MAX_BATCH, Math.max(1, limit | 0 || 12));
  const slice = paths.slice(from, from + take);

  const rows = [];
  for (const p of slice) rows.push(await auditOne(env, p));

  return {
    total: paths.length,
    offset: from,
    count: rows.length,
    done: from + rows.length >= paths.length,
    rows: rows
  };
}
