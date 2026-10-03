import { useState, useEffect } from 'react'
import { useApi, apiPost, apiSend, invalidate } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { ACCESS_ROLES } from '../../lib/admin/roles.js'
import { useTable, Field, Err, Modal } from './kit.jsx'

const API = '/admin-panel/api/admin/groups'

function Members({ group, onClose, onSaved }) {
  const [users, setUsers] = useState(null)
  const [checked, setChecked] = useState(new Set())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  useEffect(() => {
    Promise.all([getJson(`${API}/${group.id}/members?t=${Date.now()}`, { ttlMs: 0 }), getJson('/admin-panel/api/admin/users')]).then(([m, u]) => {
      if (m.error || u.error) { setErr((m.error || u.error).message); return }
      setChecked(new Set((m.data || []).map(x => x.id))); setUsers(u.data || [])
    })
  }, [group.id])
  const toggle = id => setChecked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const save = async () => {
    setBusy(true)
    const r = await apiSend(`${API}/${group.id}/members`, 'PUT', { user_ids: [...checked] })
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(`اعضای گروه «${group.name}» ذخیره شد`); onSaved()
  }
  const list = (users || []).filter(u => !q.trim() || `${u.username} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Modal title={`مدیریت اعضا: ${group.name}`} onClose={onClose} busy={busy}
      actions={<><button className="ak-btn" onClick={onClose}>انصراف</button><button className="ak-btn ak-primary" disabled={busy || !users} onClick={save}>ذخیره</button></>}>
      <input className="ak-search" type="search" placeholder="جستجو…" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ maxHeight: '50vh', overflow: 'auto', marginTop: 8 }}>
        {!users && !err && <p className="ak-muted">در حال بارگذاری…</p>}
        {list.map(u => <label key={u.id} className="ak-check"><input type="checkbox" checked={checked.has(u.id)} onChange={() => toggle(u.id)} /><bdi dir="ltr">{u.username} ({u.email})</bdi></label>)}
      </div>
      <Err>{err}</Err>
    </Modal>
  )
}

export default function Groups() {
  const { data, error, loading, reload } = useApi(API, [])
  const [edits, setEdits] = useState({})
  const groups = (Array.isArray(data) ? data : []).map(g => (edits[g.id] ? { ...g, access: edits[g.id] } : g))
  const t = useTable(groups, { keys: ['name'], sort: { key: 'name', dir: 'asc' } })
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [members, setMembers] = useState(null)
  const [del, setDel] = useState(null)
  const refresh = () => { invalidate(API); reload() }

  const create = async () => {
    if (!name.trim()) { setErr('نام گروه را وارد کنید'); return }
    setErr('')
    const r = await apiPost(API, { name: name.trim() })
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    setName(''); notifySuccess('گروه ساخته شد'); refresh()
  }
  const toggle = (g, role, on) => setEdits(e => ({ ...e, [g.id]: { ...(e[g.id] || g.access), [role]: on } }))
  const saveRow = async g => {
    const access = Object.keys(g.access || {}).filter(r => g.access[r])
    const r = await apiSend(`${API}/${g.id}/access`, 'PUT', { access })
    if (r.error) { notifyError(r.error.message); return }
    setEdits(e => { const n = { ...e }; delete n[g.id]; return n })
    notifySuccess(`دسترسی‌های گروه «${g.name}» ذخیره شد`); refresh()
  }
  const remove = async () => {
    const g = del; setDel(null)
    const r = await apiSend(`${API}/${g.id}`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(`گروه «${g.name}» حذف شد`); refresh()
  }

  return (
    <>
      <div className="ak-card">
        <h2>ساخت گروه جدید</h2>
        <div className="ak-row" style={{ alignItems: 'flex-end' }}>
          <Field label="نام گروه"><input className="ak-input" dir="ltr" placeholder="gpu-team" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} /></Field>
          <button className="ak-btn ak-primary" style={{ marginBottom: 12 }} onClick={create}>ساخت</button>
        </div>
        <Err>{err}</Err>
      </div>
      <div className="ak-card">
        <div className="ak-toolbar"><h2 style={{ margin: 0 }}>گروه‌ها</h2><div className="spacer" />{t.search()}</div>
        <ErrorNote error={error} />
        {loading && !error ? <p className="ak-muted">در حال بارگذاری…</p> : (
          <div className="ak-table-scroll">
            <table className="ak-table">
              <thead><tr>{t.th('name', 'نام')}{t.th('member_count', 'اعضا')}{ACCESS_ROLES.map(r => <th key={r.id} title={r.label}>{r.short}</th>)}<th /></tr></thead>
              <tbody>{t.shown.map(g => (
                <tr key={g.id}>
                  <td><bdi dir="ltr">{g.name}</bdi></td><td>{g.member_count}</td>
                  {ACCESS_ROLES.map(r => <td key={r.id}><input type="checkbox" checked={!!g.access?.[r.id]} onChange={e => toggle(g, r.id, e.target.checked)} title={r.label} /></td>)}
                  <td className="ak-actions-cell">
                    <button className={`ak-btn ${edits[g.id] ? 'ak-primary' : ''}`} onClick={() => saveRow(g)}>ذخیره</button>
                    <button className="ak-btn" onClick={() => setMembers(g)}>اعضا</button>
                    <button className="ak-btn ak-danger" onClick={() => setDel(g)}>حذف</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {t.pager}
          </div>
        )}
      </div>
      {members && <Members group={members} onClose={() => setMembers(null)} onSaved={() => { setMembers(null); refresh() }} />}
      {del && <ConfirmDialog danger title={`حذف گروه «${del.name}»؟`} confirmLabel="حذف" onCancel={() => setDel(null)} onConfirm={remove} />}
    </>
  )
}
