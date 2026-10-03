import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seriesValues, adaptUsageHistory, adaptCost } from '../src/lib/adapters/metrics.js'

test('seriesValues keeps nulls out', () => {
  assert.deepEqual(seriesValues([[1, 0.5], [2, null], [3, 2]]), [0.5, 2])
  assert.deepEqual(seriesValues([1, 2]), [1, 2])
  assert.deepEqual(seriesValues(undefined), [])
})

test('usage history maps every series', () => {
  const h = adaptUsageHistory({ cpu_cores: [[1, 1]], memory_gib: [[1, 2]], storage_gib: [[1, 3]], gpu_util_pct: [] })
  assert.deepEqual(h, { cpu_cores: [1], memory_gib: [2], storage_gib: [3], gpu_util_pct: [] })
})

test('cost prefers irr, falls back to usd, sorts pods by cost', () => {
  const c = adaptCost({ daily: [{ date: '2026-10-01', usd: 1, irr: 1000 }, { date: '2026-10-02', usd: 2, irr: null }],
    by_pod: [{ pod: 'a', usd: 1, irr: 10 }, { pod: 'b', usd: 3, irr: 30 }] })
  assert.deepEqual(c.labels, ['2026-10-01', '2026-10-02'])
  assert.deepEqual(c.daily, [1000, null])
  assert.equal(c.unit, 'irr')
  assert.deepEqual(c.byPod.map(p => p.pod), ['b', 'a'])
  assert.equal(adaptCost({ daily: [{ date: 'd', usd: 2, irr: null }], by_pod: [] }).unit, 'usd')
  assert.deepEqual(adaptCost(null), { daily: [], labels: [], byPod: [], unit: 'irr' })
})
