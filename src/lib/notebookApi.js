// Request bodies for kubeflow-resource-usage's notebook endpoints (same contract the
// platform's notebooks-view.js sends: POST /api/notebooks, PATCH /api/notebooks/<name>).
export function normalizeGib(v) {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  return /^\d+(\.\d+)?$/.test(s) ? `${s}Gi` : s
}

// Kubernetes DNS-1123 label; the notebook name also prefixes its StatefulSet/PVC names.
export const validName = n => /^[a-z]([-a-z0-9]{0,50}[a-z0-9])?$/.test(String(n || '').trim())

export function createPayload(f) {
  const body = {
    name: f.name.trim(),
    image: f.image,
    cpu: String(f.cpu || '1'),
    memory: normalizeGib(f.memory || '2'),
    storage: normalizeGib(f.storage || '5'),
    persist_storage: true,
    workspace_access_mode: f.accessMode || 'ReadWriteOnce',
  }
  if (f.gpuKey) { body.gpu_key = f.gpuKey; body.gpu_count = String(f.gpuCount || '1') }
  if (f.workspace === 'existing' && f.existingPvc) body.workspace_existing_pvc = f.existingPvc
  return body
}

export function resizePayload(f) {
  const resize = {}
  if (f.cpu) resize.cpu_limit = String(f.cpu)
  if (f.memory) resize.memory_limit = normalizeGib(f.memory)
  if (f.storage) resize.storage = normalizeGib(f.storage)
  if (f.gpuKey) { resize.gpu_key = f.gpuKey; resize.gpu_count = String(f.gpuCount || '1') }
  return { resize }
}
