import { useState } from 'react'
import Tabs from '../../components/Tabs.jsx'
import Card, { Hint } from '../../components/Card.jsx'
import Table, { Cell } from '../../components/Table.jsx'
import Search from '../../components/Search.jsx'
import Button from '../../components/Button.jsx'
import { useApi, apiPost } from '../../lib/api.js'
import { quotaCell, gpuCell } from '../../lib/format.js'

export default function Profiles() {
  const [sub, setSub] = useState(0)
  const { data } = useApi('/admin-panel/api/admin/profiles', [])
  const all = Array.isArray(data) ? data : []
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [edit, setEdit] = useState(null)
  const [cpu, setCpu] = useState('')
  const [mem, setMem] = useState('')
  const [sto, setSto] = useState('')
  const [tier, setTier] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const list = all.filter(p => !query || ((p.name || '') + (p.owner || '')).toLowerCase().includes(query.toLowerCase()))
  const per = 10
  const pages = Math.max(1, Math.ceil(list.length / per))
  const shown = list.slice(page * per, page * per + per)

  const openEdit = p => {
    setEdit(p)
    const h = p.resource_quota?.hard || {}
    setCpu(String(h['limits.cpu'] ?? h.cpu ?? ''))
    setMem(String(h['limits.memory'] ?? h.memory ?? ''))
    setSto(String(h['requests.storage'] ?? h.storage ?? ''))
    setTier(p.tier || '')
  }
  const save = async () => {
    setSaving(true)
    await apiPost('/admin-panel/api/admin/profiles', { name: edit?.name, tier, quota: { cpu, memory: mem, storage: sto } })
    setSaving(false)
    setEdit(null)
    setToast('تغییرات پروفایل «' + (edit?.name || '') + '» ذخیره شد.')
    setTimeout(() => setToast(''), 3500)
  }

  return (
    <>
      <Tabs tabs={[`پروفایل‌ها (${all.length})`, 'SLA', 'بازراه‌اندازی‌های SLA']} active={sub} onSelect={setSub} />
      {sub === 0 && (
        <Card>
          <h2>مدیریت پروفایل‌ها</h2>
          <Search value={query} onChange={v => { setQuery(v); setPage(0) }} />
          <Table
            cols={[Cell('نام', 'r'), Cell('مالک', 'r'), Cell('CPU'), Cell('Memory'), Cell('فضای ذخیره‌سازی'), Cell('GPU'), Cell('سطح SLA'), Cell('ایجاد شده'), Cell('')]}
            rows={shown.map(p => [
              p.name, p.owner,
              quotaCell(p.resource_quota?.hard, 'cpu'),
              quotaCell(p.resource_quota?.hard, 'memory'),
              quotaCell(p.resource_quota?.hard, 'storage'),
              gpuCell(p.resource_quota?.hard),
              p.tier || '-',
              (p.created_at || '-').slice(0, 10),
              { jsx: <Button variant="ghost" onClick={() => openEdit(p)}>ویرایش</Button> },
            ])} />
          <div className="ap-pager">
            <button className="ap-btn ap-btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))} aria-label="صفحه قبل">‹</button>
            <span className="ap-pager-label">{page + 1} / {pages}</span>
            <button className="ap-btn ap-btn-ghost" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} aria-label="صفحه بعد">›</button>
          </div>
        </Card>
      )}
      {sub === 1 && <SlaNodes />}
      {sub === 2 && <SlaRestarts />}
      {toast && <div className="app-toast">{toast}</div>}
      {edit && (
        <>
          <div className="modal-backdrop" onClick={() => setEdit(null)} />
          <div className="vw-modal" dir="rtl">
            <h2>ویرایش پروفایل: {edit.name}</h2>
            <label className="field-label">مالک</label>
            <input className="vw-field" value={edit.owner || ''} readOnly />
            <label className="field-label">CPU (هسته)</label>
            <input className="vw-field" type="number" value={cpu} onChange={e => setCpu(e.target.value)} />
            <label className="field-label">حافظه (GiB)</label>
            <input className="vw-field" type="number" value={mem} onChange={e => setMem(e.target.value)} />
            <label className="field-label">فضای ذخیره‌سازی (GiB)</label>
            <input className="vw-field" type="number" value={sto} onChange={e => setSto(e.target.value)} />
            <label className="field-label">سطح SLA</label>
            <input className="vw-field" value={tier} onChange={e => setTier(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button>
              <button className="btn-primary" onClick={save} disabled={saving}>ذخیره</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function SlaNodes() {
  const { data } = useApi('/admin-panel/api/admin/sla-nodes', [])
  const list = Array.isArray(data) ? data : []
  const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
  return (
    <Card title="نودهای SLA">
      {list.map(n => (
        <div key={n.name} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <b>{n.name}</b>
            <div className="hint">{fa(n.memory_capacity_gib)} GiB · {fa(n.cpu_capacity_cores)} هسته · {fa(n.pod_count)} پاد — {n.gpu_summary}</div>
          </div>
          <span className="badge badge-success">{n.reserved_for ? 'رزرو شده' : 'آزاد'}</span>
        </div>
      ))}
    </Card>
  )
}

export function SlaRestarts() {
  return <Card title="ری‌استارت‌های SLA (۷ روز آینده)"><Hint>هیچ ری‌استارت SLA در انتظاری وجود ندارد.</Hint></Card>
}
