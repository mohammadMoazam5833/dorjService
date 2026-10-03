import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGib, validName, createPayload, resizePayload } from '../src/lib/notebookApi.js'

test('normalizeGib adds Gi to bare numbers only', () => {
  assert.equal(normalizeGib('4'), '4Gi')
  assert.equal(normalizeGib(' 2.5 '), '2.5Gi')
  assert.equal(normalizeGib('512Mi'), '512Mi')
  assert.equal(normalizeGib(''), undefined)
})

test('validName follows DNS-1123 label rules', () => {
  assert.equal(validName('my-nb1'), true)
  assert.equal(validName('My_NB'), false)
  assert.equal(validName('-x'), false)
  assert.equal(validName('a'.repeat(53)), false)
})

test('createPayload matches the backend contract', () => {
  assert.deepEqual(createPayload({ name: ' nb1 ', image: 'img:1', cpu: '2', memory: '8', storage: '20', gpuKey: '', gpuCount: '', workspace: 'new', existingPvc: '', accessMode: 'ReadWriteOnce' }),
    { name: 'nb1', image: 'img:1', cpu: '2', memory: '8Gi', storage: '20Gi', persist_storage: true, workspace_access_mode: 'ReadWriteOnce' })
  const p = createPayload({ name: 'nb2', image: 'i', cpu: '1', memory: '4', storage: '', gpuKey: 'nvidia.com/gpu', gpuCount: '', workspace: 'existing', existingPvc: 'data', accessMode: 'ReadWriteMany' })
  assert.equal(p.gpu_key, 'nvidia.com/gpu'); assert.equal(p.gpu_count, '1')
  assert.equal(p.workspace_existing_pvc, 'data'); assert.equal(p.storage, '5Gi')
})

test('resizePayload sends only changed fields', () => {
  assert.deepEqual(resizePayload({ cpu: '4', memory: '', storage: '30', gpuKey: '', gpuCount: '' }), { resize: { cpu_limit: '4', storage: '30Gi' } })
  assert.deepEqual(resizePayload({ cpu: '', memory: '16', storage: '', gpuKey: 'nvidia.com/mig-1g.10gb', gpuCount: '2' }), { resize: { memory_limit: '16Gi', gpu_key: 'nvidia.com/mig-1g.10gb', gpu_count: '2' } })
})
