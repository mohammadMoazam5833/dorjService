import { useState, useEffect } from 'react'
import { useApi, invalidate } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import { useTable, useWhoami, Pill } from './kit.jsx'
import ProfileEdit, { tierLabel, nodeDetail, ScheduleRow } from './ProfileEdit.jsx'

const P = '/admin-panel/api/admin/profiles'
const quota = (p, k) => p.resource_quota?.hard?.[k] || '—'
const gpuQuota = p => {
  const h = p.resource_quota?.hard
  const ks = h ? Object.keys(h).filter(k => k.startsWith('nvidia.com/')) : []
  return ks.length ? ks.map(k => `${h[k]}× ${k.split('/').pop()}`).join('، ') : '—'
}
const within7 = d => d && new Date(`${d}T00:00:00Z`).getTime() <= new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime() + 7 * 864e5

export default function Profiles() {
  const who = useWhoami()
  const isSuper = !!who?.is_super
  const { data, error, loading, reload } = useApi(P, [])
  const profiles = Array.isArray(data) ? data : []
  const t = useTable(profiles, { keys: ['name', 'owner'], sort: { key: 'name', dir: 'asc' } })
  const [sub, setSub] = useState('list')
  const [editing, setEditing] = useState(null)
  const [disc, setDisc] = useState({ vendors: [], cluster: null })
  const [nodes, setNodes] = useState([])
  const [sched, setSched] = useState([])

  const loadSla = async () => {
    const [n, s] = await Promise.all([
      getJson(`/admin-panel/api/admin/sla-nodes?t=${Date.now()}`, { ttlMs: 0 }),
      getJson(`/admin-panel/api/admin/sla-tier-schedule?t=${Date.now()}`, { ttlMs: 0 }),
    ])
    setNodes(n.data || [])
    setSched((s.data || []).filter(e => e.status === 'pending' && within7(e.scheduled_for)))
  }
  useEffect(() => {
    getJson('/admin-panel/api/admin/gpu-discovery').then(r => setDisc({ vendors: r.data?.vendors || [], cluster: r.data?.cluster || null }))
    loadSla()
  }, [])

  if (editing) {
    return <ProfileEdit profile={editing} vendors={disc.vendors} cluster={disc.cluster} reloadSla={loadSla}
      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(P); reload(); loadSla() }} />
  }

  const subtabs = isSuper ? [['list', `پروفایل‌ها (${profiles.length})`], ['sla-nodes', 'نودهای SLA'], ['sla-restarts', 'راه‌اندازی‌های SLA']] : [['list', 'پروفایل‌ها']]
  return (
    <>
      <nav className="ak-tabs">{subtabs.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>

      {sub === 'list' && (
        <div className="ak-card">
          <div className="ak-toolbar"><h2 style={{ margin: 0 }}>مدیریت پروفایل‌ها</h2><div className="spacer" />{t.search('جستجوی نام یا مالک…')}</div>
          <ErrorNote error={error} />
          {loading && !error ? <p className="ak-muted">در حال بارگذاری…</p> : (
            <div className="ak-table-scroll">
              <table className="ak-table">
                <thead><tr>{t.th('name', 'نام')}{t.th('owner', 'مالک')}{t.th('cpu', 'CPU', p => quota(p, 'cpu'))}{t.th('memory', 'حافظه', p => quota(p, 'memory'))}
                  {t.th('storage', 'فضای ذخیره‌سازی', p => quota(p, 'requests.storage'))}<th>GPU</th>{t.th('tier', 'سطح SLA')}{t.th('created_at', 'ایجاد')}<th /></tr></thead>
                <tbody>{t.shown.map(p => (
                  <tr key={p.name}>
                    <td><bdi dir="ltr">{p.name}</bdi></td><td><bdi dir="ltr">{p.owner || '—'}</bdi></td>
                    <td dir="ltr">{quota(p, 'cpu')}</td><td dir="ltr">{quota(p, 'memory')}</td><td dir="ltr">{quota(p, 'requests.storage')}</td>
                    <td dir="ltr">{gpuQuota(p)}</td><td>{tierLabel(p.tier)}</td><td>{(p.created_at || '').slice(0, 10)}</td>
                    <td><button className="ak-btn" onClick={() => setEditing(p)}>ویرایش</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {t.pager}
              <p className="ak-muted">ساخت پروفایل جدید از تب «کاربران» ← «افزودن کاربر» انجام می‌شود (کاربر Keycloak و پروفایل با هم ساخته می‌شوند).</p>
            </div>
          )}
        </div>
      )}

      {sub === 'sla-nodes' && (
        <div className="ak-card">
          <h2>نودهای SLA</h2>
          {nodes.map(n => (
            <div key={n.name} className="ak-toolbar" style={{ borderBottom: '1px solid #f0f3f7', paddingBottom: 8 }}>
              <div><bdi dir="ltr">{n.name}</bdi><div className="ak-muted">{nodeDetail(n)}</div></div>
              <div className="spacer" />
              {n.reserved_for ? <span className="ak-muted">رزرو برای <bdi dir="ltr">{n.reserved_for}</bdi></span> : <Pill ok>آزاد</Pill>}
            </div>
          ))}
        </div>
      )}

      {sub === 'sla-restarts' && (
        <div className="ak-card">
          <h2>راه‌اندازی‌های SLA (۷ روز آینده)</h2>
          {sched.length === 0 ? <p className="ak-muted">در ۷ روز آینده راه‌اندازی زمان‌بندی‌شده‌ای وجود ندارد.</p> : (
            <table className="ak-table"><thead><tr><th>Namespace</th><th>سطح</th><th>تاریخ راه‌اندازی دوباره</th><th /></tr></thead>
              <tbody>{sched.map(e => <ScheduleRow key={e.id} e={e} withNs onChange={loadSla} />)}</tbody></table>
          )}
        </div>
      )}
    </>
  )
}
