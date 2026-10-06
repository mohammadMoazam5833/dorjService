import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { apiSend } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { decorate, validateArgs, fittingNodes, reservedFor, STATUS_LABELS } from '../../lib/admin/models.js'
import { Field, Err, Modal, Pill, useTable, useCaptcha } from './kit.jsx'
import './models.css'
import Spinner, { Loading } from '../../components/Spinner.jsx'

const RateLimits = lazy(() => import('./RateLimits.jsx'))
const B = '/admin-panel/api/admin/models'
const KAGGLE = '/admin-panel/api/admin/kaggle-credentials'
const HF_TOKEN = '/admin-panel/api/admin/hf-token'
const ROUTES = '/admin-panel/api/admin/litellm/routes'
const fresh = p => getJson(`${p}${p.includes('?') ? '&' : '?'}t=${Date.now()}`, { ttlMs: 0 })
const ENGINES = [['vllm', 'vLLM'], ['sglang', 'SGLang'], ['llamacpp', 'llama.cpp (GGUF)']]
const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/
const bytes = n => { if (n == null) return ''; const u = ['B', 'KiB', 'MiB', 'GiB', 'TiB']; let v = n, i = 0; while (v >= 1024 && i < 4) { v /= 1024; i++ } return `${v.toFixed(1)} ${u[i]}` }
const statusVariant = s => (s === 'serving' ? 'ok' : s === 'download_failed' ? 'err' : s === 'not_downloaded' ? '' : 'warn')

// Every catalogue/gateway action needs the admin's password + captcha (server-enforced).
const ACTIONS = {
  download: m => [`${B}/${m.id}/download`, 'POST', `دانلود ${m.display_name} آغاز شد`],
  deploy: m => [`${B}/${m.id}/deploy`, 'POST', `استقرار ${m.display_name} آغاز شد`],
  pause: m => [`${B}/${m.id}/${m.is_download_phase ? 'download' : 'deploy'}/pause`, 'POST', `${m.display_name} متوقف شد`],
  resume: m => [`${B}/${m.id}/${m.is_download_phase ? 'download' : 'deploy'}/resume`, 'POST', `${m.display_name} ادامه یافت`],
  undeploy: m => [`${B}/${m.id}/undeploy`, 'POST', `سرویس‌دهی ${m.display_name} متوقف شد`],
  delete: m => [`${B}/${m.id}`, 'DELETE', `${m.display_name} حذف شد`],
  configure_deploy: m => [`${B}/${m.id}/configure-deploy`, 'POST', `استقرار ${m.display_name} آغاز شد`],
  import: () => [`${B}/import`, 'POST', 'وارد شد؛ دانلود آغاز شد'],
  save_kaggle: () => [KAGGLE, 'POST', 'اطلاعات Kaggle ذخیره شد'],
  save_hf_token: () => [HF_TOKEN, 'POST', 'توکن HuggingFace ذخیره شد'],
  add_route: () => [ROUTES, 'POST', 'مسیر Gateway ذخیره شد'],
  delete_route: r => [`${ROUTES}/${r.id}`, 'DELETE', `مسیر ${r.model_name} حذف شد`],
}
const WARN = {
  deploy: t => (t.conflicts_currently_serving?.length ? `استقرار ${t.display_name}، مدل(های) در حال سرویس‌دهی ${t.conflicts_currently_serving.join('، ')} را متوقف می‌کند (همان GPUها).` : `استقرار ${t.display_name}؟`),
  undeploy: t => `سرویس‌دهی ${t.display_name} متوقف شود؟ وزن‌ها روی دیسک می‌مانند.`,
  delete: t => `${t.display_name} برای همیشه حذف شود؟ وزن‌های دانلودشده هم پاک می‌شوند و برای استفاده‌ی دوباره باید دوباره دانلود شوند.`,
  import: (_, x) => `${x.repo_id} وارد و دانلود شود؟ این کار زمان، پهنای باند و فضای ذخیره‌سازی واقعی مصرف می‌کند.`,
  delete_route: t => `مسیر Gateway «${t.model_name}» حذف شود؟ هر کلاینتی که از این نام/مستعار استفاده می‌کند بلافاصله از کار می‌افتد.`,
}

