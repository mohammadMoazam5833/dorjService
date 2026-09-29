import { useState } from 'react'
import Icon from './Icon.jsx'
import './NsSelector.css'

export default function NsSelector({ admin }) {
  const [open, setOpen] = useState(false)
  const [ns, setNs] = useState('godarzi')
  const pick = n => { setNs(n === 'همه' ? '__all__' : n); setOpen(false) }
  return (
    <div className="ns-selector">
      <button className="ns-btn" type="button" onClick={() => setOpen(o => !o)}>
        <span className="ns-icon"><Icon name="person" size={20} color="#5f6062" /></span>
        <article>
          <span className="text">{ns === '__all__' ? 'همه Namespaceها' : ns}</span>
          {ns !== '__all__' && <span className="owner-label">(مالک)</span>}
        </article>
        <Icon name="caret" size={24} color="#5f6062" />
      </button>
      {open && (
        <>
          <div className="ns-scrim" onClick={() => setOpen(false)} />
          <div className="ns-dropdown">
            <div className={`ns-item ${ns === '__all__' ? 'sel' : ''}`} onClick={() => pick('همه')}>
              <span className="text">همه Namespaceها</span>
            </div>
            <div className={`ns-item ${ns === 'godarzi' ? 'sel' : ''}`} onClick={() => pick('godarzi')}>
              <span className="text">godarzi</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
