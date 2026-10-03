import { useState, useEffect, useRef } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi, apiPost } from '../lib/api.js'
import { fmt } from '../lib/format.js'
import { adaptNotebooks } from '../lib/adapters/workloads.js'
import { soonProps } from '../lib/soon.js'
import ErrorNote from '../components/ErrorNote.jsx'
import './Notebooks.css'

// ── presets ──────────────────────────────────────────────────────────────────
const PRESETS = [
  { id: 'sm',  icon: '🌱', name: 'کوچک',    cpu: '1', mem: '4',  ws: '10', gpu: false, costH: 2500 },
  { id: 'md',  icon: '⚡', name: 'متوسط',   cpu: '4', mem: '16', ws: '20', gpu: false, costH: 9000 },
  { id: 'gpu', icon: '🚀', name: 'GPU',      cpu: '8', mem: '32', ws: '40', gpu: true,  costH: 46000 },
]

const CPU_RATE  = 1800   // ریال per core/h
const MEM_RATE  = 400    // ریال per GiB/h
const GPU_RATE  = 36000  // ریال per GPU/h
const DISK_RATE = 80     // ریال per GiB/h

function calcCost(cpu, mem, ws, hasGpu) {
  return (
    Number(cpu || 0) * CPU_RATE +
    Number(mem || 0) * MEM_RATE +
    Number(ws  || 0) * DISK_RATE +
    (hasGpu ? GPU_RATE : 0)
  )
}

// ── status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const MAP = {
    Running:  { cls: 'running', label: 'در حال اجرا' },
    Stopped:  { cls: 'stopped', label: 'متوقف' },
    Pending:  { cls: 'pending', label: 'در حال راه‌اندازی' },
    Starting: { cls: 'pending', label: 'در حال راه‌اندازی' },
    Error:    { cls: 'error',   label: 'خطا' },
    Stopping:    { cls: 'pending', label: 'در حال توقف' },
    Terminating: { cls: 'pending', label: 'در حال حذف' },
  }
  const { cls, label } = MAP[status] || { cls: 'stopped', label: status }
  return (
    <div>
      <span className={`nb-status ${cls}`}>
        <span className="nb-status-dot" />
        {label}
      </span>
      {cls === 'pending' && (
        <div className="nb-status-progress">
          <div className="nb-mini-progress"><div className="nb-mini-fill" /></div>
          <span>راه‌اندازی در حال انجام…</span>
        </div>
      )}
    </div>
  )
}

// ── quota bar ─────────────────────────────────────────────────────────────────
function QuotaBar({ label, used, total, unit, selected }) {
  const used2 = used + selected
  const pct = total > 0 ? Math.min(100, (used2 / total) * 100) : 0
  const fillCls = pct > 85 ? 'danger' : pct > 60 ? 'warn' : 'ok'
  const rem = Math.max(0, total - used2)
  return (
    <div className="nb-quota-item">
      <div className="nb-quota-row">
        <span className="nb-quota-lbl">{label}</span>
        <span className="nb-quota-rem">{rem} {unit} باقی</span>
      </div>
      <div className="nb-qbar">
        <div className="nb-qfill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="nb-skeleton-row">
      <div className="sk sk-name" />
      <div style={{ flex: 1 }} />
      <div className="sk sk-badge" />
      <div style={{ flex: 1 }} />
      <div className="sk sk-text" style={{ width: 200 }} />
      <div style={{ flex: 1 }} />
      <div className="sk sk-text" style={{ width: 80 }} />
    </div>
  ))
}

// ── toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onUndo, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="nb-toast" dir="rtl">
      <span>{msg}</span>
      {onUndo && <button className="nb-toast-undo" onClick={onUndo}>بازگردانی</button>}
      <button className="nb-toast-close" onClick={onClose}>✕</button>
    </div>
  )
}

// ── delete confirm ───────────────────────────────────────────────────────────
function DeleteModal({ notebook, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const name = notebook.name || notebook.id || ''
  const inUse = notebook.in_use_by
  return (
    <>
      <div className="nb-create-backdrop" style={{ zIndex: 302 }} onClick={onCancel} />
      <div className="nb-del-modal" dir="rtl">
        <h3>حذف نوت‌بوک</h3>
        <p>
          نوت‌بوک <strong>{name}</strong> به‌طور کامل حذف می‌شود. این عملیات قابل بازگشت نیست.
        </p>
        {inUse && (
          <div style={{ background: '#fff8e7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#b8790a', marginBottom: 12 }}>
            این نوت‌بوک در حال استفاده از فضای ذخیره‌سازی «{inUse}» است. ابتدا نوت‌بوک را متوقف کنید.
          </div>
        )}
        <div className="nb-del-confirm-label">برای تأیید، نام نوت‌بوک را بنویسید:</div>
        <input
          ref={inputRef}
          className="nb-del-confirm-input"
          placeholder={name}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && typed === name && !inUse && onConfirm()}
        />
        <div className="nb-del-actions">
          <button className="nb-btn-cancel" onClick={onCancel}>انصراف</button>
          <button className="nb-btn-del" disabled={typed !== name || !!inUse} onClick={onConfirm}>حذف</button>
        </div>
      </div>
    </>
  )
}

