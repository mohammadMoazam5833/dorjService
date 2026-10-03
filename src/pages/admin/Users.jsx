import { useState } from 'react'
import { useApi, apiSend, apiPost, invalidate } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useTable, useWhoami, Pill, Err, Modal } from './kit.jsx'
import OnboardWizard from './OnboardWizard.jsx'
import Offboard from './Offboard.jsx'

const API = '/admin-panel/api/admin/users'

export default function Users() {
  const who = useWhoami()
  const isSuper = !!who?.is_super
  const { data, error, loading, reload } = useApi(API, [])
  const users = Array.isArray(data) ? data : []
  const t = useTable(users, { keys: ['username', 'email'], sort: { key: 'username', dir: 'asc' } })
  const [onboard, setOnboard] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [reset, setReset] = useState(null)
  const [resetPw, setResetPw] = useState('')
  const [resetErr, setResetErr] = useState('')
  const [busy, setBusy] = useState('')
  const [pick, setPick] = useState(null)
  const [offboard, setOffboard] = useState(null)
  const refresh = () => { invalidate(API); reload() }

  const toggleEnabled = async u => {
    setBusy(u.id)
    const r = await apiSend(`${API}/${u.id}/enabled`, 'PUT', { enabled: !u.enabled })
    setBusy(''); setConfirm(null)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(r.data?.enabled ? `«${u.username}» فعال شد` : `«${u.username}» غیرفعال شد`); refresh()
  }
  const toggleAdmin = async u => {
    setBusy(u.id)
    const r = await apiSend(`${API}/${u.id}/platform-admin`, 'PUT', { granted: !u.is_platform_admin })
    setBusy(''); setConfirm(null)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(r.data?.is_platform_admin ? `دسترسی مدیر به «${u.username}» داده شد` : `دسترسی مدیر از «${u.username}» گرفته شد`); refresh()
  }
  const submitReset = async () => {
    if (resetPw.length < 8) { setResetErr('گذرواژه باید دست‌کم ۸ نویسه باشد'); return }
    setBusy(reset.id); setResetErr('')
    const r = await apiPost(`${API}/${reset.id}/reset-password`, { password: resetPw })
    setBusy('')
    if (r.error) { setResetErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(`گذرواژه‌ی «${reset.username}» بازنشانی شد`); setReset(null); setResetPw('')
  }
  // a user may own several workspaces: pick one; owning none just offers to disable the account
  const startOffboard = async u => {
    const r = await getJson('/admin-panel/api/admin/profiles', { ttlMs: 0 })
    if (r.error) { notifyError(r.error.message); return }
    const owned = (r.data || []).filter(p => p.owner === u.email).map(p => p.name)
    if (owned.length === 0) {
      if (!u.enabled) { notifyError('این کاربر پروفایلی ندارد.'); return }
      setConfirm({ kind: 'disable-no-profile', u }); return
    }
    if (owned.length === 1) setOffboard(owned[0])
    else setPick({ u, owned })
  }

  return (
    <div className="ak-card">
      <div className="ak-toolbar">
        <h2 style={{ margin: 0 }}>کاربران</h2>
        <div className="spacer" />
        {t.search('جستجوی نام کاربری یا ایمیل…')}
        <button className="ak-btn ak-primary" onClick={() => setOnboard(true)}>+ افزودن کاربر</button>
      </div>
      <ErrorNote error={error} />
      {loading && !error ? <p className="ak-muted">در حال بارگذاری…</p> : (
        <div className="ak-table-scroll">
          <table className="ak-table">
            <thead><tr>{t.th('username', 'نام کاربری')}{t.th('email', 'ایمیل')}{t.th('enabled', 'وضعیت')}{t.th('federated', 'منبع')}<th /></tr></thead>
            <tbody>
              {t.shown.map(u => (
                <tr key={u.id}>
                  <td><bdi dir="ltr">{u.username}</bdi></td>
                  <td><bdi dir="ltr">{u.email}</bdi></td>
                  <td>
                    <Pill ok={u.enabled} warn={!u.enabled}>{u.enabled ? 'فعال' : 'غیرفعال'}</Pill>
                    {u.pending_approval && <Pill warn>در انتظار تأیید ایمیل</Pill>}
                    {u.is_platform_admin && <Pill ok>مدیر پلتفرم</Pill>}
                  </td>
                  <td>{u.federated ? 'AD' : 'محلی'}</td>
                  <td className="ak-actions-cell">
                    <button className="ak-btn ak-ghost" disabled={busy === u.id} onClick={() => (u.enabled ? setConfirm({ kind: 'disable', u }) : toggleEnabled(u))}>{u.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>
                    {isSuper && <button className="ak-btn ak-ghost" disabled={busy === u.id} onClick={() => setConfirm({ kind: 'admin', u })}>{u.is_platform_admin ? 'حذف دسترسی مدیر' : 'اعطای دسترسی مدیر'}</button>}
                    <button className="ak-btn ak-ghost" onClick={() => { setReset(u); setResetPw(''); setResetErr('') }}>بازنشانی گذرواژه</button>
                    {isSuper && <button className="ak-btn ak-ghost" onClick={() => startOffboard(u)}>خروج (Offboard)</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.pager}
        </div>
      )}

      {onboard && <OnboardWizard isSuper={isSuper} onClose={() => setOnboard(false)} onDone={() => { setOnboard(false); refresh(); invalidate('/admin-panel/api/admin/profiles') }} />}
      {offboard && <Offboard profile={offboard} onClose={() => { setOffboard(null); refresh() }} onDone={() => { refresh(); invalidate('/admin-panel/api/admin/profiles') }} />}
      {pick && (
        <Modal title={`خروج: ${pick.u.email}`} onClose={() => setPick(null)} actions={<button className="ak-btn" onClick={() => setPick(null)}>انصراف</button>}>
          <p className="ak-muted">این کاربر مالک چند فضای کاری است؛ یکی را انتخاب کنید.</p>
          {pick.owned.map(n => <button key={n} className="ak-btn" style={{ display: 'block', width: '100%', marginBottom: 6 }} onClick={() => { setPick(null); setOffboard(n) }}><bdi dir="ltr">{n}</bdi></button>)}
        </Modal>
      )}
      {reset && (
        <Modal title={<>بازنشانی گذرواژه: <bdi dir="ltr">{reset.username}</bdi></>} onClose={() => setReset(null)} busy={busy === reset.id}
          actions={<><button className="ak-btn" onClick={() => setReset(null)}>انصراف</button><button className="ak-btn ak-primary" disabled={busy === reset.id} onClick={submitReset}>ثبت</button></>}>
          <label className="ak-field"><span className="ak-label">گذرواژه‌ی موقت جدید (حداقل ۸ نویسه)</span>
            <input className="ak-input" dir="ltr" value={resetPw} onChange={e => setResetPw(e.target.value)} autoFocus /></label>
          <Err>{resetErr}</Err>
        </Modal>
      )}
      {confirm?.kind === 'disable' && <ConfirmDialog danger title={`غیرفعال‌سازی «${confirm.u.username}»؟`} body="کاربر دیگر نمی‌تواند وارد شود." confirmLabel="غیرفعال کن"
        busy={busy === confirm.u.id} onCancel={() => setConfirm(null)} onConfirm={() => toggleEnabled(confirm.u)} />}
      {confirm?.kind === 'disable-no-profile' && <ConfirmDialog danger title={`غیرفعال‌سازی «${confirm.u.username}»؟`} body="این کاربر پروفایلی برای خروج ندارد؛ فقط حسابش غیرفعال می‌شود." confirmLabel="غیرفعال کن"
        busy={busy === confirm.u.id} onCancel={() => setConfirm(null)} onConfirm={() => toggleEnabled(confirm.u)} />}
      {confirm?.kind === 'admin' && <ConfirmDialog danger={confirm.u.is_platform_admin}
        title={confirm.u.is_platform_admin ? `حذف دسترسی مدیر از «${confirm.u.username}»؟` : `اعطای دسترسی مدیر به «${confirm.u.username}»؟`}
        body={confirm.u.is_platform_admin ? undefined : 'این کاربر به همه‌ی بخش‌های پنل مدیریت دسترسی کامل پیدا می‌کند.'}
        confirmLabel="تأیید" busy={busy === confirm.u.id} onCancel={() => setConfirm(null)} onConfirm={() => toggleAdmin(confirm.u)} />}
    </div>
  )
}
