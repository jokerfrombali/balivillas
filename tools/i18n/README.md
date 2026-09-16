# Итальянская версия сайта (/it/)

Английский — основной. Итальянские близнецы генерируются из английских страниц,
поэтому после любого изменения английских страниц надо перегенерировать:

    python tools/i18n/it_headers.py   # убрать мёртвый #langSwitcher, добавить hreflang (идемпотентно)
    python tools/i18n/gen_it.py       # собрать it/** из английских страниц по словарю
    python tools/i18n/it_sitemap.py   # /it/-адреса и xhtml:link в sitemap.xml

Словарь: data/i18n/it.auto.json (правила из it_rules.py) + data/i18n/it.tr.*.json
(ручные переводы, главнее правил). Новые английские строки:

    python tools/i18n/it_extract.py   # собрать все строки -> it.todo.json
    python tools/i18n/it_rules.py     # авто-правила -> it.auto.json, остаток -> it.manual.json
    # перевести остаток руками в новый data/i18n/it.tr.N.json и снова gen_it.py

Рантайм: worker/index.js снимает префикс /it/ для выбора скриптов и цен,
thb-lang.js ставит переключатель языка в шапку каждой страницы (по hreflang),
thb-it.js переводит текст виджетов (календарь, форма, карта, валюта) на /it/.
it_runtime.py — разовый патч скриптов под /it/, уже применён.
