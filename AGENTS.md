# Project Instructions

- Save tokens by default: give concise answers, avoid unnecessary scans, and do not explain obvious steps unless asked.
- Prefer PowerShell commands for the user when a task can be done manually without risk.
- Before doing work that the user can easily do by hand, provide the exact PowerShell command or manual step and wait only if user confirmation is required.
- Use tools only when they materially reduce user effort, prevent mistakes, or verify important state.
- Keep changes scoped to the current task and avoid unrelated refactors.
- SEO structure matters for this project. For rental pages, prefer clean indexable URLs over query-only filters.
- Query URLs such as `/property-rental/?location=umalas` are allowed for UI filtering, but SEO pages should use static paths such as `/villas/umalas/`.
- Keep rental URL structure documented in `docs/seo-rental-url-structure.md` and update it before adding new filter page types.
- Every indexable SEO rental page must include a short unique SEO article, matching villa cards, FAQ, breadcrumbs, canonical URL, and internal links to related rental pages.
- When importing villa photos from Airbnb, use the full Airbnb photo tour data when available: download every unique property photo, preserve `MediaTourStop` section names/categories, keep the Airbnb photo grouping/order, and use those labels for gallery sections, visible captions, image alt text, and structured villa data. Do not flatten Airbnb photos into an unlabeled image list unless Airbnb provides no labels.
- For villa pages and Airbnb imports, preserve the approved current BaliVillas design/layout: hero photo grid, booking card, smart back navigation, photo-tour gallery sections, captions, and existing visual style. Do not replace it with a simplified or unrelated template unless the user explicitly asks for a redesign.
- Canonical villa page design reference: `/villa/premier-umalas-16-3br-pool-townhouse/`. For every new villa page, clone/adapt this exact design system and interaction model first, then replace content/photos. Do not invent a new villa page layout.
- Canonical area listing design reference: `/villas/umalas/`. For every `/villas/{area}/` page, clone/adapt this exact catalog design first, then replace the area copy and cards. Area pages must show only villas for that area unless the user explicitly asks for a mixed catalog.
- Area category pages such as /villas/sanur/ and /villas/umalas/ must stay focused on that area: no generic Bali/AI search blocks in the category header, default filters must match the area, counters/titles must name the current area, and cards must only include villas from that area.
- For every villa, use the canonical villa page design and nested SEO gallery route: `/villa/.../gallery/`; old root gallery files are legacy only.
- Admin helper lives at `/admin/villas/`; it must support visual photo ordering, first photo as card cover, first five photos as villa mosaic, and Airbnb-style photo groups/captions.
- Villa admin category rules: each villa can be assigned to all-villas/property-rental, area page, bedroom page, monthly/yearly, new, luxury, and amenity filter tags; generated JSON must include `categories`, `filterTags`, and `seoSections`.


## Villa field conventions

- Dates: `updatedAt` in villa JSON and `lastmod` in `sitemap.xml` must use the current project/system date, never a guessed date.
- `cardImage` is the best selling photo for the card (usually pool, exterior, or hero shot), not necessarily Airbnb's first photo. Override the first-photo default when the first photo is weak for a card.
- `topGallery` is the 5-photo mosaic: default to the first five photos, but manual reordering is allowed when the Airbnb order is poor.
- The `seoSections` flag is spelled `newOnSite` (capital V). Do not introduce a `newOnSite` variant — a mismatched key would split into two separate fields.

## Никаких выдуманных данных

Это правило важнее краткости и важнее скорости.

- **Любая цифра, дата, цена, имя объекта или статус — только из реального источника,**
  который был прочитан в этой же сессии. Не из памяти, не по аналогии, не «примерно так
  обычно бывает». Нет источника — писать «не проверял», а не подставлять правдоподобное.
- **Рядом с цифрой указывать, откуда она взята**: имя файла, URL, эндпоинт, раздел
  панели. Читатель должен иметь возможность открыть тот же источник и увидеть то же.
- **Не выдавать макет за факт.** Скриншот локальной копии, превью, тестовый рендер,
  пример вёрстки — подписывать словом «макет» в самой подписи, а не только в тексте
  рядом. Если на картинке не боевая страница, это должно быть видно сразу.
- **Не додумывать связки между системами.** Сопоставление «объект здесь = объект там»
  делается по совпадающему полю, которое видно в обеих системах (публичное имя,
  внешний id, адрес). Совпадение по числу спален или по похожему названию —
  это гипотеза, и её надо называть гипотезой и спрашивать.
- **Расхождение между источниками — это находка, а не шум.** Если сайт, Hostex и
  Airbnb показывают разное, надо показать разницу конкретными датами и назвать
  причину, а не сглаживать формулировкой «в целом совпадает».
- **Про свою работу тоже без преувеличений.** «Проверено» пишется только про то, что
  реально запускалось на боевых данных. Не «работает», а «в тесте на таких-то данных
  дало такой-то результат».
