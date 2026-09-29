import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Icon from '../../components/Icon.jsx'
import Profiles from './Profiles.jsx'
import Users from './Users.jsx'
import Gpu from './Gpu.jsx'
import ModelsAdmin from './ModelsAdmin.jsx'
import Groups from './Groups.jsx'
import { NotebookOptions, Branding, Settings, AccessMatrix, Broadcast, LlmIssue, Assistant, Security, Monitoring } from './Misc.jsx'
import './AdminPanel.css'

const SECTIONS = [
  {
    group: 'کاربران و دسترسی',
    items: [
      { id: 'profiles', label: 'مدیریت پروفایل‌ها', icon: 'supervisor' },
      { id: 'users',    label: 'کاربران',            icon: 'group' },
      { id: 'access',   label: 'دسترسی‌ها',          icon: 'lock' },
      { id: 'groups',   label: 'گروه‌ها',             icon: 'apps' },
    ],
  },
  {
    group: 'منابع و SLA',
    items: [
      { id: 'notebook-options', label: 'تنظیمات نوت‌بوک', icon: 'note' },
      { id: 'models',           label: 'مدل‌ها',           icon: 'view-module' },
      { id: 'gpu',              label: 'مدیریت GPU',       icon: 'memory' },
      { id: 'monitoring',       label: 'مانیتورینگ',       icon: 'assessment' },
    ],
  },
  {
    group: 'تنظیمات',
    items: [
      { id: 'branding',  label: 'ظاهر پلتفرم',        icon: 'globe' },
      { id: 'settings',  label: 'تنظیمات',             icon: 'save' },
      { id: 'assistant', label: 'دستیار هوشمند',       icon: 'info' },
      { id: 'broadcast', label: 'ارسال گروهی ایمیل',   icon: 'mail' },
    ],
  },
  {
    group: 'امنیت',
    items: [
      { id: 'security', label: 'امنیت',      icon: 'shield' },
      { id: 'issues',   label: 'درخواست‌ها', icon: 'note' },
    ],
  },
]

function renderPage(id) {
  switch (id) {
    case 'profiles':         return <Profiles />
    case 'users':            return <Users />
    case 'access':           return <AccessMatrix />
    case 'groups':           return <Groups />
    case 'notebook-options': return <NotebookOptions />
    case 'models':           return <ModelsAdmin />
    case 'gpu':              return <Gpu />
    case 'monitoring':       return <Monitoring />
    case 'branding':         return <Branding />
    case 'settings':         return <Settings />
    case 'assistant':        return <Assistant />
    case 'broadcast':        return <Broadcast />
    case 'security':         return <Security />
    case 'issues':           return <LlmIssue />
    default:                 return <Profiles />
  }
}

function labelOf(id) {
  for (const s of SECTIONS)
    for (const it of s.items)
      if (it.id === id) return it.label
  return ''
}

export default function AdminPanel() {
  const [page, setPage] = useState('profiles')
  const [mini, setMini] = useState(false)

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
            {SECTIONS.map(({ group, items }) => (
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
