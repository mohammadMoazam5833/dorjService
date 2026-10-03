import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relativeUrl, adaptNotebooks, adaptVolumes, adaptVms, adaptBackups } from '../src/lib/adapters/workloads.js'

test('relativeUrl strips platform host', () => {
  assert.equal(relativeUrl('https://platform.isigpu.local/notebook/ns/nb/'), '/notebook/ns/nb/')
  assert.equal(relativeUrl('https://platform.isigpu.local/pvcviewers/ns/v/?x=1'), '/pvcviewers/ns/v/?x=1')
  assert.equal(relativeUrl(null), null)
  assert.equal(relativeUrl('/already/relative'), '/already/relative')
})

test('notebook phases map to UI statuses', () => {
  const nb = (phase, stopped = false) => ({ name: 'a', image: 'r/x:1', phase, stopped, phase_message: 'm', created_at: 't', url: 'https://platform.isigpu.local/notebook/n/a/' })
  const s = raw => adaptNotebooks([raw])[0].status
  assert.equal(s(nb('ready')), 'Running')
  assert.equal(s(nb('stopped', true)), 'Stopped')
  assert.equal(s(nb('waiting')), 'Pending')
  assert.equal(s(nb('waiting', true)), 'Stopping')
  assert.equal(s(nb('warning')), 'Error')
  assert.equal(s(nb('terminating')), 'Terminating')
  const out = adaptNotebooks([nb('ready')])[0]
  assert.equal(out.url, '/notebook/n/a/')
  assert.equal(out.in_use_by, '')
  assert.equal(out.phase_message, 'm')
})

test('adaptNotebooks tolerates non-array', () => {
  assert.deepEqual(adaptNotebooks({ error: 'x' }), [])
})

test('volumes keep fields and get a relative viewer url', () => {
  const v = adaptVolumes([{ name: 'w', size: '20Gi', status: 'Bound', viewer_url: 'https://platform.isigpu.local/pvcviewers/n/w/', used_gib: 3 }])[0]
  assert.equal(v.viewer_url, '/pvcviewers/n/w/')
  assert.equal(v.used_gib, 3)
  assert.equal(adaptVolumes([{ name: 'x', viewer_url: null }])[0].viewer_url, '')
})

test('vms map phase/cpu/memory/ip', () => {
  const v = adaptVms([{ name: 'vm1', phase: 'Running', cpu_cores: 4, memory_request: '8Gi', ip_address: '10.0.0.5', created_at: 't', console_available: true }])[0]
  assert.deepEqual(v, { name: 'vm1', status: 'Running', cpu: 4, memory: '8Gi', ip: '10.0.0.5', created_at: 't', console_available: true })
})

test('backups render size from size_gib', () => {
  assert.deepEqual(adaptBackups([{ name: 'b', created_at: '2026-10-01T00:00:00Z', size_gib: 1.5, phase: 'Completed' }]),
    [{ name: 'b', created_at: '2026-10-01T00:00:00Z', size: '1.5 GiB', phase: 'Completed' }])
  assert.equal(adaptBackups([{ name: 'b', size_gib: null }])[0].size, '—')
})
