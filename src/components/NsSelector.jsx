import { useState, useRef, useEffect } from 'react'
import Icon from './Icon.jsx'
import Spinner from './Spinner.jsx'
import { useApi } from '../lib/api.js'
import { usePrefs } from '../lib/prefs.jsx'
import { useSession, initialsOf, changePassword, logoutUrl } from '../lib/session.js'
import { notifySuccess } from '../lib/notify.js'
import './NsSelector.css'

// One header widget: the namespace the user owns + who they are. Clicking opens a dropdown
// with namespace info, display preferences, change password and sign out.
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

export default function NsSelector({ admin }) {
  const { email, namespace } = useSession()
  const { prefs, update } = usePrefs() || {}
  const { data: opts } = useApi('/api/notebooks/options')
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState(false)
  const ref = useRef(null)
  const quota = opts?.quota || {}
  const username = email ? email.split('@')[0] : '—'

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const k = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  const logout = () => { window.location.href = logoutUrl() }

  return (
    <div className="ns-root" ref={ref}>
      <button type="button" className="ns-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" title={`${username} · ${namespace || ''}`}>
        <span className="ns-avatar">{initialsOf(email)}</span>
        <div className="ns-btn-body">
          <span className="ns-name"><bdi dir="ltr">{username}</bdi></span>
          <span className="ns-role"><bdi dir="ltr">{namespace || '—'}</bdi> · مالک</span>
        </div>
        <svg className={`ns-chevron ${open ? 'open' : ''}`} viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>

      {open && (
        <div className="ns-dropdown ns-dd" role="menu">
          <div className="ns-dd-head">
            <span className="ns-dd-avatar">{initialsOf(email)}</span>
            <span className="ns-dd-names">
              <b>{username}</b>
              <bdi dir="ltr">{email || '—'}</bdi>
            </span>
          </div>
          <div className="acc-sep" />
          {!admin && (
            <div className="ns-dd-quota">
              <div className="ns-dd-quota-row"><span>هسته CPU باقی‌مانده</span><b>{quota.cpu_remaining_cores ?? '—'}</b></div>
              <div className="ns-dd-quota-row"><span>حافظه RAM باقی‌مانده</span><b>{quota.memory_remaining_gib ?? '—'} GiB</b></div>
            </div>
          )}
          {(!admin) && <div className="acc-sep" />}
          <div className="ns-dd-title">تنظیمات نمایش</div>
          <Switch label="ارقام فارسی" on={prefs?.digits === 'persian'} onChange={v => update?.({ digits: v ? 'persian' : 'latin' })} />
          <Switch label="تقویم شمسی" on={prefs?.calendar !== 'gregorian'} onChange={v => update?.({ calendar: v ? 'jalali' : 'gregorian' })} />
          <div className="acc-sep" />
          <button type="button" className="acc-row" onClick={() => { setOpen(false); setPw(true) }}>
            <span>تغییر گذرواژه</span><Icon name="lock" size={15} />
          </button>
          <button type="button" className="acc-row danger" onClick={logout}>
            <span>خروج</span><Icon name="logout" size={15} />
          </button>
        </div>
      )}
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  )
}
