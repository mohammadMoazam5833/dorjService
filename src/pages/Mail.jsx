import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import Icon from '../components/Icon.jsx'
import { useApi, apiPost } from '../lib/api.js'
import './Mail.css'

export default function Mail() {
  const [folder, setFolder] = useState('INBOX')
  const [ver, setVer] = useState(0)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [msg, setMsg] = useState(null)
  const { data: fd } = useApi('/api/mail/folders', null, [ver])
  const { data: md } = useApi('/api/mail/messages?folder=' + folder, null, [folder, ver])
  const folders = fd?.folders || []
  const all = (md?.messages || []).filter(m => !query || (m.subject + m.from).toLowerCase().includes(query.toLowerCase()))
  const per = 10
  const pages = Math.max(1, Math.ceil(all.length / per))
  const msgs = all.slice(page * per, page * per + per)

  const openMsg = async m => {
    setMsg(m)
    if (!m.seen) {
      await apiPost('/api/mail/seen', { folder, uid: m.uid })
      setVer(v => v + 1)
    }
  }

  return (
    <AppShell active="ایمیل">
      <div className="mv-page">
        <div className="mv-page-title">
          <h1>ایمیل</h1>
          <div className="mv-title-right">
            <span className="mv-readonly-badge"><Icon name="lock" size={15} color="#5f6368" /><span>فقط‌خواندنی</span></span>
            <span className="mv-address">{fd?.address || 'godarzi@isigpu.local'}</span>
            <button className="mv-btn" onClick={() => setVer(v => v + 1)}>تازه‌سازی</button>
          </div>
        </div>
        <div className="mv-content">
          <div className="mv-sidebar">
            {folders.map(f => (
              <div key={f.name} className={`mv-folder ${folder === f.name ? 'mv-folder-active' : ''}`} onClick={() => { setFolder(f.name); setPage(0) }}>
                <span className="mv-folder-name">{f.name}</span>
              </div>
            ))}
          </div>
          <div className="mv-main">
            <div className="mv-toolbar">
              <input className="mv-search" type="search" placeholder="Search..." value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
              <div className="mv-pagination">
                <button className="mv-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))}>‹</button>
                <span className="mv-page-label">{page + 1} / {pages}</span>
                <button className="mv-page-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>›</button>
              </div>
            </div>
            {msgs.length === 0 ? (
              <p className="mv-empty">هیچ پیامی در این پوشه وجود ندارد.</p>
            ) : (
              <div className="mv-list">
                {msgs.map(m => (
                  <div key={m.uid} className="mv-row" onClick={() => openMsg(m)}>
                    <span className="mv-dot" style={{ background: m.seen ? '#bdc1c6' : '#007dfc' }} />
                    <span className="mv-from">{m.from}</span>
                    <span className="mv-subject">{m.subject}</span>
                    <span className="mv-date">{m.date || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {msg && (
        <>
          <div className="modal-backdrop" onClick={() => setMsg(null)} />
          <div className="vw-modal" dir="rtl">
            <h2>{msg.subject}</h2>
            <div className="mv-meta"><b>از:</b> {msg.from}</div>
            <div className="mv-meta"><b>تاریخ:</b> {msg.date || '—'}</div>
            <div className="mv-body">{msg.body || 'متن پیام در دسترس نیست.'}</div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMsg(null)}>بستن</button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
