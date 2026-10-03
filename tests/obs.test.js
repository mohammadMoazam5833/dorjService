import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aliasMap, aliasNormalizedExpr, topUsersExpr, traceQuery, parseTrace, visibleSpans, userSlices, OTHERS_KEY, scaleSeries } from '../src/lib/admin/obs.js'

test('aliasMap maps every comma-separated litellm alias to the model id', () => {
  assert.deepEqual(aliasMap([{ id: 'glm-5.3-flash', litellm_alias: 'glm, glm5' }, { id: 'x' }, { litellm_alias: 'orphan' }]), { glm: 'glm-5.3-flash', glm5: 'glm-5.3-flash' })
})

test('aliasNormalizedExpr wraps the vector in one escaped label_replace per alias', () => {
  const e = aliasNormalizedExpr('rate(m[5m])', { 'q.1': 'qwen' })
  assert.equal(e, 'label_replace(rate(m[5m]), "requested_model", "qwen", "requested_model", "^q\\.1$")')
  assert.equal(aliasNormalizedExpr('v', {}), 'v')
})

test('topUsersExpr follows the selected range and drops None series', () => {
  const e = topUsersExpr(1440, x => `N(${x})`)
  assert.match(e, /^topk\(20, sum by \(user, requested_model\) \(N\(increase\(/)
  assert.match(e, /user!="None",requested_model!="None"\}\[1440m\]/)
})

test('traceQuery adds the client-ip clause inside the TraceQL braces', () => {
  assert.equal(traceQuery('{ a = 1 }', '10.0.0.1'), '{ a = 1 && span.client_ip = "10.0.0.1" }')
  assert.equal(traceQuery('{ }', '1.2.3.4'), '{ span.client_ip = "1.2.3.4" }')
  assert.equal(traceQuery('', '1.2.3.4'), '{ span.client_ip = "1.2.3.4" }')
  assert.equal(traceQuery(' { a } ', ''), '{ a }')
})

const span = (id, parent, s0, s1, name = id) => ({ spanId: id, parentSpanId: parent, name, startTimeUnixNano: String(s0 * 1e6), endTimeUnixNano: String(s1 * 1e6) })
const batch = (svc, spans) => ({ resource: { attributes: [{ key: 'service.name', value: { stringValue: svc } }] }, scopeSpans: [{ spans }] })

test('parseTrace builds a depth-first tree with chronological seq numbers', () => {
  const t = parseTrace({ batches: [batch('litellm', [span('a', '', 1000, 1100), span('b', 'a', 1010, 1090)]), batch('vllm', [span('c', 'b', 1020, 1080)])] })
  assert.deepEqual(t.spans.map(s => [s.id, s.depth, s.seq, s.s0ms, s.s1ms]), [['a', 0, 1, 0, 100], ['b', 1, 2, 10, 90], ['c', 2, 3, 20, 80]])
  assert.equal(t.total, 100)
  assert.equal(t.skewMs, 0)
  assert.equal(t.descendants.a, 2)
})

test('parseTrace re-aligns a service whose clock is skewed by seconds', () => {
  const t = parseTrace({ batches: [batch('litellm', [span('a', '', 1000, 1100)]), batch('vllm', [span('c', 'a', 6000, 6050)])] })
  const c = t.spans.find(s => s.id === 'c')
  assert.equal(c.s0ms, 0)
  assert.equal(t.skewMs, 5000)
})

test('visibleSpans hides descendants of collapsed spans', () => {
  const t = parseTrace({ batches: [batch('s', [span('a', '', 0, 10), span('b', 'a', 1, 9), span('c', 'b', 2, 8), span('d', '', 11, 12)])] })
  assert.deepEqual(visibleSpans(t.spans, new Set(['a'])).map(s => s.id), ['a', 'd'])
  assert.deepEqual(visibleSpans(t.spans, new Set(['b'])).map(s => s.id), ['a', 'b', 'd'])
})

test('userSlices folds users under 4% into Others and drills into a user or Others', () => {
  const rows = [{ user: 'u1', model: 'm1', value: 90 }, { user: 'u1', model: 'm2', value: 5 }, { user: 'u2', model: 'm1', value: 3 }, { user: 'u3', model: 'm1', value: 2 }]
  const top = userSlices(rows, null)
  assert.deepEqual(top.map(s => [s.key, s.value, s.drillable]), [['u1', 95, true], [OTHERS_KEY, 5, true]])
  assert.deepEqual(userSlices(rows, 'u1').map(s => [s.key, s.value]), [['m1', 90], ['m2', 5]])
  assert.deepEqual(userSlices(rows, OTHERS_KEY).map(s => s.key), ['u2', 'u3'])
  assert.equal(top[0].pct, 95)
})

test('scaleSeries maps timestamped points into the plot box with a shared time axis', () => {
  const s = scaleSeries([{ points: [[0, 0], [10, 5]] }, { points: [[5, 10]] }], { w: 100, h: 50 })
  assert.equal(s.yMax, 10)
  assert.deepEqual(s.series[0].xy, [[0, 50], [100, 25]])
  assert.deepEqual(s.series[1].xy, [[50, 0]])
  assert.equal(scaleSeries([], { w: 1, h: 1 }).empty, true)
})
