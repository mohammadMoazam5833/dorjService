import { useState, useEffect, useRef } from 'react'
import Logo from '../components/Logo.jsx'
import './Login.css'

const T = {
  fa: {
    current: 'فارسی', other: 'English',
    title: 'ورود به کنسول', sub: 'مدیریت زیرساخت هوش مصنوعی و پردازش ابری',
    user: 'نام کاربری', pass: 'گذرواژه', signin: 'ورود به کنسول',
    trust: 'دسترسی شما رمزنگاری‌شده و توسط مدیر سیستم کنترل می‌شود',
    contact: 'مشکل در ورود دارید؟ با مدیر سیستم تماس بگیرید',
    lead: 'گنجینه‌ای از توان پردازشی، در دسترس شما',
    f1: 'GPU اختصاصی و اشتراکی', f1s: 'نسل جدید کارت‌های گرافیک برای آموزش و استنتاج',
    f2: 'نوت‌بوک و ماشین مجازی آماده', f2s: 'محیط توسعه در چند ثانیه بالا می‌آید',
    f3: 'مصرف شفاف و لحظه‌ای', f3s: 'هزینه و منابع را همان لحظه ببینید',
    err: 'نام کاربری یا گذرواژه نامعتبر است',
    copy: 'تمامی حقوق برای دُرج محفوظ است',
  },
  en: {
    current: 'English', other: 'فارسی',
    title: 'Sign in to console', sub: 'AI infrastructure & cloud compute management',
    user: 'Username', pass: 'Password', signin: 'Sign in to console',
    trust: 'Your access is encrypted and controlled by the system administrator',
    contact: 'Trouble signing in? Contact your administrator',
    lead: 'A treasury of compute power, at your command',
    f1: 'Dedicated & shared GPUs', f1s: 'Latest-gen accelerators for training and inference',
    f2: 'Ready notebooks & VMs', f2s: 'Spin up a full environment in seconds',
    f3: 'Transparent, real-time usage', f3s: 'See cost and resources the moment they change',
    err: 'Invalid username or password',
    copy: 'All rights reserved · Dorj',
  },
}

