// Port of the platform's units-logic.js: which admin tabs a whoami grants, and quota math
// for unit budgets. Super admins see everything; unit admins see my-unit plus the tab groups
// their unit permissions enable.
const TABS_BY_FLAG = [
  ['usersAndProfiles', ['profiles', 'users']],
  ['accessAndGroups', ['access', 'groups']],
  ['messagingAndReports', ['broadcast']],
  ['llmKeys', ['requests']],
]

export function visibleTabs(whoami, allTabs) {
  if (!whoami) return []
  if (whoami.is_super) return [...allTabs, 'units', 'my-unit']
  const units = Object.values(whoami.units || {})
  if (!units.length) return []
  const has = flag => units.some(u => (u.permissions || {})[flag])
  const out = ['my-unit']
  for (const [flag, tabs] of TABS_BY_FLAG) if (has(flag)) out.push(...tabs)
  return out
}

const BIN = { Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50 }
const DEC = { n: 1e-9, u: 1e-6, m: 1e-3, '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15 }

export function parseQuantity(q) {
  if (typeof q === 'number') return q
  const m = /^\s*([0-9.]+)\s*([A-Za-z]*)\s*$/.exec(String(q))
  if (!m) throw new Error(`bad quantity: ${q}`)
  const n = Number(m[1])
  if (m[2] in BIN) return n * BIN[m[2]]
  if (m[2] in DEC) return Math.round(n * DEC[m[2]] * 1e9) / 1e9
  throw new Error(`bad quantity suffix: ${q}`)
}

export function remaining(budget, allocated) {
  const out = {}
  for (const [k, v] of Object.entries(budget || {})) {
    const left = parseQuantity(v) - parseQuantity((allocated || {})[k] || 0)
    out[k] = left > 0 ? left : 0
  }
  return out
}

export function quotaErrors(form, left) {
  const asks = {}
  if (form.cpu_limit) asks.cpu = form.cpu_limit
  if (form.memory_limit) asks.memory = form.memory_limit
  if (form.storage_limit) asks.storage = form.storage_limit
  for (const g of form.gpus || []) if (g.type && g.count) asks[g.type] = g.count
  const errs = {}
  for (const [k, v] of Object.entries(asks)) {
    const have = left[k] || 0
    if (parseQuantity(v) > have) errs[k] = `${v} > ${have}`
  }
  return errs
}

export const gpuChoices = budget => Object.keys(budget || {}).filter(k => k.startsWith('nvidia.com/'))
