import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupUsage, wedges, weightText } from '../src/lib/admin/gpu.js'

const usage = [
  { kind: 'Notebook', namespace: 'a', workload: 'nb1', resource: 'nvidia.com/mig-1g.10gb', count: '2', vram_gib: 20 },
  { kind: 'Notebook', namespace: 'b', workload: 'nb2', resource: 'nvidia.com/gpu', count: '1', vram_gib: 80 },
  { kind: 'Model', namespace: 'm', workload: 'glm', resource: 'nvidia.com/gpu', count: '4', vram_gib: null },
]

test('groupUsage sums counts and VRAM, falls back to units without VRAM', () => {
  const g = groupUsage(usage, u => u.kind)
  const nb = g.find(x => x.key === 'Notebook'), md = g.find(x => x.key === 'Model')
  assert.equal(nb.total, 3); assert.equal(nb.vramTotal, 100); assert.equal(nb.weight, 100)
  assert.equal(md.hasVram, false); assert.equal(md.weight, 4)
  assert.equal(weightText(nb), '100 GiB VRAM'); assert.equal(weightText(md), '4 unit(s)')
  assert.deepEqual(nb.parts, ['mig-1g.10gb ×2 (20GiB)', 'gpu ×1 (80GiB)'])
})

test('wedges split 360 degrees by weight; a single slice is a full circle', () => {
  const w = wedges([{ weight: 1 }, { weight: 3 }])
  assert.deepEqual(w.map(x => x.pct), [25, 75])
  assert.match(w[1].path, /A 100,100 0 1,1/)
  assert.match(wedges([{ weight: 5 }])[0].path, /^M 110,10 A/)
  assert.deepEqual(wedges([]), [])
})
