import { useState, useMemo, useEffect } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi, apiSend, invalidate } from '../lib/api.js'
import { fmt } from '../lib/format.js'
import { adaptNotebooks } from '../lib/adapters/workloads.js'
import { notifySuccess, notifyError } from '../lib/notify.js'
import ErrorNote from '../components/ErrorNote.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import CreateNotebook from './notebooks/CreateNotebook.jsx'
import ResizeNotebook from './notebooks/ResizeNotebook.jsx'
import NotebookDetails from './notebooks/NotebookDetails.jsx'
import { openInApp } from './Embed.jsx'
import './Notebooks.css'

const STATUS = {
  Running:     { cls: 'running', label: 'در حال اجرا' },
  Stopped:     { cls: 'stopped', label: 'متوقف' },
  Pending:     { cls: 'pending', label: 'در حال راه‌اندازی' },
  Stopping:    { cls: 'pending', label: 'در حال توقف' },
  Terminating: { cls: 'pending', label: 'در حال حذف' },
  Error:       { cls: 'error',   label: 'خطا' },
}
function StatusBadge({ status, message }) {
  const { cls, label } = STATUS[status] || { cls: 'stopped', label: status }
  return <span className={`nb-status ${cls}`} title={message || undefined}><span className="nb-status-dot" />{label}</span>
}

const COLS = [['name', 'نام'], ['status', 'وضعیت'], ['image', 'ایمیج'], ['resources', 'منابع'], ['created_at', 'ایجاد']]
const sortVal = (n, k) => (k === 'resources' ? Number(String(n.cpu_limit || 0)) : String(n[k] ?? '').toLowerCase())
const enc = encodeURIComponent

const Icon = ({ d }) => <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true"><path d={d} /></svg>
const I = {
  open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  start: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z',
  resize: 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z',
  del: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
}

