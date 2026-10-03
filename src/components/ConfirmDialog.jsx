import { useState } from 'react'
import './ConfirmDialog.css'
import Spinner from './Spinner.jsx'

// In-app replacement for window.confirm; typeToConfirm makes the user type the name.
export default function ConfirmDialog({ title, body, confirmLabel = 'تأیید', danger, typeToConfirm, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const ok = !typeToConfirm || typed === typeToConfirm
  return (
    <>
      <div className="cd-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="cd-modal" role="dialog" aria-modal="true" dir="rtl">
        <h3>{title}</h3>
        {body && <div className="cd-body">{body}</div>}
        {typeToConfirm && (
          <>
            <label className="cd-label">برای تأیید، <bdi dir="ltr">{typeToConfirm}</bdi> را تایپ کنید</label>
            <input className="cd-input" dir="ltr" autoFocus value={typed} onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ok && !busy && onConfirm()} />
          </>
        )}
        <div className="cd-actions">
          <button className="cd-btn" onClick={onCancel} disabled={busy}>انصراف</button>
          <button className={`cd-btn ${danger ? 'cd-danger' : 'cd-primary'}`} onClick={onConfirm} disabled={!ok || busy}>
            {busy ? <Spinner label="در حال انجام" /> : confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
