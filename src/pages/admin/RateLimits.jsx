import { useState, useEffect, useMemo } from 'react'
import { apiSend } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { SCOPES, normalized, planRow, planFromForm, renamePlan, planInUse, validWeight, duration } from '../../lib/admin/ratelimits.js'
import { Field, Err, Modal, Pill, useTable, useCaptcha } from './kit.jsx'

const B = '/admin-panel/api/admin/rate-limits'
const fresh = p => getJson(`${p}?t=${Date.now()}`, { ttlMs: 0 })
const SCOPE_LABELS = { key: 'کلید API', user: 'کاربر', tenant: 'تیم' }
const FAILURES = [['server_error', 'خطای سرور مدل (5xx)'], ['timeout', 'Timeout'], ['client_error', 'رد شده توسط سرور مدل (4xx)'], ['cancelled', 'لغو شده توسط کلاینت']]
const SUBS = [['usage', 'مصرف زنده'], ['plans', 'پلن‌ها'], ['weights', 'هزینه‌ی مدل'], ['assign', 'تخصیص‌ها'], ['policies', 'سیاست‌ها']]
const EMPTY_PLAN = { name: '', requests_per_window: '', window_hours: 4, requests_per_minute: '', max_concurrent: '', max_input_tokens: '', max_output_tokens: '', fail_open: false }
const ratio = (v, l) => (l === null || l === undefined || l === '' ? `${v}` : `${v} / ${l}`)
const dash = v => (v === null || v === undefined || v === '' ? '—' : v)
const clone = o => JSON.parse(JSON.stringify(o))

function Confirm({ action, target, config, onClose, onDone }) {
  const cap = useCaptcha()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!password) { setErr('گذرواژه‌ی شما لازم است'); return }
    if (!cap.answer) { setErr('کد امنیتی را وارد کنید'); return }
    setBusy(true); setErr('')
    const auth = { password, captcha_token: cap.token, captcha_answer: cap.answer }
    const r = action === 'save' ? await apiSend(B, 'PUT', { config: normalized(config), ...auth })
      : await apiSend(`${B}/usage/reset`, 'POST', { tenant: target.tenant, scope: target.scope, id: target.id, ...auth })
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); cap.reload(); return }
    notifySuccess(action === 'save' ? 'محدودیت‌ها ذخیره شد؛ Gateway حدود یک دقیقه بعد اعمال می‌کند' : `مصرف ${target.label} صفر شد`)
    onDone()
  }
  return (
    <Modal title={action === 'save' ? 'ذخیره‌ی محدودیت‌های نرخ' : 'صفر کردن مصرف'} onClose={onClose} busy={busy}
      actions={<><button className="ak-btn" onClick={onClose} disabled={busy}>انصراف</button><button className="ak-btn ak-primary" onClick={submit} disabled={busy}>تأیید</button></>}>
      <p className="ak-warn">{action === 'save' ? 'محدودیت‌های جدید ظرف حدود یک دقیقه برای همه‌ی کاربران Gateway اعمال می‌شوند.' : `پنجره‌ی پیام ${target.label} بلافاصله تازه می‌شود.`}</p>
      <p className="ak-muted">برای امنیت، هر عملیات در این بخش به گذرواژه‌ی شما و کد امنیتی زیر نیاز دارد.</p>
      <Field label="گذرواژه‌ی شما"><input className="ak-input" type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoFocus /></Field>
      {cap.view}
      <Err>{err}</Err>
    </Modal>
  )
}

