import { useState, useRef, useEffect } from 'react'
import Icon from './Icon.jsx'
import Logo from './Logo.jsx'
import './Drawer.css'

const NAV = [
  {
    group: 'فضای کار',
    items: [
      { label: 'خانه',              icon: 'home',       route: '' },
      { label: 'نوت‌بوک‌ها',        icon: 'book',       route: 'notebooks' },
      { label: 'فضاهای ذخیره‌سازی', icon: 'storage',    route: 'volumes' },
      { label: 'ماشین‌های مجازی',   icon: 'memory',     route: 'vms' },
    ],
  },
  {
    group: 'گزارش‌ها',
    items: [
      { label: 'مصرف', icon: 'assessment', route: 'usage' },
    ],
  },
]

const BOTTOM = [
  { label: 'ایمیل',  icon: 'mail', route: 'mail' },
  { label: 'راهنما', icon: 'info', route: 'help' },
]

function NavGroup({ group, items, active, mini }) {
  const [open, setOpen] = useState(true)
  const ref = useRef(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const el = ref.current
    if (!el) return
    if (open) {
      el.style.height = '0px'
      el.style.opacity = '0'
      requestAnimationFrame(() => {
        el.style.transition = 'height 0.24s ease, opacity 0.2s ease'
        el.style.height = el.scrollHeight + 'px'
        el.style.opacity = '1'
        el.addEventListener('transitionend', () => { el.style.height = 'auto' }, { once: true })
      })
    } else {
      el.style.height = el.scrollHeight + 'px'
      requestAnimationFrame(() => {
        el.style.transition = 'height 0.22s ease, opacity 0.18s ease'
        el.style.height = '0px'
        el.style.opacity = '0'
      })
    }
  }, [open])

  if (mini) {
    return (
      <div className="nav-group">
        <div className="nav-group-items mini">
          {items.map(it => {
            const sel = active === it.label
            return (
              <a key={it.label} href={`#/${it.route}`} title={it.label}>
                <div className={`menu-item mini ${sel ? 'iron-selected' : ''}`}>
                  <Icon name={it.icon} size={20} color={sel ? 'var(--nav-active)' : 'currentColor'} />
                </div>
              </a>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="nav-group">
      <button className="nav-group-label" onClick={() => setOpen(o => !o)}>
        <span>{group}</span>
        <span className="nav-arrow">{open ? '▲' : '▼'}</span>
      </button>
      <div ref={ref} className="nav-group-items" style={{ overflow: 'hidden' }}>
        {items.map(it => {
          const sel = active === it.label
          return (
            <a key={it.label} href={`#/${it.route}`}>
              <div className={`menu-item ${sel ? 'iron-selected' : ''}`}>
                <Icon name={it.icon} size={19} color={sel ? 'var(--nav-active)' : 'currentColor'} />
                <span>{it.label}</span>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function Drawer({ active }) {
  const [mini, setMini] = useState(false)

  return (
    <aside className={`drawer ${mini ? 'mini' : ''}`}>

      <figure className="logo">
        {mini
          ? <Logo variant="light" height={34} showWord={false} />
          : <Logo variant="light" height={40} />}
      </figure>

      <nav className="drawer-nav">
        {NAV.map(({ group, items }) => (
          <NavGroup key={group} group={group} items={items} active={active} mini={mini} />
        ))}
      </nav>

      <div className={`drawer-bottom ${mini ? 'mini' : ''}`}>
        <div className="drawer-divider" />
        {BOTTOM.map(it => {
          const sel = active === it.label
          return mini ? (
            <a key={it.label} href={`#/${it.route}`} title={it.label}>
              <div className={`menu-item mini ${sel ? 'iron-selected' : ''}`}>
                <Icon name={it.icon} size={18} color={sel ? 'var(--nav-active)' : 'currentColor'} />
              </div>
            </a>
          ) : (
            <a key={it.label} href={`#/${it.route}`}>
              <div className={`menu-item ${sel ? 'iron-selected' : ''}`}>
                <Icon name={it.icon} size={18} color={sel ? 'var(--nav-active)' : 'currentColor'} />
                <span>{it.label}</span>
              </div>
            </a>
          )
        })}
        <button className="drawer-toggle" onClick={() => setMini(m => !m)} title={mini ? 'بازکردن منو' : 'بستن منو'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            {mini
              ? <path d="M8 5v14l11-7z" />
              : <path d="M16 5v14L5 12z" />}
          </svg>
        </button>
      </div>
    </aside>
  )
}
