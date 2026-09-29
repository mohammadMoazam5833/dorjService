import { useState } from 'react'
import Tabs from '../../components/Tabs.jsx'
import Card, { Hint } from '../../components/Card.jsx'
import Table, { Cell } from '../../components/Table.jsx'
import Badge from '../../components/Badge.jsx'
import { useApi } from '../../lib/api.js'
import { faNum, usd, irr } from '../../lib/format.js'

const GPU_TABS = ['پاس‌تروی', 'مصرف (جدول)', 'مصرف (نمودار)', 'سرمایه']

export default function Gpu() {
  const [sub, setSub] = useState(0)
  const { data: pt } = useApi('/admin-panel/api/admin/gpu-passthrough')
  const gpus = pt?.gpus || []
  const cap = pt?.capacity_summary || []
  const totalVram = cap.reduce((a, c) => a + (c.total_vram_gib || 0), 0)
  const usedVram = cap.reduce((a, c) => a + ((c.total_vram_gib - c.free_vram_gib) || 0), 0)
  return (
    <>
      <Tabs tabs={GPU_TABS} active={sub} onSelect={setSub} />
      {sub === 0 && (
        <Card title="مدیریت GPU">
          <Hint>{faNum(gpus.length)} GPU · {faNum(usedVram.toFixed(1))} از {faNum(totalVram.toFixed(1))} GiB VRAM</Hint>
          <Table
            cols={[Cell('نود', 'r'), Cell('PCI', 'r'), Cell('مدل'), Cell('درایور'), Cell('وضعیت')]}
            rows={gpus.map(g => [
              g.node, g.bdf, g.model,
              { jsx: <b style={{ color: g.in_sync ? 'var(--green)' : 'var(--amber)' }}>{g.current_driver}</b> },
              { jsx: g.in_sync ? <b style={{ color: 'var(--green)' }}>همگام</b> : <Hint>ناهمگام</Hint> },
            ])} />
        </Card>
      )}
      {sub === 1 && (
        <Card title="مصرف GPU به تفکیک بار کاری">
          <Table
            cols={[Cell('Namespace', 'r'), Cell('بار کاری', 'r'), Cell('نوع'), Cell('منبع'), Cell('VRAM (GiB)'), Cell('نود')]}
            rows={(pt?.gpu_workload_usage || []).map(w => [w.namespace, w.workload, w.kind, w.resource, faNum(w.vram_gib), w.node])} />
        </Card>
      )}
      {sub === 2 && (
        <Card title="نمودارهای مصرف GPU (۶ ساعت اخیر)">
          <Hint>داده‌ای برای نمایش نیست.</Hint>
        </Card>
      )}
      {sub === 3 && <Capital pt={pt} />}
    </>
  )
}

function Capital({ pt }) {
  const cap = pt?.capital_report
  const rows = pt?.cost_by_department?.rows || []
  const tot = cap?.total_vram_gib ?? 0
  const used = cap?.used_vram_gib ?? 0
  const util = cap?.utilization_pct ?? (tot ? (used / tot) * 100 : 0)
  return (
    <>
      <div className="stats-row">
        <div className="stat"><div className="lbl">ظرفیت کل VRAM</div><div className="val">{faNum(tot.toFixed(1))} GiB</div><div className="sub">{cap ? usd(cap.total.usd_per_month) + ' / ماه' : '—'}</div></div>
        <div className="stat"><div className="lbl">در حال استفاده</div><div className="val">{faNum(used.toFixed(1))} GiB</div><div className="sub">{cap ? usd(cap.used.usd_per_month) + ' / ماه' : '—'}</div></div>
        <div className="stat"><div className="lbl">آزاد</div><div className="val">{faNum((cap?.free_vram_gib ?? 0).toFixed(1))} GiB</div><div className="sub">{cap ? usd(cap.free.usd_per_month) + ' / ماه' : '—'}</div></div>
      </div>
      <b>بهره‌برداری VRAM: {faNum(util.toFixed(1))}٪</b>
      <div className="progress-track"><div className="progress-fill" style={{ width: util + '%' }} /></div>
      <Card title="هزینه به تفکیک دپارتمان">
        <Table
          cols={[Cell('Namespace', 'r'), Cell('VRAM (GiB)'), Cell('USD / روز'), Cell('هزینه ماهانه')]}
          rows={rows.map(r => [r.namespace, faNum(r.vram_gib.toFixed(1)), usd(r.usd_per_day), irr(r.irr_per_month)])} />
      </Card>
    </>
  )
}
