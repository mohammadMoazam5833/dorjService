import { useState, useEffect } from 'react'
import { useApi, apiSend, invalidate } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { ACCESS_ROLES, SHARED_MODELS_ROLE } from '../../lib/admin/roles.js'
import { useTable } from './kit.jsx'

const API = '/admin-panel/api/admin/access'
const SM = '/admin-panel/api/admin/shared-models'

function smSummary(sm) {
  if (!sm) return ''
  const gib = (sm.total_bytes || 0) / 2 ** 30
  const size = gib >= 1024 ? `${(gib / 1024).toFixed(1)} TiB` : `${gib.toFixed(1)} GiB`
  let s = `${sm.model_count || 0} مدل (${size})`
  if (!sm.source_ready) s += ' — فضای مشترک آماده نیست (اسکریپت 112 را اجرا کنید)'
  else if ((sm.applied_namespaces || []).length) s += ` — سوار شده در ${sm.applied_namespaces.length} Namespace`
  return s
}

// Shared models volume (off / all users / role-gated) + the user x role access matrix.
export default function Access() {
  const { data, error, loading } = useApi(API, [])
  const [dirty, setDirty] = useState({})
  const users = (Array.isArray(data) ? data : []).map(u => (dirty[u.id] ? { ...u, access: dirty[u.id] } : u))
  const t = useTable(users, { keys: ['username', 'email'], sort: { key: 'username', dir: 'asc' } })
  const [sm, setSm] = useState({ mode: 'off', mount_path: '/home/jovyan/models' })
  const [smConfirm, setSmConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const loadSm = () => getJson(`${SM}?t=${Date.now()}`, { ttlMs: 0 }).then(r => r.data && setSm(r.data))
  useEffect(() => { loadSm() }, [])
  const roles = sm.mode === 'role' ? ACCESS_ROLES : ACCESS_ROLES.filter(r => r.id !== SHARED_MODELS_ROLE)

  const toggle = (u, role, on) => setDirty(d => ({ ...d, [u.id]: { ...(d[u.id] || u.access), [role]: on } }))
  const save = async () => {
    setSaving(true)
    try {
      for (const [id, acc] of Object.entries(dirty)) {
        const r = await apiSend(`${API}/${id}`, 'PUT', { access: Object.keys(acc).filter(k => acc[k]) })
        if (r.error) throw new Error(r.error.message)
      }
      setDirty({}); invalidate(API); notifySuccess('تغییرات دسترسی ذخیره شد')
    } catch (e) { notifyError(e.message) } finally { setSaving(false) }
  }
  const applySm = async () => {
    setSmConfirm(false)
    const r = await apiSend(SM, 'PUT', { mode: sm.mode, mount_path: sm.mount_path })
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('فضای مشترک مدل‌ها: اعمال تنظیمات آغاز شد'); loadSm()
  }

  return (
    <div className="ak-card">
      <h2>دسترسی‌ها</h2>
      <div className="ak-sub">
        <div className="ak-toolbar">
          <strong>فضای مشترک مدل‌ها</strong>
          <div className="nb-seg" style={{ marginBottom: 0 }}>
            {[['off', 'خاموش'], ['all', 'همه‌ی کاربران'], ['role', 'کاربران انتخاب‌شده']].map(([m, l]) => (
              <button key={m} className={sm.mode === m ? 'on' : ''} onClick={() => setSm(s => ({ ...s, mode: m }))}>{l}</button>
            ))}
          </div>
          {sm.mode !== 'off' && <input className="ak-input" dir="ltr" style={{ minWidth: 220 }} placeholder="/home/jovyan/models" value={sm.mount_path || ''} onChange={e => setSm(s => ({ ...s, mount_path: e.target.value }))} />}
          <button className="ak-btn ak-primary" onClick={() => setSmConfirm(true)}>اعمال</button>
        </div>
        <p className="ak-muted">{smSummary(sm)}</p>
        {sm.mode === 'role' && <p className="ak-muted">فقط کاربرانی که نقش «مدل‌ها» را در جدول زیر دارند فضای فقط‌خواندنی مدل‌ها را دریافت می‌کنند.</p>}
      </div>
      <div className="ak-toolbar"><div className="spacer" />{t.search('جستجوی کاربر…')}</div>
      <ErrorNote error={error} />
      {loading && !error ? <p className="ak-muted">در حال بارگذاری…</p> : (
        <div className="ak-table-scroll">
          <table className="ak-table">
            <thead><tr>{t.th('username', 'کاربر')}{roles.map(r => <th key={r.id} title={r.label}>{r.short}</th>)}</tr></thead>
            <tbody>{t.shown.map(u => (
              <tr key={u.id}>
                <td><div><bdi dir="ltr">{u.username}</bdi></div><div className="ak-muted"><bdi dir="ltr">{u.email}</bdi></div></td>
                {roles.map(r => <td key={r.id}><input type="checkbox" title={r.label} checked={!!u.access?.[r.id]} onChange={e => toggle(u, r.id, e.target.checked)} /></td>)}
              </tr>
            ))}</tbody>
          </table>
          {t.pager}
          <button className="ak-btn ak-primary" style={{ marginTop: 12 }} disabled={saving || !Object.keys(dirty).length} onClick={save}>
            {saving ? 'در حال ذخیره…' : `ذخیره‌ی تغییرات${Object.keys(dirty).length ? ` (${Object.keys(dirty).length} کاربر)` : ''}`}</button>
        </div>
      )}
      {smConfirm && <ConfirmDialog title="اعمال تنظیم فضای مشترک مدل‌ها؟" body="نوت‌بوک‌ها در شروع یا راه‌اندازی دوباره‌ی بعدی، فضای فقط‌خواندنی مدل‌ها را دریافت (یا حذف) می‌کنند. نوت‌بوک‌های در حال اجرا مختل نمی‌شوند."
        confirmLabel="تأیید" onCancel={() => setSmConfirm(false)} onConfirm={applySm} />}
    </div>
  )
}
