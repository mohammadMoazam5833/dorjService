import { useState, useMemo, useEffect } from 'react'
import { getJson } from '../../lib/http.js'
import './kit.css'

// Shared building blocks for every admin tab: tables always get search, sortable headers and
// pagination; first column is the label, other columns are centred values.

let whoamiPromise = null
export function useWhoami() {
  const [who, setWho] = useState(null)
  useEffect(() => {
    whoamiPromise = whoamiPromise || getJson('/admin-panel/api/admin/whoami').then(r => r.data)
    let alive = true
    whoamiPromise.then(w => alive && setWho(w || {}))
    return () => { alive = false }
  }, [])
  return who
}

export function useTable(rows, { keys = [], sort: initial = { key: keys[0], dir: 'asc' }, per = 10 } = {}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(initial)
  const [page, setPage] = useState(0)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = (rows || []).filter(r => !q || keys.some(k => String(typeof k === 'function' ? k(r) : r[k] ?? '').toLowerCase().includes(q)))
    const val = r => { const v = typeof sort.get === 'function' ? sort.get(r) : r[sort.key]; return v == null ? '' : typeof v === 'number' ? v : String(v).toLowerCase() }
    return f.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1) })
  }, [rows, query, sort])
  const pages = Math.max(1, Math.ceil(list.length / per))
  const p = Math.min(page, pages - 1)
  const shown = list.slice(p * per, p * per + per)
  const th = (key, label, get) => (
    <th key={key} className="ak-sortable" onClick={() => setSort(s => ({ key, get, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      {label}{sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  )
  const search = (placeholder = 'جستجو…') => (
    <input className="ak-search" type="search" placeholder={placeholder} value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
  )
  const pager = (
    <div className="ak-pager">
      <button className="ak-btn ak-ghost" onClick={() => setPage(Math.max(0, p - 1))} disabled={p === 0}>قبلی</button>
      <span>صفحه {p + 1} از {pages} ({list.length} مورد)</span>
      <button className="ak-btn ak-ghost" onClick={() => setPage(Math.min(pages - 1, p + 1))} disabled={p >= pages - 1}>بعدی</button>
    </div>
  )
  return { shown, th, search, pager, count: list.length }
}

export function Modal({ title, children, actions, onClose, wide, busy }) {
  return (
    <>
      <div className="ak-backdrop" onClick={busy ? undefined : onClose} />
      <div className={`ak-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" dir="rtl">
        <h2>{title}</h2>
        <div className="ak-modal-body">{children}</div>
        {actions && <div className="ak-actions">{actions}</div>}
      </div>
    </>
  )
}

export const Field = ({ label, hint, children }) => (
  <label className="ak-field"><span className="ak-label">{label}</span>{children}{hint && <span className="ak-hint">{hint}</span>}</label>
)

export const Pill = ({ ok, warn, children }) => <span className={`ak-pill ${ok ? 'ok' : warn ? 'warn' : ''}`}>{children}</span>

export const Err = ({ children }) => (children ? <p className="ak-err" role="alert" dir="auto">{children}</p> : null)

// Server-drawn captcha (/admin-panel/api/captcha -> {image, token}) used by destructive admin actions.
export function useCaptcha() {
  const [cap, setCap] = useState({ image: '', token: '' })
  const [answer, setAnswer] = useState('')
  const load = async () => {
    const r = await getJson(`/admin-panel/api/captcha?t=${Date.now()}`, { ttlMs: 0 })
    if (r.data) setCap({ image: r.data.image, token: r.data.token })
    setAnswer('')
  }
  useEffect(() => { load() }, [])
  const view = (
    <Field label="کد امنیتی" hint="برای کد جدید روی تصویر بزنید">
      {cap.image && <img className="ak-captcha" src={cap.image} alt="captcha" onClick={load} />}
      <input className="ak-input" dir="ltr" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="آنچه می‌بینید را بنویسید" />
    </Field>
  )
  return { token: cap.token, answer, view, reload: load }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// fetch helper for admin calls that return files or need headers (JSON calls use api.js)
export async function rawSend(path, method, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(d.error || d.message || `HTTP ${r.status}`)
  }
  return r
}
