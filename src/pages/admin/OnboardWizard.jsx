import { useState, useEffect } from 'react'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { Modal, Field, Err, downloadBlob, rawSend } from './kit.jsx'

export const ACCESS_ROLES = [
  ['access-resources', 'درخواست منابع'], ['access-vm', 'ماشین مجازی'], ['access-cost', 'داشبورد هزینه'],
  ['access-storage', 'فضای ذخیره‌سازی'], ['access-assistant', 'دستیار هوشمند OpenHands'], ['access-dashboards', 'داشبوردها'],
  ['access-logs', 'لاگ‌ها'], ['access-backup', 'بکاپ و بازیابی'], ['access-openwebui', 'Open WebUI'],
  ['access-helm-packages', 'استقرار بسته‌ی Helm'], ['access-llm-api', 'دسترسی مستقیم API مدل زبانی'], ['access-send-mail', 'ارسال ایمیل مدیریتی'],
]
const roleLabel = r => (ACCESS_ROLES.find(([k]) => k === r) || [r, r])[1]
const STEPS = ['حساب', 'فضای کاری', 'دسترسی', 'کلید LLM', 'پایان']

export function genPassword() {
  const pools = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%']
  const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n }
  const all = pools.join('')
  const out = pools.map(p => p[rnd(p.length)])
  while (out.length < 14) out.push(all[rnd(all.length)])
  for (let j = out.length - 1; j > 0; j--) { const k = rnd(j + 1); [out[j], out[k]] = [out[k], out[j]] }
  return out.join('')
}

const post = (p, body, method = 'POST') => rawSend(p, method, body).then(r => r.json().catch(() => ({})))

