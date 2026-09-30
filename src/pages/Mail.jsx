import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import Icon from '../components/Icon.jsx'
import { useApi, apiPost } from '../lib/api.js'
import './Mail.css'

const FA_FOLDER = {
  INBOX: 'صندوق ورودی',
  Drafts: 'پیش‌نویس',
  Junk: 'هرزنامه',
  Sent: 'ارسال‌شده',
  Archive: 'آرشیو',
  Trash: 'زباله‌دان',
}

const FOLDER_ICONS = {
  INBOX: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14v10z" /></svg>,
  Drafts: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>,
  Junk: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>,
  Sent: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" /></svg>,
  Archive: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5 6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" /></svg>,
  Trash: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>,
}

const FOLDER_COLORS = {
  INBOX: '#007dfc',
  Drafts: '#8a94a6',
  Junk: '#e8a03c',
  Sent: '#0d9488',
  Archive: '#7c3aed',
  Trash: '#d05a5a',
}

const faDate = s => {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d)) return s
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
}

const initial = from => (from || '?').replace(/[^A-Za-zآ-ی\u0600-\u06FF]/g, '').charAt(0).toUpperCase() || '?'
const AVATAR_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#e8a03c', '#d05a5a', '#0891b2']
const avatarColor = from => AVATAR_COLORS[(from || '').length % AVATAR_COLORS.length]
const nameOf = from => (from || '').replace(/<.*>/, '').trim() || from

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
  const unseenTotal = folders.reduce((a, f) => a + (f.unseen || 0), 0)

  const openMsg = async m => {
    setMsg(m)
    if (!m.seen) {
      await apiPost('/api/mail/seen', { folder, uid: m.uid })
      setVer(v => v + 1)
    }
  }

  return (
    <AppShell active="ایمیل">
      <div className="ml-page">
        <div className="ml-head">
          <div className="ml-head-main">
            <h1>ایمیل</h1>
            {unseenTotal > 0 && <span className="ml-head-badge">{unseenTotal} خوانده‌نشده</span>}
          </div>
          <div className="ml-head-side">
            <span className="ml-readonly-badge"><Icon name="lock" size={13} color="#5f6368" /><span>فقط‌خواندنی</span></span>
            <button className="ml-refresh" onClick={() => setVer(v => v + 1)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
              تازه‌سازی
            </button>
          </div>
        </div>

        <div className="ml-card">
          {/* sidebar */}
          <aside className="ml-side">
            <div className="ml-identity">
              <div className="ml-avatar" style={{ background: avatarColor(fd?.address) }}>{initial(fd?.address)}</div>
              <div className="ml-id-text">
                <b>{(fd?.address || '').split('@')[0]}</b>
                <span dir="ltr">{fd?.address || ''}</span>
              </div>
            </div>
            <div className="ml-side-label">پوشه‌ها</div>
            <nav className="ml-folders">
              {folders.map(f => {
                const active = folder === f.name
                return (
                  <button key={f.name} className={`ml-folder ${active ? 'active' : ''}`} onClick={() => { setFolder(f.name); setPage(0) }}>
                    <span className="ml-ficon" style={{ color: active ? FOLDER_COLORS[f.name] : '#8a94a6' }}>{FOLDER_ICONS[f.name]}</span>
                    <span className="ml-fbody">
                      <span className="ml-fname">{FA_FOLDER[f.name] || f.name}</span>
                      <span className="ml-flatin" dir="ltr">{f.name}</span>
                    </span>
                    {f.total > 0 && (
                      <span className={`ml-fcount ${f.unseen ? 'has-unseen' : ''}`}>{f.total}</span>
                    )}
                  </button>                )
              })}
            </nav>
            <div className="ml-side-note">
              <Icon name="lock" size={12} color="#8a94a6" />
              <span>این صندوق فقط‌خواندنی است — ارسال و حذف غیرفعال است.</span>
            </div>
          </aside>

          {/* list */}
          <section className="ml-listpane">
            <div className="ml-toolbar">
              <div className="ml-search">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
                <input type="search" placeholder="جستجوی پیام…" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
              </div>
              <div className="ml-pagination">
                <button className="ml-page-btn" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>‹</button>
                <span className="ml-page-label">{page + 1} / {pages}</span>
                <button className="ml-page-btn" disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>›</button>
              </div>
            </div>

            {msgs.length === 0 ? (
              <div className="ml-empty">
                <div className="ml-empty-icon">📭</div>
                <h3>{FA_FOLDER[folder] || folder} خالی است</h3>
                <p>هیچ پیامی در این پوشه یافت نشد.</p>
              </div>
            ) : (
              <div className="ml-list">
                {msgs.map(m => {
                  const from = nameOf(m.from)
                  return (
                    <div key={m.uid} className={`ml-row ${m.seen ? '' : 'unseen'}`} onClick={() => openMsg(m)}>
                      <span className="ml-row-avatar" style={{ background: avatarColor(m.from) }}>{initial(m.from)}</span>
                      <span className="ml-row-main">
                        <span className="ml-row-top">
                          <b className="ml-row-from">{from}</b>
                          <span className="ml-row-date">{faDate(m.date)}</span>
                        </span>
                        <span className="ml-row-subject">{m.subject}</span>
                      </span>
                      {!m.seen && <span className="ml-row-dot" />}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {msg && (
        <>
          <div className="modal-backdrop" onClick={() => setMsg(null)} />
          <div className="ml-modal" dir="rtl">
            <div className="ml-modal-head">
              <span className="ml-row-avatar lg" style={{ background: avatarColor(msg.from) }}>{initial(msg.from)}</span>
              <div className="ml-modal-title">
                <h2>{msg.subject}</h2>
                <span className="ml-modal-meta"><b>{nameOf(msg.from)}</b> · <span dir="ltr">{msg.from.match(/<(.+)>/)?.[1] || msg.from}</span> · {faDate(msg.date)}</span>
              </div>
              <button className="ml-modal-close" onClick={() => setMsg(null)}>✕</button>
            </div>
            <div className="ml-modal-body">
              {msg.body || 'متن این پیام در نمای فقط‌خواندنی در دسترس نیست.'}
            </div>
            <div className="ml-modal-foot">
              <button className="btn-secondary" onClick={() => setMsg(null)}>بستن</button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