function ConfirmAction({ action, target, extra, onClose, onDone }) {
  const cap = useCaptcha()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [url, method, ok] = ACTIONS[action](target || {})
  const submit = async () => {
    if (!password) { setErr('گذرواژه‌ی شما لازم است'); return }
    if (!cap.answer) { setErr('کد امنیتی را وارد کنید'); return }
    setBusy(true); setErr('')
    const r = await apiSend(url, method, { password, captcha_token: cap.token, captcha_answer: cap.answer, ...(extra || {}) })
    setBusy(false)
    if (r.error) { setErr(r.error.message); cap.reload(); return }
    notifySuccess(ok); onDone()
  }
  const title = target?.display_name || target?.model_name || extra?.repo_id || (action === 'save_kaggle' ? 'اطلاعات Kaggle' : action === 'save_hf_token' ? 'توکن HuggingFace' : '')
  return (
    <Modal title={`تأیید: ${title}`} onClose={onClose} busy={busy}
      actions={<><button className="ak-btn" onClick={onClose} disabled={busy}>انصراف</button><button className="ak-btn ak-primary" onClick={submit} disabled={busy}>{busy ? <Spinner label="در حال انجام" /> : 'تأیید'}</button></>}>
      {WARN[action] && <p className="ak-warn" dir="auto">{WARN[action](target || {}, extra || {})}</p>}
      <p className="ak-muted">برای امنیت، هر عملیات در این بخش به گذرواژه‌ی شما و کد امنیتی زیر نیاز دارد.</p>
      <Field label="گذرواژه‌ی شما"><input className="ak-input" type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoFocus /></Field>
      {cap.view}
      <Err>{err}</Err>
    </Modal>
  )
}

