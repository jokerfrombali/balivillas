# SEO Rental URL Structure

Goal: build a clear rental sitemap where Google can index useful villa search pages without creating thin duplicate filter pages.

## Core Rule

Use query parameters for UI filters, but use clean static URLs for SEO.

- UI filter: `/property-rental/?location=umalas`
- SEO page: `/villas/umalas/`
- Individual villa: `/villa/premier-umalas-16-3br-pool-townhouse/`

Query-filtered pages should canonicalize to the closest clean SEO URL or stay noindex when the combination is not worth indexing.

## Main Rental URLs

- `/property-rental/` - main interactive rental catalog
- `/villas/` - SEO landing page for all Bali villas
- `/villa/{villa-slug}/` - individual villa detail page

## Location Pages

Create static location pages for real inventory and search demand:

- `/villas/canggu/`
- `/villas/berawa/`
- `/villas/umalas/`
- `/villas/seminyak/`
- `/villas/ubud/`
- `/villas/uluwatu/`
- `/villas/sanur/`
- `/villas/ungasan/`
- `/villas/jimbaran/`

## Bedroom Pages

Use these when the page has enough matching inventory:

- `/villas/1-bedroom/`
- `/villas/2-bedroom/`
- `/villas/3-bedroom/`
- `/villas/4-bedroom/`
- `/villas/5-bedroom/`
- `/villas/{location}/1-bedroom/`
- `/villas/{location}/2-bedroom/`
- `/villas/{location}/3-bedroom/`
- `/villas/{location}/4-bedroom/`
- `/villas/{location}/5-bedroom/`

## Stay Length Pages

- `/villas/monthly/`
- `/villas/yearly/`
- `/villas/daily/`
- `/villas/{location}/monthly/`
- `/villas/{location}/yearly/`
- `/villas/{location}/daily/`

## Amenity Pages

Use amenity pages only for high-intent filters:

- `/villas/private-pool/`
- `/villas/beachfront/`
- `/villas/ocean-view/`
- `/villas/chef-service/`
- `/villas/{location}/private-pool/`
- `/villas/{location}/beachfront/`
- `/villas/{location}/ocean-view/`
- `/villas/{location}/chef-service/`

## Intent Pages

Use intent pages for editorial SEO and internal linking:

- `/villas/family/`
- `/villas/romantic/`
- `/villas/surf/`
- `/villas/remote-work/`
- `/villas/{location}/family/`
- `/villas/{location}/romantic/`
- `/villas/{location}/surf/`
- `/villas/{location}/remote-work/`

## Indexing Rules

- Index pages with unique title, H1, intro copy, matching villa cards, FAQ, breadcrumbs, and canonical URL.
- Every indexable page needs a short unique SEO article, not just a filtered list.
- Noindex or canonicalize filter combinations with too few villas, duplicate intent, or weak demand.
- Do not index arbitrary multi-filter query combinations.
- Add only clean static SEO URLs to `sitemap.xml`.
- Keep every villa page linked from `/villas/`, its location page, and relevant filter pages.

## SEO Article Standard

Each indexable rental page should include:

- 250-500 words of unique, useful copy for the specific page intent.
- H1 with the exact search intent, for example `Villas in Umalas, Bali`.
- Short intro above the villa cards.
- One practical section below the cards, for example `Why rent a villa in Umalas?`.
- FAQ with 3-5 questions.
- Internal links to nearby locations, bedroom pages, amenities, and individual villas.
- Clear CTA to WhatsApp or inquiry form.

Avoid generic AI filler. Text must help the visitor choose an area, villa type, stay length, or booking path.

## Article Templates

Location page:

- What the area is good for.
- Who should stay there.
- Typical villa styles and bedroom counts.
- Distance/context to beaches, cafes, schools, nightlife, or work hubs.
- When this area is better than nearby areas.

Bedroom page:

- Who the bedroom count fits.
- Common layouts and privacy tradeoffs.
- Monthly vs daily rental considerations.
- Best matching locations.

Amenity page:

- Why the amenity matters in Bali.
- What to check before booking.
- Which areas have the strongest matching inventory.

Intent page:

- Describe the use case, such as family, surf, romantic, remote work.
- Mention relevant locations, amenities, and villa layouts.
- Link to exact villa examples.

## First Implementation Priority

1. `/villas/`
2. `/villas/umalas/`
3. `/villas/sanur/`
4. `/villas/ungasan/`
5. `/villas/{location}/{bedroom}-bedroom/` for locations with enough real listings
6. Add all individual `/villa/{slug}/` pages to `sitemap.xml`
