import AppShell from '../components/AppShell.jsx'
import Tile from '../components/Tile.jsx'
import Icon from '../components/Icon.jsx'
import EChart from '../components/EChart.jsx'
import { CHART_COLORS, baseTooltip, baseGrid, baseYAxis, baseXAxis, baseLegend } from '../lib/echart-theme.js'
import { useApi } from '../lib/api.js'
import { faNum, rial, fmt } from '../lib/format.js'
import { adaptUsageHistory, adaptCost } from '../lib/adapters/metrics.js'
import { adaptNotebooks } from '../lib/adapters/workloads.js'
import ErrorNote from '../components/ErrorNote.jsx'

const QUICK_LINKS = [
  { icon: 'add', title: 'ایجاد نوت‌بوک جدید', desc: 'نوت‌بوک‌های درج', href: '#/notebooks?new=1' },
  { icon: 'add', title: 'ایجاد فضای ذخیره‌سازی جدید', desc: 'فضاهای ذخیره‌سازی', href: '#/volumes?new=1' },
]

const USAGE_COLS = [
  { key: 'cpu_cores', label: 'CPU (هسته)' },
  { key: 'memory_gib', label: 'حافظه (GiB)' },
  { key: 'storage_gib', label: 'ذخیره‌سازی (GiB)' },
]

export default function Dashboard() {
  const { data: sum, error: sumErr } = useApi('/api/dashboard-summary')
  const { data: usage } = useApi('/api/dashboard-usage-history', null, [], adaptUsageHistory)
  const { data: cost } = useApi('/api/dashboard-cost', null, [], adaptCost)
  const { data: nbs } = useApi('/api/notebooks', [], [], adaptNotebooks)
  const { data: ru } = useApi('/api/resource-usage')
  const recent = (nbs || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5)
  const c = sum?.cluster || {}
  const pct = v => (v === null || v === undefined ? '—' : faNum(Number(v).toFixed(1)))
  return (
    <AppShell active="خانه">
      <div className="dash-view">
        <ErrorNote error={sumErr} />
        <div className="dash-grid">
          <div className="dash-col" style={{ gridArea: 'notebooks' }}>
            <div className="panel-card">
              <div className="panel-header"><span className="title-text">نوت‌بوک‌های اخیر</span></div>
              {recent.length === 0 ? (
                <header className="panel-notice">هیچ نوت‌بوکی در Namespace ⁦{ru?.namespace || '—'}⁩ وجود ندارد</header>
              ) : (
                <ul className="dash-recent">
                  {recent.map(n => (
                    <li key={n.name}>
                      <a href="#/notebooks"><bdi dir="ltr">{n.name}</bdi></a>
                      <span className="vl-muted">{fmt.date(n.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="dash-col" style={{ gridArea: 'quicklinks' }}>
            <div className="panel-card">
              <div className="panel-header"><span className="title-text">میانبرهای سریع</span></div>
              <div className="quick-links">
                {QUICK_LINKS.map(l => (
                  <a key={l.title} className="quick-link" href={l.href}>
                    <span className="content-icon"><span className="icon-circle"><Icon name={l.icon} size={22} color="#2563eb" /></span></span>
                    <span className="ql-body">
                      <span className="ql-header">{l.title}</span>
                      <aside className="ql-desc">{l.desc}</aside>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="dash-tiles" style={{ gridArea: 'tiles' }}>
            <Tile icon="book" color="teal" label="نوت‌بوک‌های فعال" value={sum ? faNum(sum.active_notebooks) : '—'} />
            <Tile icon="view-module" color="teal" label="مصرف حافظه شما" value={sum ? pct(c.memory_pct) : '—'} suffix="%" />
            <Tile icon="assessment" color="amber" label="مصرف CPU شما" value={sum ? pct(c.cpu_pct) : '—'} suffix="%" />
            <Tile icon="supervisor" color="blue" label="تعداد پروفایل‌ها" value={sum ? faNum(sum.profile_count) : '—'} />
            <Tile icon="wallet" color="blue" label="هزینه ماهانه" value={sum?.monthly_cost?.amount_irr != null ? rial(sum.monthly_cost.amount_irr) : '—'} />
            <Tile icon="save" color="purple" label="مصرف فضای ذخیره‌سازی شما" value={sum ? pct(c.storage_pct) : '—'} suffix="%" />
          </div>
          <div className="paper-card section" style={{ gridArea: 'usage' }}>
            <div className="card-header" />
            <div className="section-title">تاریخچه مصرف (۶ ساعت اخیر)</div>
            <div className="usage-charts">
              {USAGE_COLS.map(col => {
                const data = usage?.[col.key] || []
                const labels = data.map((_, i) => `${Math.max(0, Math.round((data.length - 1 - i) * 5 / 60 * 10) / 10)}h`)
                const unit = col.key === 'cpu_cores' ? 'هسته' : 'GiB'
                return (
                  <div key={col.key} className="chart-col">
                    <div className="chart-label">{col.label}</div>
                    <EChart
                      height={130}
                      empty={data.length < 2 ? true : undefined}
                      option={{
                        color: [CHART_COLORS[0]],
                        tooltip: { ...baseTooltip, valueFormatter: v => `${v} ${unit}` },
                        grid: { ...baseGrid, left: 44 },
                        xAxis: baseXAxis(labels, lbl => lbl.replace('.0', '')),
                        yAxis: baseYAxis(unit),
                        series: [{ type: 'line', data, smooth: 0.3, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.12 } }],
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="paper-card section cost" style={{ gridArea: 'cost' }}>
            <div className="card-header" />
            <div className="section-title">هزینه (۳۰ روز اخیر)</div>
            <div className="cost-chart">
              <EChart
                height={190}
                empty={(cost?.daily || []).length < 2 ? true : undefined}
                option={{
                  color: [CHART_COLORS[3]],
                  tooltip: { ...baseTooltip, valueFormatter: v => cost?.unit === 'usd' ? `$${v}` : `${v} میلیون ریال` },
                  grid: baseGrid,
                  xAxis: baseXAxis(cost?.labels || []),
                  yAxis: baseYAxis(cost?.unit === 'usd' ? '$' : 'میلیون ریال'),
                  series: [{ type: 'line', data: cost?.unit === 'usd' ? (cost?.daily || []) : (cost?.daily || []).map(v => (v == null ? v : v / 1e6)), smooth: 0.3, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.15 } }],
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