function Configure({ m, onClose, onSubmit }) {
  const [engine, setEngine] = useState(m.engine || 'vllm')
  const [args, setArgs] = useState('')
  const [warning, setWarning] = useState('')
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes] = useState([])
  const [res, setRes] = useState('')
  const [gpu, setGpu] = useState(m.gpu_required != null ? String(m.gpu_required) : '1')
  const [reps, setReps] = useState(m.replicas != null ? String(m.replicas) : '1')
  const [node, setNode] = useState('')
  const [alias, setAlias] = useState(m.litellm_alias || '')
  const [err, setErr] = useState('')
  useEffect(() => {
    const real = (m.vllm_args || []).length > 0
    Promise.allSettled([real ? Promise.resolve(null) : fresh(`${B}/${m.id}/suggested-config?engine=${m.engine || 'vllm'}`), fresh(`${B}/gpu-nodes`)]).then(([s, g]) => {
      if (real) setArgs(m.vllm_args.filter(a => !reservedFor(m.engine).has(a.split('=')[0])).join('\n'))
      else if (s.value?.data) { setArgs((s.value.data.suggested_args || []).join('\n')); setWarning(s.value.data.warning || '') }
      else setWarning(s.value?.error?.message || 'پیشنهادی دریافت نشد؛ پارامترها را دستی وارد کنید.')
      const ns = g.value?.data || []
      setNodes(ns)
      const seen = new Map(); ns.forEach(n => (n.resources || []).forEach(r => seen.set(r.resource_name, r.label)))
      setRes(seen.has('nvidia.com/gpu') ? 'nvidia.com/gpu' : [...seen.keys()][0] || '')
      setLoading(false)
    })
  }, [m.id])
  const resources = (() => { const s = new Map(); nodes.forEach(n => (n.resources || []).forEach(r => s.set(r.resource_name, r.label))); return [...s] })()
  const fit = fittingNodes(nodes, parseInt(gpu, 10) || 0, res, m)
  const chosen = fit.some(n => n.name === node) ? node : (fit.find(n => n.name === m.node)?.name || fit[0]?.name || '')
  const submit = () => {
    const c = validateArgs(args, engine); if (!c.ok) { setErr(c.error); return }
    const g = parseInt(gpu, 10); if (Number.isNaN(g) || g < 0 || g > 8) { setErr('تعداد GPU باید عددی بین ۰ تا ۸ باشد'); return }
    const r = parseInt(reps, 10); if (Number.isNaN(r) || r < 1 || r > 8) { setErr('تعداد Replica باید عددی بین ۱ تا ۸ باشد'); return }
    if (!chosen) { setErr('هیچ نودی ظرفیت آزاد کافی برای این تعداد GPU ندارد'); return }
    const a = alias.trim().toLowerCase(); if (a && !ALIAS_RE.test(a)) { setErr('مستعار Gateway فقط حروف کوچک/رقم/./-/_ (حداکثر ۶۴)'); return }
    onSubmit({ args: c.args, engine, node: chosen, gpu_required: g, gpu_resource_name: res, replicas: r, litellm_alias: a })
  }
  const flagsLabel = engine === 'llamacpp' ? 'پارامترهای اجرای llama.cpp (هر خط یکی، مثلاً -ngl=999)' : `پارامترهای اجرای ${engine === 'sglang' ? 'SGLang' : 'vLLM'} (هر خط یکی؛ پیش از استقرار بررسی کنید)`
  return (
    <Modal wide title={`پیکربندی و استقرار: ${m.display_name}`} onClose={onClose}
      actions={<><button className="ak-btn" onClick={onClose}>انصراف</button><button className="ak-btn ak-primary" onClick={submit} disabled={loading}>استقرار با این تنظیمات</button></>}>
      {loading && <Loading label="در حال بررسی فایل‌های دانلودشده برای پیشنهاد اولیه" />}
      {warning && <p className="ak-muted" dir="auto">{warning}</p>}
      <div className="ak-row">
        <Field label="موتور"><select className="ak-select" dir="ltr" value={engine} onChange={e => setEngine(e.target.value)}>{ENGINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="نوع GPU"><select className="ak-select" dir="ltr" value={res} onChange={e => setRes(e.target.value)}>{resources.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="تعداد GPU"><input className="ak-input" type="number" min="0" max="8" value={gpu} onChange={e => setGpu(e.target.value)} /></Field>
        <Field label="Replica" hint="هر Replica یک نسخه‌ی کامل مدل روی GPUهای خودش است (GPU × Replica آزاد لازم است)."><input className="ak-input" type="number" min="1" max="8" value={reps} onChange={e => setReps(e.target.value)} /></Field>
      </div>
      <Field label="نود">
        {fit.length ? <select className="ak-select" dir="ltr" value={chosen} onChange={e => setNode(e.target.value)}>{fit.map(n => <option key={n.name} value={n.name}>{`${n.name} (${n.resource.free}/${n.resource.total} ${n.resource.label} free)`}</option>)}</select>
          : <span className="ak-err">هیچ نودی ظرفیت آزاد کافی برای این تعداد GPU ندارد.</span>}
      </Field>
      <Field label={flagsLabel}><textarea className="ak-textarea mono" dir="ltr" rows={10} spellCheck={false} value={args} onChange={e => setArgs(e.target.value)} /></Field>
      <Field label="مستعار Gateway (اختیاری)"><input className="ak-input" dir="ltr" placeholder="e.g. glm" value={alias} onChange={e => setAlias(e.target.value)} /></Field>
      <Err>{err}</Err>
    </Modal>
  )
}

function Tile({ m, open, act, configure }) {
  const pct = m.copy_progress?.total_bytes ? Math.min(100, Math.round((m.copy_progress.copied_bytes / m.copy_progress.total_bytes) * 100)) : 0
  const stop = fn => e => { e.stopPropagation(); fn() }
  return (
    <div className="md-tile" onClick={() => open(m)}>
      <div className="md-tile-head"><span className="md-icon">{(m.family_label || '?').slice(0, 2).toUpperCase()}</span><Pill ok={m.status === 'serving'} warn={statusVariant(m.status) === 'warn'}>{['downloading', 'copying', 'deploying'].includes(m.status) && <Spinner size={11} label={m.status_label} />} {m.status_label}</Pill></div>
      <h3 dir="auto">{m.display_name}</h3>
      {m.source_repo && <p className="md-src" dir="ltr">{m.source_repo}</p>}
      <div className="md-meta">
        {m.copy_progress && <><div className="md-bar"><div style={{ width: `${pct}%` }} /></div><p className="ak-muted" dir="ltr">{bytes(m.copy_progress.copied_bytes)} / {bytes(m.copy_progress.total_bytes)} ({pct}%)</p></>}
        {m.deploy_progress && <><div className="md-bar"><div style={{ width: `${m.deploy_progress.percent}%` }} /></div><p className="ak-muted">بارگذاری وزن‌ها: {m.deploy_progress.shards_loaded}/{m.deploy_progress.shards_total} ({m.deploy_progress.percent}%)</p></>}
        <div>GPU: {m.gpu_required}</div>
        <div dir="ltr">Engine: {m.engine}</div>
        {m.tokens_per_sec && <div>Tokens/sec: {m.tokens_per_sec}</div>}
        {m.node && <div>نود: <bdi dir="ltr">{m.node}</bdi></div>}
        {m.litellm_alias && <div>مستعار Gateway: <bdi dir="ltr">{m.litellm_alias}</bdi></div>}
        {!m.in_flight && m.status !== 'serving' && (
          <div>قابل استقرار: <Pill ok={m.deployable_now}>{m.deployable_now ? 'بله' : 'خیر'}</Pill>
            {!m.deployable && m.deploy_blocked_reason && <p className="ak-muted" dir="auto">{m.deploy_blocked_reason}</p>}
            {m.conflicts_currently_serving?.length > 0 && <p className="ak-muted">متوقف می‌شود: {m.conflicts_currently_serving.join('، ')}</p>}</div>
        )}
      </div>
      <div className="md-actions">
        {m.status === 'not_downloaded' && <button className="ak-btn ak-primary" onClick={stop(() => act('download', m))}>دانلود</button>}
        {m.status === 'download_failed' && <><button className="ak-btn ak-primary" onClick={stop(() => act('download', m, { force: true }))}>تلاش دوباره</button><button className="ak-btn ak-danger" onClick={stop(() => act('delete', m))}>حذف</button></>}
        {m.pausable && <button className="ak-btn" onClick={stop(() => act('pause', m))}>توقف موقت</button>}
        {m.resumable && <><button className="ak-btn ak-primary" onClick={stop(() => act('resume', m))}>ادامه</button><button className="ak-btn ak-danger" onClick={stop(() => act('delete', m))}>حذف</button></>}
        {m.status === 'deploying' && <><button className="ak-btn" disabled><Spinner label={m.status_label} text /></button><button className="ak-btn ak-primary" onClick={stop(() => configure(m))}>پیکربندی دوباره</button><button className="ak-btn ak-danger" onClick={stop(() => act('delete', m))}>حذف</button></>}
        {m.status === 'downloaded' && <>{m.deployable ? <button className="ak-btn ak-primary" onClick={stop(() => act('deploy', m, m.conflicts_currently_serving?.length ? { confirm_stop_conflicts: true } : {}))}>استقرار</button>
          : <button className="ak-btn ak-primary" onClick={stop(() => configure(m))}>پیکربندی</button>}<button className="ak-btn ak-danger" onClick={stop(() => act('delete', m))}>حذف</button></>}
        {m.status === 'serving' && <><button className="ak-btn" onClick={stop(() => configure(m))}>پیکربندی دوباره</button><button className="ak-btn" onClick={stop(() => act('undeploy', m))}>توقف</button><button className="ak-btn ak-danger" onClick={stop(() => act('delete', m))}>حذف</button></>}
      </div>
    </div>
  )
}

function Search({ act }) {
  const [source, setSource] = useState('huggingface')
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [detail, setDetail] = useState(null)
  const t = useTable(results, { keys: ['repo_id'], sort: { key: 'downloads', dir: 'desc' } })
  const go = async () => {
    if (!q.trim()) return
    setLoading(true); setErr('')
    const r = await fresh(`${B}/search?source=${encodeURIComponent(source)}&q=${encodeURIComponent(q.trim())}`)
    setLoading(false)
    if (r.error) { setErr(r.error.message); setResults([]); return }
    setResults(r.data || [])
  }
  const openDetail = async row => {
    setDetail({ loading: true })
    const r = await fresh(`${B}/search-detail?source=${encodeURIComponent(row.source)}&repo_id=${encodeURIComponent(row.repo_id)}`)
    setDetail(r.error ? { error: r.error.message } : { data: r.data })
  }
  const d = detail?.data
  return (
    <div className="ak-card">
      <p className="ak-muted">در HuggingFace یا Kaggle جستجو کنید و مدل را به کاتالوگ بالا وارد کنید. مدل واردشده بلافاصله دانلود می‌شود؛ پارامترهای واقعی اجرا را پیش از استقرار بررسی و تنظیم می‌کنید.</p>
      <div className="ak-row" style={{ alignItems: 'flex-end' }}>
        <Field label="منبع"><select className="ak-select" value={source} onChange={e => setSource(e.target.value)}><option value="huggingface">HuggingFace</option><option value="kaggle">Kaggle</option></select></Field>
        <Field label="عبارت جستجو"><input className="ak-input" dir="ltr" placeholder="e.g. Qwen3" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} /></Field>
        <button className="ak-btn ak-primary" style={{ marginBottom: 12 }} onClick={go} disabled={loading}>{loading ? <Spinner label="در حال جستجو" /> : 'جستجو'}</button>
      </div>
      <Err>{err}</Err>
      {results.length > 0 && (
        <>
          <div className="ak-toolbar"><div className="spacer" />{t.search('فیلتر نتایج…')}</div>
          <div className="ak-table-scroll">
            <table className="ak-table"><thead><tr>{t.th('repo_id', 'مخزن')}{t.th('pipeline_tag', 'نوع')}{t.th('downloads', 'دانلود')}{t.th('likes', 'پسند')}{t.th('file_count', 'فایل‌ها')}<th /></tr></thead>
              <tbody>{t.shown.map(r => (
                <tr key={r.repo_id} onClick={() => openDetail(r)} style={{ cursor: 'pointer' }}>
                  <td dir="ltr"><strong>{r.repo_id}</strong>{r.gated && <Pill warn>Gated</Pill>}</td><td dir="ltr">{r.pipeline_tag || '—'}</td>
                  <td>{r.downloads}</td><td>{r.likes}</td><td>{r.file_count ?? '—'}</td>
                  <td><button className="ak-btn ak-primary" onClick={e => { e.stopPropagation(); act('import', null, { repo_id: r.repo_id, source: r.source }) }}>وارد کردن و دانلود</button></td>
                </tr>
              ))}</tbody></table>
            {t.pager}
          </div>
        </>
      )}
      {detail && (
        <Modal wide title={d?.repo_id || '…'} onClose={() => setDetail(null)}
          actions={<><button className="ak-btn" onClick={() => setDetail(null)}>بستن</button>{d && <button className="ak-btn ak-primary" onClick={() => { setDetail(null); act('import', null, { repo_id: d.repo_id, source: d.source }) }}>وارد کردن و دانلود</button>}</>}>
          {detail.loading && <Loading />}
          <Err>{detail.error}</Err>
          {d && <>
            <div className="ak-toolbar">{d.pipeline_tag && <Pill>{d.pipeline_tag}</Pill>}{d.library_name && <Pill>{d.library_name}</Pill>}{d.gated && <Pill warn>Gated</Pill>}</div>
            <p className="ak-kv">دانلود: {d.downloads} · پسند: {d.likes}{d.license ? ` · مجوز: ${d.license}` : ''}</p>
            {d.readme_preview ? <pre className="md-readme" dir="auto">{d.readme_preview}</pre> : <p className="ak-muted">توضیحی برای این مخزن موجود نیست.</p>}
            {d.files?.length > 0 && <p className="ak-muted">فایل‌ها ({d.files.length}): <span dir="ltr">{d.files.slice(0, 15).join('، ')}{d.files.length > 15 ? ` +${d.files.length - 15}` : ''}</span></p>}
          </>}
        </Modal>
      )}
    </div>
  )
}

