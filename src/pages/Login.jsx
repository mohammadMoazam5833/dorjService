import { useState, useEffect, useRef } from 'react'
import './Login.css'

const T = {
  fa: {
    current: 'فارسی', other: 'انگلیسی (English)',
    title: 'ورود به سامانه', sub: 'زیرساخت هوش مصنوعی و یادگیری ماشین',
    user: 'نام کاربری', pass: 'گذرواژه', signin: 'ورود',
    trust: 'دسترسی شما ایمن و توسط مدیر سیستم کنترل می‌شود.',
    contact: 'مشکل در ورود دارید؟ با مدیر تماس بگیرید',
    tagline: 'از GPU تا هوش مصنوعی عملیاتی',
    err: 'نام کاربری یا گذرواژه نامعتبر است.',
  },
  en: {
    current: 'English', other: 'فارسی',
    title: 'Sign in to Platform', sub: 'AI & Machine Learning Infrastructure',
    user: 'Username', pass: 'Password', signin: 'Sign in',
    trust: 'Your access is secure and controlled by the system administrator.',
    contact: 'Trouble signing in? Contact your administrator',
    tagline: 'From GPUs to operational AI',
    err: 'Invalid username or password.',
  },
}

function DotGrid() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    const w = c.width = c.offsetWidth
    const h = c.height = c.offsetHeight
    const dots = []
    for (let x = 20; x < w; x += 34) for (let y = 20; y < h; y += 34) dots.push({ x, y, r: Math.random() * 1.4 + 0.5, p: Math.random() * Math.PI * 2 })
    let raf
    const draw = t => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        const a = 0.10 + 0.10 * Math.sin(t / 1400 + d.p)
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, 7)
        ctx.fillStyle = `rgba(125, 211, 252, ${a})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="lg-canvas" />
}

export default function Login() {
  const [lang, setLang] = useState('fa')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const t = T[lang]
  const rtl = lang === 'fa'

  const submit = e => {
    e.preventDefault()
    if (user.trim() === 'godarzi' && pass === '1qaz!QAZ') {
      window.location.hash = '#/'
    } else {
      setErr(t.err)
    }
  }

  return (
    <div className={`lg-page ${rtl ? '' : 'ltr'}`} dir={rtl ? 'rtl' : 'ltr'}>
      <div className="lg-wrapper">
        <div className="lg-locale">
          <a onClick={() => setLang(l => l === 'fa' ? 'en' : 'fa')}>{t.other}</a>
          <span className="lg-locale-cur">{t.current}</span>
        </div>
        <div className="lg-card">
          <div className="lg-brand">
            <DotGrid />
            <div className="lg-brand-mid">
              <img className="lg-logo" src="/img/logo.png" alt="دُرج" />
              <p className="lg-tagline">{t.tagline}</p>
            </div>
            <div className="lg-caption">برچسب‌گذاری تصویر</div>
          </div>
          <div className="lg-body">
            <div className="lg-lockup"><img src="/img/logo.png" alt="دُرج" /></div>
            <h1 className="lg-title">{t.title}</h1>
            <p className="lg-sub">{t.sub}</p>
            <form className="lg-form" onSubmit={submit}>
              <div className="lg-field">
                <label className="lg-label">{t.user}</label>
                <div className="lg-wrap">
                  <span className="lg-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></span>
                  <input className="lg-input" type="text" value={user} onChange={e => { setUser(e.target.value); setErr('') }} autoFocus />
                </div>
              </div>
              <div className="lg-field">
                <label className="lg-label">{t.pass}</label>
                <div className="lg-wrap">
                  <span className="lg-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 11a2 2 0 1 1 2-2 2 2 0 0 1-2 2z" /></svg></span>
                  <input className="lg-input" type={show ? 'text' : 'password'} value={pass} onChange={e => { setPass(e.target.value); setErr('') }} />
                  <button type="button" className="lg-eye" onClick={() => setShow(s => !s)}>
                    {show ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 7a5 5 0 0 1 5 5c0 .64-.13 1.26-.36 1.82l2.93 2.93A11.8 11.8 0 0 0 22 12a11.8 11.8 0 0 0-10-5.65 11.9 11.9 0 0 0-3.14.42l2.17 2.16A5 5 0 0 1 12 7zM2.71 3.16 1.29 4.58l2.34 2.34A11.87 11.87 0 0 0 2 12a11.8 11.8 0 0 0 10 5.65 11.9 11.9 0 0 0 4.26-.79l3.72 3.72 1.42-1.42L2.71 3.16zM12 17a5 5 0 0 1-5-5c0-.64.13-1.26.36-1.82l1.51 1.51a3 3 0 0 0 3.44 3.44l1.51 1.51A5 5 0 0 1 12 17z" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 5-5 5 5 0 0 1-5 5zm0-8a3 3 0 1 0 3 3 3 3 0 0 0-3-3z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              {err && <div className="lg-err">{err}</div>}
              <div className="lg-submit-row">
                <button type="submit" className="lg-submit">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" /></svg>
                  <span>{t.signin}</span>
                </button>
              </div>
            </form>
            <div className="lg-trust">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="#0d9488"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
              <span>{t.trust}</span>
            </div>
          </div>
        </div>
      </div>
      <a className="lg-contact">{t.contact}</a>
    </div>
  )
}
