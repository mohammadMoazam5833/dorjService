import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalized, planRow, planFromForm, renamePlan, planInUse, validWeight, duration } from '../src/lib/admin/ratelimits.js'

test('normalized fills every section with defaults', () => {
  const c = normalized({})
  assert.deepEqual(c.model_weights, { default: 1 })
  assert.deepEqual(c.defaults, { key: null, user: null, tenant: null })
  assert.deepEqual(c.overrides, { key: {}, user: {}, tenant: {} })
  assert.deepEqual(c.charge_failed, { server_error: false, timeout: false, client_error: false, cancelled: true })
  assert.equal(c.max_tokens_policy, 'clamp'); assert.equal(c.on_redis_error, 'closed')
})

test('plan form <-> plan', () => {
  assert.deepEqual(planFromForm({ requests_per_window: '50', window_hours: '4', requests_per_minute: '10', max_concurrent: '', fail_open: true }),
    { requests_per_window: 50, window_seconds: 14400, requests_per_minute: 10, fail_open: true })
  assert.match(planFromForm({ requests_per_window: '5', window_hours: '' }), /window/)
  assert.match(planFromForm({ requests_per_minute: '1.5' }), /whole/)
  assert.deepEqual(planRow('basic', { requests_per_window: 50, window_seconds: 14400 }),
    { name: 'basic', fail_open: false, requests_per_window: 50, window_hours: 4, requests_per_minute: null, max_concurrent: null, max_input_tokens: null, max_output_tokens: null })
})

test('rename and in-use checks follow defaults and overrides', () => {
  const c = normalized({ plans: { a: {} }, defaults: { user: 'a' }, overrides: { key: { k1: { plan: 'a' } } } })
  assert.equal(planInUse(c, 'a'), true)
  renamePlan(c, 'a', 'b')
  assert.equal(c.defaults.user, 'b'); assert.equal(c.overrides.key.k1.plan, 'b')
  assert.equal(planInUse(c, 'a'), false)
})

test('weights and durations', () => {
  assert.equal(validWeight(0), true); assert.equal(validWeight(0.005), false); assert.equal(validWeight(1001), false); assert.equal(validWeight(NaN), false)
  assert.equal(duration(3_900_000), '1h 5m'); assert.equal(duration(45_000), '45s')
})