function Kaggle({ act }) {
  const [configured, setConfigured] = useState(false)
  const [user, setUser] = useState('')
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { fresh(`${KAGGLE}/status`).then(r => setConfigured(!!r.data?.configured)) }, [])
  const save = () => {
    setErr('')
    if (!user.trim() || !key.trim()) { setErr('نام کاربری و کلید هر دو لازم است'); return }
    act('save_kaggle', null, { username: user.trim(), key: key.trim() }, () => { setUser(''); setKey(''); fresh(`${KAGGLE}/status`).then(r => setConfigured(!!r.data?.configured)) })
  }
  return (
    <div className="ak-card">
      <h3>اطلاعات Kaggle</h3>
      <p className="ak-muted">فقط برای جستجو/وارد کردن از Kaggle لازم است؛ به‌صورت Secret در Kubernetes ذخیره می‌شود و پس از ذخیره نمایش داده نمی‌شود.</p>
      <Pill ok={configured}>{configured ? 'تنظیم شده' : 'تنظیم نشده'}</Pill>
      <div className="ak-row" style={{ marginTop: 10 }}>
        <Field label="نام کاربری Kaggle"><input className="ak-input" dir="ltr" autoComplete="off" value={user} onChange={e => setUser(e.target.value)} /></Field>
        <Field label="کلید API Kaggle"><input className="ak-input" type="password" dir="ltr" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></Field>
      </div>
      <Err>{err}</Err>
      <button className="ak-btn ak-primary" onClick={save}>ذخیره</button>
    </div>
  )
}

