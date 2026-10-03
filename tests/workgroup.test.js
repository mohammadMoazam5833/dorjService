import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roleBreakdown, isEmail, validNamespace, suggestNamespace } from '../src/lib/workgroup.js'

test('roleBreakdown groups env-info namespaces by role, owner first', () => {
  const rows = roleBreakdown([{ namespace: 'b', role: 'contributor' }, { namespace: 'a', role: 'owner' }, { namespace: 'c', role: 'contributor' }, { namespace: 'v', role: 'viewer' }])
  assert.deepEqual(rows, [{ role: 'owner', namespaces: ['a'] }, { role: 'contributor', namespaces: ['b', 'c'] }, { role: 'viewer', namespaces: ['v'] }])
  assert.deepEqual(roleBreakdown([]), [])
})

test('isEmail matches the backend contributor check', () => {
  assert.equal(isEmail('a.b@x-y.org'), true)
  assert.equal(isEmail('nope'), false)
  assert.equal(isEmail('a@-x.org'), false)
})

test('validNamespace follows the DNS label rule', () => {
  assert.equal(validNamespace('ali-r2'), true)
  assert.equal(validNamespace('-ali'), false)
  assert.equal(validNamespace('Ali'), false)
  assert.equal(validNamespace(''), false)
})

test('suggestNamespace derives a namespace from the login like the platform', () => {
  assert.equal(suggestNamespace('Ali.Rezaei'), 'ali-rezaei')
  assert.equal(suggestNamespace('_x_y_'), 'xy')
})
