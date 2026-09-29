import { useState, useRef, useEffect } from 'react'
import Icon from './Icon.jsx'
import { useApi } from '../lib/api.js'
import './ResourcesWidget.css'

function Bar({ pct, gold }) {
  const v = Math.min(100, Number(pct ?? 0))
  const color = v > 80 ? '#ef4444' : gold ? '#E8A317' : '#1E3A8A'
  return (
    <div className="rw-bar">
      <div className="rw-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  )
}

export default function ResourcesWidget() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { data: ru } = useApi('/api/resource-usage')
  const { data: q } = useApi('/api/notebooks/options')

  const pct = v => `${Number(v ?? 0).toFixed(1)}%`
  const cost = ru?.cost?.irr ?? 0
  const qq = q?.quota || {}

  const cpuPct = ru?.cpu?.pct ?? 0
  const memPct = ru?.memory?.pct ?? 0
  const gpuPct = ru?.gpu?.util_pct ?? 0

  useEffect(() => {
    if (!open) return
    const handle = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="rw-root" ref={ref}>
      <button className="rw-trigger" onClick={() => setOpen(o => !o)} type="button">
        <span className="rw-mini-bars">
          <span className="rw-mini-bar" style={{ height: `${Math.round(cpuPct * 0.22)}px` }} title={`CPU ${pct(cpuPct)}`} />
          <span className="rw-mini-bar gpu" style={{ height: `${Math.round(gpuPct * 0.22)}px` }} title={`GPU ${pct(gpuPct)}`} />
          <span className="rw-mini-bar mem" style={{ height: `${Math.round(memPct * 0.22)}px` }} title={`RAM ${pct(memPct)}`} />
        </span>
        <span className="rw-label">منابع</span>
        <span className={`rw-caret ${open ? 'open' : ''}`}>
          <Icon name="caret" size={16} color="#8fa3b8" />
        </span>
      </button>

      {open && (
        <div className="rw-panel">
          <div className="rw-panel-head">منابع شما</div>
          <p className="rw-desc">درصد مصرف فعلی نسبت به محدودیت هر Pod در حال اجرا در این namespace.</p>

          {[
            ['CPU', ru?.cpu?.pct],
            ['RAM', ru?.memory?.pct],
            ['GPU', ru?.gpu?.util_pct],
            ['ذخیره‌سازی', ru?.storage?.pct],
          ].map(([label, v]) => (
            <div key={label} className="rw-metric">
              <div className="rw-metric-row">
                <span className="rw-metric-label">{label}</span>
                <span className="rw-metric-val">{v == null ? '—' : pct(v)}</span>
              </div>
              <Bar pct={v} gold={label === 'GPU'} />
            </div>
          ))}

          <div className="rw-cost-row">
            <span className="rw-cost-label">هزینه جاری</span>
            <span className="rw-cost-val gold"><bdi>{Number(cost).toLocaleString('en-US')}</bdi> ریال</span>
          </div>

          <div className="rw-divider" />
          <div className="rw-quota-head">سهمیه باقی‌مانده namespace</div>
          {[
            ['CPU', `${qq.cpu_remaining_cores ?? 5} / ${ru?.cpu?.requested_cores ?? 8} هسته`],
            ['RAM', `${qq.memory_remaining_gib ?? 13} / ${ru?.memory?.requested_gib ?? 32} GiB`],
            ['ذخیره‌سازی', `${qq.storage_remaining_gib ?? 6} / ${ru?.storage?.capacity_gib ?? 10} GiB`],
          ].map(([l, v]) => (
            <div key={l} className="rw-quota-row">
              <span className="rw-quota-label">{l}</span>
              <span className="rw-quota-val">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
