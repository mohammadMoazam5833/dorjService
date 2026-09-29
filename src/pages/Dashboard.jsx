import AppShell from '../components/AppShell.jsx'
import Tile from '../components/Tile.jsx'
import Icon from '../components/Icon.jsx'
import Chart from '../components/Chart.jsx'
import { useApi } from '../lib/api.js'
import { faNum, rial } from '../lib/format.js'

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
  const { data: sum } = useApi('/api/dashboard-summary')
  const { data: usage } = useApi('/api/dashboard-usage-history')
  const c = sum?.cluster || {}
  const pct = v => (v === null || v === undefined ? '—' : faNum(Number(v).toFixed(1)))
  return (
    <AppShell active="خانه">
      <div className="dash-view">
        <div className="dash-grid">
          <div className="dash-col" style={{ gridArea: 'docs' }}>
            <div className="doc-card">
              <Icon name="docs" size={56} color="#2563eb" />
              <div className="doc-title">مستندات</div>
              <div className="doc-desc">راهنماها، مستندات فنی و نحوه‌ی استفاده از آن را می‌توانید در این بخش مشاهده کنید.</div>
              <a className="doc-button" href="#/help">مشاهده مستندات</a>
            </div>
          </div>
          <div className="dash-col" style={{ gridArea: 'notebooks' }}>
            <div className="panel-card">
              <div className="panel-header"><span className="title-text">نوت‌بوک‌های اخیر</span></div>
              <header className="panel-notice">هیچ نوت‌بوکی در Namespace ⁦godarzi⁩ وجود ندارد</header>
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
            <Tile icon="book" color="teal" label="نوت‌بوک‌های فعال" value={sum ? faNum(sum.active_notebooks) : '۰'} />
            <Tile icon="view-module" color="teal" label="مصرف حافظه شما" value={sum ? pct(c.memory_pct) : '۰.۰'} suffix="%" />
            <Tile icon="assessment" color="amber" label="مصرف CPU شما" value={sum ? pct(c.cpu_pct) : '۰.۰'} suffix="%" />
            <Tile icon="supervisor" color="blue" label="تعداد پروفایل‌ها" value={sum ? faNum(sum.profile_count) : '۱'} />
            <Tile icon="wallet" color="blue" label="هزینه ماهانه" value={sum ? rial(sum.monthly_cost?.amount_irr ?? 0) : rial(0)} />
            <Tile icon="save" color="purple" label="مصرف فضای ذخیره‌سازی شما" value={sum ? pct(c.storage_pct) : '۰.۰'} suffix="%" />
          </div>
          <div className="paper-card section" style={{ gridArea: 'usage' }}>
            <div className="card-header" />
            <div className="section-title">تاریخچه مصرف (۶ ساعت اخیر)</div>
            <div className="usage-charts">
              {USAGE_COLS.map(col => (
                <div key={col.key} className="chart-col">
                  <div className="chart-label">{col.label}</div>
                  <Chart
                    series={[{ color: '#007dfc', data: (usage?.[col.key] || []).slice(-6) }]}
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
              <Chart series={[]} height={190} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
