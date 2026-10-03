import { useState, useEffect } from 'react'
import { apiPost } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { Field, Err, Modal, useTable } from './kit.jsx'

const B = '/admin-panel/api/admin'
const fresh = p => getJson(`${p}?t=${Date.now()}`, { ttlMs: 0 }).then(r => r.data)
const SUBS = [['issue', 'صدور کلید LLM'], ['keys', 'کلیدهای LLM'], ['port-exposure', 'درخواست‌های انتشار سرویس']]
const STATUS = { active: 'فعال', revoked: 'باطل‌شده', expired: 'منقضی', pending: 'در انتظار', approved: 'تأییدشده', rejected: 'ردشده' }

// One row per real model (aliases bundled in `names`); none checked = all models.
function ModelChecks({ rows, setRows }) {
  return (
    <div className="ak-checks">
      {rows.map((r, i) => (
        <label key={r.display_name + i} className="ak-check">
          <input type="checkbox" checked={!!r.checked} onChange={() => setRows(rows.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))} />
          <span className="ak-pill">{r.family_label}</span><bdi dir="ltr">{r.display_name}</bdi>
        </label>
      ))}
    </div>
  )
}

function Issue({ models }) {
  const [users, setUsers] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [nsOpts, setNsOpts] = useState([])
  const [ns, setNs] = useState('')
  const [days, setDays] = useState('0')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  useEffect(() => { setRows(models.map(m => ({ ...m, checked: false }))) }, [models])
  const ensure = async () => {
    if (users) return users
    const [u, p] = await Promise.all([fresh(`${B}/users`), fresh(`${B}/profiles`)])
    setUsers(u || []); setProfiles(p || []); return u || []
  }
  const onQ = async v => {
    setQ(v)
    if (v.trim().length < 2) { setOpen(false); return }
    await ensure(); setOpen(true)
  }
  const ql = q.trim().toLowerCase()
  const sugg = (users || []).filter(u => (u.email || '').toLowerCase().includes(ql) || (u.username || '').toLowerCase().includes(ql) || `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(ql)).slice(0, 8)
  const pick = u => {
    setQ(u.email || u.username || ''); setEmail(u.email || ''); setOpen(false)
    const opts = profiles.filter(p => p.owner === u.email).map(p => p.name)
    setNsOpts(opts); setNs(opts[0] || '')
  }
  const issue = async () => {
    setErr(''); setInfo('')
    if (!email || !ns) { setErr('ابتدا کاربر (و Namespace) را انتخاب کنید'); return }
    setBusy(true)
    const r = await apiPost(`${B}/litellm-keys`, { email, namespace: ns, expires_days: days, models: rows.filter(x => x.checked).flatMap(x => x.names) })
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    const msg = r.data?.emailed ? `کلید LLM صادر و برای ${r.data.email} ایمیل شد` : `کلید LLM برای ${r.data?.email} صادر شد (ارسال ایمیل ناموفق بود)`
    setInfo(msg); notifySuccess(msg)
    setEmail(''); setNs(''); setNsOpts([]); setQ(''); setRows(models.map(m => ({ ...m, checked: false })))
  }
  return (
    <div className="ak-card">
      <h2>صدور کلید API مدل زبانی</h2>
      <p className="ak-muted">API اصلی مدل‌های زبانی پلتفرم (llm-api.isigpu.local).</p>
      <div className="ak-row">
        <Field label="کاربر (جستجو با نام، ایمیل یا نام کاربری)">
          <div style={{ position: 'relative' }}>
            <input className="ak-input" style={{ width: '100%' }} value={q} onChange={e => onQ(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 150)} autoComplete="off" />
            {open && sugg.length > 0 && (
              <div className="ak-suggest">{sugg.map(u => (
                <div key={u.id} onMouseDown={() => pick(u)}><bdi dir="ltr">{u.email || '—'}</bdi>
                  <div className="ak-muted"><bdi dir="ltr">{u.username}</bdi>{u.first_name || u.last_name ? ` — ${`${u.first_name || ''} ${u.last_name || ''}`.trim()}` : ''}</div></div>
              ))}</div>
            )}
          </div>
        </Field>
        <Field label="Namespace"><select className="ak-select" dir="ltr" value={ns} disabled={!nsOpts.length} onChange={e => setNs(e.target.value)}>{nsOpts.map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
        <Field label="انقضا (روز، ۰ = بدون انقضا)"><input className="ak-input" type="number" min="0" value={days} onChange={e => setDays(e.target.value)} /></Field>
      </div>
      <Field label="محدود کردن به مدل‌های مشخص (هیچ‌کدام = دسترسی کامل)"><ModelChecks rows={rows} setRows={setRows} /></Field>
      <Err>{err}</Err>
      {info && <p className="ak-muted">{info}</p>}
      <button className="ak-btn ak-primary" disabled={busy} onClick={issue}>{busy ? 'در حال صدور…' : 'ساخت و ارسال کلید'}</button>
    </div>
  )
}

function Keys({ models }) {
  const [keys, setKeys] = useState(null)
  const load = () => fresh(`${B}/litellm-keys`).then(k => setKeys(k || []))
  useEffect(() => { load() }, [])
  const t = useTable(keys || [], { keys: ['email', 'key_alias', 'status'], sort: { key: 'created_at', dir: 'desc' } })
  const [edit, setEdit] = useState(null)
  const [rows, setRows] = useState([])
  const [revoke, setRevoke] = useState(null)
  const [busy, setBusy] = useState(false)
  const openEdit = k => { const cur = new Set(k.models || []); setRows(models.map(m => ({ ...m, checked: m.names.some(n => cur.has(n)) }))); setEdit(k) }
  const saveEdit = async () => {
    setBusy(true)
    const r = await apiPost(`${B}/litellm-keys/${edit.token}/models`, { models: rows.filter(x => x.checked).flatMap(x => x.names) })
    setBusy(false)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('دسترسی مدل‌های کلید به‌روز شد'); setEdit(null); load()
  }
  const doRevoke = async () => {
    const k = revoke; setRevoke(null)
    const r = await apiPost(`${B}/litellm-keys/${k.token}/revoke`, {})
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('کلید باطل شد'); load()
  }
  return (
    <div className="ak-card">
      <div className="ak-toolbar"><h2 style={{ margin: 0 }}>کلیدهای صادرشده‌ی LLM</h2><div className="spacer" />{t.search()}</div>
      {!keys ? <p className="ak-muted">در حال بارگذاری…</p> : (
        <div className="ak-table-scroll">
          <table className="ak-table"><thead><tr>{t.th('email', 'ایمیل')}{t.th('key_alias', 'نام کلید')}{t.th('created_at', 'ایجاد')}{t.th('expires_at', 'انقضا')}<th>مدل‌ها</th>{t.th('status', 'وضعیت')}<th /></tr></thead>
            <tbody>{t.shown.map(k => (
              <tr key={k.token}>
                <td><bdi dir="ltr">{k.email || '—'}</bdi></td><td dir="ltr">{k.key_alias || '—'}</td>
                <td>{(k.created_at || '').slice(0, 10)}</td><td>{(k.expires_at || '').slice(0, 10) || '—'}</td>
                <td dir="ltr">{k.models?.length ? k.models.join(', ') : 'همه‌ی مدل‌ها'}</td><td>{STATUS[k.status] || k.status}</td>
                <td className="ak-actions-cell">{k.status === 'active' && <><button className="ak-btn" onClick={() => openEdit(k)}>ویرایش دسترسی</button><button className="ak-btn ak-danger" onClick={() => setRevoke(k)}>ابطال</button></>}</td>
              </tr>
            ))}</tbody></table>
          {t.pager}
        </div>
      )}
      {edit && (
        <Modal title="ویرایش دسترسی مدل‌ها" onClose={() => setEdit(null)} busy={busy}
          actions={<><button className="ak-btn" onClick={() => setEdit(null)}>انصراف</button><button className="ak-btn ak-primary" disabled={busy} onClick={saveEdit}>ذخیره</button></>}>
          <p className="ak-muted">اگر هیچ مدلی انتخاب نشود، همه‌ی مدل‌ها مجازند.</p>
          <ModelChecks rows={rows} setRows={setRows} />
        </Modal>
      )}
      {revoke && <ConfirmDialog danger title={`ابطال کلید ${revoke.key_alias || ''}؟`} body="برنامه‌هایی که از این کلید استفاده می‌کنند بلافاصله قطع می‌شوند." confirmLabel="ابطال" onCancel={() => setRevoke(null)} onConfirm={doRevoke} />}
    </div>
  )
}

function PortExposure() {
  const [items, setItems] = useState(null)
  const load = () => fresh(`${B}/port-exposure-requests`).then(x => setItems(x || []))
  useEffect(() => { load() }, [])
  const t = useTable(items || [], { keys: ['namespace', 'service_name', 'requested_by'], sort: { key: 'namespace', dir: 'asc' } })
  const [confirm, setConfirm] = useState(null)
  const act = async (r, verb) => {
    setConfirm(null)
    const res = await apiPost(`${B}/port-exposure-requests/${r.id}/${verb}`, {})
    if (res.error) { notifyError(res.error.message); return }
    notifySuccess(verb === 'approve' ? 'درخواست انتشار سرویس تأیید شد' : 'درخواست انتشار سرویس رد شد'); load()
  }
  return (
    <div className="ak-card">
      <div className="ak-toolbar"><h2 style={{ margin: 0 }}>درخواست‌های انتشار سرویس</h2><div className="spacer" />{t.search()}</div>
      <p className="ak-muted">تأیید، همان سرویس/پورت را زیر یک مسیر تصادفی و غیرقابل‌حدس روی همین دامنه (پورت ۴۴۳) منتشر می‌کند.</p>
      {!items ? <p className="ak-muted">در حال بارگذاری…</p> : (
        <div className="ak-table-scroll">
          <table className="ak-table"><thead><tr>{t.th('namespace', 'Namespace')}{t.th('service_name', 'سرویس')}{t.th('requested_by', 'درخواست‌دهنده')}{t.th('status', 'وضعیت')}<th>آدرس</th><th /></tr></thead>
            <tbody>{t.shown.map(r => (
              <tr key={r.id}>
                <td dir="ltr">{r.namespace}</td><td dir="ltr">{r.service_name}{r.service_port ? `:${r.service_port}` : ''}</td><td dir="ltr">{r.requested_by}</td>
                <td>{STATUS[r.status] || r.status}</td><td dir="ltr">{r.exposed_path || '—'}</td>
                <td className="ak-actions-cell">{r.status === 'pending' && <><button className="ak-btn ak-primary" onClick={() => setConfirm({ r, verb: 'approve' })}>تأیید</button><button className="ak-btn ak-danger" onClick={() => setConfirm({ r, verb: 'reject' })}>رد</button></>}</td>
              </tr>
            ))}</tbody></table>
          {t.pager}
        </div>
      )}
      {confirm && <ConfirmDialog danger={confirm.verb === 'reject'} title={confirm.verb === 'approve' ? 'تأیید انتشار سرویس؟' : 'رد درخواست انتشار سرویس؟'}
        body={<bdi dir="ltr">{confirm.r.namespace}/{confirm.r.service_name}</bdi>} confirmLabel={confirm.verb === 'approve' ? 'تأیید' : 'رد'}
        onCancel={() => setConfirm(null)} onConfirm={() => act(confirm.r, confirm.verb)} />}
    </div>
  )
}

export default function Requests() {
  const [sub, setSub] = useState('issue')
  const [models, setModels] = useState([])
  useEffect(() => { fresh(`${B}/litellm-keys/available-models`).then(m => setModels(m || [])) }, [])
  return (
    <>
      <nav className="ak-tabs">{SUBS.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>
      {sub === 'issue' && <Issue models={models} />}
      {sub === 'keys' && <Keys models={models} />}
      {sub === 'port-exposure' && <PortExposure />}
    </>
  )
}
