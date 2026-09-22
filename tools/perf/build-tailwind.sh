#!/bin/sh
# Compile the site's Tailwind classes into one static stylesheet, /thb-tw.css.
#
# Why: until 18.09.2026 every page loaded https://cdn.tailwindcss.com (≈110 KB of
# render-blocking JavaScript that generated the CSS in the browser). Lighthouse on the
# home page: LCP 10.9 s, "render-blocking 730 ms", "unused JavaScript 108 KB". A compiled
# 37 KB CSS file removes all of that and renders pixel-identical (checked on /, /villas/sanur/,
# /villa-management/).
#
# Run from the repo root after adding pages that use NEW Tailwind classes:
#     sh tools/perf/build-tailwind.sh
# Needs Node 18+; installs tailwindcss@3 into a scratch folder on first run.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${TMPDIR:-/tmp}/thb-tailwind"
mkdir -p "$WORK"
cd "$WORK"
[ -d node_modules/tailwindcss ] || { npm init -y >/dev/null 2>&1; npm i -s tailwindcss@3 @tailwindcss/container-queries >/dev/null 2>&1; }
printf '@tailwind base;@tailwind components;@tailwind utilities;' > in.css
cp "$ROOT/tools/perf/tailwind/tailwind.config.js" ./tailwind.config.js
sed -i.bak "s#'./#'$ROOT/#g" tailwind.config.js
npx tailwindcss -c tailwind.config.js -i in.css -o "$ROOT/thb-tw.css" --minify
# The @font-face rules ship inside the same file: two separate render-blocking stylesheets cost an
# extra round trip (PSI 20.09.2026 charged /fonts/fonts.css 180 ms). fonts-site.css is fonts.css
# without JetBrains Mono, which only balivillas_checklist.html uses.
python3 - "$ROOT" <<'PY'
import re, sys, os
root = sys.argv[1]
css = open(os.path.join(root, 'fonts/fonts.css'), encoding='utf-8').read()
kept = [m.group(0) for m in re.finditer(r'(?:/\*[^*]*\*/\s*)?@font-face\s*\{[^}]*\}', css)
        if 'JetBrains' not in m.group(0)]
open(os.path.join(root, 'fonts/fonts-site.css'), 'w', encoding='utf-8').write('\n'.join(kept) + '\n')
tw_path = os.path.join(root, 'thb-tw.css')
marker = '/* --- site fonts (appended by tools/perf/build-tailwind.sh) --- */'
tw = open(tw_path, encoding='utf-8').read().split(marker)[0].rstrip()
fonts = open(os.path.join(root, 'fonts/fonts-site.css'), encoding='utf-8').read()
open(tw_path, 'w', encoding='utf-8').write(tw + '\n' + marker + '\n' + fonts)
PY
ls -l "$ROOT/thb-tw.css"
