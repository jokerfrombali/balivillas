# Деплой TheBaliHost

Статический сайт. Хостинг — **Cloudflare Workers (Static Assets)**, домен — `thehostbali.com`.

## Параметры

| Параметр | Значение |
|---|---|
| GitHub-репозиторий | `jokerfrombali/thebalihost` (приватный) |
| Продакшн-ветка | `main` |
| Хостинг | Cloudflare Workers, аккаунт `nevskiy50@gmail.com` |
| Имя Worker-проекта | `thebalihost` |
| Домен | `thehostbali.com` + `www.thehostbali.com` |
| Регистратор домена | Namecheap |
| DNS | Cloudflare, NS `jack.ns.cloudflare.com` / `vida.ns.cloudflare.com` |
| Build command | *(пусто)* |
| Deploy command | `npx wrangler deploy` |
| Конфиг | `wrangler.jsonc` в корне репозитория |

Сборки нет. `wrangler.jsonc` говорит отдавать содержимое корня репозитория как статику,
`.assetsignore` исключает служебные папки из публичной выдачи.

## Что НЕ публикуется (см. `.assetsignore`)

`.github/`, `docs/`, `growth-engine/`, `imports/`, `tools/`, `AGENTS.md`,
`Dockerfile`, `nginx.conf`, `cleanup-virtual-villas.ps1`, `balivillas_checklist.html`.

`data/villas.json` публикуется — его подтягивают страницы вилл на лету.

## Страница 404

`404.html` в корне. В `wrangler.jsonc` стоит `"not_found_handling": "404-page"` —
Cloudflare сам отдаёт этот файл со статусом 404 на любой неизвестный путь.
Локальный `python -m http.server` так не умеет: там неизвестный путь вернёт свою
заглушку, проверять страницу локально нужно по прямому адресу `/404.html`.

## Рабочий цикл

1. Claude правит файлы в локальной папке проекта.
2. `git add` + `git commit` — история изменений остаётся в git.
3. `git push` в `origin/main`.
4. Cloudflare ловит push и деплоит автоматически, обычно 1–2 минуты.

Откат: Cloudflare → Workers → `thebalihost` → Deployments → нужная версия → Rollback.

## Ограничения бесплатного плана

- Трафик и запросы к статике — без лимита.
- 20 000 файлов в проекте (сейчас ~730) и 25 МиБ на файл.
  Самый большой файл — `video-header-manta.mp4`, 23.9 МиБ. **Впритык к лимиту** —
  новые видео класть только меньше 25 МиБ либо выносить на R2.

## История

Репозиторий создан 2026-07-28 как clean start из снапшота `balivillas`.
Полная предыдущая история — в `jokerfrombali/balivillas`.
