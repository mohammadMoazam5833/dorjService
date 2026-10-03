import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Icon from '../../components/Icon.jsx'
import Profiles from './Profiles.jsx'
import Users from './Users.jsx'
import Gpu from './Gpu.jsx'
import ModelsAdmin from './ModelsAdmin.jsx'
import Groups from './Groups.jsx'
import Access from './Access.jsx'
import NotebookOptions from './NotebookOptions.jsx'
import Branding from './Branding.jsx'
import Settings from './Settings.jsx'
import Broadcast from './Broadcast.jsx'
import Requests from './Requests.jsx'
import { Assistant, Security, Monitoring, SoonPanel } from './Misc.jsx'
import { visibleTabs } from '../../lib/admin/units.js'
import { useWhoami } from './kit.jsx'
import './AdminPanel.css'

// Same tab ids and order as the platform's admin-panel-view (PANEL_TABS + UNIT_TABS);
// which ones a viewer gets comes from whoami via visibleTabs().
const PANEL_TABS = ['profiles', 'users', 'notebook-options', 'branding', 'settings', 'access', 'groups', 'broadcast', 'requests', 'troubleshoot', 'models', 'gpu-passthrough', 'security', 'monitoring']
const SECTIONS = [
  { group: 'کاربران و دسترسی', items: [
    { id: 'profiles', label: 'مدیریت پروفایل‌ها', icon: 'supervisor' },
    { id: 'users', label: 'کاربران', icon: 'group' },
    { id: 'access', label: 'دسترسی‌ها', icon: 'lock' },
    { id: 'groups', label: 'گروه‌ها', icon: 'apps' },
    { id: 'units', label: 'واحدها', icon: 'view-module' },
    { id: 'my-unit', label: 'واحد من', icon: 'supervisor' },
  ] },
  { group: 'منابع و مدل‌ها', items: [
    { id: 'notebook-options', label: 'تنظیمات نوت‌بوک', icon: 'note' },
    { id: 'models', label: 'مدل‌ها', icon: 'view-module' },
    { id: 'gpu-passthrough', label: 'مدیریت GPU', icon: 'memory' },
    { id: 'monitoring', label: 'مانیتورینگ', icon: 'assessment' },
  ] },
  { group: 'تنظیمات و ارتباطات', items: [
    { id: 'branding', label: 'ظاهر پلتفرم', icon: 'globe' },
    { id: 'settings', label: 'تنظیمات', icon: 'save' },
    { id: 'broadcast', label: 'ارسال گروهی ایمیل', icon: 'mail' },
    { id: 'requests', label: 'درخواست‌ها', icon: 'note' },
    { id: 'troubleshoot', label: 'دستیار هوشمند', icon: 'info' },
  ] },
  { group: 'امنیت', items: [
    { id: 'security', label: 'امنیت', icon: 'shield' },
  ] },
]

function renderPage(id) {
  switch (id) {
    case 'profiles':         return <Profiles />
    case 'users':            return <Users />
    case 'access':           return <Access />
    case 'groups':           return <Groups />
    case 'notebook-options': return <NotebookOptions />
    case 'models':           return <ModelsAdmin />
    case 'gpu-passthrough':  return <Gpu />
    case 'monitoring':       return <Monitoring />
    case 'branding':         return <Branding />
    case 'settings':         return <Settings />
    case 'troubleshoot':     return <Assistant />
    case 'broadcast':        return <Broadcast />
    case 'security':         return <Security />
    case 'requests':         return <Requests />
    case 'units':            return <SoonPanel title="واحدها" />
    case 'my-unit':          return <SoonPanel title="واحد من" />
    default:                 return null
  }
}

function labelOf(id) {
  for (const s of SECTIONS) for (const it of s.items) if (it.id === id) return it.label
  return ''
}

export default function AdminPanel() {
  const who = useWhoami()
  const allowed = who ? visibleTabs(who, PANEL_TABS) : null
  const [picked, setPicked] = useState(null)
  const [mini, setMini] = useState(false)
  const page = allowed && (allowed.includes(picked) ? picked : allowed[0])
  const setPage = setPicked

  if (!who) return <AppShell active=""><p style={{ padding: 24 }}>در حال بارگذاری…</p></AppShell>
  if (!allowed.length) {
    return (
      <AppShell active="">
        <div className="paper-card section" style={{ margin: 24, padding: 24 }}>
          <h2>دسترسی ندارید</h2>
          <p>پنل مدیریت فقط برای مدیران پلتفرم در دسترس است.</p>
          <a href="#/">بازگشت به خانه</a>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell active="" admin>
      <div className="admin-layout">

        <aside className={`admin-sidenav ${mini ? 'mini' : ''}`}>
          <div className="admin-sidenav-top">
            {!mini && <span className="admin-sidenav-title">مدیریت</span>}
            <button
              className="asn-toggle"
              type="button"
              onClick={() => setMini(m => !m)}
              title={mini ? 'باز کردن منوی مدیریت' : 'بستن منوی مدیریت'}
              aria-label={mini ? 'باز کردن منوی مدیریت' : 'بستن منوی مدیریت'}
            aria-expanded={!mini}
            >
              <svg className="asn-toggle-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                {mini
                  ? <>
                      <rect x="4" y="4.5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M9 4.5v15M12 9l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  : <>
                      <rect x="4" y="4.5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M15 4.5v15M12 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </>}
              </svg>
            </button>
          </div>
          <div className="admin-sidenav-inner">
            {SECTIONS.map(s => ({ ...s, items: s.items.filter(it => allowed.includes(it.id)) })).filter(s => s.items.length).map(({ group, items }) => (
              <div key={group} className="asn-group">
                {!mini && <div className="asn-group-label">{group}</div>}
                {mini && <div className="asn-divider" />}
                {items.map(it => (
                  <button
                    key={it.id}
                    className={`asn-item ${page === it.id ? 'active' : ''} ${mini ? 'mini' : ''}`}
                    onClick={() => setPage(it.id)}
                    title={mini ? it.label : undefined}
                  >
                    <Icon name={it.icon} size={18} color={page === it.id ? '#0d9488' : 'currentColor'} />
                    {!mini && <span>{it.label}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

        </aside>

        <div className="admin-content">
          <div className="admin-content-header">
            <h1 className="admin-page-title">{labelOf(page)}</h1>
          </div>
          <div className="admin-page-body">
            {renderPage(page)}
          </div>
        </div>

      </div>
    </AppShell>
  )
}
