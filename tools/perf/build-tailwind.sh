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
ls -l "$ROOT/thb-tw.css"
