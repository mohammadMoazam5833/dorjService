export const faNum = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])

export const faDate = iso => {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('fa-IR') } catch { return String(iso).slice(0, 10) }
}

export const usd = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

export const irr = n => faNum(Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })) + ' تومان'

export function fmtQuota(v) {
  if (v === undefined || v === null || v === '') return '-'
  const s = String(v)
  if (s === '1m') return '1 دقیقه'
  if (s.endsWith('m') && !isNaN(parseFloat(s))) return s.slice(0, -1) + ' دقیقه'
  return s
}

export function quotaCell(hard, keyPart) {
  if (!hard) return '-'
  const k = Object.keys(hard).find(k => k.includes(keyPart))
  return k ? fmtQuota(hard[k]) : '-'
}

export function gpuCell(hard) {
  if (!hard) return '-'
  const k = Object.keys(hard).find(k => k.startsWith('nvidia.com'))
  return k ? `${hard[k]}x ${k.replace('nvidia.com/', '')}` : '-'
}
