// Pure HTTP core (no React). Real backends sit behind oauth2-proxy: an expired session answers
// /api/* with 401 (api_routes), so we reload once to re-run the login redirect.
const RELOAD_KEY = 'dorj.http.last401Reload'
const RELOAD_GAP_MS = 10_000
let cache = new Map()
let now = () => Date.now()

export function _resetForTests(opts = {}) {
  cache = new Map()
  now = opts.now || (() => Date.now())
}

export function invalidate(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
}

function onUnauthorized() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (now() - last < RELOAD_GAP_MS) return
    sessionStorage.setItem(RELOAD_KEY, String(now()))
  } catch {
    // storage blocked: still reload once per page life
    if (onUnauthorized.done) return
    onUnauthorized.done = true
  }
  location.reload()
}

async function request(path, init) {
  let r
  try {
    r = await fetch(path, { credentials: 'same-origin', ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) } })
  } catch (e) {
    return { data: null, error: { status: 0, message: String(e?.message || e) } }
  }
  let body = null
  try { body = await r.json() } catch { body = null }
  if (r.ok) return { data: body, error: null }
  if (r.status === 401) onUnauthorized()
  const message = (body && typeof body === 'object' && (body.error || body.message)) || `HTTP ${r.status}`
  return { data: null, error: { status: r.status, message: String(message) } }
}

export async function getJson(path, { ttlMs = 30_000 } = {}) {
  const hit = cache.get(path)
  if (hit && now() - hit.at < ttlMs) return hit.result
  const result = await request(path, { method: 'GET' })
  if (!result.error) cache.set(path, { at: now(), result })
  return result
}

// "/api/mail/seen" -> "/api/mail", "/admin-panel/api/admin/users/x" -> "/admin-panel/api/admin/users"
function collectionPrefix(path) {
  const p = path.split('?')[0].split('/').filter(Boolean)
  return '/' + p.slice(0, Math.max(2, p.length - 1)).join('/')
}

export async function send(path, { method = 'POST', body } = {}) {
  const result = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!result.error) invalidate(collectionPrefix(path))
  return result
}
