# Деплой TheBaliHost

Статический сайт. Хостинг — Cloudflare Pages (бесплатный план), домен — `thehostbali.com`.

## Параметры

| Параметр | Значение |
|---|---|
| GitHub-репозиторий | `jokerfrombali/thebalihost` (приватный) |
| Продакшн-ветка | `main` |
| Хостинг | Cloudflare Pages, аккаунт `nevskiy50@gmail.com` |
| Имя Pages-проекта | `thebalihost` |
| Домен | `thehostbali.com` + `www.thehostbali.com` |
| Регистратор домена | Namecheap |
| DNS | Cloudflare (NS переключены с Namecheap) |
| Framework preset | None |
| Build command | *(пусто)* |
| Build output directory | `/` |
| Root directory | *(пусто, корень репо)* |

Сборки нет — Pages просто раздаёт файлы из корня репозитория как есть.

## Рабочий цикл

1. Claude правит файлы в локальной папке проекта.
2. `git add` + `git commit` — история изменений остаётся в git.
3. `git push` в `origin/main`.
4. Cloudflare Pages ловит push и деплоит автоматически, обычно 1–2 минуты.

Откат: в Cloudflare Pages → Deployments → нужный деплой → **Rollback**.

## Ограничения бесплатного плана

- Трафик и запросы — без лимита.
- 500 сборок в месяц (одна сборка = один push в `main`).
- Максимум 20 000 файлов в проекте (сейчас ~725) и 25 МиБ на файл.
  Самый большой файл — `video-header-manta.mp4`, 23.9 МиБ. **Впритык к лимиту** —
  новые видео класть только меньше 25 МиБ либо выносить на R2/внешний хостинг.

## Что Pages игнорирует

`Dockerfile`, `nginx.conf`, `.dockerignore` — остатки прежней схемы деплоя,
на Pages не используются. `sw.js` (service worker) раздаётся как обычный файл.

## История

Репозиторий создан 2026-07-28 как clean start из снапшота `balivillas`.
Полная предыдущая история — в `jokerfrombali/balivillas`.
