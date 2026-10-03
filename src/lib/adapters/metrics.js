// /api/dashboard-usage-history returns Prometheus range points [[unixTs, value|null], ...].
export function seriesValues(points) {
  if (!Array.isArray(points)) return []
  return points
    .map(p => (Array.isArray(p) ? p[1] : p))
    .filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map(Number)
}

export const adaptUsageHistory = raw => ({
  cpu_cores: seriesValues(raw?.cpu_cores),
  memory_gib: seriesValues(raw?.memory_gib),
  storage_gib: seriesValues(raw?.storage_gib),
  gpu_util_pct: seriesValues(raw?.gpu_util_pct),
})

// /api/dashboard-cost: {daily:[{date,usd,irr}], by_pod:[{pod,usd,irr}]}. irr is null when no FX rate.
export function adaptCost(raw) {
  const daily = Array.isArray(raw?.daily) ? raw.daily : []
  const unit = daily.some(d => d.irr != null) || daily.length === 0 ? 'irr' : 'usd'
  return {
    unit,
    labels: daily.map(d => d.date),
    daily: daily.map(d => d[unit] ?? null),
    byPod: (Array.isArray(raw?.by_pod) ? raw.by_pod : []).slice().sort((a, b) => (b.usd || 0) - (a.usd || 0)),
  }
}
