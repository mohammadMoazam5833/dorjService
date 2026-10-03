import { useState, useEffect } from 'react'
import { apiSend, apiPost } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { ACCESS_ROLES } from '../../lib/admin/roles.js'
import { UNIT_FLAGS, budgetBars, specFromForm } from '../../lib/admin/units.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { Field, Err, Modal, useTable } from './kit.jsx'

// Port of the platform's admin Units tab (super admins): organisational units with a resource
// budget, unit admins, delegated permissions, and user/profile membership.
const API = '/admin-panel/api/admin/units'

export const unitLabel = u => (u ? (u.displayName?.fa || u.displayName?.en || u.name) : '')

export function Bars({ u }) {
  return budgetBars(u).map(b => (
    <div key={b.key} className="unit-bar-row">
      <span className="unit-bar-key" dir="ltr">{b.key}</span>
      <div className="unit-bar"><div className={`unit-bar-fill ${b.warn ? 'warn' : ''}`} style={{ width: `${b.pct}%` }} /></div>
      <span className="unit-bar-val" dir="ltr">{b.text}</span>
    </div>
  ))
}

function UnitForm({ unit, onClose, onSaved }) {
  const isNew = !unit
  const b = unit?.budget || {}
  const [f, setF] = useState(() => ({
    name: unit?.name || '', fa: unit?.displayName?.fa || '', en: unit?.displayName?.en || '', admins: (unit?.admins || []).join(', '),
    cpu: b.cpu || '', memory: b.memory || '', storage: b.storage || '',
    gpus: Object.keys(b).filter(k => k.startsWith('nvidia.com/')).map(k => `${k}=${b[k]}`).join('\n'),
    permissions: { ...(unit?.permissions || {}) }, roles: [...(unit?.allowedAccessRoles || [])], models: [...(unit?.allowedModels || [])],
  }))
  const [users, setUsers] = useState([])
  const [models, setModels] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getJson('/admin-panel/api/admin/users').then(r => setUsers(r.data || []))
    getJson('/admin-panel/api/admin/litellm-keys/available-models').then(r => setModels([...new Set((r.data || []).flatMap(g => g.names || []))].sort()))
  }, [])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const toggle = (list, id, on) => set(list, on ? [...f[list].filter(x => x !== id), id] : f[list].filter(x => x !== id))
  const save = async () => {
    setErr('')
    let spec
    try { spec = specFromForm(f) } catch (e) { setErr(e.message); return }
    if (isNew && !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(f.name.trim())) { setErr('شناسه‌ی واحد باید با حروف کوچک لاتین، عدد و خط تیره باشد'); return }
    setBusy(true)
    const r = isNew ? await apiPost(API, { name: f.name.trim(), spec }) : await apiSend(`${API}/${encodeURIComponent(f.name)}`, 'PUT', { spec })
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(isNew ? 'واحد ساخته شد' : 'واحد به‌روز شد'); onSaved()
  }
  return (
    <Modal wide busy={busy} title={isNew ? 'واحد جدید' : `ویرایش ${unitLabel(unit)}`} onClose={onClose}
      actions={<><button className="ak-btn" onClick={onClose} disabled={busy}>انصراف</button><button className="ak-btn ak-primary" onClick={save} disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button></>}>
      <div className="ak-row">
        <Field label="شناسه‌ی واحد"><input className="ak-input" dir="ltr" value={f.name} disabled={!isNew} placeholder="ai-lab" onChange={e => set('name', e.target.value)} /></Field>
        <Field label="نام نمایشی (فارسی)"><input className="ak-input" dir="auto" value={f.fa} onChange={e => set('fa', e.target.value)} /></Field>
        <Field label="نام نمایشی (انگلیسی)"><input className="ak-input" dir="ltr" value={f.en} onChange={e => set('en', e.target.value)} /></Field>
      </div>
      <Field label="مدیران واحد (نام‌های کاربری، جدا با کاما)">
        <input className="ak-input" dir="ltr" list="unit-user-list" value={f.admins} placeholder="ali.r, sara.k" onChange={e => set('admins', e.target.value)} />
        <datalist id="unit-user-list">{users.map(u => <option key={u.id} value={u.username}>{u.email}</option>)}</datalist>
      </Field>
      <h3>بودجه</h3>
      <div className="ak-row">
        <Field label="CPU (هسته)"><input className="ak-input" dir="ltr" value={f.cpu} placeholder="64" onChange={e => set('cpu', e.target.value)} /></Field>
        <Field label="حافظه"><input className="ak-input" dir="ltr" value={f.memory} placeholder="256Gi" onChange={e => set('memory', e.target.value)} /></Field>
        <Field label="فضای ذخیره‌سازی"><input className="ak-input" dir="ltr" value={f.storage} placeholder="2Ti" onChange={e => set('storage', e.target.value)} /></Field>
      </div>
      <Field label="GPU / MIG (هر خط: key=count)"><textarea className="ak-textarea" dir="ltr" rows={3} style={{ minHeight: 70 }} value={f.gpus} placeholder="nvidia.com/gpu=4" onChange={e => set('gpus', e.target.value)} /></Field>
      <h3>مجوزها</h3>
      {UNIT_FLAGS.map(x => <label key={x.id} className="ak-check"><input type="checkbox" checked={!!f.permissions[x.id]} onChange={e => set('permissions', { ...f.permissions, [x.id]: e.target.checked })} />{x.label}</label>)}
      <h3>نقش‌های دسترسی که این واحد می‌تواند بدهد</h3>
      <div className="ak-checks">{ACCESS_ROLES.map(r => <label key={r.id} className="ak-check"><input type="checkbox" checked={f.roles.includes(r.id)} onChange={e => toggle('roles', r.id, e.target.checked)} />{r.label}</label>)}</div>
      <h3>مدل‌هایی که این واحد می‌تواند برایشان کلید صادر کند</h3>
      <div className="ak-checks">{models.map(m => <label key={m} className="ak-check" dir="ltr"><input type="checkbox" checked={f.models.includes(m)} onChange={e => toggle('models', m, e.target.checked)} />{m}</label>)}</div>
      <Err>{err}</Err>
    </Modal>
  )
}

