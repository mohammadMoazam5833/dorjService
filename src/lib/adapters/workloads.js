// Real kubeflow-resource-usage JSON -> the props the existing pages render.
// Backend URLs are built from KUBEFLOW_HOSTNAME (platform.isigpu.local); their routes are
// host "*" on the gateway, so a host-relative path keeps the user on goodarzi.
export function relativeUrl(u) {
  if (!u) return u ?? null
  try { const x = new URL(u, 'https://placeholder.invalid'); return x.pathname + x.search + x.hash } catch { return u }
}

const list = raw => (Array.isArray(raw) ? raw : [])

function notebookStatus(n) {
  switch (n.phase) {
    case 'ready': return 'Running'
    case 'stopped': return 'Stopped'
    case 'waiting': return n.stopped ? 'Stopping' : 'Pending'
    case 'terminating': return 'Terminating'
    case 'warning': return 'Error'
    default: return n.stopped ? 'Stopped' : 'Pending'
  }
}

export const adaptNotebooks = raw => list(raw).map(n => ({
  name: n.name,
  status: notebookStatus(n),
  image: n.image || '',
  created_at: n.created_at,
  url: relativeUrl(n.url),
  in_use_by: '',
  phase_message: n.phase_message || '',
  stopped: !!n.stopped,
  cpu_limit: n.cpu_limit ?? null,
  memory_limit: n.memory_limit ?? null,
  storage: n.storage ?? null,
  gpu_key: n.gpu_key ?? null,
  gpu_count: n.gpu_count ?? null,
}))

export const adaptVolumes = raw => list(raw).map(v => ({ ...v, viewer_url: relativeUrl(v.viewer_url) || '' }))

export const adaptVms = raw => list(raw).map(v => ({
  name: v.name,
  status: v.phase || 'Unknown',
  cpu: v.cpu_cores ?? null,
  memory: v.memory_request ?? null,
  ip: v.ip_address ?? null,
  created_at: v.created_at,
  console_available: !!v.console_available,
}))

export const adaptBackups = raw => list(raw).map(b => ({
  name: b.name,
  created_at: b.created_at,
  size: b.size_gib == null ? '—' : `${b.size_gib} GiB`,
  phase: b.phase,
}))
