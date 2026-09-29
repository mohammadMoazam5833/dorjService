import { useState, useRef, useEffect } from 'react'
import Icon from './Icon.jsx'
import { useApi } from '../lib/api.js'
import './NsSelector.css'

export default function NsSelector({ admin }) {
  const [open, setOpen] = useState(false)
  const [ns, setNs] = useState('godarzi')
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  const { data } = useApi('/api/workgroup/get-all-namespaces', [])
  const { data: ru } = useApi('/api/resource-usage')
  const { data: opts } = useApi('/api/notebooks/options')

  const list = Array.isArray(data) ? data.map(r => r[0]) : ['godarzi']
  const filtered = list.filter(n => n.includes(query.trim()))

  const quota = opts?.quota || {}
  const cpuRem = quota.cpu_remaining_cores ?? 5
  const memRem = quota.memory_remaining_gib ?? 13

  const pick = n => { setNs(n); setOpen(false); setQuery('') }

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60)
    else setQuery('')
  }, [open])

  const role = admin ? null : 'مالک'

  return (
    <div className="ns-root">
      <button className="ns-btn" type="button" onClick={() => setOpen(o => !o)}>
        <span className="ns-avatar">
          <Icon name="person" size={16} color="#0a3b71" />
        </span>
        <div className="ns-btn-body">
          <span className="ns-name">{admin ? 'همه Namespaceها' : ns}</span>
          {role && <span className="ns-role">{role}</span>}
        </div>
        <span className={`ns-chevron ${open ? 'open' : ''}`}>
          <Icon name="caret" size={18} color="#8fa3b8" />
        </span>
      </button>

      {!admin && (
        <div className="ns-quota-strip">
          <span className="ns-quota-item" title="هسته CPU باقی‌مانده">
            <span className="ns-quota-dot cpu" />
            <span>{cpuRem} هسته</span>
          </span>
          <span className="ns-quota-sep" />
          <span className="ns-quota-item" title="حافظه RAM باقی‌مانده">
            <span className="ns-quota-dot mem" />
            <span>{memRem} GiB</span>
          </span>
        </div>
      )}

      {open && (
        <>
          <div className="ns-scrim" onClick={() => { setOpen(false); setQuery('') }} />
          <div className="ns-dropdown">
            <div className="ns-search-wrap">
              <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="#8fa3b8" /></svg>
              <input
                ref={searchRef}
                className="ns-search"
                placeholder="جستجوی namespace…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="ns-list">
              {admin && (
                <div className="ns-item" onClick={() => pick('__all__')}>
                  <span className="ns-item-name">همه Namespaceها</span>
                </div>
              )}
              {filtered.length === 0 && (
                <div className="ns-empty">موردی یافت نشد</div>
              )}
              {filtered.map(n => (
                <div
                  key={n}
                  className={`ns-item ${ns === n && !admin ? 'sel' : ''}`}
                  onClick={() => pick(n)}
                >
                  <span className="ns-item-avatar">
                    <Icon name="person" size={14} color={ns === n ? '#0d9488' : '#8fa3b8'} />
                  </span>
                  <span className="ns-item-name">{n}</span>
                  <span className="ns-item-role">مالک</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
