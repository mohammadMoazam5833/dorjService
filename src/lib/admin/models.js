// Model catalogue rules, ported from the platform's admin-panel-models.js.
export const STATUS_LABELS = {
  not_downloaded: 'دانلود نشده', downloading: 'در حال دانلود…', download_paused: 'دانلود متوقف شده', download_failed: 'دانلود ناموفق',
  downloaded: 'دانلود شده', copying: 'در حال آماده‌سازی…', copy_paused: 'آماده‌سازی متوقف شده', deploying: 'در حال استقرار…', serving: 'در حال سرویس‌دهی',
}
const PAUSABLE = new Set(['downloading', 'copying'])
const RESUMABLE = new Set(['download_paused', 'copy_paused'])
export const IN_FLIGHT = new Set(['downloading', 'copying', 'deploying', 'download_paused', 'copy_paused'])
const RESERVED = new Set(['--model', '--model-path', '--served-model-name', '--host', '--port'])
const RESERVED_LLAMACPP = new Set(['--model', '-m', '--alias', '--host', '--port'])
export const reservedFor = engine => (engine === 'llamacpp' ? RESERVED_LLAMACPP : RESERVED)

export function decorate(m) {
  const conflicts = m.conflicts_currently_serving || []
  return {
    ...m,
    status_label: STATUS_LABELS[m.status] || m.status,
    in_flight: IN_FLIGHT.has(m.status),
    pausable: PAUSABLE.has(m.status),
    resumable: RESUMABLE.has(m.status),
    is_download_phase: m.status === 'downloading' || m.status === 'download_paused',
    deployable_now: m.status === 'serving' || (!!m.deployable && conflicts.length === 0),
  }
}

// One flag per line; vLLM/SGLang need "--", llama.cpp accepts "-" and must offload to GPU
// with enough aggregate context for a 128K prompt per slot.
export function validateArgs(text, engine) {
  const llama = engine === 'llamacpp'
  const reserved = reservedFor(engine)
  const lines = (text || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (!lines.length) return { ok: false, error: 'دست‌کم یک پارامتر اجرا اضافه کنید' }
  for (const line of lines) {
    if (!(llama ? line.startsWith('-') : line.startsWith('--'))) return { ok: false, error: `پارامتر نیست (must start with ${llama ? '- or --' : '--'}): ${line}` }
    const name = line.split('=')[0]
    if (reserved.has(name)) return { ok: false, error: `${name} به‌صورت خودکار تنظیم می‌شود؛ این خط را حذف کنید` }
  }
  if (llama) {
    if (!lines.some(l => /^(-ngl|--gpu-layers|--n-gpu-layers)(=|$)/.test(l))) return { ok: false, error: '-ngl=999 (یا --n-gpu-layers) را اضافه کنید؛ بدون آن مدل فقط روی CPU اجرا می‌شود' }
    const intOf = names => {
      for (const line of lines) {
        const [n, v] = line.split('=', 2)
        if (names.has(n) && v !== undefined) { const p = parseInt(v, 10); return Number.isInteger(p) ? { value: p } : { error: `${n} must be an integer` } }
      }
      return {}
    }
    const ctx = intOf(new Set(['-c', '--ctx-size'])); if (ctx.error) return { ok: false, error: ctx.error }
    const np = intOf(new Set(['-np', '--parallel'])); if (np.error) return { ok: false, error: np.error }
    const par = np.value === undefined ? 1 : np.value
    if (ctx.value === undefined) return { ok: false, error: '--ctx-size را اضافه کنید (دست‌کم -np × 131072)' }
    const per = Math.floor(ctx.value / par)
    if (per < 131072) return { ok: false, error: `--ctx-size is aggregate: -np=${par} with --ctx-size=${ctx.value} gives only ${per} per slot; use at least ${par * 131072}` }
  }
  return { ok: true, args: lines }
}

// Nodes with enough free GPUs of the chosen resource; the model's own current node counts its
// already-held GPUs as free (redeploying in place).
export function fittingNodes(nodes, need, resource, self) {
  const selfRes = self?.gpu_resource_name || 'nvidia.com/gpu'
  const selfGpus = self?.gpu_required != null ? parseInt(self.gpu_required, 10) || 0 : 0
  return (nodes || [])
    .map(n => ({ name: n.name, match: (n.resources || []).find(r => r.resource_name === resource) }))
    .filter(n => n.match)
    .map(n => ({ name: n.name, resource: { ...n.match, free: n.match.free + (self && n.name === self.node && resource === selfRes ? selfGpus : 0) } }))
    .filter(n => n.resource.free >= (need || 0))
}
