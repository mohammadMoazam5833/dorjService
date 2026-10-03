// Gateway rate-limit config helpers, ported from the platform's admin-panel-rate-limits.js.
export const SCOPES = ['key', 'user', 'tenant']
const INT_FIELDS = ['requests_per_minute', 'max_concurrent', 'max_input_tokens', 'max_output_tokens']
const isEmpty = v => v === null || v === undefined || v === ''
const numOrNull = v => { if (isEmpty(v)) return null; const n = Number(v); return Number.isFinite(n) ? n : NaN }
const clone = o => JSON.parse(JSON.stringify(o))

export function normalized(cfg) {
  const c = clone(cfg || {})
  c.model_weights = c.model_weights || { default: 1 }
  c.plans = c.plans || {}
  c.defaults = c.defaults || {}
  c.overrides = c.overrides || {}
  for (const s of SCOPES) { if (!(s in c.defaults)) c.defaults[s] = null; c.overrides[s] = c.overrides[s] || {} }
  c.charge_failed = { server_error: false, timeout: false, client_error: false, cancelled: true, ...(c.charge_failed || {}) }
  c.max_tokens_policy = c.max_tokens_policy || 'clamp'
  c.on_redis_error = c.on_redis_error || 'closed'
  return c
}

export function planRow(name, p) {
  const row = { name, fail_open: !!p.fail_open, requests_per_window: p.requests_per_window ?? null, window_hours: p.window_seconds ? +(p.window_seconds / 3600).toFixed(2) : null }
  for (const k of INT_FIELDS) row[k] = p[k] ?? null
  return row
}

// Returns the plan object, or an error string.
export function planFromForm(f) {
  const plan = {}
  const rpw = numOrNull(f.requests_per_window), hours = numOrNull(f.window_hours)
  if (Number.isNaN(rpw) || (rpw !== null && rpw < 0)) return 'Messages per window must be a positive number'
  if (rpw !== null) {
    if (!hours || Number.isNaN(hours) || hours <= 0) return 'The window length (hours) is required with a message limit'
    plan.requests_per_window = rpw; plan.window_seconds = Math.round(hours * 3600)
  }
  for (const k of INT_FIELDS) {
    const v = numOrNull(f[k])
    if (Number.isNaN(v) || (v !== null && (v < 0 || !Number.isInteger(v)))) return 'Limits must be whole numbers (empty = no limit)'
    if (v !== null) plan[k] = v
  }
  if (f.fail_open) plan.fail_open = true
  return plan
}

export function renamePlan(c, from, to) {
  for (const s of SCOPES) {
    if (c.defaults[s] === from) c.defaults[s] = to
    for (const e of Object.values(c.overrides[s] || {})) if (e.plan === from) e.plan = to
  }
}

export const planInUse = (c, name) => SCOPES.some(s => c.defaults[s] === name || Object.values(c.overrides[s] || {}).some(e => e.plan === name))
export const validWeight = v => v !== null && !Number.isNaN(v) && (v === 0 || (v >= 0.01 && v <= 1000))
export function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : m ? `${m}m` : `${s}s`
}
