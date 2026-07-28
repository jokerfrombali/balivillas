# Запуск Airbnb Villa Extractor

1. Открой Docker Desktop и дождись статуса “Docker is running”.
2. В PowerShell выполни:

```powershell
cd "D:\Projects\balivillas\tools\airbnb-importer"
.\run.ps1
```

3. Открой:

```text
http://localhost:8090
```

4. Вставь Airbnb URL.

Результат будет сохранён в:

```text
D:\Projects\balivillas\imports\airbnb-<roomId>\
```

Программа не меняет страницы сайта, `data/villas.json`, `sitemap.xml` и другие файлы сайта. Она только создаёт папку импорта.
