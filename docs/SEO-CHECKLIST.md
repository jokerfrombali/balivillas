# SEO: ручные шаги (панели, не код)

Код-часть сделана 2026-08-19: OG/Twitter-карточки на 53 страницах, VacationRental
JSON-LD на виллах, ItemList на каталоге, description/canonical на /property-rental/,
www-редирект в _redirects, robots.txt почищен.

## 1. Google Search Console — главное

1. https://search.google.com/search-console → Add property → **Domain** → `thehostbali.com`.
2. Google даст TXT-запись → Cloudflare → thehostbali.com → DNS → Add record:
   Type TXT, Name `@`, Content — строка от Google → Verify.
3. Sitemaps → добавить обе:
   - `https://thehostbali.com/sitemap.xml`
   - `https://thehostbali.com/sitemap-growth.xml`
4. URL Inspection → вставить главную и 2-3 виллы → Request indexing.
5. Через неделю смотреть: Pages (что проиндексировано), Enhancements
   (подтянулся ли VacationRental), Core Web Vitals.

## 2. Bing Webmaster Tools (бесплатный трафик + ChatGPT Search)

https://www.bing.com/webmasters → Import from Google Search Console (одной кнопкой).

## 3. Google Business Profile

https://business.google.com → создать профиль:
- Название: The Host Bali
- Категория: Villa rental agency (+ Property management company)
- Телефон: +62 857 4649 9697
- Адрес: Jalan Pasekan Gang Batu Ngonjol 10 No. 8, Batubulan Kangin,
  Sukawati, Gianyar, Bali 80582
- Сайт: https://thehostbali.com
- Фото вилл из /public-objects/images/
Подтверждение обычно видео-звонком или открыткой. После публикации профиля
просить гостей оставлять отзывы — это главный фактор карт.

## 4. Если www-редирект из _redirects не заработал

Cloudflare → thehostbali.com → Rules → Redirect Rules → Create:
- When: Hostname equals `www.thehostbali.com`
- Then: Dynamic redirect, expression
  `concat("https://thehostbali.com", http.request.uri.path)`, 301, preserve query.

## 5. Дальше по контенту (по желанию)

- Раз в месяц дописывать тексты районов (Ungasan сейчас нормальный, но короче Sanur).
- Блог-страницы под запросы «bali villa with private pool <район>» — по одной в месяц.
- Ссылки: профили в каталогах (TripAdvisor, Google Maps, Bali-каталоги) с
  ссылкой на сайт.
