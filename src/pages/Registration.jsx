import { useState } from 'react'
import { apiPost } from '../lib/api.js'
import { getJson } from '../lib/http.js'
import { validNamespace, suggestNamespace } from '../lib/workgroup.js'
import { LOGOUT_URL } from '../lib/session.js'
import { Err, Field } from './admin/kit.jsx'
import Logo from '../components/Logo.jsx'
import './Registration.css'
import Spinner from '../components/Spinner.jsx'

// Shown to a signed-in user who has no workspace (Profile) yet. With REGISTRATION_FLOW on, they
// create one (POST /api/workgroup/create, then poll /exists like the platform); otherwise profiles
// come from admin onboarding, so they are told to ask an admin.
export default function Registration({ status, onDone }) {
  const [step, setStep] = useState(0)
  const [ns, setNs] = useState(() => suggestNamespace(String(status.user || '').split('@')[0]))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    if (!validNamespace(ns)) { setErr('نام فقط حروف کوچک لاتین، عدد و خط تیره است و باید با حرف یا عدد شروع و تمام شود.'); return }
    setBusy(true); setErr('')
    const r = await apiPost('/api/workgroup/create', { namespace: ns })
    if (r.error) { setBusy(false); setErr(r.error.message); return }
    for (let i = 0; i < 66; i++) {
      const x = await getJson(`/api/workgroup/exists?t=${Date.now()}`, { ttlMs: 0 })
      if (x.data?.hasWorkgroup) { onDone(); return }
      await new Promise(res => setTimeout(res, 300))
    }
    setBusy(false)
    setErr('فضای کاری هنوز آماده نشده است؛ چند لحظه بعد دوباره «پایان» را بزنید.')
  }

  return (
    <div className="rg-page" dir="rtl">
      <div className="rg-card">
        <div className="rg-logo"><Logo variant="dark" /></div>
        {!status.registrationFlowAllowed ? <>
          <h2>هنوز فضای کاری ندارید</h2>
          <p>حساب <bdi dir="ltr">{status.user}</bdi> وارد شده است، اما هنوز فضای کاری (پروفایل) برای آن ساخته نشده. فضای کاری را مدیر پلتفرم هنگام ثبت‌نام کاربر می‌سازد؛ با مدیر پلتفرم تماس بگیرید.</p>
          <div className="rg-actions"><button className="ak-btn" onClick={onDone}>بررسی دوباره</button><a className="ak-btn" href={LOGOUT_URL}>خروج</a></div>
        </> : step === 0 ? <>
          <h2>خوش آمدید</h2>
          <p>برای استفاده از پلتفرم باید یک فضای کاری (namespace) برای حساب شما ساخته شود. مراحل را دنبال کنید.</p>
          <div className="rg-actions"><button className="ak-btn ak-primary" onClick={() => setStep(1)}>شروع</button></div>
        </> : <>
          <h2>فضای کاری</h2>
          <p>فضای کاری مجموعه‌ای از سرویس‌هاست و منابعی که در آن می‌سازید از دیگر فضاها جداست. به‌طور پیش‌فرض یک نام برایتان پیشنهاد شده است.</p>
          <Field label="نام فضای کاری">
            <input className="ak-input" dir="ltr" maxLength={63} value={ns} disabled={busy} autoFocus
              onChange={e => { setNs(e.target.value.toLowerCase().replace(/[^-a-z0-9]/g, '')); setErr('') }} onKeyDown={e => e.key === 'Enter' && !busy && finish()} />
          </Field>
          <Err>{err}</Err>
          <div className="rg-actions">
            <button className="ak-btn" onClick={() => setStep(0)} disabled={busy}>بازگشت</button>
            <button className="ak-btn ak-primary" onClick={finish} disabled={busy}>{busy ? <Spinner label="در حال ساخت" /> : 'پایان'}</button>
          </div>
        </>}
        {status.registrationFlowAllowed && <div className="rg-dots">{[0, 1].map(i => <span key={i} className={step === i ? 'on' : ''} />)}</div>}
      </div>
    </div>
  )
}
