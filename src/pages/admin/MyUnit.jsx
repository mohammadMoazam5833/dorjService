import { useState, useEffect } from 'react'
import { getJson } from '../../lib/http.js'
import { budgetBars } from '../../lib/admin/units.js'
import { Err, Pill, useTable } from './kit.jsx'
import { unitLabel } from './Units.jsx'
import { Loading } from '../../components/Spinner.jsx'

// Port of the platform's "My unit" tab: the units the signed-in admin manages (every unit for a
// super admin), with budget/allocated/used/remaining cards and the unit's users and profiles.
const quota = rq => Object.entries(rq?.hard || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'

export default function MyUnit() {
  const [units, setUnits] = useState(null)
  const [users, setUsers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [sel, setSel] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    getJson('/admin-panel/api/unit/me', { ttlMs: 0 }).then(r => { if (r.error) setErr(r.error.message); else { setUnits(r.data || []); setSel(s => s || r.data?.[0]?.name || '') } })
    getJson('/admin-panel/api/admin/users').then(r => setUsers(r.data || []))
    getJson('/admin-panel/api/admin/profiles').then(r => setProfiles(r.data || []))
  }, [])
  const cur = (units || []).find(u => u.name === sel) || units?.[0] || null
  const ids = new Set(cur?.member_ids || [])
  const uT = useTable(users.filter(u => ids.has(u.id)), { keys: ['username', 'email'], sort: { key: 'username', dir: 'asc' } })
  const pT = useTable(profiles.filter(p => cur && p.unit === cur.name), { keys: ['name', 'owner'], sort: { key: 'name', dir: 'asc' } })

  if (err) return <div className="ak-card"><h2>واحد من</h2><Err>{err}</Err></div>
  if (!units) return <div className="ak-card"><h2>واحد من</h2><Loading /></div>
  if (!units.length) return <div className="ak-card"><h2>واحد من</h2><p className="ak-muted">شما مدیر هیچ واحدی نیستید.</p></div>
  return (
    <>
      <div className="ak-card">
        <div className="ak-toolbar">
          <h2 style={{ margin: 0 }}>{unitLabel(cur)}</h2><div className="spacer" />
          {units.length > 1 && <select className="ak-select" value={cur?.name} onChange={e => setSel(e.target.value)}>{units.map(u => <option key={u.name} value={u.name}>{unitLabel(u)}</option>)}</select>}
        </div>
        <div className="unit-cards">
          {budgetBars(cur).map(c => (
            <div key={c.key} className="unit-card">
              <div className="unit-card-key" dir="ltr">{c.key}</div>
              <div className="unit-bar"><div className={`unit-bar-fill ${c.warn ? 'warn' : ''}`} style={{ width: `${c.pct}%` }} /></div>
              <div className="unit-card-rows">
                <span>بودجه</span><b dir="ltr">{c.budget}</b><span>تخصیص‌یافته</span><b dir="ltr">{c.allocated}</b>
                <span>در حال استفاده</span><b dir="ltr">{c.used}</b><span>باقی‌مانده</span><b dir="ltr">{c.remaining}</b>
              </div>
            </div>
          ))}
          {!budgetBars(cur).length && <p className="ak-muted">برای این واحد بودجه‌ای تعریف نشده است.</p>}
        </div>
      </div>
      <div className="ak-card">
        <h2>کاربران این واحد</h2>
        <div className="ak-toolbar">{uT.search()}</div>
        <table className="ak-table"><thead><tr>{uT.th('username', 'نام کاربری')}{uT.th('email', 'ایمیل')}{uT.th('enabled', 'وضعیت')}</tr></thead>
          <tbody>{uT.shown.map(x => <tr key={x.id}><td dir="auto">{x.username}</td><td dir="ltr">{x.email}</td><td><Pill ok={x.enabled}>{x.enabled ? 'فعال' : 'غیرفعال'}</Pill></td></tr>)}</tbody></table>
        {uT.pager}
      </div>
      <div className="ak-card">
        <h2>پروفایل‌های این واحد</h2>
        <div className="ak-toolbar">{pT.search()}</div>
        <table className="ak-table"><thead><tr>{pT.th('name', 'نام')}{pT.th('owner', 'مالک')}<th>سهمیه</th></tr></thead>
          <tbody>{pT.shown.map(p => <tr key={p.name}><td dir="ltr">{p.name}</td><td dir="ltr">{p.owner}</td><td dir="ltr" className="sec-wrap">{quota(p.resource_quota)}</td></tr>)}</tbody></table>
        {pT.pager}
      </div>
    </>
  )
}
