/* Lead storage in KV.
 *
 * Until now a request only existed as a Telegram message: fine for reacting in
 * the moment, useless for "which villa gets asked about most" or "did we ever
 * answer #0042". Every lead is now also written to KV and gets a status, so the
 * admin panel can work as a small CRM.
 *
 * Key layout:
 *   lead:000123        one lead, JSON, no TTL — this is business history
 *   The ticket number doubles as the sort key, so list() returns them in order.
 */

const STATUSES = ['new', 'working', 'booked', 'lost'];

function key(no) { return 'lead:' + String(no).padStart(6, '0'); }

/* Called from handleLead once the ticket number is known. Never throws: losing
   the archive copy must not cost us the Telegram message. */
export async function saveLead(env, no, data) {
  if (!env.THB_STATS || !no) return;
  const rec = {
    no: String(no),
    ts: Date.now(),
    source: data.source === 'whatsapp' ? 'whatsapp' : 'form',
    villa: data.villa || '',
    checkin: data.checkin || '',
    checkout: data.checkout || '',
    nights: data.nights || 0,
    guests: data.guests || '',
    adults: data.adults || 0,
    children: data.children || 0,
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    note: data.note || '',
    text: String(data.text || '').slice(0, 800),
    page: data.page || data.url || '',
    city: data.city || '',
    country: data.country || '',
    status: 'new',
    adminNote: ''
  };
  try {
    await env.THB_STATS.put(key(no), JSON.stringify(rec));
  } catch (e) { /* archive is best-effort */ }
}

/* Newest first. limit caps how many records we actually read back. */
export async function listLeads(env, limit) {
  if (!env.THB_STATS) return [];
  const names = [];
  let cursor;
  do {
    const page = await env.THB_STATS.list({ prefix: 'lead:', cursor: cursor });
    page.keys.forEach(function (k) { names.push(k.name); });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  /* zero-padded numbers sort lexicographically, so this is newest-first */
  names.sort().reverse();

  /* Read in parallel chunks: sequentially, 300 records is 300 round trips and
     the panel visibly hangs. Chunked so we never open hundreds at once. */
  const wanted = names.slice(0, limit || 200);
  const out = [];
  for (let i = 0; i < wanted.length; i += 40) {
    const chunk = await Promise.all(wanted.slice(i, i + 40).map(function (name) {
      return env.THB_STATS.get(name).then(function (raw) {
        try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
      }).catch(function () { return null; });
    }));
    chunk.forEach(function (r) { if (r) out.push(r); });
  }
  return out;
}

export async function updateLead(env, no, patch) {
  if (!env.THB_STATS || !no) return null;
  const k = key(no);
  let rec;
  try { rec = JSON.parse(await env.THB_STATS.get(k) || 'null'); } catch (e) { rec = null; }
  if (!rec) return null;

  if (patch.status && STATUSES.indexOf(patch.status) >= 0) rec.status = patch.status;
  if (typeof patch.adminNote === 'string') rec.adminNote = patch.adminNote.slice(0, 1000);
  rec.updatedAt = Date.now();

  await env.THB_STATS.put(k, JSON.stringify(rec));
  return rec;
}

/* Counts + the villa ranking that tells you what to buy more of. */
export function summarise(leads, sinceMs) {
  const rows = sinceMs ? leads.filter(function (l) { return l.ts >= sinceMs; }) : leads;
  const byStatus = { new: 0, working: 0, booked: 0, lost: 0 };
  const bySource = { whatsapp: 0, form: 0 };
  const byVilla = {};
  let withDates = 0;

  rows.forEach(function (l) {
    if (byStatus[l.status] !== undefined) byStatus[l.status]++;
    if (bySource[l.source] !== undefined) bySource[l.source]++;
    if (l.villa) byVilla[l.villa] = (byVilla[l.villa] || 0) + 1;
    if (l.checkin) withDates++;
  });

  return {
    total: rows.length,
    byStatus: byStatus,
    bySource: bySource,
    withDates: withDates,
    topVillas: Object.entries(byVilla).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8)
  };
}

export { STATUSES };
