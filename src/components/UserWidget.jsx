import { useState, useRef, useEffect } from 'react'
import Icon from './Icon.jsx'
import { useApi, apiPost } from '../lib/api.js'
import { usePrefs } from '../lib/prefs.jsx'
import './UserWidget.css'

const USERNAME = 'godarzi'
const EMAIL = 'godarzi@isigpu.local'
const INITIALS = 'گد'

export default function UserWidget() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState(false)
  const [bk, setBk] = useState(false)
  const [cur, setCur] = useState('')
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const ref = useRef(null)
  const { data: backups } = useApi('/api/backups', [])
  const list = Array.isArray(backups) ? backups : []

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const { prefs, update: updatePrefs } = usePrefs() || {}
  const logout = () => { window.location.hash = '#/login' }
  const savePw = async () => {
    await apiPost('/api/change-password', { current: cur, password: n1 })
    setPw(false); setCur(''); setN1(''); setN2('')
  }

  const close = () => setOpen(false)

  return (
    <>
      <div className="uw-root" ref={ref}>
        <button className="uw-trigger" type="button" onClick={() => setOpen(o => !o)}>
          <span className="uw-avatar">{INITIALS}</span>
          <span className="uw-name">{USERNAME}</span>
          <span className={`uw-caret ${open ? 'open' : ''}`}>
            <Icon name="caret" size={16} color="#8fa3b8" />
          </span>
        </button>

        {open && (
          <div className="uw-menu">
            <div className="uw-menu-header">
              <span className="uw-menu-avatar">{INITIALS}</span>
              <div className="uw-menu-info">
                <span className="uw-menu-name">{USERNAME}</span>
                <span className="uw-menu-email">{EMAIL}</span>
              </div>
            </div>
            <div className="uw-divider" />
            <a className="uw-item" href="#/mail" onClick={close}>
              <Icon name="mail" size={15} color="#56657f" />
              <span>ایمیل</span>
            </a>
            <div className="uw-item" onClick={() => { close(); setBk(true) }}>
              <Icon name="backup" size={15} color="#56657f" />
              <span>بکاپ‌ها</span>
            </div>
            <div className="uw-item" onClick={() => { close(); setPw(true) }}>
              <Icon name="lock" size={15} color="#56657f" />
              <span>تغییر گذرواژه</span>
            </div>
            <a className="uw-item" href="#/admin-panel" onClick={close}>
              <Icon name="shield" size={15} color="#56657f" />
              <span>پنل ادمین</span>
            </a>
            <div className="uw-divider" />
            <div className="uw-item" onClick={() => updatePrefs?.({ digits: prefs?.digits === 'persian' ? 'latin' : 'persian' })}>
              <Icon name="globe" size={15} color="#56657f" />
              <span>{prefs?.digits === 'persian' ? 'نمایش ارقام لاتین' : 'نمایش ارقام فارسی'}</span>
            </div>
            <div className="uw-item" onClick={() => updatePrefs?.({ calendar: prefs?.calendar === 'gregorian' ? 'jalali' : 'gregorian' })}>
              <Icon name="note" size={15} color="#56657f" />
              <span>{prefs?.calendar === 'gregorian' ? 'تقویم شمسی' : 'تقویم میلادی'}</span>
            </div>
            <div className="uw-divider" />
            <div className="uw-item danger" onClick={() => { close(); logout() }}>
              <Icon name="logout" size={15} color="#d93025" />
              <span>خروج</span>
            </div>
          </div>
        )}
      </div>

      {pw && (
        <>
          <div className="uw-backdrop" onClick={() => setPw(false)} />
          <div className="uw-modal" dir="rtl">
            <h2 className="uw-modal-title">تغییر گذرواژه</h2>
            <label className="uw-field-label">گذرواژه فعلی</label>
            <input className="uw-field" type="password" dir="ltr" value={cur} onChange={e => setCur(e.target.value)} />
            <label className="uw-field-label">گذرواژه جدید</label>
            <input className="uw-field" type="password" dir="ltr" value={n1} onChange={e => setN1(e.target.value)} />
            <label className="uw-field-label">تکرار گذرواژه جدید</label>
            <input className="uw-field" type="password" dir="ltr" value={n2} onChange={e => setN2(e.target.value)} />
            <div className="uw-modal-actions">
              <button className="uw-btn-sec" onClick={() => setPw(false)}>انصراف</button>
              <button className="uw-btn-pri" onClick={savePw} disabled={!cur || !n1 || n1 !== n2}>ذخیره</button>
            </div>
          </div>
        </>
      )}

      {bk && (
        <>
          <div className="uw-backdrop" onClick={() => setBk(false)} />
          <div className="uw-modal" dir="rtl">
            <h2 className="uw-modal-title">بکاپ‌ها</h2>
            {list.length === 0 ? (
              <p className="uw-empty">هیچ بکاپی در دسترس نیست.</p>
            ) : (
              <table className="uw-table">
                <thead><tr><th>نام</th><th>تاریخ</th><th>حجم</th></tr></thead>
                <tbody>
                  {list.map((b, i) => (
                    <tr key={i}>
                      <td>{b.name || b.id}</td>
                      <td>{(b.created_at || b.date || '—').slice(0, 10)}</td>
                      <td>{b.size || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="uw-modal-actions">
              <button className="uw-btn-sec" onClick={() => setBk(false)}>بستن</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
