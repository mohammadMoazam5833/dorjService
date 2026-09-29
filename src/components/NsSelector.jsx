import { useState } from 'react'
import Icon from './Icon.jsx'
import { useApi } from '../lib/api.js'
import './NsSelector.css'

export default function NsSelector({ admin }) {
  const [open, setOpen] = useState(false)
  const [ns, setNs] = useState('godarzi')
  const { data } = useApi('/api/workgroup/get-all-namespaces', [])
  const list = Array.isArray(data) ? data.map(r => r[0]) : ['godarzi']
  const pick = n => { setNs(n); setOpen(false) }
  return (
    <div className="ns-selector">
      <button className="ns-btn" type="button" onClick={() => setOpen(o => !o)}>
        <span className="ns-icon"><Icon name="person" size={20} color="#5f6062" /></span>
        <article>
          <span className="text">{admin ? 'همه Namespaceها' : ns}</span>
          {!admin && <span className="owner-label">(مالک)</span>}
        </article>
        <Icon name="caret" size={24} color="#5f6062" />
      </button>
      {open && (
        <>
          <div className="ns-scrim" onClick={() => setOpen(false)} />
          <div className="ns-dropdown">
            <div className="ns-item" onClick={() => pick('__all__')}>
              <span className="text">همه Namespaceها</span>
              {admin && <Icon name="caret" size={0} />}
            </div>
            {list.map(n => (
              <div key={n} className={`ns-item ${ns === n ? 'sel' : ''}`} onClick={() => pick(n)}>
                <span className="text">{n}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