function Members({ unit, onClose, onSaved }) {
  const [users, setUsers] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    Promise.all([getJson('/admin-panel/api/admin/users', { ttlMs: 0 }), getJson('/admin-panel/api/admin/profiles', { ttlMs: 0 })]).then(([u, p]) => {
      if (u.error || p.error) { setErr((u.error || p.error).message); return }
      const inUnit = new Set(unit.member_ids || [])
      setUsers((u.data || []).map(x => ({ id: x.id, label: `${x.username} (${x.email || ''})`, checked: inUnit.has(x.id), was: inUnit.has(x.id) })))
      setProfiles((p.data || []).filter(x => !x.unit || x.unit === unit.name).map(x => ({ id: x.name, label: x.name, checked: x.unit === unit.name, was: x.unit === unit.name })))
    })
  }, [unit.name])
  const flip = (setter, id, on) => setter(list => list.map(m => (m.id === id ? { ...m, checked: on } : m)))
  const save = async () => {
    const pick = (l, fn) => l.filter(fn).map(m => m.id)
    const add = { users: pick(users, m => m.checked && !m.was), profiles: pick(profiles, m => m.checked && !m.was) }
    const rem = { users: pick(users, m => !m.checked && m.was), profiles: pick(profiles, m => !m.checked && m.was) }
    if (!add.users.length && !add.profiles.length && !rem.users.length && !rem.profiles.length) { notifySuccess('تغییری برای ذخیره نیست'); onClose(); return }
    setBusy(true); setErr('')
    let r = { error: null }
    if (add.users.length || add.profiles.length) r = await apiPost(`${API}/${encodeURIComponent(unit.name)}/members`, add)
    if (!r.error && (rem.users.length || rem.profiles.length)) r = await apiPost(`${API}/-/members`, rem)
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess('اعضا ذخیره شدند'); onSaved()
  }
  const filt = l => l.filter(m => !q || m.label.toLowerCase().includes(q.toLowerCase()))
  const col = (title, list, setter) => (
    <div><h3>{title}</h3><div className="unit-members-list">{filt(list).map(m => <label key={m.id} className="ak-check" dir="ltr"><input type="checkbox" checked={m.checked} onChange={e => flip(setter, m.id, e.target.checked)} />{m.label}</label>)}</div></div>
  )
  return (
    <Modal wide busy={busy} title={`اعضای ${unitLabel(unit)}`} onClose={onClose}
      actions={<><button className="ak-btn" onClick={onClose} disabled={busy}>انصراف</button><button className="ak-btn ak-primary" onClick={save} disabled={busy || !users}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button></>}>
      <p className="ak-muted">موارد تیک‌خورده به این واحد منتقل می‌شوند. یک پروفایل فقط وقتی منتقل می‌شود که بودجه‌ی واحد گنجایش سهمیه‌ی آن را داشته باشد.</p>
      <input className="ak-search" type="search" placeholder="جستجو…" value={q} onChange={e => setQ(e.target.value)} />
      {!users && !err ? <p className="ak-muted">در حال بارگذاری…</p> : <div className="unit-members-cols">{col('کاربران', users || [], setUsers)}{col('پروفایل‌ها', profiles, setProfiles)}</div>}
      <Err>{err}</Err>
    </Modal>
  )
}

