import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

let calls, reloads, store, nowMs
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
globalThis.sessionStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) } }
globalThis.location = { reload: () => { reloads++ } }

const http = await import('../src/lib/http.js')

beforeEach(() => {
  calls = []; reloads = 0; store = {}; nowMs = 1_000_000
  http._resetForTests({ now: () => nowMs })
})
const stubFetch = (...responses) => {
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return responses.shift() }
}

test('200 returns data and no error', async () => {
  stubFetch(resp(200, { a: 1 }))
  assert.deepEqual(await http.getJson('/api/x'), { data: { a: 1 }, error: null })
})

test('403 returns error with backend message', async () => {
  stubFetch(resp(403, { error: 'no Profile found with owner u@x' }))
  const r = await http.getJson('/api/notebooks')
  assert.equal(r.data, null)
  assert.deepEqual(r.error, { status: 403, message: 'no Profile found with owner u@x' })
})

test('network failure is status 0', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  const r = await http.getJson('/api/x')
  assert.equal(r.error.status, 0)
})

test('401 reloads at most once per 10 s', async () => {
  stubFetch(resp(401, {}), resp(401, {}), resp(401, {}))
  await http.getJson('/api/a'); await http.getJson('/api/b')
  assert.equal(reloads, 1)
  nowMs += 10_001
  await http.getJson('/api/c')
  assert.equal(reloads, 2)
})

test('cache hits within TTL, refetches after TTL', async () => {
  stubFetch(resp(200, 1), resp(200, 2))
  assert.equal((await http.getJson('/api/v')).data, 1)
  assert.equal((await http.getJson('/api/v')).data, 1)
  assert.equal(calls.length, 1)
  nowMs += 30_001
  assert.equal((await http.getJson('/api/v')).data, 2)
})

test('errors are not cached', async () => {
  stubFetch(resp(500, { error: 'boom' }), resp(200, 'ok'))
  await http.getJson('/api/e')
  assert.equal((await http.getJson('/api/e')).data, 'ok')
})

test('send posts JSON and invalidates the collection prefix', async () => {
  stubFetch(resp(200, { items: [1] }), resp(200, { ok: true }), resp(200, { items: [1, 2] }))
  await http.getJson('/api/mail/messages?folder=INBOX')
  const r = await http.send('/api/mail/seen', { body: { folder: 'INBOX', uid: 3 } })
  assert.deepEqual(r, { data: { ok: true }, error: null })
  assert.equal(calls[1].init.method, 'POST')
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json')
  assert.equal(calls[1].init.body, JSON.stringify({ folder: 'INBOX', uid: 3 }))
  assert.deepEqual((await http.getJson('/api/mail/messages?folder=INBOX')).data, { items: [1, 2] })
})