function Aurora() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    let w, h, dots = []
    const resize = () => {
      w = c.width = c.offsetWidth
      h = c.height = c.offsetHeight
      dots = []
      for (let x = 24; x < w; x += 40) for (let y = 24; y < h; y += 40) {
        dots.push({ x, y, r: Math.random() * 1.3 + 0.4, p: Math.random() * Math.PI * 2, g: Math.random() > 0.86 })
      }
    }
    resize()
    window.addEventListener('resize', resize)
    let raf
    const draw = t => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        const a = 0.08 + 0.10 * Math.sin(t / 1600 + d.p)
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, 7)
        ctx.fillStyle = d.g ? `rgba(244, 194, 75, ${a + 0.06})` : `rgba(124, 151, 234, ${a})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="lg-canvas" />
}

function NeuralNet() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w, h, nodes = [], raf, dpr = Math.min(window.devicePixelRatio || 1, 2)
    const LINK = 150            // max distance for a synapse
    const MOUSE = 170           // cursor influence radius
    const pointer = { x: -9999, y: -9999, on: false }
    const build = () => {
      w = c.offsetWidth; h = c.offsetHeight
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(90, Math.round((w * h) / 16000))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.8,
        gold: Math.random() > 0.85,
        p: Math.random() * Math.PI * 2,
      }))
    }
    build()
    window.addEventListener('resize', build)
    const move = e => {
      const r = c.getBoundingClientRect()
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = true
    }
    const leave = () => { pointer.on = false; pointer.x = pointer.y = -9999 }
    if (!reduce) {
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerdown', move)
      c.addEventListener('pointerleave', leave)
    }
    const draw = t => {
      ctx.clearRect(0, 0, w, h)
      // synapses
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            const o = (1 - d / LINK) * 0.28
            ctx.strokeStyle = `rgba(124, 151, 234, ${o})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
      }
      // links to the cursor
      if (pointer.on) {
        for (const n of nodes) {
          const dx = n.x - pointer.x, dy = n.y - pointer.y
          const d = Math.hypot(dx, dy)
          if (d < MOUSE) {
            const o = (1 - d / MOUSE) * 0.5
            ctx.strokeStyle = `rgba(244, 194, 75, ${o})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke()
          }
        }
      }
      // nodes
      for (const n of nodes) {
        if (!reduce) { n.x += n.vx; n.y += n.vy }
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1
        let near = 0
        if (pointer.on) {
          const dx = pointer.x - n.x, dy = pointer.y - n.y
          const d = Math.hypot(dx, dy)
          if (d < MOUSE) {
            near = 1 - d / MOUSE
            // gentle attraction toward the cursor
            n.x += (dx / (d || 1)) * near * 0.6
            n.y += (dy / (d || 1)) * near * 0.6
          }
        }
        const pulse = 0.55 + 0.45 * Math.sin(t / 1400 + n.p)
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + near * 1.6, 0, 7)
        ctx.fillStyle = (n.gold || near > 0.35)
          ? `rgba(244, 194, 75, ${Math.min(1, 0.5 + 0.4 * pulse + near * 0.4)})`
          : `rgba(160, 186, 245, ${0.35 + 0.4 * pulse + near * 0.3})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      c.removeEventListener('pointerleave', leave)
    }
  }, [])
  return <canvas ref={ref} className="lg-net" aria-hidden="true" />
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
      <NeuralNet />
      <div className="lg-orb lg-orb-1" />
      <div className="lg-orb lg-orb-2" />

      <header className="lg-topbar">
        <Logo variant="light" height={34} />
        <button className="lg-locale" onClick={() => setLang(l => l === 'fa' ? 'en' : 'fa')}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.6a15.7 15.7 0 0 0-1.3-3.4A8 8 0 0 1 18.9 8zM12 4c.8 1.1 1.4 2.5 1.8 4h-3.6C10.6 6.5 11.2 5.1 12 4zM4.3 14a7.8 7.8 0 0 1 0-4h3a17 17 0 0 0 0 4zm.8 2h2.6c.3 1.2.8 2.4 1.3 3.4A8 8 0 0 1 5.1 16zm2.6-8H5.1a8 8 0 0 1 3.9-3.4C8.5 5.6 8 6.8 7.7 8zM12 20c-.8-1.1-1.4-2.5-1.8-4h3.6c-.4 1.5-1 2.9-1.8 4zm2.2-6H9.8a15 15 0 0 1 0-4h4.4a15 15 0 0 1 0 4zm.8 5.4c.5-1 1-2.2 1.3-3.4h2.6a8 8 0 0 1-3.9 3.4zM16.6 14a17 17 0 0 0 0-4h3a7.8 7.8 0 0 1 0 4z" /></svg>
        <span>{t.other}</span>
        </button>
      </header>

      <main className="lg-main">
        <section className="lg-brand">
          <Aurora />
          <div className="lg-brand-inner">
            <div className="lg-gem"><Logo variant="light" height={72} showWord={false} /></div>
            <h2 className="lg-lead">{t.lead}</h2>
            <ul className="lg-features">
              {[[t.f1, t.f1s, 'gpu'], [t.f2, t.f2s, 'box'], [t.f3, t.f3s, 'chart']].map(([h, s, ic]) => (
                <li key={h}>
                  <span className="lg-feat-ic">{FEAT[ic]}</span>
                  <span className="lg-feat-txt">
                    <b>{h}</b>
                    <em>{s}</em>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lg-panel">
          <div className="lg-card">
            <h1 className="lg-title">{t.title}</h1>
            <p className="lg-sub">{t.sub}</p>
            <form className="lg-form" onSubmit={submit}>
              <div className="lg-field">
                <label className="lg-label">{t.user}</label>
                <div className="lg-wrap">
                  <span className="lg-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg></span>
                  <input className="lg-input" type="text" dir="ltr" value={user} onChange={e => { setUser(e.target.value); setErr('') }} autoFocus />
                </div>
              </div>
              <div className="lg-field">
                <label className="lg-label">{t.pass}</label>
                <div className="lg-wrap">
                  <span className="lg-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 11a2 2 0 1 1 2-2 2 2 0 0 1-2 2z" /></svg></span>
                  <input className="lg-input" type={show ? 'text' : 'password'} dir="ltr" value={pass} onChange={e => { setPass(e.target.value); setErr('') }} />
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
              <button type="submit" className="lg-submit">
                <span>{t.signin}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" /></svg>
              </button>
            </form>
            <div className="lg-trust">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--lapis)"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
              <span>{t.trust}</span>
            </div>
          </div>
          <a className="lg-contact">{t.contact}</a>
          <p className="lg-copy">{t.copy}</p>
        </section>
      </main>
    </div>
  )
}

const FEAT = {
  gpu: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><rect x="7" y="10" width="6" height="4" rx="1" /><path d="M17 10v4M6 6V4M10 6V4M14 6V4M6 20v-2M10 20v-2M14 20v-2" /></svg>,
  box: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>,
  chart: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" /></svg>,
}
