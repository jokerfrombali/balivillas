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

