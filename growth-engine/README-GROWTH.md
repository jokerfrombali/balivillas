# Growth Engine — быстрый бесплатный трафик, который конвертируется в WhatsApp-лиды

Автономный генератор (Node 18+, ноль зависимостей). Берёт виллы из вашего API и производит весь «нестандартный» слой трафика, которого нет у конкурентов по Бали.

## Что внутри и почему это работает

| Файл/выход | Что даёт | Почему быстро и бесплатно |
|---|---|---|
| Страницы `/villa/{slug}/` | 515 индексируемых страниц с JSON-LD VacationRental+FAQ вместо нуля | Google наконец видит инвентарь; FAQ-schema даёт расширенные сниппеты |
| `/villas/{area}/…` (×спальни, ×monthly) | Программатик-страницы под запросы «3 bedroom villa canggu», «ubud monthly rental» | Низкоконкурентные longtail — самый быстрый органический вход |
| `/bali-villa-prices/` + `data/price-index.json` | **Живой индекс цен** из реального инвентаря, пересчёт ежедневно | Единственные реальные данные цен по районам → журналисты ссылаются, AI цитирует. Dataset-schema внутри |
| `llms.txt` + `llms-full.txt` + `data/villas.json` | Каталог, который ChatGPT/Perplexity/Claude читают напрямую | GEO: когда пользователь спрашивает AI «где снять виллу в Чангу» — у ассистента есть ваши данные с ценами и ссылками |
| `feed.xml` (RSS) | Подключите в Pinterest (Settings → Bulk create pins → RSS) | Pinterest автоматически публикует пины всех вилл — вечнозелёный визуальный трафик без ведения аккаунта |
| `indexnow.mjs` | Мгновенный пинг Bing/Yandex | **Индекс Bing питает ChatGPT Search и Copilot** — страницы попадают в AI-выдачу за часы, не недели |
| `deploy/growth-engine.yml` | Ежедневная пересборка на GitHub Actions | Свежесть контента (обновлено <30 дней) даёт ~3× больше AI-цитирований — у вас будет «обновлено сегодня» каждый день, автоматически |
| WhatsApp deep-links с предзаполненным текстом | Каждая страница = прямой лид | Гость пишет уже с названием виллы; UTM-метка в тексте показывает, какая страница привела деньги |

## Запуск

```bash
# тест на встроенных данных
node growth-engine/engine.mjs

# с реальными данными
API_BASE=https://mantavillas.com SITE_ORIGIN=https://balivillas.ai node growth-engine/engine.mjs

# мгновенная индексация (после выкладки dist/ на сайт)
node growth-engine/indexnow.mjs
```

Результат в `growth-engine/dist/` — выложите содержимое в корень сайта (или укажите `OUT_DIR` прямо в папку сайта).

## Установка автопилота (15 минут)

1. Скопируйте папку `growth-engine/` в корень репозитория `balivillas`.
2. `deploy/growth-engine.yml` → переместите в `.github/workflows/growth-engine.yml`.
3. В workflow проверьте `API_BASE` (должен отдавать JSON на `/api/villas`; если API закрыт — добавьте токен в GitHub Secrets и заголовок в `loadVillas()`).
4. Первый запуск: Actions → growth-engine → Run workflow.
5. После деплоя: проверьте `https://balivillas.ai/llms.txt` и `https://balivillas.ai/bali-villa-prices/`.
6. Добавьте строку `Sitemap: https://balivillas.ai/sitemap-growth.xml` в robots.txt и отправьте в Search Console + Bing Webmaster Tools.
7. Pinterest: бизнес-аккаунт → Create → Bulk create with RSS → `https://balivillas.ai/feed.xml`.
8. Файл `{key}.txt` (создаётся indexnow.mjs) должен быть доступен в корне сайта.

## Что это НЕ делает (честно)

- Не спамит Reddit/форумы — за это банят и домен, и бренд.
- Не гарантирует трафик за неделю: реалистично — первые AI-цитирования и Bing/ChatGPT-показы через 1–4 недели, органика Google через 2–4 месяца. Это самый быстрый белый путь, а не магия.
- Прямая конверсия зависит от скорости ответа в WhatsApp (<5 минут) — двигатель приводит лида, закрывает человек.

## Быстрые проверки после запуска

- `спросите ChatGPT/Perplexity: «median villa price in Canggu per night»` — через 2–4 недели ваш price-index должен начать появляться в источниках.
- Bing Webmaster Tools → URL Inspection: страницы должны индексироваться в течение суток после IndexNow-пинга.
- GA4: смотрите UTM `via balivillas.ai/...` в тексте входящих WhatsApp-сообщений — это карта «страница → деньги».