function HfToken({ act }) {
  const [configured, setConfigured] = useState(false)
  const [token, setToken] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { fresh(`${HF_TOKEN}/status`).then(r => setConfigured(!!r.data?.configured)) }, [])
  const save = () => {
    setErr('')
    if (!token.trim()) { setErr('توکن لازم است'); return }
    act('save_hf_token', null, { token: token.trim() }, () => { setToken(''); fresh(`${HF_TOKEN}/status`).then(r => setConfigured(!!r.data?.configured)) })
  }
  return (
    <div className="ak-card">
      <h3>توکن HuggingFace</h3>
      <p className="ak-muted">برای دانلود مدل‌های گیت‌شده لازم است؛ حساب مربوطه باید ابتدا مجوز مدل را در huggingface.co بپذیرد. به‌صورت Secret در Kubernetes ذخیره می‌شود و پس از ذخیره نمایش داده نمی‌شود.</p>
      <Pill ok={configured}>{configured ? 'تنظیم شده' : 'تنظیم نشده'}</Pill>
      <div className="ak-row" style={{ marginTop: 10 }}>
        <Field label="توکن دسترسی HuggingFace"><input className="ak-input" type="password" dir="ltr" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></Field>
      </div>
      <Err>{err}</Err>
      <button className="ak-btn ak-primary" onClick={save}>ذخیره</button>
    </div>
  )
}

