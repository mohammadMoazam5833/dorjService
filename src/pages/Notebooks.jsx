import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi, apiPost } from '../lib/api.js'

const FALLBACK_IMAGES = [
  'dorj/notebook-servers/jupyter-pytorch-cuda-full:v1.10.0',
  'dorj/notebook-servers/jupyter-tensorflow-cuda-full:v1.10.0',
]

export default function Notebooks() {
  const { data } = useApi('/api/notebooks', [])
  const { data: opts } = useApi('/api/notebooks/options')
  const images = opts?.image_options || FALLBACK_IMAGES
  const q = opts?.quota || {}
  const [open, setOpen] = useState(() => window.location.hash.includes('?new=1'))
  const [name, setName] = useState('')
  const [image, setImage] = useState(opts?.image_default || FALLBACK_IMAGES[0])
  const [cpu, setCpu] = useState('1')
  const [mem, setMem] = useState('')
  const [ws, setWs] = useState('new')
  const [wsSize, setWsSize] = useState('')
  const [mode, setMode] = useState('ReadWriteOnce')
  const [permanent, setPermanent] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const list = (Array.isArray(data) ? data : []).filter(n => !query || (n.name || n.id || '').toLowerCase().includes(query.toLowerCase()))
  const per = 10
  const pages = Math.max(1, Math.ceil(list.length / per))
  const shown = list.slice(page * per, page * per + per)

  const create = async () => {
    setSaving(true)
    await apiPost('/api/notebooks', { name, image, cpu, memory_gib: mem, workspace: ws, workspace_size_gib: wsSize, access_mode: mode, permanent })
    setSaving(false)
    setOpen(false)
    window.location.reload()
  }

  return (
    <AppShell active="نوت‌بوک‌ها">
      <div className="nb-page-title">
        <h1>نوت‌بوک‌های من</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>+ نوت‌بوک جدید</button>
      </div>
      <div className="nb-content">
        <div className="nb-toolbar">
          <input className="nb-search" type="search" placeholder="Search..." value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
          <div className="nb-pagination">
            <button className="nb-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))}>&lt;</button>
            <span className="nb-page-label">{page + 1} / {pages}</span>
            <button className="nb-page-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>&gt;</button>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="nb-empty">هیچ نوت‌بوکی در این Namespace وجود ندارد.</p>
        ) : (
          <table className="nb-table">
            <thead><tr><th>نام</th><th>وضعیت</th><th>ایمیج</th><th>ایجاد</th></tr></thead>
            <tbody>
              {shown.map(n => (
                <tr key={n.name || n.id}>
                  <td>{n.name || n.id}</td>
                  <td>{n.status || '—'}</td>
                  <td>{n.image || '—'}</td>
                  <td>{(n.created_at || '').slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && (
        <>
          <div className="modal-backdrop" onClick={() => setOpen(false)} />
          <div className="nb-modal" dir="rtl">
            <div className="nb-modal-header">
              <h2>ایجاد نوت‌بوک</h2>
              <label className="field-label">نام</label>
              <input className="nb-field" type="text" placeholder="my-notebook" value={name} onChange={e => setName(e.target.value)} />
              <label className="field-label">ایمیج</label>
              <select className="nb-field" value={image} onChange={e => setImage(e.target.value)}>
                {images.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="nb-modal-scroll">
              <label className="field-label">CPU (هسته) <span className="quota-hint">({q.cpu_remaining_cores ?? 8} remaining)</span></label>
              <input className="nb-field" type="number" value={cpu} onChange={e => setCpu(e.target.value)} />
              <label className="field-label">حافظه (GiB) <span className="quota-hint">({q.memory_remaining_gib ?? 32} GiB remaining)</span></label>
              <input className="nb-field" type="number" value={mem} onChange={e => setMem(e.target.value)} />
              <label className="field-label">فضای ذخیره‌سازی Workspace</label>
              <select className="nb-field" value={ws} onChange={e => setWs(e.target.value)}>
                <option value="new">جدید</option>
                <option value="existing">موجود</option>
              </select>
              <label className="field-label">Workspace Volume Size (GiB) <span className="quota-hint">({q.storage_remaining_gib ?? 9} GiB remaining)</span></label>
              <input className="nb-field" type="number" value={wsSize} onChange={e => setWsSize(e.target.value)} />
              <label className="field-label">حالت دسترسی</label>
              <select className="nb-field" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="ReadWriteOnce">ReadWriteOnce</option>
                <option value="ReadOnlyMany">ReadOnlyMany</option>
                <option value="ReadWriteMany">ReadWriteMany</option>
              </select>
              <label className="nb-checkbox-row">
                <input type="checkbox" checked={permanent} onChange={e => setPermanent(e.target.checked)} />
                <span>ذخیره‌سازی دائمی (توصیه‌شده)</span>
              </label>
              <label className="field-label">فضاهای ذخیره‌سازی داده (اختیاری)</label>
              <button className="btn-secondary">+ افزودن فضای ذخیره‌سازی داده</button>
              <label className="field-label">GPU (اختیاری)</label>
              <p className="nb-modal-warn">در حال حاضر GPU‌ای برای فضای‌نام شما در دسترس نیست.</p>
            </div>
            <div className="nb-modal-footer">
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setOpen(false)}>انصراف</button>
                <button className="btn-primary" onClick={create} disabled={saving}>ایجاد</button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
