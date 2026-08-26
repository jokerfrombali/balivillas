/* Admin authentication for the Worker.
 *
 * One password, kept in the ADMIN_PASSWORD secret, exchanged for a signed
 * session cookie. There is no user table: a single owner logs in from a phone
 * or a laptop, and the cookie is all the state we need.
 *
 * The cookie is HMAC-SHA256 over its own expiry, so nobody can mint or extend
 * one without the key. It carries no personal data — only "valid until".
 *
 * Without ADMIN_PASSWORD set, every admin endpoint answers 503: a panel that
 * shows leads must never be reachable by accident.
 */

const COOKIE = 'thb_admin';
const TTL_SEC = 12 * 3600;          // a working day, then log in again

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Comparison that does not leak how much of the password matched. */
function sameSecret(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

async function hmac(env, message) {
  /* The session key is derived from the password, so rotating the password
     invalidates every existing cookie — which is what you want after a leak. */
  const secret = env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || '';
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode('thb-admin-v1:' + secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64url(new Uint8Array(sig));
}

async function mintToken(env) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  return exp + '.' + await hmac(env, String(exp));
}

async function tokenValid(env, token) {
  if (!token || token.indexOf('.') < 0) return false;
  const parts = token.split('.');
  const exp = Number(parts[0]);
  if (!exp || exp * 1000 < Date.now()) return false;
  return sameSecret(parts[1], await hmac(env, String(exp)));
}

function cookieValue(req, name) {
  const raw = req.headers.get('cookie') || '';
  const hit = raw.split(/;\s*/).find(function (c) { return c.indexOf(name + '=') === 0; });
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}

/* true when the request carries a live admin session */
export async function isAdmin(req, env) {
  if (!env.ADMIN_PASSWORD && !env.ADMIN_SESSION_SECRET) return false;
  return tokenValid(env, cookieValue(req, COOKIE));
}

export function adminConfigured(env) {
  return !!env.ADMIN_PASSWORD;
}

function setCookie(token, maxAge) {
  return COOKIE + '=' + encodeURIComponent(token) +
    '; Path=/; Max-Age=' + maxAge +
    '; HttpOnly; Secure; SameSite=Strict';
}

/* POST /api/admin/login  { password }
 * Throttled by the caller, so a stolen URL cannot be brute-forced. */
export async function handleLogin(req, env) {
  let d = {};
  try { d = await req.json(); } catch (e) {}

  if (!env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), {
      status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
  if (!d.password || !sameSecret(d.password, env.ADMIN_PASSWORD)) {
    return new Response(JSON.stringify({ ok: false, error: 'bad_password' }), {
      status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'set-cookie': setCookie(await mintToken(env), TTL_SEC)
    }
  });
}

export function handleLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'set-cookie': setCookie('', 0)
    }
  });
}
