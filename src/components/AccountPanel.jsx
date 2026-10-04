import { useState, useRef, useEffect } from 'react'
import Icon from './Icon.jsx'
import Spinner from './Spinner.jsx'
import { usePrefs } from '../lib/prefs.jsx'
import { useSession, initialsOf, changePassword, LOGOUT_URL } from '../lib/session.js'
import { notifySuccess } from '../lib/notify.js'
import './UserWidget.css'

// Account block at the foot of the sidebar: who is signed in, display preferences (Persian
// digits, Jalali calendar), change password and sign out. Replaces the header user menu.
function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="acc-row" onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={`acc-switch ${on ? 'on' : ''}`}><span /></span>
    </button>
  )
}

function PasswordModal({ onClose }) {
  const [cur, setCur] = useState('')
  const [n1, setN1] = useState('')
  const [n2, setN2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true); setErr('')
    const r = await changePassword(cur, n1)
    setBusy(false)
    if (!r.ok) { setErr(r.message || 'تغییر گذرواژه ناموفق بود.'); return }
    notifySuccess('گذرواژه تغییر کرد'); onClose()
  }
  return (
    <>
      <div className="uw-backdrop" onClick={busy ? undefined : onClose} />
      <div className="uw-modal" dir="rtl" role="dialog" aria-modal="true" aria-label="تغییر گذرواژه">
        <h2 className="uw-modal-title">تغییر گذرواژه</h2>
        <label className="uw-field-label">گذرواژه فعلی</label>
        <input className="uw-field" type="password" dir="ltr" autoFocus autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} />
        <label className="uw-field-label">گذرواژه جدید</label>
        <input className="uw-field" type="password" dir="ltr" autoComplete="new-password" value={n1} onChange={e => setN1(e.target.value)} />
        <label className="uw-field-label">تکرار گذرواژه جدید</label>
        <input className="uw-field" type="password" dir="ltr" autoComplete="new-password" value={n2} onChange={e => setN2(e.target.value)} />
        {n2 && n1 !== n2 && <p className="uw-error" role="alert">تکرار گذرواژه یکسان نیست.</p>}
        {err && <p className="uw-error" role="alert" dir="auto">{err}</p>}
        <div className="uw-modal-actions">
          <button className="uw-btn-sec" onClick={onClose} disabled={busy}>انصراف</button>
          <button className="uw-btn-pri" onClick={save} disabled={busy || !cur || !n1 || n1 !== n2}>{busy ? <Spinner label="در حال ذخیره" /> : 'ذخیره'}</button>
        </div>
      </div>
    </>
  )
}

export default function AccountPanel({ mini }) {
  const { email } = useSession()
  const { prefs, update } = usePrefs() || {}
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState(false)
  const ref = useRef(null)
  const username = email ? email.split('@')[0] : '—'
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const k = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  const logout = () => { window.location.href = LOGOUT_URL }

  return (
    <div className={`acc ${mini ? 'mini' : ''}`} ref={ref}>
      {open && (
        <div className="acc-pop" role="menu">
          <div className="acc-pop-title">تنظیمات نمایش</div>
          <Switch label="ارقام فارسی" on={prefs?.digits === 'persian'} onChange={v => update?.({ digits: v ? 'persian' : 'latin' })} />
          <Switch label="تقویم شمسی" on={prefs?.calendar !== 'gregorian'} onChange={v => update?.({ calendar: v ? 'jalali' : 'gregorian' })} />
          <div className="acc-sep" />
          <button type="button" className="acc-row" onClick={() => { setOpen(false); setPw(true) }}>
            <span>تغییر گذرواژه</span><Icon name="lock" size={15} />
          </button>
          {mini && <button type="button" className="acc-row danger" onClick={logout}><span>خروج</span><Icon name="logout" size={15} /></button>}
        </div>
      )}
      <div className="acc-card">
        <button type="button" className="acc-who" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" title={email || ''}>
          <span className="acc-avatar">{initialsOf(email)}</span>
          {!mini && <span className="acc-names"><b>{username}</b><bdi dir="ltr">{email || '—'}</bdi></span>}
          {!mini && <Icon name="settings" size={16} />}
        </button>
        {!mini && <button type="button" className="acc-logout" onClick={logout} title="خروج" aria-label="خروج"><Icon name="logout" size={17} /></button>}
      </div>
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  )
}