export default function Notebooks() {
  const { data, loading, error, reload } = useApi('/api/notebooks', null, [], adaptNotebooks)
  const { data: opts } = useApi('/api/notebooks/options')
  const [create, setCreate] = useState(false)
  const [resize, setResize] = useState(null)
  const [details, setDetails] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [page, setPage] = useState(0)

  const raw = Array.isArray(data) ? data : []
  // the drawer follows the live row, not the snapshot taken when it was opened
  const detailsNb = details ? raw.find(n => n.name === details.name) || details : null
  // poll while any notebook is between states, so status/actions never go stale
  const transitionalCount = raw.filter(n => ['Pending', 'Stopping', 'Terminating'].includes(n.status)).length
  useEffect(() => {
    if (!transitionalCount) return
    const t = setInterval(() => { invalidate('/api/notebooks'); reload() }, 5000)
    return () => clearInterval(t)
  }, [transitionalCount, reload])
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = raw.filter(n => !q || n.name.toLowerCase().includes(q) || n.image.toLowerCase().includes(q))
    return f.sort((a, b) => {
      const x = sortVal(a, sort.key), y = sortVal(b, sort.key)
      return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1)
    })
  }, [raw, query, sort])
  const PER = 10
  const pages = Math.max(1, Math.ceil(list.length / PER))
  const shown = list.slice(page * PER, page * PER + PER)
  const toggleSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const refresh = () => { invalidate('/api/notebooks'); invalidate('/api/resource-usage'); reload() }

  const startStop = async n => {
    const stop = n.status !== 'Stopped'
    setBusy(n.name)
    const r = await apiSend(`/api/notebooks/${enc(n.name)}`, 'PATCH', { stopped: stop })
    setBusy('')
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(stop ? `نوت‌بوک «${n.name}» در حال توقف است` : `نوت‌بوک «${n.name}» در حال راه‌اندازی است`)
    refresh()
  }
  const doDelete = async () => {
    const n = del
    setBusy(n.name)
    const r = await apiSend(`/api/notebooks/${enc(n.name)}`, 'DELETE')
    setBusy(''); setDel(null)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(`نوت‌بوک «${n.name}» حذف شد`)
    refresh(); invalidate('/api/volumes')
  }

  const isLoading = loading && !error
  return (
    <AppShell active="نوت‌بوک‌ها">
      <div className="nb-page">
        <div className="nb-title-row">
          <h1>نوت‌بوک‌های من</h1>
          <div className="spacer" />
          <button className="nb-new-btn" onClick={() => setCreate(true)} disabled={!opts}>
            <Icon d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /> نوت‌بوک جدید
          </button>
        </div>

        <div className="nb-bar">
          <div className="nb-search-wrap">
            <input className="nb-search-input" placeholder="جستجوی نوت‌بوک یا ایمیج…" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
          </div>
          <div className="spacer" />
          <button className="nb-action-btn" title="تازه‌سازی" onClick={refresh}><Icon d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></button>
          <span className="nb-count">{list.length} نوت‌بوک</span>
        </div>

        <ErrorNote error={error} />
        {isLoading && <p className="nb-fhint" style={{ padding: 24 }}>در حال بارگذاری…</p>}

        {!isLoading && !error && raw.length === 0 && (
          <div className="nb-empty-state">
            <div className="nb-empty-icon">📒</div>
            <h3>هنوز نوت‌بوکی ندارید</h3>
            <p>نوت‌بوک‌های Jupyter برای آموزش مدل، آنالیز داده و آزمایش سریع محیطی ایزوله می‌دهند.</p>
            <div className="nb-empty-actions"><button className="nb-new-btn" onClick={() => setCreate(true)} disabled={!opts}>ساخت اولین نوت‌بوک</button></div>
          </div>
        )}
        {!isLoading && raw.length > 0 && list.length === 0 && <div className="nb-empty-state"><h3>نتیجه‌ای یافت نشد</h3></div>}

        {shown.length > 0 && (
          <div className="nb-table-wrap">
            <table className="nb-tbl">
              <thead><tr>
                {COLS.map(([k, l]) => (
                  <th key={k} className={`sortable ${sort.key === k ? sort.dir : ''}`} onClick={() => toggleSort(k)}>{l}{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                ))}
                <th style={{ width: 190 }} />
              </tr></thead>
              <tbody>
                {shown.map(n => {
                  const running = n.status === 'Running'
                  const transitional = ['Pending', 'Stopping', 'Terminating'].includes(n.status)
                  const b = busy === n.name
                  return (
                    <tr key={n.name}>
                      <td><button className="nb-name nb-linklike" onClick={() => setDetails(n)}><bdi dir="ltr">{n.name}</bdi></button></td>
                      <td><StatusBadge status={n.status} message={n.phase_message} /></td>
                      <td><div className="nb-image-cell" title={n.image}><bdi dir="ltr">{n.image.split('/').pop() || '—'}</bdi></div></td>
                      <td><span className="nb-date" dir="ltr">{n.cpu_limit ?? '—'} CPU · {n.memory_limit ?? '—'}{n.gpu_count ? ` · ${n.gpu_count} GPU` : ''}</span></td>
                      <td><span className="nb-date">{fmt.date(n.created_at)}</span></td>
                      <td>
                        <div className="nb-actions">
                          <button className="nb-action-btn" title="باز کردن" disabled={!running || !n.url} onClick={() => openInApp(n.url, n.name)}><Icon d={I.open} /></button>
                          <button className="nb-action-btn" title={n.status === 'Stopped' ? 'شروع' : 'توقف'} disabled={b || transitional} onClick={() => startStop(n)}>
                            <Icon d={n.status === 'Stopped' ? I.start : I.stop} />
                          </button>
                          <button className="nb-action-btn" title="جزئیات" onClick={() => setDetails(n)}><Icon d={I.info} /></button>
                          <button className="nb-action-btn" title="تغییر اندازه" disabled={b || transitional || !opts} onClick={() => setResize(n)}><Icon d={I.resize} /></button>
                          <button className="nb-action-btn danger" title="حذف" disabled={b || n.status === 'Terminating'} onClick={() => setDel(n)}><Icon d={I.del} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="nb-pager">
                <button className="nb-action-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
                <span>{page + 1} / {pages}</span>
                <button className="nb-action-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>›</button>
              </div>
            )}
          </div>
        )}
      </div>

      {create && <CreateNotebook opts={opts} onClose={() => setCreate(false)} onCreated={() => { setCreate(false); refresh() }} />}
      {resize && <ResizeNotebook nb={resize} opts={opts} onClose={() => setResize(null)} onDone={() => { setResize(null); refresh() }} />}
      {detailsNb && <NotebookDetails nb={detailsNb} onClose={() => setDetails(null)} />}
      {del && (
        <ConfirmDialog danger title={`حذف نوت‌بوک «${del.name}»؟`} typeToConfirm={del.name} busy={busy === del.name}
          body="این کار برگشت‌پذیر نیست. نوت‌بوک و Pod آن حذف می‌شود؛ فضای ذخیره‌سازی workspace باقی می‌ماند و در «فضاهای ذخیره‌سازی» قابل مدیریت است."
          confirmLabel="حذف" onCancel={() => setDel(null)} onConfirm={doDelete} />
      )}
    </AppShell>
  )
}
