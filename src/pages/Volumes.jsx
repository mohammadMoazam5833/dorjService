import { useState, useRef, useEffect } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi, apiPost, apiSend } from '../lib/api.js'
import { fmt } from '../lib/format.js'
import { adaptVolumes, adaptVms } from '../lib/adapters/workloads.js'
import ErrorNote from '../components/ErrorNote.jsx'
import { DeleteVolume, AutoresizeVolume } from './volumes/VolumeDialogs.jsx'
import { openInApp } from './Embed.jsx'
import VmDetails from './vms/VmDetails.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { relativeUrl } from '../lib/adapters/workloads.js'
import { notifySuccess, notifyError } from '../lib/notify.js'
import { invalidate } from '../lib/api.js'
import './Volumes.css'

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  Bound:    { cls: 'bound',    label: 'فعال' },
  Pending:  { cls: 'pending',  label: 'در حال آماده‌سازی' },
  Released: { cls: 'released', label: 'آزاد' },
  Failed:   { cls: 'failed',   label: 'خطا' },
}

function StatusBadge({ status }) {
  const { cls = 'released', label = status || '—' } = STATUS_MAP[status] || {}
  return (
    <span className={`vl-status ${cls}`}>
      <span className="vl-status-dot" />
      {label}
    </span>
  )
}

