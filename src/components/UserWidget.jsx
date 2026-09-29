import { useState } from 'react'
import Icon from './Icon.jsx'
import { useApi, apiPost } from '../lib/api.js'
import './UserWidget.css'

export default function UserWidget() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState(false)
  const [bk, setBk] = useState(false)
  const [cur, setCur] = useState('')
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const [fa, setFa] = useState(true)
  const { data: backups } = useApi('/api/backups', [])
  const list = Array.isArray(backups) ? backups : []

  const logout = () => { window.location.hash = '#/login' }
  const toggleLang = () => { const nf = !fa; setFa(nf); document.documentElement.dir = nf ? 'rtl' : 'ltr' }
  const savePw = async () => { await apiPost('/api/change-password', { current: cur, password: n1 }); setPw(false); setCur(''); setN1(''); setN2('') }

  const items = [
    { icon: 'lock', label: 'تغییر گذرواژه', act: () => setPw(true) },
    { icon: 'mail', label: 'ایمیل', act: () => { window.location.hash = '#/mail' } },
    { icon: 'backup', label: 'بکاپ‌ها', act: () => setBk(true) },
    { icon: 'shield', label: 'پنل ادمین', act: () => { window.location.hash = '#/admin-panel' } },
    { icon: 'globe', label: fa ? 'تغییر به انگلیسی' : 'تغییر به فارسی', act: toggleLang },
    { icon: 'logout', label: 'خروج', act: logout },
  ]

  return (
    <>
      <button className="user-pill" onClick={() => setOpen(o => !o)}>godarzi@isigpu.local</button>
      {open && (
        <div className="user-menu">
          {items.map(it => (
            it.icon === 'mail' || it.icon === 'shield' ? (
              <a key={it.label} className="user-menu-item" href={it.icon === 'mail' ? '#/mail' : '#/admin-panel'} onClick={() => setOpen(false)}>
                <span className="um-ic"><Icon name={it.icon} size={16} color="#3c4043" /></span>
                <span>{it.label}</span>
              </a>
            ) : (
              <div key={it.label} className="user-menu-item" onClick={() => { it.act(); setOpen(false) }}>
                <span className="um-ic"><Icon name={it.icon} size={16} color="#3c4043" /></span>
                <span>{it.label}</span>
              </div>
            )
          ))}
        </div>
      )}
      {pw && (
        <>
          <div className="modal-backdrop" onClick={() => setPw(false)} />
          <div className="vw-modal" dir="rtl">
            <h2>تغییر گذرواژه</h2>
            <label className="field-label">گذرواژه فعلی</label>
            <input className="vw-field" type="password" value={cur} onChange={e => setCur(e.target.value)} />
            <label className="field-label">گذرواژه جدید</label>
            <input className="vw-field" type="password" value={n1} onChange={e => setN1(e.target.value)} />
            <label className="field-label">تکرار گذرواژه جدید</label>
            <input className="vw-field" type="password" value={n2} onChange={e => setN2(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setPw(false)}>انصراف</button>
              <button className="btn-primary" onClick={savePw}>ذخیره</button>
            </div>
          </div>
        </>
      )}
      {bk && (
        <>
          <div className="modal-backdrop" onClick={() => setBk(false)} />
          <div className="vw-modal" dir="rtl">
            <h2>بکاپ‌ها</h2>
            {list.length === 0 ? (
              <p className="vw-empty" style={{ padding: '16px 0' }}>هیچ بکاپی در دسترس نیست.</p>
            ) : (
              <table className="vw-table">
                <thead><tr><th>نام</th><th>تاریخ</th><th>حجم</th></tr></thead>
                <tbody>{list.map((b, i) => <tr key={i}><td>{b.name || b.id}</td><td>{(b.created_at || b.date || '—').slice(0, 10)}</td><td>{b.size || '—'}</td></tr>)}</tbody>
              </table>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setBk(false)}>بستن</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
