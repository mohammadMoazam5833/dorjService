import { useState, useEffect } from 'react'
import NsSelector from './NsSelector.jsx'
import ResourcesWidget from './ResourcesWidget.jsx'
import UserWidget from './UserWidget.jsx'
import SearchModal from './SearchModal.jsx'
import Drawer from './Drawer.jsx'
import ErrorNote from './ErrorNote.jsx'
import { useSession } from '../lib/session.js'
import { useBranding } from '../lib/branding.js'
import './AppShell.css'

export default function AppShell({ active, admin, children }) {
  const [search, setSearch] = useState(false)
  const { error: sessionError } = useSession()
  useBranding()

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearch(s => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="app-layout" dir="rtl">
      <Drawer active={active} />
      <div className="app-content">
        <header className="app-header">
          <NsSelector admin={admin} />
          <div className="app-header-spacer" />
          <button className="app-search-btn" type="button" onClick={() => setSearch(true)}>
            <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />
            </svg>
            <span className="app-search-placeholder">جستجو…</span>
            <kbd className="app-search-kbd">Ctrl K</kbd>
          </button>
          <ResourcesWidget />
          <UserWidget />
        </header>
        <main className="main"><ErrorNote error={sessionError} />{children}</main>
      </div>

      {search && <SearchModal onClose={() => setSearch(false)} />}
    </div>
  )
}
