import { useState, useRef, useEffect } from 'react'
import { useIsMobile } from '../lib/useMedia.js'
import Icon from './Icon.jsx'
import Logo from './Logo.jsx'
import AccountPanel from './AccountPanel.jsx'
import { useSession } from '../lib/session.js'
import './Drawer.css'

// Destinations live in the sidebar; account actions and display preferences in its foot
// (AccountPanel). The help pages moved to the login page's documentation panel.
const NAV = [
  {
    group: 'فضای کار',
    items: [
      { label: 'خانه',              icon: 'home',       route: '' },
      { label: 'نوت‌بوک‌ها',        icon: 'book',       route: 'notebooks' },
      { label: 'فضاهای ذخیره‌سازی', icon: 'storage',    route: 'volumes' },
      { label: 'ماشین‌های مجازی',   icon: 'memory',     route: 'vms' },
      { label: 'بکاپ‌ها',           icon: 'backup',     route: 'backups' },
    ],
  },
  { group: 'گزارش‌ها', items: [{ label: 'مصرف', icon: 'assessment', route: 'usage' }] },
  {
    group: 'ارتباطات',
    items: [
      { label: 'ایمیل',          icon: 'mail',  route: 'mail' },
      { label: 'مدیریت همکاران', icon: 'group', route: 'manage-users' },
    ],
  },
  { group: 'مدیریت', admin: true, items: [{ label: 'پنل مدیریت', icon: 'shield', route: 'admin-panel' }] },
]

const MINI_KEY = 'dorj.drawer.mini'
const readMini = () => { try { return localStorage.getItem(MINI_KEY) === '1' } catch { return false } }

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
                  <Icon name={it.icon} size={17} color={sel ? 'var(--nav-active)' : 'currentColor'} />
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
        <span className={`nav-arrow ${open ? '' : 'closed'}`}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </span>
      </button>
      <div ref={ref} className="nav-group-items" style={{ overflow: 'hidden' }}>
        {items.map(it => {
          const sel = active === it.label
          return (
            <a key={it.label} href={`#/${it.route}`}>
              <div className={`menu-item ${sel ? 'iron-selected' : ''}`}>
                <Icon name={it.icon} size={17} color={sel ? 'var(--nav-active)' : 'currentColor'} />
                <span>{it.label}</span>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function Drawer({ active, mobileOpen = false, onClose }) {
  const [miniPref, setMiniPref] = useState(readMini)
  const setMini = f => setMiniPref(m => { const v = f(m); try { localStorage.setItem(MINI_KEY, v ? '1' : '0') } catch { /* private mode */ } return v })
  const mobile = useIsMobile()
  const mini = miniPref && !mobile // the off-canvas phone drawer always shows labels
  const { isAdmin } = useSession()
  const groups = NAV.filter(g => !g.admin || isAdmin)

  return (
    <>
    {mobile && mobileOpen && <div className="drawer-backdrop" onClick={onClose} />}
    <aside className={`drawer ${mini ? 'mini' : ''} ${mobileOpen ? 'm-open' : ''}`} aria-hidden={mobile && !mobileOpen ? true : undefined}>

      <div className="drawer-head">
        <a className="logo" href="#/" aria-label="خانه">
          {mini
            ? <Logo variant="light" height={32} showWord={false} />
            : <Logo variant="light" height={34} />}
        </a>
        {!mobile && (
          <button className="drawer-toggle" type="button" onClick={() => setMini(m => !m)}
            title={mini ? 'باز کردن منو' : 'جمع کردن منو'} aria-label={mini ? 'باز کردن منو' : 'جمع کردن منو'} aria-expanded={!mini}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <rect x="4" y="4.5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M15 4.5v15" stroke="currentColor" strokeWidth="1.6" />
              <path d={mini ? 'M10.5 9 8 12l2.5 3' : 'M8 9l2.5 3L8 15'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <nav className="drawer-nav">
        {groups.map(({ group, items }) => (
          <NavGroup key={group} group={group} items={items} active={active} mini={mini} />
        ))}
      </nav>

      <div className={`drawer-bottom ${mini ? 'mini' : ''}`}>
        <AccountPanel mini={mini} />
      </div>
    </aside>
    </>
  )
}
