# SEO: ручные шаги (панели, не код)

Код-часть сделана 2026-08-19: OG/Twitter-карточки на 53 страницах, VacationRental
JSON-LD на виллах, ItemList на каталоге, description/canonical на /property-rental/,
robots.txt почищен.

## 1. Google Search Console — сделано 19.08.2026

Ресурс `https://thehostbali.com/` (тип «с префиксом в URL») создан и **подтверждён
автоматически** — по тегу Google Аналитики, который уже стоит на страницах.
Поэтому важно: не удалять gtag.js со страниц, иначе подтверждение слетит.

- Sitemap `https://thehostbali.com/sitemap.xml` — статус «Успешно», 49 страниц.
- Sitemap `https://thehostbali.com/sitemap-growth.xml` — «Успешно», 13 страниц.
- GA4 ↔ Search Console связаны: в Отчётах GA4 появились «Запросы» и «Обычный
  поисковый трафик» — там будет видно, по каким запросам приходят из Google.

Что осталось руками:

1. URL Inspection → главная и 2–3 виллы → **Request indexing** (ускоряет первый обход).
2. Через неделю смотреть Pages (что проиндексировано), Enhancements
   (подтянулся ли VacationRental), Core Web Vitals.
3. По желанию — добавить ещё и **доменный** ресурс `thehostbali.com`
   (покрывает www и http): Add property → Domain → TXT-запись в Cloudflare DNS.

## 2. Google Analytics 4 — сделано 19.08.2026

Ресурс `550710445`, поток «сайт», `G-PF1FJQN7ME`, сбор данных идёт.

- Хранение данных о событиях: **14 месяцев** (было 2 — дефолт, из-за которого
  нельзя сравнивать сезон с сезоном).
- Ключевые события (конверсии): `whatsapp_click`, `booking_submit`.
- Специальные параметры: `spot` (CTA spot), `page_name` (Villa page),
  `has_dates` (Dates chosen) — без них параметры собираются, но не видны в отчётах.
- Улучшенная статистика включена (прокрутка, исходящие клики и т.д.).

Честно про «двигать в топ»: GA4 не влияет на позиции. Позиции показывает и
объясняет Search Console (запросы, показы, CTR, средняя позиция), а GA4
показывает, что эти визиты делают дальше — дошли ли до WhatsApp и заявки.
Связка двух источников и даёт материал для решений: какие районы и виллы
дописывать, какие страницы переписывать под запросы, где ломается путь к заявке.

## 3. Bing Webmaster Tools (бесплатный трафик + ChatGPT Search)

https://www.bing.com/webmasters → Import from Google Search Console (одной кнопкой).

## 4. Google Business Profile

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

## 5. www -> apex (осталось)

Cloudflare → thehostbali.com → Rules → Redirect Rules → Create:
- When: Hostname equals `www.thehostbali.com`
- Then: Dynamic redirect, expression
  `concat("https://thehostbali.com", http.request.uri.path)`, 301, preserve query.

В воркере это сделать нельзя: HTML отдаётся напрямую из хранилища статики и до
кода воркера не доходит — редирект там просто не сработал бы. Сейчас
`www.thehostbali.com` отвечает 200, то есть сайт доступен по двум адресам;
критично это не ломает (canonical на всех страницах указывает на apex), но
правило лучше поставить.

## 6. Дальше по контенту (по желанию)

- Раз в месяц дописывать тексты районов (Ungasan сейчас нормальный, но короче Sanur).
- Блог-страницы под запросы «bali villa with private pool <район>» — по одной в месяц.
- Ссылки: профили в каталогах (TripAdvisor, Google Maps, Bali-каталоги) с
  ссылкой на сайт.