function Gateway({ act }) {
  const [data, setData] = useState({ routes: [], available_targets: [] })
  const load = () => fresh(ROUTES).then(r => r.data && setData({ routes: r.data.routes || [], available_targets: r.data.available_targets || [] }))
  useEffect(() => { load() }, [])
  const t = useTable(data.routes, { keys: ['model_name', 'model_target', 'api_base'], sort: { key: 'model_name', dir: 'asc' } })
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [err, setErr] = useState('')
  const picked = data.available_targets.find(x => x.label === target)
  const toggle = async r => {
    const hidden = !r.hidden
    const res = await apiSend(`${ROUTES}/${encodeURIComponent(r.model_name)}/visibility`, 'PUT', { hidden })
    if (res.error) { notifyError(res.error.message); return }
    notifySuccess(hidden ? `${r.model_name} از فهرست مدل‌ها پنهان شد` : `${r.model_name} در فهرست مدل‌ها نمایش داده می‌شود`); load()
  }
  const add = () => {
    setErr('')
    const n = name.trim().toLowerCase()
    if (!n || !picked) { setErr('نام/مستعار مدل لازم است و باید یک بک‌اند انتخاب شود'); return }
    if (!ALIAS_RE.test(n)) { setErr('نام مدل فقط حروف کوچک/رقم/./-/_ (حداکثر ۶۴)'); return }
    act('add_route', null, { model_name: n, model_target: picked.model_target, api_base: picked.api_base }, () => { setName(''); setTarget(''); load() })
  }
  return (
    <div className="ak-card">
      <h3>مسیریابی Gateway</h3>
      <p className="ak-muted">هر مدلی که از Gateway سرویس داده می‌شود از یکی از این مسیرها عبور می‌کند. مسیرهای «ثابت» از قالب مخزن می‌آیند و فقط مسیرهای «پویا»ی دستی قابل حذف‌اند.</p>
      <div className="ak-toolbar"><div className="spacer" />{t.search('فیلتر مسیرها…')}</div>
      <div className="ak-table-scroll">
        <table className="ak-table"><thead><tr>{t.th('model_name', 'نام مدل')}{t.th('model_target', 'هدف')}{t.th('api_base', 'API base')}<th>منبع</th><th>نمایش</th><th /></tr></thead>
          <tbody>{t.shown.map(r => (
            <tr key={r.id || r.model_name}>
              <td dir="ltr">{r.model_name}</td><td dir="ltr">{r.model_target}</td><td dir="ltr">{r.api_base}</td>
              <td>{r.editable ? <Pill>پویا</Pill> : <Pill>ثابت</Pill>}</td>
              <td><input type="checkbox" checked={!r.hidden} onChange={() => toggle(r)} /></td>
              <td>{r.editable && r.manual && <button className="ak-btn ak-danger" onClick={() => act('delete_route', r, null, load)}>حذف</button>}</td>
            </tr>
          ))}</tbody></table>
        {t.pager}
      </div>
      <h3>افزودن مسیر</h3>
      <div className="ak-row">
        <Field label="نام / مستعار مدل"><input className="ak-input" dir="ltr" placeholder="e.g. glm" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="بک‌اند (هدف + API base)" hint={picked ? `${picked.model_target} → ${picked.api_base}` : undefined}>
          <select className="ak-select" dir="ltr" value={target} onChange={e => setTarget(e.target.value)}>
            <option value="">— یک بک‌اند سرویس‌دهنده انتخاب کنید —</option>{data.available_targets.map(x => <option key={x.label} value={x.label}>{x.label}</option>)}
          </select>
        </Field>
      </div>
      <Err>{err}</Err>
      <button className="ak-btn ak-primary" onClick={add}>افزودن مسیر</button>
    </div>
  )
}

