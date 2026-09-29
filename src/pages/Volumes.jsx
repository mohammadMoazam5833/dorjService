import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi, apiPost } from '../lib/api.js'
import { faNum } from '../lib/format.js'

export default function Volumes() {
  const { data } = useApi('/api/volumes', [])
  const { data: q } = useApi('/api/volumes/quota')
  const [open, setOpen] = useState(() => window.location.hash.includes('?new=1'))
  const [name, setName] = useState('')
  const [size, setSize] = useState('5')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState('')
  const list = (Array.isArray(data) ? data : []).filter(v => !query || (v.name || '').toLowerCase().includes(query.toLowerCase()))
  const per = 10
  const pages = Math.max(1, Math.ceil(list.length / per))
  const shown = list.slice(page * per, page * per + per)

  const browse = v => {
    if (v.viewer_url) window.open(v.viewer_url, '_blank')
    else {
      setToast(`مرور فایل‌ها برای «${v.name}» در دسترس نیست — این فضا mount نشده است.`)
      setTimeout(() => setToast(''), 3500)
    }
  }

  const create = async () => {
    setSaving(true)
    await apiPost('/api/volumes', { name, size_gib: Number(size) })
    setSaving(false)
    setOpen(false)
    window.location.reload()
  }

  return (
    <AppShell active="فضاهای ذخیره‌سازی">
      <div className="nb-page-title">
        <h1>فضاهای ذخیره‌سازی</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>ایجاد فضای ذخیره‌سازی</button>
      </div>
      <div className="vw-content">
        <div className="vw-toolbar">
          <input className="vw-search" type="search" placeholder="Search..." value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
          <div className="vw-pagination">
            <button className="vw-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))}>&lt;</button>
            <span className="vw-page-label">{page + 1} / {pages}</span>
            <button className="vw-page-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>&gt;</button>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="vw-empty">هیچ فضای ذخیره‌سازی‌ای در این Namespace وجود ندارد.</p>
        ) : (
          <table className="vw-table">
            <thead>
              <tr>
                <th>نام</th><th>حجم</th><th>وضعیت</th><th>استفاده‌شده توسط</th><th>تغییر اندازه خودکار</th><th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(v => (
                <tr key={v.name}>
                  <td>{v.name}</td>
                  <td>{v.used_gib == null ? <span className="vw-usage-nodata">در حال حاضر mount نشده - داده‌ی زنده‌ای در دسترس نیست</span> : `${faNum(v.used_gib)} / ${v.size}`}</td>
                  <td><span className={`vw-pill ${(v.status || '').toLowerCase()}`}>{v.status}</span></td>
                  <td><span className="vw-pill attached">{v.shared ? 'مشترک / فقط‌خواندنی' : v.in_use_by || '—'}</span></td>
                  <td>{v.autoresize_enabled ? 'روشن' : ''}</td>
                  <td className="vw-actions"><span onClick={() => browse(v)}>مرور فایل‌ها</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {toast && <div className="app-toast">{toast}</div>}
      {open && (
        <>
          <div className="modal-backdrop" onClick={() => setOpen(false)} />
          <div className="vw-modal" dir="rtl">
            <h2>ایجاد فضای ذخیره‌سازی</h2>
            <label className="field-label">نام</label>
            <input className="vw-field" type="text" placeholder="my-volume" value={name} onChange={e => setName(e.target.value)} />
            <p className="vw-field-hint">فقط حروف کوچک انگلیسی، رقم و خط تیره</p>
            <label className="field-label">Size (GiB) <span className="quota-hint">({q?.quota?.storage_remaining_gib ?? 9} GiB remaining)</span></label>
            <input className="vw-field" type="number" value={size} onChange={e => setSize(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setOpen(false)}>انصراف</button>
              <button className="btn-primary" onClick={create} disabled={saving}>ایجاد</button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}

export function Vms() {
  const { data: en } = useApi('/api/vms/enabled')
  const { data } = useApi('/api/vms', [])
  const list = Array.isArray(data) ? data : []
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const shown = list.filter(v => !query || (v.name || v.id || '').toLowerCase().includes(query.toLowerCase()))
  const per = 10
  const pages = Math.max(1, Math.ceil(shown.length / per))
  return (
    <AppShell active="فضاهای ذخیره‌سازی">
      <div className="nb-page-title"><h1>ماشین‌های مجازی</h1></div>
      <div className="vw-content">
        {en && en.enabled === false && <p className="vw-empty">سرویس ماشین مجازی در حال حاضر در پلتفرم غیرفعال است.</p>}
        <div className="vm-toolbar">
          <input className="vm-search" type="search" placeholder="Search..." value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
          <div className="vm-pagination">
            <button className="vm-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))}>‹</button>
            <span className="vm-page-label">{page + 1} / {pages}</span>
            <button className="vm-page-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>›</button>
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="vm-empty">هنوز ماشین مجازی‌ای در این Namespace وجود ندارد.</p>
        ) : (
          <table className="vw-table">
            <thead><tr><th>نام</th><th>وضعیت</th><th>CPU</th><th>حافظه</th><th>IP</th><th>ایجاد</th></tr></thead>
            <tbody>
              {shown.slice(page * per, page * per + per).map(v => (
                <tr key={v.name || v.id}>
                  <td>{v.name || v.id}</td>
                  <td>{v.status || '—'}</td>
                  <td>{v.cpu || '—'}</td>
                  <td>{v.memory || '—'}</td>
                  <td>{v.ip || '—'}</td>
                  <td>{(v.created_at || '').slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  )
}
