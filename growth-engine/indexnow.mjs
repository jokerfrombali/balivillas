#!/usr/bin/env node
/**
 * IndexNow — мгновенная индексация в Bing/Yandex/Seznam/Naver. Бесплатно.
 * Почему это важно: индекс Bing питает ChatGPT Search и Copilot —
 * новые страницы попадают в AI-выдачу за часы, а не недели.
 *
 * Запуск (после engine.mjs):
 *   node indexnow.mjs                 # пингует все URL из dist/urls.txt
 *   ONLY_NEW=1 node indexnow.mjs     # только URL, которых не было в прошлом запуске
 *
 * Один раз: положите сгенерированный {key}.txt в корень сайта (скрипт создаст файл в dist/).
 */

import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR || path.join(__dirname, "dist");
const ORIGIN = (process.env.SITE_ORIGIN || "https://balivillas.ai").replace(/\/$/, "");
const KEY_FILE = path.join(__dirname, ".indexnow-key");
const SEEN_FILE = path.join(__dirname, ".indexnow-seen.json");

async function getKey() {
  try {
    return (await readFile(KEY_FILE, "utf8")).trim();
  } catch {
    const key = randomBytes(16).toString("hex");
    await writeFile(KEY_FILE, key);
    console.log(`Создан новый IndexNow-ключ: ${key}`);
    return key;
  }
}

async function main() {
  const key = await getKey();
  await writeFile(path.join(OUT, `${key}.txt`), key); // файл верификации → корень сайта

  let urls = (await readFile(path.join(OUT, "urls.txt"), "utf8")).split("\n").filter(Boolean);

  if (process.env.ONLY_NEW) {
    let seen = [];
    try { seen = JSON.parse(await readFile(SEEN_FILE, "utf8")); } catch {}
    const seenSet = new Set(seen);
    urls = urls.filter((u) => !seenSet.has(u));
    await writeFile(SEEN_FILE, JSON.stringify([...new Set([...seen, ...urls])]));
    if (!urls.length) return console.log("Новых URL нет — пинг не нужен.");
  }

  // batch до 10 000 URL за запрос
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: ORIGIN.replace(/^https?:\/\//, ""),
      key,
      keyLocation: `${ORIGIN}/${key}.txt`,
      urlList: urls.slice(0, 10000),
    }),
  });
  console.log(`IndexNow: ${urls.length} URL отправлено, статус ${res.status} ${res.status === 200 || res.status === 202 ? "✓ принято" : "— проверьте, что " + key + ".txt лежит в корне сайта"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