export default function Models() {
  const [models, setModels] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState(null)
  const [detail, setDetail] = useState(null)
  const [configure, setConfigure] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const pollers = useRef({})

  const load = async () => {
    const r = await fresh(B)
    if (r.error) { setErr(`بارگذاری مدل‌ها ناموفق بود (${r.error.status})`); return }
    const ms = (r.data || []).map(decorate)
    setModels(ms)
    ms.filter(m => m.in_flight).forEach(m => poll(m.id))
  }
  // in-flight models refresh themselves every 4s until they settle
  const poll = id => {
    if (pollers.current[id]) return
    pollers.current[id] = setInterval(async () => {
      const r = await fresh(`${B}/${id}/status`)
      if (!r.data) return
      const row = decorate(r.data)
      setModels(ms => (ms || []).map(m => (m.id === id ? row : m)))
      if (!row.in_flight) {
        clearInterval(pollers.current[id]); delete pollers.current[id]
        if (row.status === 'serving' || row.status === 'downloaded') notifySuccess(`${row.display_name}: ${STATUS_LABELS[row.status]}`)
      }
    }, 4000)
  }
  useEffect(() => { load(); return () => Object.values(pollers.current).forEach(clearInterval) }, [])

  const families = []
  for (const m of models || []) if (!families.some(f => f[0] === m.family)) families.push([m.family, m.family_label])
  const tabs = [...families, ['__search', 'جستجو'], ['__settings', 'تنظیمات'], ['__litellm', 'Gateway'], ['__ratelimits', 'محدودیت نرخ']]
  const current = tab || tabs[0]?.[0]
  const act = (action, target, extra, after) => setConfirm({ action, target, extra, after })

  return (
    <>
      <Err>{err}</Err>
      {!models && !err && <Loading />}
      {models && (
        <>
          <nav className="ak-tabs">{tabs.map(([id, l]) => <button key={id} className={current === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>)}</nav>
          {!current?.startsWith('__') && (
            <div className="md-grid">{models.filter(m => m.family === current).map(m => <Tile key={m.id} m={m} open={setDetail} act={act} configure={setConfigure} />)}</div>
          )}
          {current === '__search' && <Search act={act} />}
          {current === '__settings' && <><Kaggle act={act} /><HfToken act={act} /></>}
          {current === '__litellm' && <Gateway act={act} />}
          {current === '__ratelimits' && <Suspense fallback={<Loading />}><RateLimits /></Suspense>}
        </>
      )}
      {detail && (
        <Modal title={detail.display_name} onClose={() => setDetail(null)} actions={<button className="ak-btn" onClick={() => setDetail(null)}>بستن</button>}>
          {[['ارائه با نام', detail.display_name], ['مخزن منبع', detail.source_repo], ['مستعار Gateway', detail.litellm_alias], ['نود', detail.node], ['GPU لازم', detail.gpu_required],
            ['Replica', detail.replicas ?? 1], ['کوانتیزاسیون', detail.quantization], ['حجم PVC', detail.pvc_size], ['حجم دانلودشده', detail.downloaded_size],
            ['Tokens/sec (زنده)', detail.tokens_per_sec], ['وضعیت', detail.status_label]].map(([k, v]) => <p key={k} className="ak-kv"><b>{k}:</b><span dir="auto">{v ?? '—'}</span></p>)}
        </Modal>
      )}
      {configure && <Configure m={configure} onClose={() => setConfigure(null)} onSubmit={extra => { const m = configure; setConfigure(null); act('configure_deploy', m, extra) }} />}
      {confirm && <ConfirmAction {...confirm} onClose={() => setConfirm(null)} onDone={() => {
        const c = confirm; setConfirm(null)
        if (c.target?.id && ['download', 'deploy', 'resume', 'configure_deploy'].includes(c.action)) poll(c.target.id)
        c.after?.(); load()
      }} />}
    </>
  )
}
