import AppShell from '../components/AppShell.jsx'
import Tile from '../components/Tile.jsx'
import Icon from '../components/Icon.jsx'
import Chart from '../components/Chart.jsx'
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
              {USAGE_COLS.map(col => (
                <div key={col.key} className="chart-col">
                  <div className="chart-label">{col.label}</div>
                  <Chart
                    series={[{ color: '#007dfc', data: usage?.[col.key] || [] }]}
                    height={130}
                    unit={col.key === 'cpu_cores' ? 'هسته' : 'GiB'}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="paper-card section cost" style={{ gridArea: 'cost' }}>
            <div className="card-header" />
            <div className="section-title">هزینه (۳۰ روز اخیر)</div>
            <div className="cost-chart">
              <Chart series={[{ color: '#E8A317', data: cost?.unit === 'usd' ? (cost?.daily || []) : (cost?.daily || []).map(v => (v == null ? v : v / 1e6)) }]} xLabels={cost?.labels} height={190} unit={cost?.unit === 'usd' ? '$' : 'میلیون ریال'} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
