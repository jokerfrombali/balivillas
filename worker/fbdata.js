/* Группы Facebook и журнал публикаций.
 *
 * Агент, который будет вести объявления в группах, должен знать три вещи:
 * куда можно писать, когда туда можно писать снова и что там уже висит.
 * Первое и третье мы храним сами, второе считается из первых двух.
 *
 * Хранилище — тот же KV, что и у остального воркера: групп десятки, постов
 * сотни, отдельная база под такой объём не нужна. Журнал держим одним ключом
 * и подрезаем до POSTS_MAX: он нужен для правила «не чаще раза в N дней» и
 * для отчёта, а не как вечный архив.
 */

const GROUPS = 'fb:groups';
const POSTS = 'fb:posts';
const POSTS_MAX = 2000;

const DAY = 86400000;

function nowIso() { return new Date().toISOString(); }

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?facebook\.com\/(groups\/)?/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function listGroups(env) {
  try { return JSON.parse(await env.THB_STATS.get(GROUPS) || '[]') || []; }
  catch (e) { return []; }
}

async function saveGroups(env, list) {
  await env.THB_STATS.put(GROUPS, JSON.stringify(list));
}

/* Правила группы держим в том виде, в каком их пишут админы: раз в сколько
   дней можно постить, можно ли оставлять WhatsApp, можно ли поднимать старый
   пост, надо ли удалять предыдущий. Чего не знаем — оставляем null, это
   честнее выдуманного значения. */
export async function upsertGroup(env, g) {
  const list = await listGroups(env);
  const id = g.id || slug(g.url || g.name);
  if (!id) throw new Error('group needs name or url');

  const prev = list.filter((x) => x.id === id)[0] || null;
  const rec = {
    id,
    name: g.name || (prev && prev.name) || id,
    url: g.url || (prev && prev.url) || '',
    members: g.members != null ? Number(g.members) : (prev ? prev.members : null),
    language: g.language || (prev && prev.language) || null,
    area: g.area || (prev && prev.area) || null,
    kind: g.kind || (prev && prev.kind) || 'any',       /* rent | sale | any */
    active: g.active != null ? !!g.active : (prev ? prev.active : true),
    rules: {
      intervalDays: num(g.intervalDays, prev && prev.rules && prev.rules.intervalDays, 7),
      whatsappAllowed: bool(g.whatsappAllowed, prev && prev.rules && prev.rules.whatsappAllowed),
      bumpAllowed: bool(g.bumpAllowed, prev && prev.rules && prev.rules.bumpAllowed),
      deleteOld: bool(g.deleteOld, prev && prev.rules && prev.rules.deleteOld),
      priceRequired: bool(g.priceRequired, prev && prev.rules && prev.rules.priceRequired),
      notes: g.notes != null ? String(g.notes).slice(0, 600)
                             : (prev && prev.rules ? prev.rules.notes : '')
    },
    updatedAt: nowIso()
  };

  const out = list.filter((x) => x.id !== id);
  out.push(rec);
  out.sort((a, b) => a.id.localeCompare(b.id));
  await saveGroups(env, out);
  return rec;
}

function num(v, prev, def) {
  const n = Number(v);
  if (isFinite(n) && n > 0) return n;
  return prev != null ? prev : def;
}

function bool(v, prev) {
  if (v === true || v === false) return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return prev != null ? prev : null;     /* null = не знаем правила */
}

export async function deleteGroup(env, id) {
  const list = await listGroups(env);
  const out = list.filter((x) => x.id !== id);
  if (out.length === list.length) return false;
  await saveGroups(env, out);
  return true;
}

export async function deletePost(env, id) {
  let all = [];
  try { all = JSON.parse(await env.THB_STATS.get(POSTS) || '[]') || []; } catch (e) {}
  const out = all.filter((x) => x.id !== id);
  if (out.length === all.length) return false;
  await env.THB_STATS.put(POSTS, JSON.stringify(out));
  return true;
}

export async function listPosts(env, filter) {
  let all = [];
  try { all = JSON.parse(await env.THB_STATS.get(POSTS) || '[]') || []; } catch (e) {}
  const f = filter || {};
  return all.filter((p) => {
    if (f.groupId && p.groupId !== f.groupId) return false;
    if (f.propertyId && p.propertyId !== f.propertyId) return false;
    if (f.since && p.postedAt < f.since) return false;
    return true;
  });
}

export async function savePost(env, p) {
  if (!p || !p.groupId) throw new Error('groupId required');

  let all = [];
  try { all = JSON.parse(await env.THB_STATS.get(POSTS) || '[]') || []; } catch (e) {}

  const rec = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    groupId: String(p.groupId),
    propertyId: p.propertyId ? String(p.propertyId) : null,
    url: p.url ? String(p.url).slice(0, 400) : '',
    postedAt: p.postedAt || nowIso(),
    /* posted | removed | rejected | pending */
    status: p.status || 'posted',
    note: p.note ? String(p.note).slice(0, 600) : ''
  };

  all.push(rec);
  all.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));   /* свежие сверху */
  if (all.length > POSTS_MAX) all = all.slice(0, POSTS_MAX);
  await env.THB_STATS.put(POSTS, JSON.stringify(all));
  return rec;
}

/* Что можно публиковать сегодня.
 *
 * Считаем по журналу: последний пост в группу плюс интервал из её правил. Если
 * правила неизвестны, группа всё равно попадает в ответ, но с пометкой: пусть
 * агент спросит человека, а не решит сам. */
export async function postingPlan(env, onDate) {
  const groups = await listGroups(env);
  const posts = await listPosts(env, {});
  const at = onDate ? new Date(onDate + 'T00:00:00Z') : new Date();
  const now = at.getTime();

  const out = [];
  for (const g of groups) {
    const mine = posts.filter((p) => p.groupId === g.id && p.status !== 'rejected');
    const last = mine[0] || null;                   /* журнал отсортирован свежими вверх */
    const interval = (g.rules && g.rules.intervalDays) || null;

    let canPost = true;
    let reason = 'интервал выдержан';
    let nextAt = null;

    if (!g.active) {
      canPost = false;
      reason = 'группа выключена';
    } else if (last && interval) {
      const due = new Date(last.postedAt).getTime() + interval * DAY;
      nextAt = new Date(due).toISOString();
      if (now < due) {
        canPost = false;
        const days = Math.ceil((due - now) / DAY);
        reason = 'с прошлой публикации прошло меньше ' + interval +
                 ' дн., ждать ещё ' + days;
      }
    } else if (!last) {
      reason = 'в этой группе ещё не публиковались';
    }

    out.push({
      groupId: g.id,
      name: g.name,
      url: g.url,
      kind: g.kind,
      area: g.area,
      canPost,
      reason,
      nextAllowedAt: nextAt,
      intervalDays: interval,
      rules: g.rules,
      lastPost: last ? { url: last.url, postedAt: last.postedAt,
                         propertyId: last.propertyId, status: last.status } : null,
      postedTotal: mine.length
    });
  }

  out.sort((a, b) => (a.canPost === b.canPost ? 0 : a.canPost ? -1 : 1));
  return { date: at.toISOString().slice(0, 10), groups: out };
}
