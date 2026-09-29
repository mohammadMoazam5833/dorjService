import { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from '../lib/api.js'
import './SearchModal.css'

const PAGES = [
  { label: 'خانه',               sub: 'داشبورد',          icon: '🏠', route: '' },
  { label: 'نوت‌بوک‌ها',          sub: 'فضای کار',          icon: '📒', route: 'notebooks' },
  { label: 'فضاهای ذخیره‌سازی',   sub: 'فضای کار',          icon: '💾', route: 'volumes' },
  { label: 'ماشین‌های مجازی',      sub: 'فضای کار',          icon: '🖥️', route: 'vms' },
  { label: 'مصرف',               sub: 'گزارش‌ها',           icon: '📊', route: 'usage' },
  { label: 'ایمیل',              sub: 'ارتباطات',           icon: '✉️', route: 'mail' },
  { label: 'راهنما',             sub: 'پشتیبانی',           icon: '❓', route: 'help' },
  { label: 'پنل ادمین',          sub: 'مدیریت',             icon: '🛡️', route: 'admin-panel' },
]

function score(item, q) {
  const hay = `${item.label} ${item.sub || ''} ${item.route || ''}`.toLowerCase()
  return hay.includes(q) ? 1 : 0
}

export default function SearchModal({ onClose }) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const { data: notebooks } = useApi('/api/notebooks', [])
  const { data: volumes } = useApi('/api/volumes', [])

  const nbItems = (Array.isArray(notebooks) ? notebooks : []).map(n => ({
    label: n.name, sub: `نوت‌بوک · ${n.status}`, icon: '📒', route: 'notebooks',
  }))
  const volItems = (Array.isArray(volumes) ? volumes : []).map(v => ({
    label: v.name, sub: `فضای ذخیره‌سازی · ${v.size}`, icon: '💾', route: 'volumes',
  }))

  const ALL = [...PAGES, ...nbItems, ...volItems]
  const trimQ = q.trim().toLowerCase()
  const results = trimQ ? ALL.filter(it => score(it, trimQ) > 0) : PAGES

  useEffect(() => { setCursor(0) }, [q])
  useEffect(() => { inputRef.current?.focus() }, [])

  const go = useCallback(item => {
    window.location.hash = `#/${item.route}`
    onClose()
  }, [onClose])

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && results[cursor]) { go(results[cursor]) }
    else if (e.key === 'Escape') { onClose() }
  }

  useEffect(() => {
    const el = listRef.current?.children[cursor]
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const groups = trimQ ? null : [
    { title: 'صفحات', items: PAGES },
  ]

  return (
    <>
      <div className="sm-backdrop" onClick={onClose} />
      <div className="sm-modal" role="dialog" aria-modal="true" dir="rtl">
        <div className="sm-search-row">
          <svg className="sm-search-icon" viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />
          </svg>
          <input
            ref={inputRef}
            className="sm-input"
            placeholder="جستجو در صفحات، نوت‌بوک‌ها، فضاهای ذخیره‌سازی…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button className="sm-clear" onClick={() => setQ('')} type="button">✕</button>
          )}
          <kbd className="sm-esc-badge">Esc</kbd>
        </div>

        <div className="sm-list" ref={listRef}>
          {results.length === 0 && (
            <div className="sm-empty">نتیجه‌ای برای «{q}» یافت نشد</div>
          )}

          {groups
            ? groups.map(g => (
              <div key={g.title}>
                <div className="sm-group-label">{g.title}</div>
                {g.items.map((it, i) => {
                  const idx = i
                  return (
                    <div
                      key={it.route + it.label}
                      className={`sm-item ${cursor === idx ? 'active' : ''}`}
                      onClick={() => go(it)}
                      onMouseEnter={() => setCursor(idx)}
                    >
                      <span className="sm-item-icon">{it.icon}</span>
                      <span className="sm-item-label">{it.label}</span>
                      <span className="sm-item-sub">{it.sub}</span>
                      <span className="sm-item-enter">↵</span>
                    </div>
                  )
                })}
              </div>
            ))
            : results.map((it, i) => (
              <div
                key={it.route + it.label + i}
                className={`sm-item ${cursor === i ? 'active' : ''}`}
                onClick={() => go(it)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="sm-item-icon">{it.icon}</span>
                <span className="sm-item-label">{it.label}</span>
                <span className="sm-item-sub">{it.sub}</span>
                <span className="sm-item-enter">↵</span>
              </div>
            ))
          }
        </div>

        <div className="sm-footer">
          <span><kbd>↑↓</kbd> حرکت</span>
          <span><kbd>↵</kbd> انتخاب</span>
          <span><kbd>Esc</kbd> بستن</span>
        </div>
      </div>
    </>
  )
}
