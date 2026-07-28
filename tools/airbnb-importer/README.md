# Airbnb Villa Extractor

Локальная программа для механического извлечения Airbnb-виллы в папку `imports/airbnb-<roomId>/`.

Что делает:
- скачивает сырой HTML в `raw/listing.html`;
- сохраняет встроенные Airbnb scripts/state в `raw/bootstrap.json`;
- извлекает `listing.json` с названием, параметрами, описанием, amenities, фото и группами фото;
- скачивает все уникальные фото в `photos/01.jpg`, `02.jpg`, ...;
- пишет `manifest.json` и `README.md`;
- НЕ трогает страницы сайта, sitemap и каталоги вилл.

## Запуск через Docker

Из PowerShell:

```powershell
cd "D:\Projects\balivillas\tools\airbnb-importer"
docker build -t balivillas-airbnb-importer .
docker run --rm -p 8090:8090 -v "D:\Projects\balivillas:/workspace" balivillas-airbnb-importer
```

Открыть:

```text
http://localhost:8090
```

Вставить Airbnb URL и нажать “Скачать виллу”.

## Результат

Например:

```text
D:\Projects\balivillas\imports\airbnb-1640382948484924036\
```

Внутри будут `photos/`, `raw/`, `listing.json`, `manifest.json`, `README.md`.
