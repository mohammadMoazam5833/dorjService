// GPU usage grouping and SVG pie geometry, ported from the platform's admin-panel-gpu-passthrough.js.
export const PIE_COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#a142f4', '#00acc1', '#ff7043', '#9e9d24', '#5c6bc0', '#8d6e63']
export const resourceLabel = r => (r || '').replace(/^nvidia\.com\//, '')

export function groupUsage(list, keyFn) {
  const groups = new Map()
  for (const u of list || []) {
    const key = keyFn(u)
    if (!groups.has(key)) groups.set(key, { key, sample: u, total: 0, vramTotal: 0, hasVram: true, parts: [] })
    const g = groups.get(key)
    const n = parseFloat(u.count) || 1
    const vram = Number(u.vram_gib)
    g.total += n
    if (u.vram_gib === null || u.vram_gib === undefined || Number.isNaN(vram)) g.hasVram = false
    else g.vramTotal += vram
    g.parts.push(`${resourceLabel(u.resource)} ×${u.count}${Number.isNaN(vram) || u.vram_gib == null ? '' : ` (${Math.round(vram * 10) / 10}GiB)`}`)
  }
  return [...groups.values()].map(g => ({ ...g, weight: g.hasVram ? g.vramTotal : g.total }))
}

export const weightText = d => (d.hasVram ? `${Math.round(d.vramTotal * 10) / 10} GiB VRAM` : `${d.total} unit(s)`)

// SVG paths in a 220x220 box, starting at 12 o'clock and going clockwise.
export function wedges(data) {
  const total = data.reduce((s, d) => s + d.weight, 0) || 1
  const cx = 110, cy = 110, r = 100
  let angle = 0
  return data.map(d => {
    const frac = d.weight / total
    const start = angle, end = angle + frac * 2 * Math.PI
    angle = end
    const large = end - start > Math.PI ? 1 : 0
    const x1 = cx + r * Math.sin(start), y1 = cy - r * Math.cos(start)
    const x2 = cx + r * Math.sin(end), y2 = cy - r * Math.cos(end)
    const path = frac > 0.9999 ? `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z` : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large},1 ${x2},${y2} Z`
    return { ...d, path, pct: Math.round(frac * 1000) / 10 }
  })
}
