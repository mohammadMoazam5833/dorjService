import { useState } from 'react'
import Icon from './Icon.jsx'
import { useApi } from '../lib/api.js'
import './ResourcesWidget.css'

export default function ResourcesWidget() {
  const [open, setOpen] = useState(false)
  const { data: ru } = useApi('/api/resource-usage')
  const { data: q } = useApi('/api/notebooks/options')
  const pct = v => `${Number(v ?? 0).toFixed(1)}%`
  const cost = ru?.cost?.irr ?? 0
  const qq = q?.quota || {}
  return (
    <div className="res-root">
      {open && (
        <div className="res-panel">
          <div className="res-head">منابع شما</div>
          <p className="res-desc">درصد مصرف فعلی نسبت به محدودیت هر Pod در حال اجرا در این namespace نشان داده می‌شود.</p>
          {[
            ['پردازنده', ru?.cpu?.pct],
            ['حافظه', ru?.memory?.pct],
            ['پردازنده گرافیکی', ru?.gpu?.util_pct, true],
            ['فضای ذخیره‌سازی', ru?.storage?.pct],
          ].map(([label, v, nodata]) => (
            <div key={label} className="res-metric">
              <div className="res-metric-top">
                <span className="res-val">{v == null ? 'بدون داده' : pct(v)}</span>
                <span className="res-label">{label}</span>
              </div>
              <div className="res-bar"><div className="res-fill" style={{ width: `${Math.min(100, Number(v ?? 0))}%` }} /></div>
            </div>
          ))}
          <div className="res-metric">
            <div className="res-metric-top">
              <span className="res-val">{Number(cost).toLocaleString('en-US')} ریال</span>
              <span className="res-label">هزینه</span>
            </div>
          </div>
          <div className="res-quota-title">سهمیه باقی‌مانده</div>
          <p className="res-desc">مصرف‌شده / کل مجاز برای کل namespace شما (جدا از محدودیت هر Pod).</p>
          {[['پردازنده', `${qq.cpu_remaining_cores ?? 8} / ${ru?.cpu?.requested_cores ?? 8}`],
            ['حافظه', `${qq.memory_remaining_gib ?? 32} Gi / ${ru?.memory?.requested_gib ?? 32} Gi`],
            ['فضای ذخیره‌سازی', `${qq.storage_remaining_gib ?? 9} Gi / ${ru?.storage?.capacity_gib ?? 10} Gi`]].map(([l, v]) => (
            <div key={l} className="res-quota-row">
              <span className="res-val">{v}</span>
              <span className="res-label">{l}</span>
            </div>
          ))}
        </div>
      )}
      <div className="res-widget" onClick={() => setOpen(o => !o)}>
        <span className="res-caret"><Icon name={open ? 'caret' : 'chevronUp'} size={14} color="#151a1f" /></span>
        <span>منابع شما</span>
      </div>
    </div>
  )
}
