import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateArgs, fittingNodes, decorate } from '../src/lib/admin/models.js'

test('vLLM flags: must start with --, reserved names rejected', () => {
  assert.deepEqual(validateArgs('--max-model-len=8192\n# note\n\n--tensor-parallel-size=2', 'vllm'), { ok: true, args: ['--max-model-len=8192', '--tensor-parallel-size=2'] })
  assert.equal(validateArgs('', 'vllm').ok, false)
  assert.match(validateArgs('-x', 'vllm').error, /must start with --/)
  assert.match(validateArgs('--port=1', 'sglang').error, /--port/)
})

test('llama.cpp flags need -ngl and a per-slot context of 128K', () => {
  assert.match(validateArgs('--ctx-size=131072', 'llamacpp').error, /-ngl/)
  assert.match(validateArgs('-ngl=999', 'llamacpp').error, /--ctx-size/)
  assert.match(validateArgs('-ngl=999\n-np=2\n--ctx-size=131072', 'llamacpp').error, /65536 per/)
  assert.equal(validateArgs('-ngl=999\n-np=2\n--ctx-size=262144', 'llamacpp').ok, true)
  assert.match(validateArgs('-ngl=999\n-c=abc', 'llamacpp').error, /integer/)
  assert.match(validateArgs('-m=x\n-ngl=1', 'llamacpp').error, /-m/)
})

test('fitting nodes count the model\'s own GPUs as free', () => {
  const nodes = [{ name: 'a', resources: [{ resource_name: 'nvidia.com/gpu', free: 1, total: 4, label: 'H100' }] },
    { name: 'b', resources: [{ resource_name: 'nvidia.com/gpu', free: 2, total: 2, label: 'H100' }] }]
  assert.deepEqual(fittingNodes(nodes, 2, 'nvidia.com/gpu', null).map(n => n.name), ['b'])
  assert.deepEqual(fittingNodes(nodes, 2, 'nvidia.com/gpu', { node: 'a', gpu_required: 1 }).map(n => n.name), ['a', 'b'])
})

test('decorate derives status flags', () => {
  const d = decorate({ status: 'downloading', deployable: true, conflicts_currently_serving: [] })
  assert.equal(d.in_flight, true); assert.equal(d.pausable, true); assert.equal(d.is_download_phase, true)
  assert.equal(decorate({ status: 'downloaded', deployable: true, conflicts_currently_serving: ['x'] }).deployable_now, false)
})
