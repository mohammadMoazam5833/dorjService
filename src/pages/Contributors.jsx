import { useState, useEffect } from 'react'
import AppShell from '../components/AppShell.jsx'
import { apiPost, apiSend } from '../lib/api.js'
import { getJson } from '../lib/http.js'
import { notifySuccess, notifyError } from '../lib/notify.js'
import { roleBreakdown, isEmail } from '../lib/workgroup.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { Err, useTable } from './admin/kit.jsx'

// Port of the platform's manage-users view: account info, profile memberships, contributors of
// every owned profile (add/remove by email) and, for cluster admins, all profiles with owners.
const WG = '/api/workgroup'
const ROLE = { owner: 'مالک', contributor: 'همکار (ویرایش)', viewer: 'بیننده' }

function OwnedContributors({ ns }) {
  const [list, setList] = useState(null)
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState(null)
  useEffect(() => {
    getJson(`${WG}/get-contributors/${encodeURIComponent(ns)}`, { ttlMs: 0 }).then(r => (r.error ? setErr(r.error.message) : setList(r.data || [])))
  }, [ns])
  const add = async () => {
    const c = email.trim()
    if (!isEmail(c)) { setErr('آدرس ایمیل معتبر نیست'); return }
    if ((list || []).includes(c)) { setErr('این همکار از قبل عضو است'); return }
    setBusy(true); setErr('')
    const r = await apiPost(`${WG}/add-contributor/${encodeURIComponent(ns)}`, { contributor: c })
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    setList(r.data || []); setEmail(''); notifySuccess(`${c} به ${ns} اضافه شد`)
  }
  const remove = async () => {
    const c = del; setDel(null); setBusy(true)
    const r = await apiSend(`${WG}/remove-contributor/${encodeURIComponent(ns)}`, 'DELETE', { contributor: c })
    setBusy(false)
    if (r.error) { notifyError(r.error.message); return }
    setList(r.data || []); notifySuccess(`${c} از ${ns} حذف شد`)
  }
  return (
    <div className="ak-card">
      <h2>همکاران <bdi dir="ltr"><code>{ns}</code></bdi></h2>
      <p className="ak-muted">همکاران به منابع این فضای کاری (نوت‌بوک‌ها، pipelineها و…) دسترسی ویرایش دارند.</p>
      {!list && !err && <p className="ak-muted">در حال بارگذاری…</p>}
      {list && (
        <div className="ct-chips">
          {!list.length && <span className="ak-muted">هنوز همکاری اضافه نشده است.</span>}
          {list.map(c => <span key={c} className="ct-chip" dir="ltr">{c}<button title="حذف" disabled={busy} onClick={() => setDel(c)}>×</button></span>)}
        </div>
      )}
      <div className="ak-toolbar" style={{ marginTop: 12 }}>
        <input className="ak-input" dir="ltr" type="email" style={{ flex: 1, maxWidth: 360 }} placeholder="email@example.com" value={email}
          onChange={e => { setEmail(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="ak-btn ak-primary" onClick={add} disabled={busy || !email.trim()}>افزودن همکار</button>
      </div>
      <Err>{err}</Err>
      {del && <ConfirmDialog danger title={`حذف ${del} از همکاران ${ns}؟`} confirmLabel="حذف" onCancel={() => setDel(null)} onConfirm={remove} />}
    </div>
  )
}

function AllProfiles() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { getJson(`${WG}/get-all-namespaces`).then(r => (r.error ? setErr(r.error.message) : setRows((r.data || []).map(([namespace, owner, contributors]) => ({ namespace, owner, contributors }))))) }, [])
  const t = useTable(rows || [], { keys: ['namespace', 'owner', 'contributors'], sort: { key: 'namespace', dir: 'asc' } })
  return (
    <div className="ak-card">
      <h2>نمای کلی پروفایل‌ها (مدیر خوشه)</h2>
      <Err>{err}</Err>
      {!rows && !err ? <p className="ak-muted">در حال بارگذاری…</p> : <>
        <div className="ak-toolbar">{t.search()}</div>
        <div className="ak-table-scroll"><table className="ak-table" dir="ltr"><thead><tr>{t.th('namespace', 'Namespace')}{t.th('owner', 'Owner')}{t.th('contributors', 'Contributors')}</tr></thead>
          <tbody>{t.shown.map(r => <tr key={r.namespace}><td>{r.namespace}</td><td>{r.owner || '—'}</td><td className="sec-wrap">{r.contributors || '—'}</td></tr>)}</tbody></table></div>
        {t.pager}
      </>}
    </div>
  )
}

export default function Contributors() {
  const [env, setEnv] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { getJson(`${WG}/env-info`, { ttlMs: 0 }).then(r => (r.error ? setErr(r.error.message) : setEnv(r.data))) }, [])
  const groups = roleBreakdown(env?.namespaces)
  const owned = (env?.namespaces || []).filter(n => n.role === 'owner').map(n => n.namespace)
  return (
    <AppShell active="مدیریت همکاران">
      <div className="ak-card">
        <h2>اطلاعات حساب</h2>
        <Err>{err}</Err>
        {!env && !err && <p className="ak-muted">در حال بارگذاری…</p>}
        {env && <>
          <p className="ak-kv"><b>کاربر:</b><bdi dir="ltr">{env.user}</bdi>{env.isClusterAdmin && <span className="ak-pill warn">مدیر خوشه</span>}</p>
          <h3>عضویت در پروفایل‌ها</h3>
          {!groups.length ? <p className="ak-muted">شما عضو هیچ فضای کاری‌ای نیستید.</p> : (
            <table className="ak-table"><thead><tr><th>نقش شما</th><th>فضاهای کاری</th></tr></thead>
              <tbody>{groups.map(g => <tr key={g.role}><td>{ROLE[g.role]}</td><td dir="ltr">{g.namespaces.join(', ')}</td></tr>)}</tbody></table>
          )}
        </>}
      </div>
      {owned.map(ns => <OwnedContributors key={ns} ns={ns} />)}
      {env?.isClusterAdmin && <AllProfiles />}
    </AppShell>
  )
}