function PlanForm({ initial, editing, config, onClose, onApply }) {
  const [f, setF] = useState(initial)
  const [err, setErr] = useState('')
  const set = k => e => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const apply = () => {
    const name = (f.name || '').trim()
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(name)) { setErr('نام پلن: فقط حروف کوچک انگلیسی، رقم، - و _'); return }
    if (name !== editing && config.plans[name]) { setErr('پلنی با این نام وجود دارد'); return }
    const plan = planFromForm(f)
    if (typeof plan === 'string') { setErr(plan); return }
    onApply(name, plan)
  }
  const num = (k, l, step) => <Field label={l}><input className="ak-input" type="number" min="0" step={step} dir="ltr" value={f[k]} onChange={set(k)} /></Field>
  return (
    <Modal title={editing ? 'ویرایش پلن' : 'افزودن پلن'} onClose={onClose}
      actions={<><button className="ak-btn" onClick={onClose}>انصراف</button><button className="ak-btn ak-primary" onClick={apply}>اعمال</button></>}>
      <p className="ak-muted">هر فیلدی را برای «بدون محدودیت» خالی بگذارید.</p>
      <Field label="نام پلن"><input className="ak-input" dir="ltr" placeholder="e.g. basic" value={f.name} onChange={set('name')} /></Field>
      <div className="ak-row">{num('requests_per_window', 'پیام در هر پنجره', '0.1')}{num('window_hours', 'طول پنجره (ساعت)', '0.5')}</div>
      <div className="ak-row">{num('requests_per_minute', 'درخواست در دقیقه', '1')}{num('max_concurrent', 'اجرای هم‌زمان', '1')}</div>
      <div className="ak-row">{num('max_input_tokens', 'حداکثر توکن ورودی', '1024')}{num('max_output_tokens', 'حداکثر توکن خروجی', '256')}</div>
      <label className="ak-check"><input type="checkbox" checked={!!f.fail_open} onChange={set('fail_open')} />مجاز در زمان قطعی Redis (فقط سرویس‌های داخلی)</label>
      <Err>{err}</Err>
    </Modal>
  )
}