function UsageBar({ used, total }) {
  if (used == null) return <span className="vl-muted">mount نشده</span>
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const cls = pct > 85 ? 'danger' : pct > 65 ? 'warn' : 'ok'
  return (
    <div className="vl-usage-bar-wrap">
      <div className="vl-usage-label">
        <span>{used} GiB</span>
        <span>{total} GiB</span>
      </div>
      <div className="vl-ubar">
        <div className="vl-ufill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── row ⋯ menu ───────────────────────────────────────────────────────────────
function RowMenu({ volume, onBrowse, onAutoresize, onCloseViewer, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const act = fn => { setOpen(false); fn() }

  return (
    <div className="vl-menu-wrap" ref={ref}>
      <button className={`vl-menu-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        ⋯
      </button>
      {open && (
        <div className="vl-menu-drop">
          <div
            className={`vl-menu-item ${volume.status !== 'Bound' ? 'disabled' : ''}`}
            onClick={() => volume.status === 'Bound' && act(onBrowse)}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
            مرور فایل‌ها
          </div>
          {volume.has_viewer && (
            <div className="vl-menu-item" onClick={() => act(onCloseViewer)}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              بستن مرورگر فایل
            </div>
          )}
          <div className={`vl-menu-item ${volume.shared ? 'disabled' : ''}`} onClick={() => !volume.shared && act(onAutoresize)}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M13 2.05V4.07C16.94 4.54 20 7.92 20 12s-3.06 7.46-7 7.93v2.02c4.95-.49 9-4.76 9-9.95s-4.05-9.46-9-9.95zM11 2.05C6.05 2.54 2 6.81 2 12s4.05 9.46 9 9.95v-2.02C7.06 19.46 4 16.08 4 12s3.06-7.46 7-7.93V2.05zM12 7l-4 4h3v4h2v-4h3l-4-4z" /></svg>
            افزایش خودکار حجم
          </div>
          <div className={`vl-menu-item danger ${volume.shared ? 'disabled' : ''}`} onClick={() => !volume.shared && act(onDelete)}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            حذف
          </div>
        </div>
      )}
    </div>
  )
}

// ── column visibility picker ──────────────────────────────────────────────────
const ALL_COLS = [
  { key: 'name',     label: 'نام',              fixed: true },
  { key: 'size',     label: 'حجم / مصرف',       fixed: true },
  { key: 'status',   label: 'وضعیت',             fixed: true },
  { key: 'inuse',    label: 'در استفاده توسط',   fixed: false },
  { key: 'resize',   label: 'تغییر اندازه خودکار', fixed: false },
  { key: 'shared',   label: 'نوع دسترسی',        fixed: false },
]

function ColPicker({ visible, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="vl-cols-root" ref={ref}>
      <button className="vl-cols-btn" onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" /></svg>
        ستون‌ها
      </button>
      {open && (
        <div className="vl-cols-panel">
          {ALL_COLS.filter(c => !c.fixed).map(c => (
            <label key={c.key} className="vl-cols-item">
              <input
                type="checkbox"
                checked={visible.includes(c.key)}
                onChange={e => {
                  onChange(e.target.checked
                    ? [...visible, c.key]
                    : visible.filter(k => k !== c.key))
                }}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="vl-toast">
      <span>{msg}</span>
      <button className="vl-toast-close" onClick={onClose}>✕</button>
    </div>
  )
}

// ── sort helper ───────────────────────────────────────────────────────────────
function sortRows(rows, key, dir) {
  if (!key) return rows
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key]
    if (key === 'size') {
      av = parseFloat(a.size) || 0; bv = parseFloat(b.size) || 0
    }
    if (key === 'used_gib') { av = a.used_gib ?? -1; bv = b.used_gib ?? -1 }
    if (typeof av === 'string') av = av.toLowerCase()
    if (typeof bv === 'string') bv = bv.toLowerCase()
    return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })
}

// ── volumes page ──────────────────────────────────────────────────────────────
export default function Volumes() {
  const { data, loading, error, reload } = useApi('/api/volumes', null, [], adaptVolumes)
  const [delVol, setDelVol] = useState(null)
  const [arVol, setArVol] = useState(null)
  const [createErr, setCreateErr] = useState('')
  const refresh = () => { invalidate('/api/volumes'); invalidate('/api/resource-usage'); reload() }
  const { data: q, error: qErr } = useApi('/api/volumes/quota')
  const [open, setOpen]   = useState(() => window.location.hash.includes('new=1'))
  const [name, setName]   = useState('')
  const [size, setSize]   = useState('5')
  const [saving, setSaving] = useState(false)
  const [query, setQuery]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [visible, setVisible] = useState(['inuse', 'resize', 'shared'])
  const [toast, setToast]   = useState(null)
  const [page, setPage]     = useState(0)

  const raw = Array.isArray(data) ? data : []
  const statuses = ['all', ...new Set(raw.map(v => v.status).filter(Boolean))]

  let list = raw
  if (query) list = list.filter(v => (v.name || '').toLowerCase().includes(query.toLowerCase()))
  if (statusFilter !== 'all') list = list.filter(v => v.status === statusFilter)
  list = sortRows(list, sortKey, sortDir)

  const PER   = 15
  const pages = Math.max(1, Math.ceil(list.length / PER))
  const shown = list.slice(page * PER, page * PER + PER)

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const thProps = key => ({
    className: `sortable ${sortKey === key ? sortDir : ''}`,
    onClick: () => toggleSort(key),
  })

  // POST .../viewer starts (or reuses) the PVCViewer; it then opens inside the app shell.
  const browse = async v => {
    if (v.viewer_url) { openInApp(v.viewer_url, v.name); return }
    const r = await apiPost(`/api/volumes/${encodeURIComponent(v.name)}/viewer`, {})
    if (r.error) { notifyError(r.error.message); return }
    refresh()
    openInApp(relativeUrl(r.data?.viewer_url), v.name)
  }

  const closeViewer = async v => {
    const r = await apiSend(`/api/volumes/${encodeURIComponent(v.name)}/viewer`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(`مرورگر فایل «${v.name}» بسته شد`)
    refresh()
  }

  const create = async () => {
    setSaving(true); setCreateErr('')
    const r = await apiPost('/api/volumes', { name: name.trim(), size: `${Number(size)}Gi` })
    setSaving(false)
    if (r.error) { setCreateErr(r.error.message); notifyError(r.error.message); return }
    setOpen(false); setName('')
    notifySuccess(`فضای ذخیره‌سازی «${name.trim()}» ایجاد شد`)
    refresh()
  }

  const storageRem = q?.quota?.storage_remaining_gib ?? null
  const showCol = k => visible.includes(k)

  const SortTh = ({ col, children }) => (
    <th {...thProps(col)}>
      {children}
      <span className="vl-sort-icon" />
    </th>
  )

  return (
    <AppShell active="فضاهای ذخیره‌سازی">
      <div className="vl-page">
        {/* title */}
        <div className="vl-title-row">
          <h1>فضاهای ذخیره‌سازی</h1>
          <div className="spacer" />
          <button className="vl-new-btn" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            ایجاد فضای ذخیره‌سازی
          </button>
        </div>

        {/* toolbar */}
        <div className="vl-toolbar">
          <div className="vl-search-wrap">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              className="vl-search-input"
              placeholder="جستجوی فضای ذخیره‌سازی…"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0) }}
            />
          </div>

          <div className="vl-filter-chips">
            {statuses.map(s => (
              <button
                key={s}
                className={`vl-chip ${statusFilter === s ? 'active' : ''}`}
                onClick={() => { setStatusFilter(s); setPage(0) }}
              >
                {s === 'all' ? 'همه' : (STATUS_MAP[s]?.label || s)}
              </button>
            ))}
          </div>

          <div className="vl-spacer" />
          <span className="vl-count">{list.length} فضا</span>
          <ColPicker visible={visible} onChange={setVisible} />
        </div>

        {/* skeleton */}
        <ErrorNote error={error || qErr} />
        {loading && (
          <div style={{ padding: '24px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display:'flex', gap:16, marginBottom:14 }}>
                <div className="vl-sk" style={{ width:120, height:14 }} />
                <div className="vl-sk" style={{ width:80,  height:14 }} />
                <div className="vl-sk" style={{ width:60,  height:14 }} />
              </div>
            ))}
          </div>
        )}

        {/* empty */}
        {!loading && !error && raw.length === 0 && (
          <div className="vl-empty">
            <div className="vl-empty-icon">💾</div>
            <h3>هنوز فضای ذخیره‌سازی ندارید</h3>
            <p>فضاهای ذخیره‌سازی برای ذخیره دائمی داده‌های نوت‌بوک‌ها استفاده می‌شوند.</p>
            <button className="vl-new-btn" onClick={() => setOpen(true)}>ایجاد اولین فضا</button>
          </div>
        )}

        {/* table */}
        {!loading && shown.length > 0 && (
          <div className="vl-table-wrap">
            <table className="vl-tbl">
              <thead>
                <tr>
                  <SortTh col="name">نام</SortTh>
                  <SortTh col="used_gib">حجم / مصرف</SortTh>
                  <SortTh col="status">وضعیت</SortTh>
                  {showCol('inuse')  && <th>در استفاده توسط</th>}
                  {showCol('resize') && <th>تغییر اندازه خودکار</th>}
                  {showCol('shared') && <th>نوع دسترسی</th>}
                  <th className="vl-menu-cell" />
                </tr>
              </thead>
              <tbody>
                {shown.map(v => {
                  const totalGib = parseFloat(v.size) || null
                  return (
                    <tr key={v.name}>
                      <td>
                        <div className="vl-name"><bdi dir="ltr">{v.name}</bdi></div>
                        {v.size && <div className="vl-muted"><bdi dir="ltr">{v.size}</bdi></div>}
                      </td>
                      <td>
                        {totalGib
                          ? <UsageBar used={v.used_gib} total={totalGib} />
                          : <span className="vl-muted">—</span>}
                      </td>
                      <td><StatusBadge status={v.status} /></td>
                      {showCol('inuse') && (
                        <td>
                          {v.in_use_by
                            ? <span style={{ fontSize:13, color:'#0c1a33' }}>{v.in_use_by}</span>
                            : <span className="vl-muted">—</span>}
                        </td>
                      )}
                      {showCol('resize') && (
                        <td>
                          <span className="vl-toggle">
                            <span className={`vl-toggle-dot ${v.autoresize_enabled ? 'on' : ''}`} />
                            {v.autoresize_enabled ? 'روشن' : 'خاموش'}
                          </span>
                        </td>
                      )}
                      {showCol('shared') && (
                        <td>
                          <span style={{ fontSize: 12, color: '#56657f' }}>
                            {v.shared ? 'مشترک / فقط‌خواندنی' : 'اختصاصی'}
                          </span>
                        </td>
                      )}
                      <td className="vl-menu-cell">
                        <RowMenu
                          volume={v}
                          onBrowse={() => browse(v)}
                          onAutoresize={() => setArVol(v)}
                          onCloseViewer={() => closeViewer(v)}
                          onDelete={() => setDelVol(v)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {pages > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', justifyContent:'flex-end' }}>
                <button style={{ border:0, background:'transparent', fontSize:20, cursor:'pointer', color:'#56657f' }} onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>‹</button>
                <span style={{ fontSize:12, color:'#8fa3b8' }}>{page+1} / {pages}</span>
                <button style={{ border:0, background:'transparent', fontSize:20, cursor:'pointer', color:'#56657f' }} onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page>=pages-1}>›</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* create modal */}
      {open && (
        <>
          <div className="vl-create-backdrop" onClick={() => setOpen(false)} />
          <div className="vl-create-modal" dir="rtl">
            <div className="vl-modal-title">ایجاد فضای ذخیره‌سازی</div>
            <label className="vl-flabel">نام</label>
            <input className="vl-finput" placeholder="my-volume" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <p className="vl-hint">فقط حروف کوچک انگلیسی، رقم و خط تیره مجاز است.</p>

            <label className="vl-flabel">حجم (GiB)</label>
            <input className="vl-finput" type="number" min="1" value={size} onChange={e => setSize(e.target.value)} />
            <div className="vl-quota-bar">
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#8fa3b8', marginBottom:4 }}>
                <span>سهمیه باقی‌مانده</span><span>{storageRem ?? '—'} GiB</span>
              </div>
              <div style={{ height:4, background:'#e8edf3', borderRadius:999, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:999, background:'#0d9488',
                  width: `${Math.min(100, (Number(size) / storageRem) * 100)}%`,
                  transition:'width .3s' }} />
              </div>
            </div>

            {createErr && <div className="nb-form-err" role="alert" dir="auto">{createErr}</div>}
            <div className="vl-modal-actions">
              <button className="vl-btn-cancel" onClick={() => setOpen(false)}>انصراف</button>
              <button className="vl-btn-create" onClick={create} disabled={saving || !name.trim() || Number(size) <= 0}>
                {saving ? 'در حال ایجاد…' : 'ایجاد'}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && <Toast msg={toast.msg} onClose={() => setToast(null)} />}
      {delVol && <DeleteVolume vol={delVol} onClose={() => setDelVol(null)} onDone={() => { setDelVol(null); refresh() }} />}
      {arVol && <AutoresizeVolume vol={arVol} onClose={() => setArVol(null)} onDone={() => { setArVol(null); refresh() }} />}
    </AppShell>
  )
}

// ── VMs ───────────────────────────────────────────────────────────────────────
const VM_STATUS_MAP = {
  Running: { cls: 'bound',    label: 'در حال اجرا' },
  Stopped: { cls: 'released', label: 'متوقف' },
  Error:   { cls: 'failed',   label: 'خطا' },
  Starting:   { cls: 'pending',  label: 'در حال راه‌اندازی' },
  Stopping:   { cls: 'pending',  label: 'در حال توقف' },
  Paused:     { cls: 'released', label: 'متوقف موقت' },
  Migrating:  { cls: 'pending',  label: 'در حال انتقال' },
  Provisioning: { cls: 'pending', label: 'در حال آماده‌سازی' },
  Unknown:    { cls: 'released', label: 'نامشخص' },
}

function VmStatusBadge({ status }) {
  const { cls = 'released', label = status || '—' } = VM_STATUS_MAP[status] || {}
  return (
    <span className={`vl-status ${cls}`}>
      <span className="vl-status-dot" />{label}
    </span>
  )
}

function VmRowMenu({ vm, busy, onStartStop, onRestart, onDetails, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const running = vm.status === 'Running'
  const settled = running || vm.status === 'Stopped'
  const act = fn => { setOpen(false); fn() }
  const item = (label, d, fn, enabled = true, danger = false) => (
    <div className={`vl-menu-item ${danger ? 'danger' : ''} ${enabled && !busy ? '' : 'disabled'}`} onClick={() => enabled && !busy && act(fn)}>
      <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d={d} /></svg>{label}
    </div>
  )
  return (
    <div className="vl-menu-wrap" ref={ref}>
      <button className={`vl-menu-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <div className="vl-menu-drop">
          {item('جزئیات و کنسول', 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z', onDetails)}
          {item(running ? 'توقف' : 'راه‌اندازی', running ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z', onStartStop, settled)}
          {item('راه‌اندازی دوباره', 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', onRestart, running)}
          {item('حذف', 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z', onDelete, true, true)}
        </div>
      )}
    </div>
  )
}

export function Vms() {
  const { data: en }   = useApi('/api/vms/enabled')
  const { data, loading, error, reload } = useApi('/api/vms', null, [], adaptVms)
  const [vmDetails, setVmDetails] = useState(null)
  const [vmDel, setVmDel] = useState(null)
  const [vmBusy, setVmBusy] = useState('')
  const vmRefresh = () => { invalidate('/api/vms'); reload() }
  const vmCall = async (vm, method, path, body, ok) => {
    setVmBusy(vm.name)
    const r = await apiSend(`/api/vms/${encodeURIComponent(vm.name)}${path}`, method, body)
    setVmBusy('')
    if (r.error) { notifyError(r.error.message); return false }
    notifySuccess(ok); vmRefresh(); return true
  }
  const vmTransitional = (Array.isArray(data) ? data : []).some(v => !['Running', 'Stopped'].includes(v.status))
  useEffect(() => {
    const t = setInterval(vmRefresh, vmTransitional ? 5000 : 15000)
    return () => clearInterval(t)
  }, [vmTransitional])
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)

  const raw = Array.isArray(data) ? data : []
  let list = raw
  if (query) list = list.filter(v => (v.name || '').toLowerCase().includes(query.toLowerCase()))
  if (statusFilter !== 'all') list = list.filter(v => v.status === statusFilter)
  list = sortRows(list, sortKey, sortDir)

  const PER   = 15
  const pages = Math.max(1, Math.ceil(list.length / PER))
  const shown = list.slice(page * PER, page * PER + PER)
  const statuses = ['all', ...new Set(raw.map(v => v.status).filter(Boolean))]

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortTh = ({ col, children }) => (
    <th className={`sortable ${sortKey === col ? sortDir : ''}`} onClick={() => toggleSort(col)}>
      {children}<span className="vl-sort-icon" />
    </th>
  )

  return (
    <AppShell active="ماشین‌های مجازی">
      <div className="vl-page">
        <div className="vl-title-row">
          <h1>ماشین‌های مجازی</h1>
        </div>

        {en?.enabled === false && (
          <div style={{ margin:'16px 24px', background:'#fff8e7', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#b8790a' }}>
            سرویس ماشین مجازی در حال حاضر در پلتفرم غیرفعال است.
          </div>
        )}

        <ErrorNote error={error} />

        <div className="vl-toolbar">
          <div className="vl-search-wrap">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input className="vl-search-input" placeholder="جستجوی ماشین مجازی…" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
          </div>
          <div className="vl-filter-chips">
            {statuses.map(s => (
              <button key={s} className={`vl-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => { setStatusFilter(s); setPage(0) }}>
                {s === 'all' ? 'همه' : (VM_STATUS_MAP[s]?.label || s)}
              </button>
            ))}
          </div>
          <div className="vl-spacer" />
          <span className="vl-count">{list.length} ماشین مجازی</span>
        </div>

        {loading && <div style={{ padding:24, color:'#8fa3b8', fontSize:13 }}>در حال بارگذاری…</div>}

        {!loading && shown.length === 0 && (
          <div className="vl-empty">
            <div className="vl-empty-icon">🖥️</div>
            <h3>هیچ ماشین مجازی‌ای وجود ندارد</h3>
            <p>از این بخش می‌توانید ماشین‌های مجازی خود را مدیریت کنید.</p>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className="vl-table-wrap">
            <table className="vl-tbl">
              <thead>
                <tr>
                  <SortTh col="name">نام</SortTh>
                  <SortTh col="status">وضعیت</SortTh>
                  <th>CPU</th>
                  <th>حافظه</th>
                  <th>IP</th>
                  <SortTh col="created_at">ایجاد</SortTh>
                  <th className="vl-menu-cell" />
                </tr>
              </thead>
              <tbody>
                {shown.map(v => (
                  <tr key={v.name || v.id}>
                    <td><button className="nb-linklike vl-name" onClick={() => setVmDetails(v)}><bdi dir="ltr">{v.name}</bdi></button></td>
                    <td><VmStatusBadge status={v.status} /></td>
                    <td>{v.cpu || '—'}</td>
                    <td>{v.memory ? `${v.memory}` : '—'}</td>
                    <td><bdi dir="ltr" style={{ fontFamily:'var(--font-latin)', fontSize:13 }}>{v.ip || '—'}</bdi></td>
                    <td><span className="vl-muted">{fmt.date(v.created_at)}</span></td>
                    <td className="vl-menu-cell"><VmRowMenu vm={v} busy={vmBusy === v.name}
                      onDetails={() => setVmDetails(v)}
                      onStartStop={() => vmCall(v, 'PATCH', '', { stopped: v.status === 'Running' }, v.status === 'Running' ? `ماشین مجازی «${v.name}» در حال توقف است` : `ماشین مجازی «${v.name}» در حال راه‌اندازی است`)}
                      onRestart={() => vmCall(v, 'POST', '/restart', {}, `ماشین مجازی «${v.name}» دوباره راه‌اندازی می‌شود`)}
                      onDelete={() => setVmDel(v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', justifyContent:'flex-end' }}>
                <button style={{ border:0, background:'transparent', fontSize:20, cursor:'pointer', color:'#56657f' }} onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>‹</button>
                <span style={{ fontSize:12, color:'#8fa3b8' }}>{page+1} / {pages}</span>
                <button style={{ border:0, background:'transparent', fontSize:20, cursor:'pointer', color:'#56657f' }} onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page>=pages-1}>›</button>
              </div>
            )}
          </div>
        )}
      </div>
      {vmDetails && <VmDetails vm={vmDetails} onClose={() => { setVmDetails(null); vmRefresh() }} />}
      {vmDel && (
        <ConfirmDialog danger title={`حذف ماشین مجازی «${vmDel.name}»؟`} typeToConfirm={vmDel.name} busy={vmBusy === vmDel.name}
          body="ماشین مجازی حذف می‌شود و این کار قابل بازگشت نیست."
          confirmLabel="حذف" onCancel={() => setVmDel(null)}
          onConfirm={async () => { if (await vmCall(vmDel, 'DELETE', '', undefined, `ماشین مجازی «${vmDel.name}» حذف شد`)) setVmDel(null) }} />
      )}
    </AppShell>
  )
}
