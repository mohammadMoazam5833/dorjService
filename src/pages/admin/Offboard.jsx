import { useState, useEffect, useRef } from 'react'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { Modal, Field, Err, Pill, useCaptcha, downloadBlob, rawSend } from './kit.jsx'
import Spinner from '../../components/Spinner.jsx'

const enc = encodeURIComponent
const P = '/admin-panel/api/admin/profiles'

// Offboarding = export the profile's volumes (password + captcha), let the admin download the
// export, then permanently delete the profile (password + a fresh captcha). Same flow and
// endpoints as the platform's admin-panel-users/profiles.
export default function Offboard({ profile, onClose, onDone }) {
  const [stage, setStage] = useState('confirm')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [exp, setExp] = useState({ id: '', pvcs: [], downloaded: false })
  const [dlPassword, setDlPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [delPassword, setDelPassword] = useState('')
  const cap = useCaptcha()
  const delCap = useCaptcha()
  const poll = useRef(null)

  useEffect(() => () => clearInterval(poll.current), [])
  const pollStatus = async id => {
    const r = await getJson(`${P}/${enc(profile)}/offboard/prepare/${enc(id)}?t=${Date.now()}`, { ttlMs: 0 })
    if (r.data?.downloaded) { setExp(e => ({ ...e, downloaded: true })); clearInterval(poll.current) }
  }
  const toDelete = msg => {
    delCap.reload()
    setNotice(msg || `پروفایل «${profile}» و همه‌ی منابع آن برای همیشه حذف می‌شود. این کار برگشت‌پذیر نیست.`)
    setStage('delete')
  }

  const prepare = async () => {
    setBusy(true); setErr('')
    try {
      const r = await rawSend(`${P}/${enc(profile)}/offboard/prepare`, 'POST', { password, captcha_token: cap.token, captcha_answer: cap.answer })
      const d = await r.json()
      if (d.no_volumes) { toDelete(`«${profile}» فضای ذخیره‌سازی‌ای برای خروجی ندارد؛ می‌توانید مستقیماً حذفش کنید.`); return }
      setExp({ id: d.export_id, pvcs: d.pvcs || [], downloaded: false })
      setStage('prepared')
      pollStatus(d.export_id)
      poll.current = setInterval(() => pollStatus(d.export_id), 4000)
    } catch (e) { setErr(e.message); cap.reload() } finally { setBusy(false) }
  }
  const notify = async () => {
    try { await rawSend(`${P}/${enc(profile)}/offboard/prepare/${enc(exp.id)}/notify`, 'POST'); notifySuccess('ایمیل اطلاع‌رسانی برای کاربر ارسال شد') }
    catch (e) { setErr(e.message); notifyError(e.message) }
  }
  const download = async () => {
    setErr('')
    try {
      const r = await rawSend(`${P}/${enc(profile)}/offboard/prepare/${enc(exp.id)}/download`, 'POST', { password: dlPassword })
      const m = (r.headers.get('Content-Disposition') || '').match(/filename="?([^"]+)"?/)
      downloadBlob(await r.blob(), m ? m[1] : 'export')
      pollStatus(exp.id)
    } catch (e) { setErr(e.message) }
  }
  const remove = async () => {
    setBusy(true); setErr('')
    try {
      await rawSend(`${P}/${enc(profile)}`, 'DELETE', { password: delPassword, captcha_token: delCap.token, captcha_answer: delCap.answer })
      notifySuccess(`پروفایل «${profile}» حذف شد`)
      setStage('done'); onDone?.()
    } catch (e) { setErr(e.message); notifyError(e.message); delCap.reload() } finally { setBusy(false) }
  }

  const close = <button className="ak-btn" onClick={onClose} disabled={busy}>{stage === 'done' ? 'بستن' : 'انصراف'}</button>
  return (
    <Modal title={<>خروج کاربر (Offboard): <bdi dir="ltr">{profile}</bdi></>} onClose={onClose} busy={busy}
      actions={
        stage === 'confirm' ? <>{close}<button className="ak-btn ak-primary" disabled={busy || !password || !cap.answer} onClick={prepare}>{busy ? <Spinner label="در حال آماده‌سازی" /> : 'آماده‌سازی خروجی'}</button></>
        : stage === 'prepared' ? <>{close}<button className="ak-btn" onClick={download} disabled={!dlPassword}>دانلود خروجی</button>
            <button className="ak-btn ak-danger" disabled={!exp.downloaded} onClick={() => toDelete()}>ادامه به حذف</button></>
        : stage === 'delete' ? <>{close}<button className="ak-btn ak-danger" disabled={busy || !delPassword || !delCap.answer} onClick={remove}>{busy ? <Spinner label="در حال حذف" /> : 'حذف دائمی'}</button></>
        : close}>
      {stage === 'confirm' && (
        <>
          <p className="ak-muted">ابتدا از همه‌ی فضاهای ذخیره‌سازی این پروفایل خروجی گرفته می‌شود.</p>
          <Field label="گذرواژه‌ی شما"><input className="ak-input" type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} /></Field>
          {cap.view}
        </>
      )}
      {stage === 'prepared' && (
        <>
          <p className="ak-kv"><b>شناسه‌ی خروجی:</b><bdi dir="ltr">{exp.id}</bdi></p>
          {exp.pvcs.length > 0 && <p className="ak-kv"><b>فضاهای شامل:</b><bdi dir="ltr">{exp.pvcs.join(', ')}</bdi></p>}
          <Pill ok={exp.downloaded} warn={!exp.downloaded}>{exp.downloaded ? 'دانلود شد' : 'هنوز دانلود نشده'}</Pill>
          <div className="ak-toolbar" style={{ marginTop: 10 }}><button className="ak-btn" onClick={notify}>اطلاع‌رسانی به کاربر با ایمیل</button></div>
          <Field label="گذرواژه‌ی شما (برای دانلود)"><input className="ak-input" type="password" dir="ltr" value={dlPassword} onChange={e => setDlPassword(e.target.value)} /></Field>
          <p className="ak-muted">حذف فقط پس از دانلود خروجی فعال می‌شود.</p>
        </>
      )}
      {stage === 'delete' && (
        <>
          <Err>{notice}</Err>
          <Field label="گذرواژه‌ی شما"><input className="ak-input" type="password" dir="ltr" value={delPassword} onChange={e => setDelPassword(e.target.value)} /></Field>
          {delCap.view}
        </>
      )}
      {stage === 'done' && <p>پروفایل حذف شد.</p>}
      <Err>{err}</Err>
    </Modal>
  )
}