// Port of the platform's onboarding wizard: account -> profile (+ optional kubeconfig / port
// exposure) -> access roles -> optional LLM key -> finish (welcome PDF, emailed when possible).
// Anything created is rolled back if the wizard is abandoned.
export default function OnboardWizard({ isSuper, onClose, onDone }) {
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [st, setSt] = useState({})
  const [f, setF] = useState({ username: '', email: '', first: '', last: '', password: '', namespace: '', cpu: '', memory: '', storage: '',
    gpus: [], kube: false, kubeDays: '30', pexp: false, pexpSvc: '', pexpPort: '', roles: [], llm: false, llmDays: '365' })
  const [vendors, setVendors] = useState([])
  const [adSync, setAdSync] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  useEffect(() => {
    getJson('/admin-panel/api/admin/gpu-discovery').then(r => setVendors(r.data?.vendors || []))
    getJson('/admin-panel/api/admin/ad-sync').then(r => setAdSync(!!r.data?.enabled))
  }, [])

  const run = async fn => { setBusy(true); setErr(''); try { await fn() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const rollback = async () => {
    try {
      const d = await post('/admin-panel/api/admin/onboarding/rollback', { namespace: st.namespace || '', user_id: st.user_id || '', llm_api_key_hash: st.llm_api_key_hash || '' })
      const res = d.results || {}
      const summary = Object.keys(res).map(k => `${k}: ${res[k]}`).join('، ')
      notifySuccess(summary ? `ساخت کاربر لغو شد — ${summary}` : 'ساخت کاربر لغو شد')
    } catch (e) { notifyError('درخواست لغو ناموفق بود: ' + e.message) }
  }
  const cancel = () => (st.user_id ? setConfirm('cancel') : onClose())

  const step1 = () => run(async () => {
    const username = f.username.trim(), email = f.email.trim()
    if (!username || !email || !f.password) throw new Error('نام کاربری، ایمیل و گذرواژه را وارد کنید')
    const v = await post('/admin-panel/api/admin/verify-mailbox', { email, password: f.password })
    if (!v.valid) throw new Error('صندوق ایمیل هنوز وجود ندارد' + (v.reason ? ` (${v.reason})` : ''))
    const u = await post('/admin-panel/api/admin/users', { username, email, password: f.password, first_name: f.first.trim(), last_name: f.last.trim() })
    setSt({ username, email, first_name: f.first.trim(), last_name: f.last.trim(), temp_password: f.password, user_id: u.id })
    set('namespace', username); setStep(2)
  })
  const next1 = () => (adSync ? setConfirm('ad') : step1())

  const step2 = () => run(async () => {
    const ns = f.namespace.trim()
    if (!ns) throw new Error('نام Namespace را وارد کنید')
    const gpus = f.gpus.filter(g => g.type && String(g.count).trim()).map(g => ({ type: g.type, count: String(g.count).trim() }))
    await post('/admin-panel/api/admin/profiles', { name: ns, owner_email: st.email, cpu_limit: f.cpu.trim(),
      memory_limit: f.memory.trim() ? `${f.memory.trim()}Gi` : '', storage_limit: f.storage.trim() ? `${f.storage.trim()}Gi` : '', gpus })
    let next = { ...st, namespace: ns, quota: { cpu_limit: f.cpu.trim(), memory_limit: f.memory.trim(), storage_limit: f.storage.trim(), gpus } }
    if (f.kube) {
      try {
        const r = await rawSend(`/admin-panel/api/admin/profiles/${encodeURIComponent(ns)}/kubeconfig`, 'POST', { access: 'ro', duration_days: parseInt(f.kubeDays, 10), owner_email: st.email })
        next = { ...next, kubeconfig_expires_at: r.headers.get('X-Expires-At') }
      } catch { /* optional extra, same as the platform */ }
    }
    if (f.pexp && f.pexpSvc.trim() && f.pexpPort.trim()) {
      try {
        const e = await post(`/admin-panel/api/admin/profiles/${encodeURIComponent(ns)}/port-exposure`, { service_name: f.pexpSvc.trim(), service_port: parseInt(f.pexpPort, 10), owner_email: st.email })
        next = { ...next, port_exposure_url: `${window.location.origin}${e.exposed_path}`, port_exposure_service: `${e.service_name}:${e.service_port}` }
      } catch (e) { setErr('ایجاد Port exposure ناموفق بود: ' + e.message) }
    }
    setSt(next); setStep(3)
  })
  const step3 = () => run(async () => {
    if (!st.user_id) throw new Error('کاربر یافت نشد؛ به مرحله‌ی ۱ برگردید')
    await post(`/admin-panel/api/admin/access/${st.user_id}`, { access: f.roles }, 'PUT')
    setSt(s => ({ ...s, access_roles: f.roles.slice() })); setStep(4)
  })
  const step4 = () => run(async () => {
    if (!f.llm) { setSt(s => ({ ...s, llm_api_key_text: null })); setStep(5); return }
    if (!st.namespace) throw new Error('کلید LLM به Namespace فضای کاری (مرحله‌ی ۲) نیاز دارد')
    const d = await post('/admin-panel/api/admin/litellm-keys', { email: st.email, namespace: st.namespace, expires_days: Number(f.llmDays || 365) })
    setSt(s => ({ ...s, llm_api_key_text: d.email_body, llm_api_key_hash: d.key_hash })); setStep(5)
  })
  const finish = () => run(async () => {
    const r = await rawSend('/admin-panel/api/admin/onboarding/finish', 'POST', st)
    const emailed = r.headers.get('X-Emailed') === 'true'
    downloadBlob(await r.blob(), `welcome-${st.username || st.email}.pdf`)
    notifySuccess(emailed ? `کاربر «${st.username}» ساخته شد و ایمیل خوش‌آمد ارسال شد` : `کاربر «${st.username}» ساخته شد (فقط PDF؛ ایمیل ارسال نشد)`)
    onDone()
  })

  const undo = st.user_id && err && step > 1 && <button className="ak-btn" disabled={busy} onClick={async () => { setBusy(true); await rollback(); setBusy(false); onDone() }}>لغو همه‌ی موارد ساخته‌شده</button>
  const nextBtn = (fn, label = 'بعدی') => <button className="ak-btn ak-primary" disabled={busy} onClick={fn}>{busy ? 'در حال انجام…' : label}</button>
  const cancelBtn = <button className="ak-btn" onClick={cancel} disabled={busy}>انصراف</button>

  return (
    <>
      <Modal wide title="افزودن کاربر جدید" onClose={cancel} busy={busy}
        actions={<>{undo}{cancelBtn}
          {step === 1 && nextBtn(next1)}
          {step === 2 && <><button className="ak-btn" disabled={busy} onClick={() => { setSt(s => ({ ...s, namespace: null, quota: null })); setStep(3) }}>رد شدن</button>{nextBtn(step2)}</>}
          {step === 3 && nextBtn(step3)}
          {step === 4 && nextBtn(step4)}
          {step === 5 && nextBtn(finish, 'پایان و دریافت PDF')}
        </>}>
        <div className="ak-steps">{STEPS.map((s, i) => <span key={s} className={`ak-step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}`}>{i + 1}. {s}</span>)}</div>

        {step === 1 && (
          <>
            <div className="ak-row">
              <Field label="نام کاربری"><input className="ak-input" dir="ltr" value={f.username} onChange={e => {
                const u = e.target.value
                setF(s => ({ ...s, username: u, email: !s.email || /^[^@]*@isigpu\.local$/.test(s.email) ? (u ? `${u}@isigpu.local` : '') : s.email }))
              }} /></Field>
              <Field label="ایمیل"><input className="ak-input" dir="ltr" type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
            </div>
            <div className="ak-row">
              <Field label="نام"><input className="ak-input" value={f.first} onChange={e => set('first', e.target.value)} /></Field>
              <Field label="نام خانوادگی"><input className="ak-input" value={f.last} onChange={e => set('last', e.target.value)} /></Field>
            </div>
            <Field label="گذرواژه"><input className="ak-input" dir="ltr" value={f.password} onChange={e => set('password', e.target.value)} /></Field>
            <button className="ak-btn" onClick={() => set('password', genPassword())}>ساخت گذرواژه‌ی تصادفی</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ak-row">
              <Field label="نام Namespace"><input className="ak-input" dir="ltr" value={f.namespace} onChange={e => set('namespace', e.target.value)} /></Field>
              <Field label="سقف CPU (اختیاری)"><input className="ak-input" type="number" min="0" step="0.001" value={f.cpu} onChange={e => set('cpu', e.target.value)} /></Field>
              <Field label="سقف حافظه Gi (اختیاری)"><input className="ak-input" type="number" min="0" value={f.memory} onChange={e => set('memory', e.target.value)} /></Field>
              <Field label="سقف فضای ذخیره‌سازی Gi (اختیاری)"><input className="ak-input" type="number" min="0" value={f.storage} onChange={e => set('storage', e.target.value)} /></Field>
            </div>
            <div className="ak-sub">
              <h3>تخصیص GPU / MIG (اختیاری)</h3>
              {f.gpus.map((g, i) => {
                const v = vendors.find(x => x.limitsKey === g.type)
                return (
                  <div key={i} className="ak-row">
                    <select className="ak-select" dir="ltr" value={g.type} onChange={e => set('gpus', f.gpus.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                      <option value="">— انتخاب —</option>
                      {vendors.map(v2 => <option key={v2.limitsKey} value={v2.limitsKey}>{v2.uiName || v2.limitsKey}</option>)}
                      {g.type && !v && <option value={g.type}>{g.type}</option>}
                    </select>
                    <input className="ak-input" type="number" min="1" max={v?.allocatable_total || undefined} value={g.count} onChange={e => set('gpus', f.gpus.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} />
                    <button className="ak-btn" onClick={() => set('gpus', f.gpus.filter((_, j) => j !== i))}>حذف</button>
                  </div>
                )
              })}
              <button className="ak-btn" onClick={() => set('gpus', [...f.gpus, { type: '', count: '' }])}>+ افزودن GPU</button>
            </div>
            {isSuper && (
              <>
                <label className="ak-check"><input type="checkbox" checked={f.kube} onChange={e => set('kube', e.target.checked)} />صدور Kubeconfig فقط‌خواندنی</label>
                {f.kube && <Field label="مدت (روز)"><input className="ak-input" type="number" min="1" value={f.kubeDays} onChange={e => set('kubeDays', e.target.value)} /></Field>}
                <label className="ak-check"><input type="checkbox" checked={f.pexp} onChange={e => set('pexp', e.target.checked)} />انتشار پورت یک سرویس</label>
                {f.pexp && <div className="ak-row">
                  <Field label="نام سرویس"><input className="ak-input" dir="ltr" value={f.pexpSvc} onChange={e => set('pexpSvc', e.target.value)} /></Field>
                  <Field label="پورت سرویس"><input className="ak-input" type="number" min="1" value={f.pexpPort} onChange={e => set('pexpPort', e.target.value)} /></Field>
                </div>}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <div className="ak-checks">
            {ACCESS_ROLES.map(([r, l]) => (
              <label key={r} className="ak-check"><input type="checkbox" checked={f.roles.includes(r)}
                onChange={() => set('roles', f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r])} />{l}</label>
            ))}
          </div>
        )}

        {step === 4 && (
          <>
            <label className="ak-check"><input type="checkbox" checked={f.llm} onChange={e => set('llm', e.target.checked)} />صدور کلید مستقیم API مدل زبانی</label>
            {f.llm && <Field label="انقضا (روز)"><input className="ak-input" type="number" min="1" value={f.llmDays} onChange={e => set('llmDays', e.target.value)} /></Field>}
          </>
        )}

        {step === 5 && (
          <>
            <p className="ak-kv"><b>حساب:</b><bdi dir="ltr">{st.username} ({st.email})</bdi></p>
            {st.namespace && <p className="ak-kv"><b>فضای کاری:</b><bdi dir="ltr">{st.namespace}</bdi></p>}
            {st.access_roles?.length > 0 && <p className="ak-kv"><b>دسترسی‌ها:</b>{st.access_roles.map(roleLabel).join('، ')}</p>}
            {st.kubeconfig_expires_at && <p className="ak-kv"><b>Kubeconfig:</b>صادر شد، انقضا <bdi dir="ltr">{st.kubeconfig_expires_at}</bdi></p>}
            {st.port_exposure_url && <p className="ak-kv"><b>Port exposure:</b><bdi dir="ltr">{st.port_exposure_url}</bdi></p>}
            {st.llm_api_key_text && <p className="ak-kv"><b>کلید LLM:</b>صادر شد</p>}
          </>
        )}
        <Err>{err}</Err>
      </Modal>
      {confirm === 'cancel' && <ConfirmDialog danger title="لغو ساخت کاربر؟" body="حساب و هر پروفایل یا کلیدی که در این مراحل ساخته شده حذف می‌شود."
        confirmLabel="لغو و حذف" onCancel={() => setConfirm(null)} onConfirm={async () => { setConfirm(null); await rollback(); onDone() }} />}
      {confirm === 'ad' && <ConfirmDialog title="ساخت حساب Active Directory" body="این کار یک حساب واقعی در Active Directory می‌سازد. ادامه می‌دهید؟"
        confirmLabel="ادامه" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); step1() }} />}
    </>
  )
}
