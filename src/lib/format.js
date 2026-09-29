// ── digit style ────────────────────────────────────────────────────────────
// Default: Latin (Arabic numerals). Readable from prefs context at call sites.
export const toDigits = (s, style = 'latin') => {
  const str = String(s)
  if (style === 'persian') return str.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
  return str
}

// Legacy alias — kept for callers that don't need preference-awareness.
// Always returns Latin to avoid table/card inconsistency.
export const faNum = s => String(s)

// ── dates ──────────────────────────────────────────────────────────────────
// calendar: 'jalali' (Persian solar) | 'gregorian'
export const fmt = {
  date(iso, { calendar = 'jalali', digits = 'latin' } = {}) {
    if (!iso) return '—'
    try {
      const locale = calendar === 'jalali' ? 'fa-IR-u-ca-persian' : 'fa-IR'
      const d = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
      return digits === 'latin' ? d.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))) : d
    } catch {
      return String(iso).slice(0, 10)
    }
  },

  dateShort(iso, opts = {}) {
    if (!iso) return '—'
    try {
      const { calendar = 'jalali' } = opts
      const locale = calendar === 'jalali' ? 'fa-IR-u-ca-persian' : 'fa-IR'
      return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
    } catch {
      return String(iso).slice(5, 10)
    }
  },
}

// Legacy alias
export const faDate = iso => fmt.date(iso)

// ── numbers ────────────────────────────────────────────────────────────────
export const num = (n, decimals = 0) =>
  Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: decimals })

// ── currency ───────────────────────────────────────────────────────────────
// Always Rial. One format, used everywhere.
export const rial = n => `${Number(n || 0).toLocaleString('en-US')} ریال`
export const usd  = n => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

// Legacy alias (was toman — now Rial to unify)
export const irr = rial

// ── quota/resource display ─────────────────────────────────────────────────
export function fmtQuota(v) {
  if (v === undefined || v === null || v === '') return '—'
  const s = String(v)
  if (s.endsWith('m') && !isNaN(parseFloat(s))) return s.slice(0, -1) + ' میلی‌هسته'
  if (s.endsWith('Gi')) return s.slice(0, -2) + ' GiB'
  if (s.endsWith('Mi')) return s.slice(0, -2) + ' MiB'
  return s
}

export function quotaCell(hard, keyPart) {
  if (!hard) return '—'
  const k = Object.keys(hard).find(k => k.includes(keyPart))
  return k ? fmtQuota(hard[k]) : '—'
}

export function gpuCell(hard) {
  if (!hard) return '—'
  const k = Object.keys(hard).find(k => k.startsWith('nvidia.com'))
  return k ? `${hard[k]}× ${k.replace('nvidia.com/', '')}` : '—'
}