// ── create modal ─────────────────────────────────────────────────────────────
function CreateModal({ opts, quota, onClose, onCreate }) {
  const images = opts?.image_options || ['dorj/notebook-servers/jupyter-pytorch-cuda-full:v1.10.0']
  const q = quota || {}

  const [preset, setPreset] = useState('sm')
  const [name, setName]     = useState('')
  const [image, setImage]   = useState(images[0])
  const [cpu, setCpu]       = useState(PRESETS[0].cpu)
  const [mem, setMem]       = useState(PRESETS[0].mem)
  const [ws, setWs]         = useState(PRESETS[0].ws)
  const [hasGpu, setHasGpu] = useState(false)
  const [mode, setMode]     = useState('ReadWriteOnce')
  const [permanent, setPermanent] = useState(true)
  const [adv, setAdv]       = useState(false)
  const [saving, setSaving] = useState(false)

  const applyPreset = p => {
    setPreset(p.id)
    setCpu(p.cpu); setMem(p.mem); setWs(p.ws); setHasGpu(p.gpu)
  }

  const costH = calcCost(cpu, mem, ws, hasGpu)
  const costDay = costH * 24

  const usedCpu = (q.cpu_total_cores || 8) - (q.cpu_remaining_cores || 8)
  const usedMem = (q.memory_total_gib || 32) - (q.memory_remaining_gib || 32)
  const usedDisk = (q.storage_total_gib || 10) - (q.storage_remaining_gib || 10)

  const canCreate = name.trim().length >= 2 && Number(cpu) > 0 && Number(mem) > 0

  const submit = async () => {
    setSaving(true)
    await apiPost('/api/notebooks', { name: name.trim(), image, cpu, memory_gib: mem, workspace_size_gib: ws, access_mode: mode, permanent })
    setSaving(false)
    onCreate(name.trim())
    onClose()
  }

  return (
    <>
      <div className="nb-create-backdrop" onClick={onClose} />
      <div className="nb-create-modal" dir="rtl">
        {/* header */}
        <div className="nb-modal-head">
          <h2>ایجاد نوت‌بوک جدید</h2>
          <button className="nb-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* presets */}
        <div className="nb-presets">
          {PRESETS.map(p => (
            <button key={p.id} className={`nb-preset ${preset === p.id ? 'active' : ''}`} onClick={() => applyPreset(p)}>
              <div className="nb-preset-icon">{p.icon}</div>
              <div className="nb-preset-name">{p.name}</div>
              <div className="nb-preset-spec">{p.cpu} هسته · {p.mem} GiB{p.gpu ? ' · ۱ GPU' : ''}</div>
              <div className="nb-preset-cost">~{p.costH.toLocaleString('en-US')} ریال/ساعت</div>
            </button>
          ))}
        </div>

        {/* body */}
        <div className="nb-modal-body">
          {/* form */}
          <div className="nb-form-col">
            <label className="nb-flabel">نام نوت‌بوک</label>
            <input className="nb-finput" placeholder="my-notebook" value={name} onChange={e => setName(e.target.value)} autoFocus />

            <label className="nb-flabel">ایمیج</label>
            <select className="nb-finput" value={image} onChange={e => setImage(e.target.value)}>
              {images.map(i => <option key={i} value={i}>{i.split('/').pop()}</option>)}
            </select>

            <label className="nb-flabel">منابع</label>
            <div className="nb-finput-row">
              <div>
                <div style={{ fontSize: 11, color: '#8fa3b8', marginBottom: 4 }}>CPU (هسته)</div>
                <input className="nb-finput" type="number" min="1" value={cpu} onChange={e => setCpu(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8fa3b8', marginBottom: 4 }}>RAM (GiB)</div>
                <input className="nb-finput" type="number" min="1" value={mem} onChange={e => setMem(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8fa3b8', marginBottom: 4 }}>دیسک (GiB)</div>
                <input className="nb-finput" type="number" min="1" value={ws} onChange={e => setWs(e.target.value)} />
              </div>
            </div>

            {/* advanced */}
            <button className="nb-adv-toggle" onClick={() => setAdv(a => !a)}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" style={{ transform: adv ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>
                <path d="M8 5v14l11-7z" />
              </svg>
              گزینه‌های پیشرفته
            </button>
            {adv && (
              <div className="nb-adv-content">
                <label className="nb-flabel">حالت دسترسی فضای ذخیره‌سازی</label>
                <select className="nb-finput" value={mode} onChange={e => setMode(e.target.value)}>
                  <option value="ReadWriteOnce">ReadWriteOnce — اختصاصی</option>
                  <option value="ReadOnlyMany">ReadOnlyMany — فقط‌خواندنی</option>
                  <option value="ReadWriteMany">ReadWriteMany — اشتراکی</option>
                </select>
                <label className="nb-check-row">
                  <input type="checkbox" checked={permanent} onChange={e => setPermanent(e.target.checked)} />
                  <span>ذخیره‌سازی دائمی (توصیه‌شده)</span>
                </label>
              </div>
            )}

            {!hasGpu && (
              <div style={{ marginTop: 12, background: '#f4f7f9', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#56657f' }}>
                برای استفاده از GPU پیش‌تنظیم «GPU» را انتخاب کنید.
              </div>
            )}
          </div>

          {/* sidebar */}
          <div className="nb-sidebar-col">
            <div className="nb-cost-head">برآورد هزینه</div>
            <div className="nb-cost-line">
              <span className="nb-cost-label">CPU ({cpu} هسته)</span>
              <span className="nb-cost-val">{(Number(cpu) * CPU_RATE).toLocaleString('en-US')}</span>
            </div>
            <div className="nb-cost-line">
              <span className="nb-cost-label">RAM ({mem} GiB)</span>
              <span className="nb-cost-val">{(Number(mem) * MEM_RATE).toLocaleString('en-US')}</span>
            </div>
            <div className="nb-cost-line">
              <span className="nb-cost-label">دیسک ({ws} GiB)</span>
              <span className="nb-cost-val">{(Number(ws) * DISK_RATE).toLocaleString('en-US')}</span>
            </div>
            {hasGpu && (
              <div className="nb-cost-line">
                <span className="nb-cost-label">GPU (۱ واحد)</span>
                <span className="nb-cost-val">{GPU_RATE.toLocaleString('en-US')}</span>
              </div>
            )}
            <div className="nb-cost-total">
              <span className="nb-cost-total-label">ساعتی</span>
              <span className="nb-cost-total-val">{costH.toLocaleString('en-US')} ﷼</span>
            </div>
            <div className="nb-cost-line" style={{ paddingTop: 4 }}>
              <span className="nb-cost-label">روزانه (تقریبی)</span>
              <span className="nb-cost-val">{costDay.toLocaleString('en-US')}</span>
            </div>

            <div className="nb-quota-head">سهمیه namespace</div>
            <QuotaBar label="CPU" used={usedCpu} total={q.cpu_total_cores || 8} unit="هسته" selected={Number(cpu) || 0} />
            <QuotaBar label="RAM" used={usedMem} total={q.memory_total_gib || 32} unit="GiB" selected={Number(mem) || 0} />
            <QuotaBar label="دیسک" used={usedDisk} total={q.storage_total_gib || 10} unit="GiB" selected={Number(ws) || 0} />
          </div>
        </div>

        {/* footer */}
        <div className="nb-modal-foot">
          <span style={{ fontSize: 12, color: '#8fa3b8' }}>هزینه فقط زمان اجرا محاسبه می‌شود</span>
          <div className="spacer" />
          <button className="nb-btn-cancel" onClick={onClose}>انصراف</button>
          <button className="nb-btn-create" onClick={submit} disabled={saving || !canCreate}>
            {saving ? 'در حال ایجاد…' : 'ایجاد نوت‌بوک'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Notebooks() {
  const { data, loading, error } = useApi('/api/notebooks', null, [], adaptNotebooks)
  const { data: opts }    = useApi('/api/notebooks/options')
  const quota = opts?.quota || {}

  const [openCreate, setOpenCreate] = useState(false)
  const [delTarget, setDelTarget]   = useState(null)
  const [toast, setToast]           = useState(null)
  const [query, setQuery]           = useState('')
  const [page, setPage]             = useState(0)

  const raw  = Array.isArray(data) ? data : []
  const list = raw.filter(n => !query || (n.name || n.id || '').toLowerCase().includes(query.toLowerCase()))
  const PER  = 10
  const pages = Math.max(1, Math.ceil(list.length / PER))
  const shown = list.slice(page * PER, page * PER + PER)

  const showToast = (msg, onUndo) => {
    setToast({ msg, onUndo, key: Date.now() })
  }

  const handleCreate = name => {
    showToast(`نوت‌بوک «${name}» در حال راه‌اندازی است`)
    setTimeout(() => window.location.reload(), 300)
  }

  const handleDelete = async () => {
    const name = delTarget.name || delTarget.id
    setDelTarget(null)
    showToast(`نوت‌بوک «${name}» حذف شد`, () => {
      showToast('بازگردانی فعلاً پشتیبانی نمی‌شود.')
    })
  }

  const isLoading = loading && !error

  return (
    <AppShell active="نوت‌بوک‌ها">
      <div className="nb-page">
        {/* title */}
        <div className="nb-title-row">
          <h1>نوت‌بوک‌های من</h1>
          <div className="spacer" />
          <button className="nb-new-btn" {...soonProps}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            نوت‌بوک جدید
          </button>
        </div>

        {/* search bar */}
        {!isLoading && raw.length > 0 && (
          <div className="nb-bar">
            <div className="nb-search-wrap">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <input
                className="nb-search-input" placeholder="جستجوی نوت‌بوک…"
                value={query} onChange={e => { setQuery(e.target.value); setPage(0) }}
              />
            </div>
            <div className="spacer" />
            <span className="nb-count">{list.length} نوت‌بوک</span>
          </div>
        )}

        <ErrorNote error={error} />

        {/* skeleton */}
        {isLoading && <SkeletonRows />}

        {/* empty state */}
        {!isLoading && !error && raw.length === 0 && (
          <div className="nb-empty-state">
            <div className="nb-empty-icon">📒</div>
            <h3>هنوز نوت‌بوکی ندارید</h3>
            <p>نوت‌بوک‌های Jupyter برای آموزش مدل، آنالیز داده و آزمایش سریع محیطی ایزوله می‌دهند.</p>
            <div className="nb-empty-actions">
              <button className="nb-new-btn" {...soonProps}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                ساخت اولین نوت‌بوک
              </button>
              <a className="nb-empty-link" href="#/help">مشاهده آموزش‌ها ←</a>
            </div>
          </div>
        )}

        {/* empty search */}
        {!isLoading && raw.length > 0 && list.length === 0 && (
          <div className="nb-empty-state">
            <div className="nb-empty-icon" style={{ background: '#f4f7f9', fontSize: 24 }}>🔍</div>
            <h3>نتیجه‌ای یافت نشد</h3>
            <p>نوت‌بوکی با نام «{query}» وجود ندارد.</p>
          </div>
        )}

        {/* table */}
        {!isLoading && shown.length > 0 && (
          <div className="nb-table-wrap">
            <table className="nb-tbl">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>وضعیت</th>
                  <th>ایمیج</th>
                  <th>ایجاد</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(n => {
                  const name = n.name || n.id
                  const isRunning = n.status === 'Running'
                  const inUse = n.in_use_by
                  return (
                    <tr key={name}>
                      <td>
                        <div className="nb-name">{name}</div>
                      </td>
                      <td title={n.phase_message}><StatusBadge status={n.status} /></td>
                      <td>
                        <div className="nb-image-cell" title={n.image}>
                          <bdi dir="ltr">{n.image?.split('/').pop() || '—'}</bdi>
                        </div>
                      </td>
                      <td>
                        <span className="nb-date">{fmt.date(n.created_at)}</span>
                      </td>
                      <td>
                        <div className="nb-actions">
                          {isRunning && (
                            <a href={n.url || '#'} className="nb-action-btn" title="باز کردن">
                              <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" /></svg>
                            </a>
                          )}
                          <div className="nb-tooltip-wrap">
                            <button
                              className="nb-action-btn danger"
                              {...soonProps}
                            >
                              <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                            </button>
                            {inUse && (
                              <div className="nb-tooltip">در حال استفاده توسط فضای ذخیره‌سازی «{inUse}»</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', justifyContent: 'flex-end' }}>
                <button className="nb-action-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
                <span style={{ fontSize: 12, color: '#8fa3b8' }}>{page + 1} / {pages}</span>
                <button className="nb-action-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>›</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* modals */}
      {openCreate && (
        <CreateModal
          opts={opts}
          quota={quota}
          onClose={() => setOpenCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {delTarget && (
        <DeleteModal
          notebook={delTarget}
          onConfirm={handleDelete}
          onCancel={() => setDelTarget(null)}
        />
      )}

      {/* toast */}
      {toast && (
        <Toast
          key={toast.key}
          msg={toast.msg}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      )}
    </AppShell>
  )
}