export default function RateLimits() {
  const [state, setState] = useState(null)
  const [config, setConfig] = useState(null)
  const [savedJson, setSavedJson] = useState('')
  const [usage, setUsage] = useState({ rows: [], error: '' })
  const [sub, setSub] = useState('usage')
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [planForm, setPlanForm] = useState(null)
  const [newWeight, setNewWeight] = useState({ model: '', value: '1' })
  const [newOv, setNewOv] = useState({ scope: 'key', name: '', plan: '' })

  const load = async () => {
    const r = await fresh(B)
    if (r.error) { setErr(r.error.message); return }
    setState({ status: r.data.status || {}, models: r.data.models || [], known: { key: r.data.key_aliases || [], user: r.data.users || [], tenant: r.data.tenants || [] } })
    setSavedJson(JSON.stringify(normalized(r.data.config || {})))
    setConfig(normalized(r.data.config || {}))
    loadUsage()
  }
  const loadUsage = async () => {
    const r = await fresh(`${B}/usage`)
    if (r.error) { setUsage({ rows: [], error: r.error.message }); return }
    const now = r.data.now_ms || Date.now()
    setUsage({ error: r.data.error || '', rows: (r.data.rows || []).map(x => ({ ...x, scope_label: SCOPE_LABELS[x.scope] || x.scope,
      used_label: ratio(x.used, x.limit), running_label: ratio(x.running, x.max_concurrent), rpm_label: ratio(x.rpm, x.rpm_limit),
      next_free_label: x.next_free_at_ms ? duration(x.next_free_at_ms - now) : '—' })) })
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setInterval(() => { if (sub === 'usage' && !document.hidden) loadUsage() }, 15000)
    return () => clearInterval(t)
  }, [sub])

  const update = fn => setConfig(c => { const n = clone(c); fn(n); return n })
  const dirty = config && JSON.stringify(normalized(config)) !== savedJson
  const planNames = useMemo(() => (config ? Object.keys(config.plans).sort() : []), [config])
  const plans = useMemo(() => planNames.map(n => planRow(n, config.plans[n] || {})), [planNames, config])
  const weights = useMemo(() => (config ? Object.entries(config.model_weights).map(([model, weight]) => ({ model, weight, is_default: model === 'default' })) : []), [config])
  const overrides = useMemo(() => (config ? SCOPES.flatMap(s => Object.entries(config.overrides[s] || {}).map(([name, e]) => ({ scope: s, scope_label: SCOPE_LABELS[s], name, plan: e.plan || '', custom: Object.keys(e).some(k => k !== 'plan') }))) : []), [config])

  const uT = useTable(usage.rows, { keys: ['label', 'scope_label', 'tenant', 'plan'], sort: { key: 'percent', dir: 'desc' } })
  const pT = useTable(plans, { keys: ['name'], sort: { key: 'name', dir: 'asc' } })
  const wT = useTable(weights, { keys: ['model'], sort: { key: 'model', dir: 'asc' } })
  const oT = useTable(overrides, { keys: ['name', 'scope_label', 'plan'], sort: { key: 'name', dir: 'asc' } })

  if (err) return <Err>{err}</Err>
  if (!config) return <p className="ak-muted">در حال بارگذاری محدودیت‌ها…</p>
  const st = state.status

  const applyPlan = (name, plan) => {
    const old = planForm.editing
    update(c => {
      const prev = old ? c.plans[old] || {} : {}
      if (prev.models) plan.models = prev.models
      if (prev.model_weights) plan.model_weights = prev.model_weights
      if (old && old !== name) { delete c.plans[old]; renamePlan(c, old, name) }
      c.plans[name] = plan
    })
    setPlanForm(null)
  }
  const editPlan = row => setPlanForm({ editing: row.name, initial: { ...row, requests_per_window: row.requests_per_window ?? '', window_hours: row.window_hours ?? '',
    requests_per_minute: row.requests_per_minute ?? '', max_concurrent: row.max_concurrent ?? '', max_input_tokens: row.max_input_tokens ?? '', max_output_tokens: row.max_output_tokens ?? '' } })
  const delPlan = name => { if (planInUse(config, name)) { notifyError(`پلن «${name}» هنوز تخصیص داده شده؛ ابتدا آن تخصیص‌ها را تغییر دهید`); return } update(c => { delete c.plans[name] }) }
  const setWeight = (model, raw) => { const v = raw === '' ? null : Number(raw); if (!validWeight(v)) { notifyError('هزینه باید ۰ (رایگان) یا بین ۰٫۰۱ و ۱۰۰۰ باشد'); return } update(c => { c.model_weights[model] = v }) }
  const addWeight = () => {
    const m = newWeight.model.trim(), v = newWeight.value === '' ? null : Number(newWeight.value)
    if (!m) { notifyError('یک مدل انتخاب کنید'); return }
    if (!validWeight(v)) { notifyError('هزینه باید ۰ (رایگان) یا بین ۰٫۰۱ و ۱۰۰۰ باشد'); return }
    update(c => { c.model_weights[m] = v }); setNewWeight({ model: '', value: '1' })
  }
  const addOverride = () => {
    const name = newOv.name.trim()
    if (!name || !newOv.plan) { notifyError('یک نام وارد و یک پلن انتخاب کنید'); return }
    update(c => { c.overrides[newOv.scope][name] = { ...(c.overrides[newOv.scope][name] || {}), plan: newOv.plan } })
    setNewOv(s => ({ ...s, name: '' }))
  }

  return (
    <div className="ak-card">
      <h3>محدودیت‌های نرخ</h3>
      <p className="ak-muted">محدودیت هر درخواست عبوری از Gateway: تعداد پیام در پنجره‌ی چرخشی، درخواست در دقیقه، اجرای هم‌زمان و اندازه‌ی درخواست.</p>
      <div className="ak-toolbar">
        <Pill ok={st.enforcing} warn={!st.enforcing}>{st.enforcing ? 'در حال اعمال' : 'هنوز اعمال نمی‌شود'}</Pill>
        <Pill ok={st.redis === 'ok'}>{st.redis === 'ok' ? 'Redis متصل' : 'Redis در دسترس نیست'}</Pill>
        {!st.configmap && <Pill>هنوز پیکربندی‌ای ذخیره نشده</Pill>}
      </div>
      {!st.enforcing && <p className="ak-warn">LiteLLM هنوز callback محدودیت نرخ را بارگذاری نمی‌کند، پس هیچ‌کدام از موارد زیر اعمال نمی‌شود (اسکریپت <span dir="ltr">126-deploy-litellm-quota.sh --wire-litellm</span>).</p>}
      {st.redis_error && <p className="ak-muted" dir="ltr">Redis: {st.redis_error}</p>}
      <div className="ak-toolbar">
        {dirty && <Pill warn>تغییرات ذخیره‌نشده</Pill>}
        <button className="ak-btn ak-primary" disabled={!dirty} onClick={() => setConfirm({ action: 'save' })}>ذخیره‌ی تغییرات</button>
        <button className="ak-btn" disabled={!dirty} onClick={() => { setConfig(normalized(JSON.parse(savedJson))); notifySuccess('تغییرات کنار گذاشته شد') }}>کنار گذاشتن</button>
      </div>

      <nav className="ak-tabs">{SUBS.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>

      {sub === 'usage' && <>
        <p className="ak-muted">هر کسی که در پنجره‌ی فعلی درخواست دارد، مستقیم از Redis؛ هر ۱۵ ثانیه تازه می‌شود.</p>
        {usage.error && <p className="ak-muted" dir="ltr">{usage.error}</p>}
        <div className="ak-toolbar"><div className="spacer" />{uT.search('فیلتر نام، تیم یا پلن…')}</div>
        <div className="ak-table-scroll"><table className="ak-table"><thead><tr>{uT.th('label', 'نام')}{uT.th('scope_label', 'نوع')}{uT.th('tenant', 'تیم')}{uT.th('plan', 'پلن')}
          {uT.th('percent', 'پیام مصرف‌شده')}{uT.th('remaining', 'باقی‌مانده')}{uT.th('running', 'در حال اجرا')}{uT.th('rpm', 'دقیقه‌ی اخیر')}{uT.th('next_free_at_ms', 'آزاد شدن پیام بعدی')}<th /></tr></thead>
          <tbody>{uT.shown.map((r, i) => (
            <tr key={i}><td dir="auto">{r.label}</td><td>{r.scope_label}</td><td dir="auto">{dash(r.tenant)}</td><td dir="ltr">{r.plan || 'بدون محدودیت'}</td>
              <td><Pill ok={r.percent < 70} warn={r.percent >= 70}><span dir="ltr">{r.used_label}</span></Pill></td><td dir="ltr">{dash(r.remaining)}</td>
              <td dir="ltr">{r.running_label}</td><td dir="ltr">{r.rpm_label}</td><td dir="ltr">{r.next_free_label}</td>
              <td><button className="ak-btn" onClick={() => setConfirm({ action: 'reset', target: r })}>صفر کردن مصرف</button></td></tr>
          ))}</tbody></table></div>
        {!usage.rows.length && <p className="ak-muted">در هیچ پنجره‌ی فعلی درخواستی نیست.</p>}
        {uT.pager}
      </>}

      {sub === 'plans' && <>
        <p className="ak-muted">پلن مجموعه‌ای از محدودیت‌هاست؛ خالی یعنی بدون محدودیت. پیام‌ها در پنجره‌ی چرخشی شمرده می‌شوند (مثلاً ۵۰ در هر ۴ ساعت).</p>
        <div className="ak-toolbar"><button className="ak-btn ak-primary" onClick={() => setPlanForm({ editing: '', initial: { ...EMPTY_PLAN } })}>افزودن پلن</button><div className="spacer" />{pT.search('فیلتر پلن‌ها…')}</div>
        <div className="ak-table-scroll"><table className="ak-table"><thead><tr>{pT.th('name', 'پلن')}{pT.th('requests_per_window', 'پیام در پنجره')}{pT.th('window_hours', 'پنجره (ساعت)')}{pT.th('requests_per_minute', 'درخواست در دقیقه')}
          {pT.th('max_concurrent', 'هم‌زمان')}{pT.th('max_input_tokens', 'توکن ورودی')}{pT.th('max_output_tokens', 'توکن خروجی')}{pT.th('fail_open', 'مجاز بدون Redis')}<th /></tr></thead>
          <tbody>{pT.shown.map(p => (
            <tr key={p.name}><td dir="ltr">{p.name}</td><td dir="ltr">{dash(p.requests_per_window)}</td><td dir="ltr">{dash(p.window_hours)}</td><td dir="ltr">{dash(p.requests_per_minute)}</td>
              <td dir="ltr">{dash(p.max_concurrent)}</td><td dir="ltr">{dash(p.max_input_tokens)}</td><td dir="ltr">{dash(p.max_output_tokens)}</td><td>{p.fail_open ? 'بله' : 'خیر'}</td>
              <td className="ak-actions-cell"><button className="ak-btn" onClick={() => editPlan(p)}>ویرایش</button><button className="ak-btn ak-danger" onClick={() => delPlan(p.name)}>حذف</button></td></tr>
          ))}</tbody></table></div>
        {pT.pager}
      </>}

      {sub === 'weights' && <>
        <p className="ak-muted">هر درخواست به هر مدل چند «پیام» مصرف می‌کند (مثلاً ۲ برای مدل سنگین، ۰٫۱ برای سبک، ۰ رایگان). مدل‌های فهرست‌نشده از ردیف default پیروی می‌کنند.</p>
        <div className="ak-toolbar"><div className="spacer" />{wT.search('فیلتر مدل‌ها…')}</div>
        <div className="ak-table-scroll"><table className="ak-table"><thead><tr>{wT.th('model', 'مدل')}{wT.th('weight', 'پیام به ازای درخواست')}<th /></tr></thead>
          <tbody>{wT.shown.map(w => (
            <tr key={w.model}><td dir="ltr">{w.model}</td>
              <td><input className="ak-input" style={{ width: '7em' }} type="number" min="0" max="1000" step="0.01" dir="ltr" defaultValue={w.weight} onBlur={e => String(w.weight) !== e.target.value && setWeight(w.model, e.target.value)} /></td>
              <td>{!w.is_default && <button className="ak-btn ak-danger" onClick={() => update(c => { delete c.model_weights[w.model] })}>حذف</button>}</td></tr>
          ))}</tbody></table></div>
        {wT.pager}
        <div className="ak-row" style={{ alignItems: 'flex-end' }}>
          <Field label="مدل (نامی که کلاینت می‌فرستد)"><input className="ak-input" dir="ltr" list="rl-models" placeholder="e.g. glm" value={newWeight.model} onChange={e => setNewWeight(s => ({ ...s, model: e.target.value }))} />
            <datalist id="rl-models">{state.models.map(m => <option key={m} value={m} />)}</datalist></Field>
          <Field label="پیام به ازای درخواست"><input className="ak-input" type="number" min="0" max="1000" step="0.01" dir="ltr" value={newWeight.value} onChange={e => setNewWeight(s => ({ ...s, value: e.target.value }))} /></Field>
          <button className="ak-btn ak-primary" style={{ marginBottom: 12 }} onClick={addWeight}>افزودن هزینه‌ی مدل</button>
        </div>
      </>}

      {sub === 'assign' && <>
        <h3>پلن پیش‌فرض</h3>
        <p className="ak-muted">برای هر کلید API، کاربر و تیمی که تخصیص مشخص ندارد اعمال می‌شود. هر درخواست باید در محدودیت کلید، کاربر و تیمش جا شود.</p>
        <table className="ak-table"><thead><tr><th>اعمال روی</th><th>پلن</th></tr></thead>
          <tbody>{SCOPES.map(s => (
            <tr key={s}><td>{SCOPE_LABELS[s]}</td><td><select className="ak-select" dir="ltr" value={config.defaults[s] || ''} onChange={e => update(c => { c.defaults[s] = e.target.value || null })}>
              <option value="">بدون محدودیت</option>{planNames.map(p => <option key={p} value={p}>{p}</option>)}</select></td></tr>
          ))}</tbody></table>
        <h3>تخصیص‌های مشخص</h3>
        <p className="ak-muted">به یک کلید API (با alias)، کاربر (با شناسه یا ایمیل) یا تیم (با شناسه یا نام) پلن خودش را بدهید.</p>
        <div className="ak-toolbar"><div className="spacer" />{oT.search('فیلتر تخصیص‌ها…')}</div>
        <div className="ak-table-scroll"><table className="ak-table"><thead><tr>{oT.th('name', 'نام')}{oT.th('scope_label', 'نوع')}{oT.th('plan', 'پلن')}<th /></tr></thead>
          <tbody>{oT.shown.map(o => (
            <tr key={o.scope + o.name}><td dir="auto">{o.name}</td><td>{o.scope_label}</td>
              <td><select className="ak-select" dir="ltr" value={o.plan} onChange={e => update(c => { c.overrides[o.scope][o.name].plan = e.target.value })}>{planNames.map(p => <option key={p} value={p}>{p}</option>)}</select>
                {o.custom && <Pill>+ محدودیت سفارشی در quota.yaml</Pill>}</td>
              <td><button className="ak-btn ak-danger" onClick={() => update(c => { delete c.overrides[o.scope][o.name] })}>حذف</button></td></tr>
          ))}</tbody></table></div>
        {oT.pager}
        <div className="ak-row" style={{ alignItems: 'flex-end' }}>
          <Field label="نوع"><select className="ak-select" value={newOv.scope} onChange={e => setNewOv(s => ({ ...s, scope: e.target.value }))}>{SCOPES.map(s => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}</select></Field>
          <Field label="نام"><input className="ak-input" dir="ltr" list="rl-names" value={newOv.name} onChange={e => setNewOv(s => ({ ...s, name: e.target.value }))} />
            <datalist id="rl-names">{(state.known[newOv.scope] || []).map(n => <option key={n} value={n} />)}</datalist></Field>
          <Field label="پلن"><select className="ak-select" dir="ltr" value={newOv.plan} onChange={e => setNewOv(s => ({ ...s, plan: e.target.value }))}><option value="">— انتخاب —</option>{planNames.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
          <button className="ak-btn ak-primary" style={{ marginBottom: 12 }} onClick={addOverride}>افزودن تخصیص</button>
        </div>
      </>}

      {sub === 'policies' && <>
        <h3>درخواست‌های ناموفق</h3>
        <p className="ak-muted">آیا درخواستی که کامل نشده باز هم یک پیام مصرف می‌کند؟ غیرفعال یعنی پیام برمی‌گردد. جایگاه هم‌زمانی همیشه آزاد می‌شود.</p>
        <table className="ak-table"><thead><tr><th>خطا</th><th>از سهمیه کم می‌شود</th></tr></thead>
          <tbody>{FAILURES.map(([id, l]) => <tr key={id}><td>{l}</td><td><input type="checkbox" checked={!!config.charge_failed[id]} onChange={e => update(c => { c.charge_failed[id] = e.target.checked })} /></td></tr>)}</tbody></table>
        <h3>سیاست‌های دیگر</h3>
        <div className="ak-row">
          <Field label="وقتی max_tokens بیشتر از سقف پلن است"><select className="ak-select" value={config.max_tokens_policy} onChange={e => update(c => { c.max_tokens_policy = e.target.value })}>
            <option value="clamp">تا سقف کم شود</option><option value="reject">درخواست رد شود</option></select></Field>
          <Field label="وقتی Redis در دسترس نیست"><select className="ak-select" value={config.on_redis_error} onChange={e => update(c => { c.on_redis_error = e.target.value })}>
            <option value="closed">رد درخواست‌ها (امن)</option><option value="local">محدودیت تقریبی برای هر سرور</option></select></Field>
        </div>
        <p className="ak-muted">پلن‌هایی که «مجاز بدون Redis» دارند در هر حال عبور می‌کنند. تغییر آدرس خود Redis به راه‌اندازی دوباره‌ی LiteLLM نیاز دارد.</p>
      </>}

      {planForm && <PlanForm {...planForm} config={config} onClose={() => setPlanForm(null)} onApply={applyPlan} />}
      {confirm && <Confirm {...confirm} config={config} onClose={() => setConfirm(null)} onDone={() => { const c = confirm; setConfirm(null); c.action === 'save' ? load() : loadUsage() }} />}
    </div>
  )
}
