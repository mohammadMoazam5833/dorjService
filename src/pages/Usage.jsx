import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi } from '../lib/api.js'
import { adaptUsageHistory } from '../lib/adapters/metrics.js'
import ErrorNote from '../components/ErrorNote.jsx'
import Section from '../components/Section.jsx'
import Card from '../components/Card.jsx'
import Table, { Cell } from '../components/Table.jsx'
import EChart from '../components/EChart.jsx'
import { CHART_COLORS, baseTooltip, baseGrid, baseYAxis, baseXAxis, baseLegend } from '../lib/echart-theme.js'
import { Chip, ChipRow } from '../components/Chip.jsx'

// /api/dashboard-usage-history covers the last 6 h at a 5-minute step (HISTORY_WINDOW_SECONDS);
// longer ranges do not exist server-side, so only this one is offered.
const RANGES = [{ label: '۶ ساعت اخیر', hours: 6 }]

function makeXLabels(n) {
  return Array.from({ length: n }, (_, i) => {
    const minsAgo = Math.round(((n - 1 - i) / Math.max(1, n - 1)) * 360)
    const h = Math.round(minsAgo / 60)
    return h === 0 ? 'اکنون' : `${h}h`
  })
}

function StatCard({ label, val, sub, pct, unit }) {
  const color = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#0d9488'
  return (
    <div className="stat">
      <div className="lbl">{label}</div>
      <div className="val" style={{ fontSize: 18 }}>{val}</div>
      {sub && <div className="sub">{sub}</div>}
      {pct != null && (
        <div style={{ marginTop: 6 }}>
          <div className="progress-track" style={{ height: 5 }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
          </div>
          <div style={{ fontSize: 11, color: '#8fa3b8', marginTop: 3 }}>{pct.toFixed(1)}٪ مصرف‌شده</div>
        </div>
      )}
    </div>
  )
}

export default function Usage() {
  const { data: u, error } = useApi('/api/resource-usage')
  const { data: hist, loading: histLoading } = useApi('/api/dashboard-usage-history', null, [], adaptUsageHistory)
  const [rangeIdx, setRangeIdx] = useState(0)

  const slice = arr => (Array.isArray(arr) ? arr : [])

  const cpuData  = slice(hist?.cpu_cores)
  const memData  = slice(hist?.memory_gib)
  const diskData = slice(hist?.storage_gib)
  const xLabels  = makeXLabels(Math.max(cpuData.length, 1))

  const cpuPct  = u?.cpu?.pct ?? null
  const memPct  = u?.memory?.pct ?? null
  const diskPct = u?.storage?.pct ?? null

  return (
    <AppShell active="مصرف">
      <div className="title-row">
        <h2>مصرف منابع</h2>
        <div className="spacer" />
        <ChipRow>
          {RANGES.map((rng, i) => (
            <Chip key={i} on={rangeIdx === i} onClick={() => setRangeIdx(i)} style={{ cursor: 'pointer' }}>
              {rng.label}
            </Chip>
          ))}
        </ChipRow>
      </div>
      <ErrorNote error={error} />

      <div className="page-body">
        {/* stat cards */}
        <div className="stats-row">
          <StatCard
            label="CPU"
            val={`${u?.cpu?.used_cores ?? '—'} / ${u?.cpu?.requested_cores ?? '—'} هسته`}
            sub={`درخواست‌شده: ${u?.cpu?.requested_cores ?? '—'} هسته`}
            pct={cpuPct}
          />
          <StatCard
            label="حافظه"
            val={`${u?.memory?.used_gib ?? '—'} / ${u?.memory?.requested_gib ?? '—'} GiB`}
            sub={`آزاد: ${u ? (u.memory.requested_gib - u.memory.used_gib).toFixed(1) : '—'} GiB`}
            pct={memPct}
          />
          <StatCard
            label="ذخیره‌سازی"
            val={`${u?.storage?.used_gib ?? '—'} / ${u?.storage?.capacity_gib ?? '—'} GiB`}
            sub={`آزاد: ${u ? (u.storage.capacity_gib - u.storage.used_gib).toFixed(1) : '—'} GiB`}
            pct={diskPct}
          />
          <StatCard
            label="GPU"
            val={`${u?.gpu?.slices_allocated ?? '—'} اسلایس`}
            sub={u?.gpu?.util_pct != null ? `بهره‌وری: ${u.gpu.util_pct.toFixed(1)}٪` : 'بدون داده'}
            pct={u?.gpu?.util_pct ?? null}
          />
        </div>

        {/* CPU + Memory chart */}
        <Section title="CPU و حافظه">
          <EChart
            height={160}
            loading={histLoading}
            empty={cpuData.length < 2 && memData.length < 2 ? true : undefined}
            option={{
              color: [CHART_COLORS[0], CHART_COLORS[1]],
              tooltip: { ...baseTooltip },
              grid: baseGrid,
              xAxis: baseXAxis(xLabels),
              yAxis: baseYAxis(''),
              legend: baseLegend(['CPU (هسته)', 'حافظه (GiB)']),
              series: [
                { name: 'CPU (هسته)', type: 'line', data: cpuData, smooth: 0.3, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.1 } },
                { name: 'حافظه (GiB)', type: 'line', data: memData, smooth: 0.3, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.1 } },
              ],
            }}
          />
        </Section>

        {/* Disk chart */}
        <Section title="ذخیره‌سازی">
          <EChart
            height={120}
            loading={histLoading}
            empty={diskData.length < 2 ? true : undefined}
            option={{
              color: [CHART_COLORS[2]],
              tooltip: { ...baseTooltip, valueFormatter: v => `${v} GiB` },
              grid: { ...baseGrid, bottom: 22 },
              xAxis: baseXAxis(xLabels),
              yAxis: baseYAxis('GiB'),
              series: [{ name: 'فضای ذخیره‌سازی (GiB)', type: 'line', data: diskData, smooth: 0.3, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.12 } }],
            }}
          />
        </Section>

        {/* cost table */}
        <Card title="هزینه تخمینی (۳۰ روز)">
          <Table
            cols={[Cell('منبع', 'r'), Cell('مصرف'), Cell('هزینه')]}
            rows={[
              ['Podها', `${u?.cpu?.used_cores ?? '—'} هسته فعال`, u?.cost?.irr ? `${Number(u.cost.irr).toLocaleString('en-US')} ریال` : '—'],
              ['بکاپ', `${u?.backup_cost?.count ?? '—'} بکاپ`, u?.backup_cost?.usd ? `$${u.backup_cost.usd}` : '—'],
            ]}
          />
        </Card>
      </div>
    </AppShell>
  )
}
