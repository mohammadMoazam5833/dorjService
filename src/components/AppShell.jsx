import NsSelector from './NsSelector.jsx'
import Drawer from './Drawer.jsx'
import './AppShell.css'

export default function AppShell({ active, admin, pageTitle, tabs, tabActive, onTab, children }) {
  return (
    <div className="app-layout" dir="rtl">
      <Drawer active={active} />
      <div className="app-content">
        <header className="app-header">
          <NsSelector admin={admin} />
        </header>
        {admin && <div className="page-title">{pageTitle || 'پنل ادمين'}</div>}
        {tabs}
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
