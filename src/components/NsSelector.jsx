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
  const [visible, setVisible] = useState({ current: false, next: false, repeat: false })

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const checks = [
    { label: 'حداقل ۸ نویسه', ok: n1.length >= 8 },
    { label: 'حرف و عدد', ok: /[a-zA-Z]/.test(n1) && /\d/.test(n1) },
    { label: 'نماد یا حروف بزرگ/کوچک', ok: /[^a-zA-Z0-9]/.test(n1) || (/[a-z]/.test(n1) && /[A-Z]/.test(n1)) },
  ]
  const score = !n1 ? 0 : checks.filter(c => c.ok).length
  const strengthText = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی'][score]
  const strengthClass = ['bad', 'bad', 'mid', 'good'][score]
  const canSave = !busy && cur && n1.length >= 8 && n1 === n2

  const save = async e => {
    e.preventDefault()
    if (!canSave) return
    setBusy(true); setErr('')
    const r = await changePassword(cur, n1)
    setBusy(false)
    if (!r.ok) { setErr(r.message || 'تغییر گذرواژه ناموفق بود.'); return }
    notifySuccess('گذرواژه تغییر کرد'); onClose()
  }

  const Eye = ({ on, onClick }) => (
    <button type="button" className="pw-eye" onClick={onClick} aria-label={on ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه'} title={on ? 'پنهان کردن' : 'نمایش'}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {on ? <>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /><path d="M4 20 20 4" />
        </> : <>
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" />
        </>}
      </svg>
    </button>
  )

  return (
    <>
      <div className="pw-backdrop" onClick={busy ? undefined : onClose} />
      <form className="pw-modal" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="pw-title" onSubmit={save}>
        <header className="pw-head">
          <span className="pw-icon" aria-hidden="true"><Icon name="lock" size={20} /></span>
          <div className="pw-heading">
            <h2 id="pw-title">تغییر گذرواژه</h2>
            <p>گذرواژه‌ی قوی‌تر حساب شما را امن‌تر نگه می‌دارد.</p>
          </div>
          <button type="button" className="pw-close" onClick={onClose} disabled={busy} aria-label="بستن">✕</button>
        </header>

        <div className="pw-body">
          <div className="pw-field">
            <label htmlFor="pw-current">گذرواژه فعلی</label>
            <div className="pw-input">
              <input id="pw-current" type={visible.current ? 'text' : 'password'} dir="ltr" autoFocus autoComplete="current-password" placeholder="••••••••" value={cur} onChange={e => setCur(e.target.value)} />
              <Eye on={visible.current} onClick={() => setVisible(v => ({ ...v, current: !v.current }))} />
            </div>
          </div>

          <div className="pw-field">
            <label htmlFor="pw-next">گذرواژه جدید</label>
            <div className="pw-input">
              <input id="pw-next" type={visible.next ? 'text' : 'password'} dir="ltr" autoComplete="new-password" placeholder="حداقل ۸ نویسه" value={n1} onChange={e => setN1(e.target.value)} />
              <Eye on={visible.next} onClick={() => setVisible(v => ({ ...v, next: !v.next }))} />
            </div>
            <div className="pw-strength" aria-live="polite">
              <div className="pw-meter">
                {[0, 1, 2].map(i => <span key={i} className={i < score ? strengthClass : ''} />)}
              </div>
              <span className={`pw-strength-label ${score ? strengthClass : ''}`}>{n1 ? strengthText : 'امنیت'}</span>
            </div>
            <ul className="pw-rules">
              {checks.map(c => <li key={c.label} className={c.ok ? 'ok' : ''}>{c.label}</li>)}
            </ul>
          </div>

          <div className="pw-field">
            <label htmlFor="pw-repeat">تکرار گذرواژه جدید</label>
            <div className={`pw-input ${n2 && n1 !== n2 ? 'invalid' : ''}`}>
              <input id="pw-repeat" type={visible.repeat ? 'text' : 'password'} dir="ltr" autoComplete="new-password" placeholder="تکرار دقیق" value={n2} onChange={e => setN2(e.target.value)} />
              <Eye on={visible.repeat} onClick={() => setVisible(v => ({ ...v, repeat: !v.repeat }))} />
            </div>
            {n2 && n1 !== n2 && <p className="pw-error" role="alert">تکرار گذرواژه یکسان نیست.</p>}
          </div>

          {err && <div className="pw-alert" role="alert">{err}</div>}
        </div>

        <footer className="pw-actions">
          <button type="button" className="pw-secondary" onClick={onClose} disabled={busy}>انصراف</button>
          <button type="submit" className="pw-primary" disabled={!canSave}>
            {busy ? <Spinner label="در حال ذخیره" size={15} /> : 'ذخیره'}
          </button>
        </footer>
      </form>
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
