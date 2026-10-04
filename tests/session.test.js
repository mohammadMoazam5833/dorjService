import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const routes = {}
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} }
globalThis.location = { reload: () => {} }
globalThis.fetch = async (url, init) => {
  const r = routes[`${init?.method || 'GET'} ${url}`]
  if (!r) throw new Error('unexpected ' + url)
  return { ok: r[0] < 300, status: r[0], json: async () => r[1] }
}
const http = await import('../src/lib/http.js')
const { loadSession, initialsOf, changePassword, logoutUrl } = await import('../src/lib/session.js')

beforeEach(() => { http._resetForTests(); for (const k of Object.keys(routes)) delete routes[k] })

test('admin user', async () => {
  routes['GET /api/change-password/whoami'] = [200, { email: 'a@isigpu.local', displayName: 'a@isigpu.local' }]
  routes['GET /api/resource-usage'] = [200, { namespace: 'ns-a' }]
  routes['GET /admin-panel/api/admin/whoami'] = [200, { email: 'a@isigpu.local', role: 'platform-admin' }]
  assert.deepEqual(await loadSession(), { email: 'a@isigpu.local', namespace: 'ns-a', isAdmin: true, error: null })
})

test('non-admin gets 403 from whoami -> isAdmin false, no error', async () => {
  routes['GET /api/change-password/whoami'] = [200, { email: 'u@isigpu.local' }]
  routes['GET /api/resource-usage'] = [200, { namespace: 'ns-u' }]
  routes['GET /admin-panel/api/admin/whoami'] = [403, { error: 'not admin' }]
  const s = await loadSession()
  assert.equal(s.isAdmin, false)
  assert.equal(s.error, null)
})

test('user without a Profile surfaces the namespace error', async () => {
  routes['GET /api/change-password/whoami'] = [200, { email: 'n@isigpu.local' }]
  routes['GET /api/resource-usage'] = [403, { error: 'no Profile found with owner n@isigpu.local' }]
  routes['GET /admin-panel/api/admin/whoami'] = [403, { error: 'x' }]
  const s = await loadSession()
  assert.equal(s.namespace, null)
  assert.equal(s.error.status, 403)
})

test('initials', () => {
  assert.equal(initialsOf('godarzi@isigpu.local'), 'GO')
  assert.equal(initialsOf(''), '?')
})

test('changePassword sends the backend contract and reports its message', async () => {
  let sent
  globalThis.fetch = async (url, init) => { sent = { url, init }; return { ok: false, status: 400, json: async () => ({ error: 'Invalid current password' }) } }
  const r = await changePassword('old', 'new')
  assert.equal(sent.url, '/api/change-password')
  assert.deepEqual(JSON.parse(sent.init.body), { currentPassword: 'old', newPassword: 'new' })
  assert.deepEqual(r, { ok: false, message: 'Invalid current password' })
  // ends the Keycloak SSO session first, then clears oauth2-proxy's cookie on this host
  assert.equal(logoutUrl('https://platform.isigpu.local'),
    'https://identity.isigpu.local/realms/dorj/protocol/openid-connect/logout?client_id=dex&post_logout_redirect_uri=' +
    encodeURIComponent('https://platform.isigpu.local/oauth2/sign_out'))
})
