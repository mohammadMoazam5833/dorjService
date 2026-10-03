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
