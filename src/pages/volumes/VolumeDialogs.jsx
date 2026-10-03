import { useState } from 'react'
import { apiSend } from '../../lib/api.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import Spinner from '../../components/Spinner.jsx'

const enc = encodeURIComponent
const rnd = () => 2 + Math.floor(Math.random() * 9)

// DELETE /api/volumes/<name> re-verifies the caller: a client-drawn a+b captcha plus the
// user's current password (checked against Keycloak server-side); force also detaches
// pods still mounting the volume.
export function DeleteVolume({ vol, onClose, onDone }) {
  const [cap] = useState(() => ({ a: rnd(), b: rnd() }))
  const [answer, setAnswer] = useState('')
  const [password, setPassword] = useState('')
  const inUse = !!(vol.in_use_by || vol.attached_to_vm)
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ok = answer !== '' && password && (!inUse || force) && !busy

  const submit = async () => {
    setBusy(true); setErr('')
    const r = await apiSend(`/api/volumes/${enc(vol.name)}`, 'DELETE',
      { captcha_a: cap.a, captcha_b: cap.b, captcha_answer: Number(answer), password, force })
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(`فضای ذخیره‌سازی «${vol.name}» حذف شد`)
    onDone()
  }

  return (
    <>
      <div className="cd-backdrop" onClick={busy ? undefined : onClose} />
      <div className="cd-modal" dir="rtl" role="dialog" aria-modal="true">
        <h3>حذف «<bdi dir="ltr">{vol.name}</bdi>»؟</h3>
        <p className="cd-body">همه‌ی داده‌های این فضای ذخیره‌سازی برای همیشه پاک می‌شود. برای تأیید، گذرواژه‌ی خود و پاسخ سؤال را وارد کنید.</p>
        {inUse && (
          <label className="vd-force">
            <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
            <span>این فضا در حال استفاده است ({vol.in_use_by || 'ماشین مجازی'}). حذف اجباری Podهای استفاده‌کننده را هم متوقف می‌کند.</span>
          </label>
        )}
        <label className="cd-label">گذرواژه‌ی فعلی</label>
        <input className="cd-input" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
        <label className="cd-label"><bdi dir="ltr">{cap.a} + {cap.b}</bdi> = ؟</label>
        <input className="cd-input" type="number" dir="ltr" value={answer} onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ok && submit()} />
        {err && <div className="nb-form-err" role="alert" dir="auto">{err}</div>}
        <div className="cd-actions">
          <button className="cd-btn" onClick={onClose} disabled={busy}>انصراف</button>
          <button className="cd-btn cd-danger" onClick={submit} disabled={!ok}>{busy ? <Spinner label="در حال حذف" /> : 'حذف'}</button>
        </div>
      </div>
    </>
  )
}

const pctNum = s => String(s || '10%').replace('%', '')
const giNum = s => String(s || '').replace(/Gi$/, '')

// PATCH /api/volumes/<name>/autoresize - topolvm grows the PVC when free space drops below
// the threshold, up to the limit.
export function AutoresizeVolume({ vol, onClose, onDone }) {
  const [enabled, setEnabled] = useState(!!vol.autoresize_enabled)
  const [limit, setLimit] = useState(giNum(vol.autoresize_limit) || String(Math.ceil((vol.capacity_gib || 10) * 2)))
  const [threshold, setThreshold] = useState(pctNum(vol.autoresize_threshold))
  const [increase, setIncrease] = useState(pctNum(vol.autoresize_increase))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const valid = !enabled || (Number(limit) > 0 && Number(threshold) > 0 && Number(threshold) < 100 && Number(increase) > 0)

  const submit = async () => {
    setBusy(true); setErr('')
    const body = enabled ? { enabled, limit: `${limit}Gi`, threshold: `${threshold}%`, increase: `${increase}%` } : { enabled }
    const r = await apiSend(`/api/volumes/${enc(vol.name)}/autoresize`, 'PATCH', body)
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(enabled ? `افزایش خودکار حجم «${vol.name}» فعال شد` : `افزایش خودکار حجم «${vol.name}» غیرفعال شد`)
    onDone()
  }

  return (
    <>
      <div className="cd-backdrop" onClick={busy ? undefined : onClose} />
      <div className="cd-modal" dir="rtl" role="dialog" aria-modal="true">
        <h3>افزایش خودکار حجم: <bdi dir="ltr">{vol.name}</bdi></h3>
        <label className="vd-force"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /><span>فعال</span></label>
        {enabled && (
          <div className="nb-finput-row">
            <div><div className="nb-fhint">سقف حجم (GiB)</div><input className="nb-finput" type="number" min="1" value={limit} onChange={e => setLimit(e.target.value)} /></div>
            <div><div className="nb-fhint">آستانه‌ی فضای آزاد (%)</div><input className="nb-finput" type="number" min="1" max="99" value={threshold} onChange={e => setThreshold(e.target.value)} /></div>
            <div><div className="nb-fhint">میزان افزایش (%)</div><input className="nb-finput" type="number" min="1" value={increase} onChange={e => setIncrease(e.target.value)} /></div>
          </div>
        )}
        <p className="cd-body">وقتی فضای آزاد کمتر از آستانه شود، حجم به اندازه‌ی «میزان افزایش» بزرگ می‌شود تا به سقف برسد. افزایش حجم از سهمیه‌ی Namespace کم می‌کند.</p>
        {err && <div className="nb-form-err" role="alert" dir="auto">{err}</div>}
        <div className="cd-actions">
          <button className="cd-btn" onClick={onClose} disabled={busy}>انصراف</button>
          <button className="cd-btn cd-primary" onClick={submit} disabled={!valid || busy}>{busy ? <Spinner label="در حال ذخیره" /> : 'ذخیره'}</button>
        </div>
      </div>
    </>
  )
}
