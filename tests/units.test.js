import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visibleTabs, parseQuantity, remaining, quotaErrors, gpuChoices } from '../src/lib/admin/units.js'

const ALL = ['profiles', 'users', 'notebook-options', 'access', 'groups', 'broadcast', 'requests']
test('super admin sees every tab plus units', () => {
  assert.deepEqual(visibleTabs({ is_super: true }, ALL), [...ALL, 'units', 'my-unit'])
})
test('unit admin sees my-unit plus permitted groups', () => {
  const w = { units: { u1: { permissions: { usersAndProfiles: true } }, u2: { permissions: { llmKeys: true } } } }
  assert.deepEqual(visibleTabs(w, ALL), ['my-unit', 'profiles', 'users', 'requests'])
  assert.deepEqual(visibleTabs({ units: {} }, ALL), [])
  assert.deepEqual(visibleTabs(null, ALL), [])
})
test('quantities', () => {
  assert.equal(parseQuantity('2Gi'), 2 * 2 ** 30)
  assert.equal(parseQuantity('500m'), 0.5)
  assert.equal(parseQuantity(3), 3)
  assert.throws(() => parseQuantity('2Xi'))
})
test('remaining, quota errors, gpu choices', () => {
  const left = remaining({ cpu: '8', memory: '16Gi' }, { cpu: '10' })
  assert.deepEqual(left, { cpu: 0, memory: 16 * 2 ** 30 })
  assert.deepEqual(quotaErrors({ cpu_limit: '1', memory_limit: '20Gi' }, left), { cpu: '1 > 0', memory: `20Gi > ${16 * 2 ** 30}` })
  assert.deepEqual(gpuChoices({ cpu: 1, 'nvidia.com/gpu': 2 }), ['nvidia.com/gpu'])
})

import { budgetBars, specFromForm, UNIT_FLAGS } from '../src/lib/admin/units.js'

test('budgetBars reports allocated vs budget per key and warns above 90%', () => {
  const bars = budgetBars({ budget: { cpu: '10', memory: '10Gi' }, allocated: { cpu: '9500m' } })
  assert.deepEqual(bars.map(b => [b.key, b.pct, b.warn, b.text]), [['cpu', 95, true, '9500m / 10'], ['memory', 0, false, '0 / 10Gi']])
})

test('specFromForm builds the unit spec and parses GPU lines', () => {
  const spec = specFromForm({ fa: ' واحد ', en: 'Lab', admins: 'a, b,', cpu: '64', memory: '', storage: '2Ti', gpus: 'nvidia.com/gpu=4\n\nnvidia.com/mig-1g.10gb = 2', permissions: { llmKeys: true }, roles: ['r'], models: ['m'] })
  assert.deepEqual(spec.budget, { cpu: '64', storage: '2Ti', 'nvidia.com/gpu': 4, 'nvidia.com/mig-1g.10gb': 2 })
  assert.deepEqual(spec.admins, ['a', 'b'])
  assert.deepEqual(spec.displayName, { fa: 'واحد', en: 'Lab' })
  assert.equal(Object.keys(spec.permissions).length, UNIT_FLAGS.length)
  assert.equal(spec.permissions.llmKeys, true)
  assert.equal(spec.permissions.accessAndGroups, false)
})

test('specFromForm rejects a GPU line it cannot parse', () => {
  assert.throws(() => specFromForm({ fa: '', en: '', admins: '', gpus: 'gpu: 4' }), /GPU/)
})
