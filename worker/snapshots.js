/* Недельные снимки Search Console в KV.
 *
 * Зачем: Search Console отдаёт максимум 16 месяцев и только «как сейчас».
 * Вопрос «мы переписали title три недели назад — помогло?» по её API не
 * задать: сравнить не с чем. Снимок раз в неделю превращает это в
 * измеримое — но только начиная с сегодня, задним числом историю не собрать.
 * Поэтому смысл в том, чтобы начать копить как можно раньше.
 *
 * Ключи:
 *   gsc:week:YYYY-Www   один снимок за ISO-неделю, TTL 2 года
 *
 * Идемпотентность: cron ходит каждые 30 минут, а снимок нужен один за неделю.
 * Пишем, только если за текущую неделю снимка ещё нет — так пропущенный из-за
 * деплоя понедельник не стоит нам недели истории, снимок просто возьмётся
 * следующим запуском.
 */

import { searchConsole } from './ga.js';

const TTL_SEC = 730 * 86400;          // два года — дальше Search Console и сама не помнит

/* ISO-неделя: год и номер недели, как их считает ISO 8601. Обычный «номер дня
   делённый на 7» разъезжается на границе года. */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  /* четверг той же недели однозначно задаёт её год */
  const day = (t.getUTCDay() + 6) % 7;                 // Mon=0 .. Sun=6
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((t - firstThursday) / (7 * 86400000));
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function key(week) { return 'gsc:week:' + week; }

/* Снимает, если за эту неделю ещё не снимали. Возвращает, что произошло. */
export async function takeSnapshot(env, force) {
  if (!env.THB_STATS) return { ok: false, reason: 'no_kv' };

  const week = isoWeek(new Date());
  if (!force) {
    const have = await env.THB_STATS.get(key(week));
    if (have) return { ok: true, skipped: 'already_have', week: week };
  }

  const sc = await searchConsole(env, 28);
  if (!sc) return { ok: false, reason: 'search_console_unavailable', week: week };

  const snap = {
    week: week,
    takenAt: Date.now(),
    from: sc.from,
    to: sc.to,
    clicks: sc.clicks,
    impressions: sc.impressions,
    ctr: sc.ctr,
    position: sc.position,
    /* по 40 строк хватает, чтобы потом ответить «что стало с этим запросом»,
       и не раздувает значение до неприличного размера */
    queries: sc.queries.slice(0, 40),
    pages: sc.pages.slice(0, 40)
  };

  await env.THB_STATS.put(key(week), JSON.stringify(snap), { expirationTtl: TTL_SEC });
  return { ok: true, saved: true, week: week, clicks: snap.clicks };
}

/* Все снимки, свежие первыми. */
export async function listSnapshots(env, limit) {
  if (!env.THB_STATS) return [];
  const names = [];
  let cursor;
  do {
    const page = await env.THB_STATS.list({ prefix: 'gsc:week:', cursor: cursor });
    page.keys.forEach(function (k) { names.push(k.name); });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  names.sort().reverse();
  const out = [];
  for (const n of names.slice(0, limit || 60)) {
    try {
      const raw = await env.THB_STATS.get(n);
      if (raw) out.push(JSON.parse(raw));
    } catch (e) {}
  }
  return out;
}

/* Что изменилось между самым свежим и снимком N недель назад.
 * Возвращает null, пока сравнивать не с чем — врать про «рост» на одном
 * снимке нельзя. */
export function compare(snaps, backWeeks) {
  if (!snaps || snaps.length < 2) return null;
  const cur = snaps[0];
  const idx = Math.min(snaps.length - 1, Math.max(1, backWeeks || 4));
  const old = snaps[idx];

  const delta = (a, b) => Math.round((a - b) * 10) / 10;
  const pct = (a, b) => (b ? Math.round((a - b) / b * 1000) / 10 : null);

  /* по запросам: кто вырос, кто просел — именно это отвечает «помогло ли» */
  const oldQ = {};
  (old.queries || []).forEach(function (q) { oldQ[q.key] = q; });

  const moved = [];
  (cur.queries || []).forEach(function (q) {
    const o = oldQ[q.key];
    if (!o) return;
    const dClicks = q.clicks - o.clicks;
    const dPos = o.position - q.position;          // положительное = поднялись
    if (Math.abs(dClicks) >= 2 || Math.abs(dPos) >= 2) {
      moved.push({
        key: q.key,
        clicks: q.clicks, wasClicks: o.clicks, dClicks: dClicks,
        position: q.position, wasPosition: o.position,
        dPosition: Math.round(dPos * 10) / 10
      });
    }
  });
  moved.sort(function (a, b) { return b.dClicks - a.dClicks; });

  return {
    from: { week: old.week, to: old.to },
    to: { week: cur.week, to: cur.to },
    weeksApart: idx,
    clicks: { now: cur.clicks, was: old.clicks, d: delta(cur.clicks, old.clicks), pct: pct(cur.clicks, old.clicks) },
    impressions: { now: cur.impressions, was: old.impressions, d: delta(cur.impressions, old.impressions), pct: pct(cur.impressions, old.impressions) },
    ctr: { now: cur.ctr, was: old.ctr, d: delta(cur.ctr, old.ctr) },
    /* позиция «лучше», когда меньше — знак переворачиваем, чтобы плюс всегда
       означал улучшение */
    position: { now: cur.position, was: old.position, d: delta(old.position, cur.position) },
    up: moved.filter(function (m) { return m.dClicks > 0; }).slice(0, 10),
    down: moved.filter(function (m) { return m.dClicks < 0; }).reverse().slice(0, 10)
  };
}
