# Состояние проекта thehostbali.com — паспорт для передачи

Этот файл — точка входа для любого нового человека или ИИ-ассистента
(в том числе новой сессии Claude с другого аккаунта). Здесь всё, что нельзя
вычитать из самого кода. Секретных значений здесь нет — только их имена и
места, где они лежат.

Обновлено: 21.08.2026.

## Что это

Статический сайт аренды вилл на Бали + Cloudflare Worker. Владелец —
jokerfrombali (nevskiy50@gmail.com). Компания PT MITRA VILA NUSANTARA,
адрес: Jalan Pasekan Gang Batu Ngonjol 10 No. 8, Batubulan Kangin, Sukawati,
Gianyar, Bali 80582. Контакт: +62 857 4649 9697 (он же WhatsApp).
Конверсия сайта = сообщение в WhatsApp или заявка через форму BOOKING.

## Инфраструктура

- **Хостинг**: Cloudflare Workers static assets. Воркер `thebalihost`,
  конфиг — `wrangler.jsonc` (main: `worker/index.js`, binding ASSETS,
  KV `THB_STATS`, cron `*/30 * * * *`).
- **Деплой**: git push → Workers Builds, либо вручную `npx wrangler deploy`.
  Перед деплоем: `python tools/update-lastmod.py`; после пуша:
  `python tools/indexnow.py`.
- **Секреты воркера** (Cloudflare → Workers → thebalihost → Variables):
  `TELEGRAM_TOKEN`, `TG_HOOK_SECRET`, `GA_SA_KEY`, `ADMIN_PASSWORD`,
  `SC_CLIENT_ID`, `SC_CLIENT_SECRET`, `SC_REFRESH_TOKEN`.
  Значения — только там. Без `ADMIN_PASSWORD` панель `/admin/` никого не пускает.
  Три `SC_*` — для Search Console: сервисный аккаунт она не принимает
  («не найден адрес»), поэтому там OAuth от myhostbali@gmail.com, см. `docs/ADMIN.md`.
- **Что не публикуется**: см. `.assetsignore` (worker/, docs/, tools/ и т.д.).

## Worker API (worker/index.js)

`POST /api/lead` — заявка → Telegram + архив в KV `lead:NNNNNN`, сквозной номер
из KV `seq:lead`. `POST /api/hit` — счётчик просмотров. `POST /api/alert` — JS-ошибки.
`POST /api/tg` — вебхук бота (команды /stats, /health, /help).
`GET /api/health` — проверка страниц. Cron: аптайм + недельная сводка пн 08:00 WITA.
`/api/admin/*` — панель управления за cookie-сессией, см. `docs/ADMIN.md`
(модули `worker/admin.js`, `auth.js`, `leads.js`, `seo.js`).
www→apex редирект в воркере сделать НЕЛЬЗЯ (HTML отдаётся мимо него) —
он стоит Cloudflare Redirect Rule'ом: `https://www.*` → `https://${1}`, 301,
с сохранением query string. Поставлен 26.08.2026, проверен: один прыжок,
метки (utm) переживают редирект.

## Telegram

Бот `@hostbali_bot`, чат `-1003961611036`: тема 2 — заявки, тема 4 —
аналитика/аварии. Токен засвечен в старой переписке — план: перевыпустить
через @BotFather и обновить секрет (владелец отложил: «потом поменяем»).
Подробности: `docs/TELEGRAM-BOT.md`.

## Аналитика и поиск

- **GA4**: property `550710445`, поток G-PF1FJQN7ME. Хранение 14 мес.
  Ключевые события: whatsapp_click, booking_submit. Спец-параметры:
  spot, page_name, has_dates. События шлёт `thb-events.js`.
  Данные в бот тянет `worker/ga.js` через service account (секрет GA_SA_KEY).
- **Search Console**: ресурс `https://thehostbali.com/`, подтверждён по тегу
  GA (не удалять gtag!). Карты: sitemap.xml (49), sitemap-growth.xml (13),
  sitemap-images.xml (283 фото). Связан с GA4.
- **Bing Webmaster**: те же три карты + IndexNow (ключ — 32-hex `.txt`
  в корне сайта, скрипт `tools/indexnow.py`).
- **Cookie-баннер**: thb-consent.js, Consent Mode v2.

## SEO — что сделано и что осталось

Сделано: см. `docs/SEO-CHECKLIST.md` (главный чек-лист) — canonical, OG,
VacationRental/ItemList/BreadcrumbList/FAQPage/LocalBusiness JSON-LD,
шрифты локально в /fonts/, llms.txt, hreflang (главная ↔ 16 языковых).

Осталось (владелец): Google Business Profile —
черновик создан (The Host Bali, Vacation home rental agency), нужен ввод
адреса + видео-подтверждение (инструкция в SEO-CHECKLIST §4); фото для GBP
подготовлены в `D:\Projects\thebalihost-gbp-photos`. Через 7–10 дней после
19.08.2026 — первый разбор запросов в Search Console.

## Конвенции для правок

- Windows: все патчи файлов — python с `newline=''`, иначе CRLF ломает диффы.
- 12 страниц вилл несут инъектированные блоки thb-* (крошки, секции,
  календарь, фото, enquiry) — правки скриптов делать в общих файлах
  thb-*.js в корне.
- Тексты страниц — английский; чат с владельцем — русский.