export default function Units() {
  const [units, setUnits] = useState(null)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(null)
  const [members, setMembers] = useState(null)
  const [del, setDel] = useState(null)
  const load = async () => { const r = await getJson(`${API}?t=${Date.now()}`, { ttlMs: 0 }); if (r.error) setErr(r.error.message); else setUnits(r.data || []) }
  useEffect(() => { load() }, [])
  const t = useTable(units || [], { keys: ['name', unitLabel, u => (u.admins || []).join(' ')], sort: { key: 'name', dir: 'asc', get: unitLabel } })
  const remove = async () => {
    const u = del; setDel(null)
    const r = await apiSend(`${API}/${encodeURIComponent(u.name)}`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('واحد حذف شد'); load()
  }
  return (
    <div className="ak-card">
      <div className="ak-toolbar"><h2 style={{ margin: 0 }}>واحدها</h2><div className="spacer" /><button className="ak-btn ak-primary" onClick={() => setForm({})}>+ واحد جدید</button></div>
      <Err>{err}</Err>
      {!units && !err && <p className="ak-muted">در حال بارگذاری…</p>}
      {units && <>
        <div className="ak-toolbar">{t.search()}</div>
        <div className="ak-table-scroll">
          <table className="ak-table"><thead><tr>{t.th('name', 'نام', unitLabel)}<th>مدیران</th>{t.th('users', 'کاربران', u => Number(u.status?.users || 0))}{t.th('profiles', 'پروفایل‌ها', u => Number(u.status?.profiles || 0))}<th>مصرف بودجه</th><th /></tr></thead>
            <tbody>{t.shown.map(u => (
              <tr key={u.name}>
                <td><b>{unitLabel(u)}</b><div className="ak-muted" dir="ltr">{u.name}</div></td>
                <td dir="ltr">{(u.admins || []).join(', ') || '—'}</td>
                <td>{u.status?.users ?? '—'}</td><td>{u.status?.profiles ?? '—'}</td>
                <td style={{ minWidth: 280 }}><Bars u={u} /></td>
                <td className="ak-actions-cell">
                  <button className="ak-btn" onClick={() => setForm({ unit: u })}>ویرایش</button>
                  <button className="ak-btn" onClick={() => setMembers(u)}>اعضا</button>
                  <button className="ak-btn ak-danger" onClick={() => setDel(u)}>حذف</button>
                </td>
              </tr>))}</tbody></table>
        </div>
        {t.pager}
      </>}
      {form && <UnitForm unit={form.unit} onClose={() => setForm(null)} onSaved={() => { setForm(null); load() }} />}
      {members && <Members unit={members} onClose={() => setMembers(null)} onSaved={() => { setMembers(null); load() }} />}
      {del && <ConfirmDialog danger typeToConfirm={del.name} title={`حذف واحد «${unitLabel(del)}»؟`} body="فقط واحد خالی حذف می‌شود؛ اگر کاربر یا پروفایلی در آن باشد، اول باید از بخش اعضا خارجشان کنید." confirmLabel="حذف" onCancel={() => setDel(null)} onConfirm={remove} />}
    </div>
  )
}
