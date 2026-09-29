import AppShell from '../components/AppShell.jsx'
import { useApi } from '../lib/api.js'
import { faNum } from '../lib/format.js'
import Section from '../components/Section.jsx'
import Card, { Hint } from '../components/Card.jsx'
import Table, { Cell } from '../components/Table.jsx'
import Chart from '../components/Chart.jsx'
import { Chip, ChipRow } from '../components/Chip.jsx'

export default function Usage() {
  const { data: u } = useApi('/api/resource-usage')
  const { data: hist } = useApi('/api/dashboard-usage-history')
  return (
    <AppShell active="خانه">
      <div className="title-row">
        <h2>مصرف منابع</h2>
        <div className="spacer" />
        <ChipRow>
          <Chip on>۶ ساعت اخیر</Chip><Chip>۲۴ ساعت</Chip><Chip>۷ روز</Chip><Chip>۳۰ روز</Chip>
        </ChipRow>
      </div>
      <div className="page-body">
        <div className="stats-row">
          <div className="stat"><div className="lbl">CPU</div><div className="val">{faNum(u?.cpu?.used_cores ?? 0)} / {faNum(u?.cpu?.requested_cores ?? 8)} هسته</div><div className="sub">درخواست‌شده: {faNum(u?.cpu?.requested_cores ?? 8)}</div></div>
          <div className="stat"><div className="lbl">حافظه</div><div className="val">{faNum(u?.memory?.used_gib ?? 0)} / {faNum(u?.memory?.requested_gib ?? 32)} GiB</div><div className="sub">درخواست‌شده: {faNum(u?.memory?.requested_gib ?? 32)}</div></div>
          <div className="stat"><div className="lbl">فضا</div><div className="val">{faNum(u?.storage?.used_gib ?? 0)} / {faNum(u?.storage?.capacity_gib ?? 10)} GiB</div><div className="sub">{faNum((u?.storage?.capacity_gib ?? 10) - (u?.storage?.used_gib ?? 0))}Gi آزاد</div></div>
          <div className="stat"><div className="lbl">GPU</div><div className="val">{faNum(u?.gpu?.slices_allocated ?? 0)} اسلایس</div><div className="sub">{u?.gpu?.util_pct != null ? faNum(u.gpu.util_pct.toFixed(1)) + '٪' : '—'}</div></div>
        </div>
        <Section title="تاریخچه مصرف">
          <Chart series={[
            { color: '#007dfc', data: hist?.cpu_cores || [] },
            { color: '#12dec6', data: hist?.memory_gib || [] },
          ]} />
        </Section>
        <Card title="هزینه تخمینی (۳۰ روز)">
          <Table
            cols={[Cell('منبع', 'r'), Cell('مصرف'), Cell('نرخ'), Cell('هزینه ماهانه')]}
            rows={[
              ['Podها', `${faNum(u?.cpu?.used_cores ?? 0)} ساعت`, '—', (u?.cost?.usd ?? 0) === 0 ? '$0.00' : '$' + u.cost.usd],
              ['Backup', faNum(u?.backup_cost?.count ?? 0), '—', u?.backup_cost?.usd ? '$' + u.backup_cost.usd : '$0.00'],
            ]} />
        </Card>
      </div>
    </AppShell>
  )
}
