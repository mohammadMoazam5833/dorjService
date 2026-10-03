import { useState, useEffect } from 'react'
import { getJson } from '../../lib/http.js'
import { apiSend, apiPost } from '../../lib/api.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { Field, Err, Pill, Modal, useTable, downloadBlob, rawSend } from './kit.jsx'

const enc = encodeURIComponent
const P = '/admin-panel/api/admin/profiles'
export const tierLabel = t => (t === 'guaranteed' ? 'تضمینی (Guaranteed)' : t === 'standard' ? 'استاندارد' : '—')
const today = () => new Date().toISOString().slice(0, 10)
const actor = (at, by) => (at ? (by ? `${at} (${by})` : at) : '')
const SCHED = { pending: 'در انتظار', applied: 'اعمال شد', cancelled_stale: 'لغو (منسوخ)' }

export function nodeDetail(n) {
  let s = `${Math.round(n.cpu_allocatable_cores || 0)} هسته، ${Math.round(n.memory_allocatable_gib || 0)}Gi قابل تخصیص`
  if (n.gpu_summary) s += `، ${n.gpu_summary}${n.gpu_mig_enabled ? ' (MIG)' : ''}`
  s += `، ${n.pod_count || 0} پاد`
  if (n.singleton_infra?.length) s += ` — میزبان: ${n.singleton_infra.join('، ')}`
  return s
}

function useList(path, filter = x => x) {
  const [items, setItems] = useState([])
  const load = async () => { const r = await getJson(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`, { ttlMs: 0 }); setItems(filter(r.data || [])) }
  useEffect(() => { load() }, [path])
  return [items, load]
}

// In-app PDF viewer (connection sheets) - never a new browser tab.
export function PdfModal({ url, title, onClose }) {
  return (
    <Modal wide title={title} onClose={onClose} actions={<><a className="ak-btn" href={url} download>دانلود</a><button className="ak-btn" onClick={onClose}>بستن</button></>}>
      <iframe title={title} src={url} style={{ width: '100%', height: '65vh', border: '1px solid #e8edf3', borderRadius: 10 }} />
    </Modal>
  )
}

function SlaHistory({ ns, reloadSchedule }) {
  const [all, load] = useList('/admin-panel/api/admin/sla-tier-schedule', a => a.filter(e => e.namespace === ns).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')))
  const t = useTable(all, { keys: ['tier', 'status', 'scheduled_for'], sort: { key: 'created_at', dir: 'desc' } })
  return (
    <>
      <div className="ak-toolbar"><h3 style={{ margin: 0 }}>تاریخچه‌ی SLA</h3><div className="spacer" />{t.search()}</div>
      {all.length === 0 ? <p className="ak-muted">هنوز تغییر سطح SLA ثبت نشده است.</p> : (
        <><table className="ak-table"><thead><tr>{t.th('tier', 'سطح')}{t.th('scheduled_for', 'تاریخ راه‌اندازی دوباره')}{t.th('status', 'وضعیت')}<th /></tr></thead>
          <tbody>{t.shown.map(e => <ScheduleRow key={e.id} e={e} withTier onChange={() => { load(); reloadSchedule?.() }} />)}</tbody></table>{t.pager}</>
      )}
    </>
  )
}

export function ScheduleRow({ e, withTier, withNs, onChange }) {
  const [date, setDate] = useState(e.scheduled_for)
  const pending = e.status === 'pending'
  const save = async () => {
    if (!date || date === e.scheduled_for) return
    const r = await apiSend(`/admin-panel/api/admin/sla-tier-schedule/${enc(e.id)}`, 'PATCH', { scheduled_for: date })
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('تاریخ راه‌اندازی دوباره به‌روز شد'); onChange()
  }
  const cancel = async () => {
    const r = await apiSend(`/admin-panel/api/admin/sla-tier-schedule/${enc(e.id)}`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('راه‌اندازی زمان‌بندی‌شده لغو شد'); onChange()
  }
  return (
    <tr>
      {withNs && <td><bdi dir="ltr">{e.namespace}</bdi></td>}
      {withTier && <td>{tierLabel(e.tier)}</td>}
      {withNs && <td>{tierLabel(e.tier)}</td>}
      <td>{pending ? <input className="ak-input" type="date" min={today()} value={date || ''} onChange={x => setDate(x.target.value)} /> : e.scheduled_for}</td>
      {!withNs && <td>{SCHED[e.status] || 'لغو شد'}</td>}
      <td className="ak-actions-cell">{pending && <><button className="ak-btn" onClick={save}>ذخیره</button><button className="ak-btn" onClick={cancel}>لغو</button></>}</td>
    </tr>
  )
}

function Kubeconfigs({ ns, owner }) {
  const [all, load] = useList(`${P}/${enc(ns)}/kubeconfigs`)
  const t = useTable(all, { keys: ['access', 'issued_by'], sort: { key: 'issued_at', dir: 'desc' } })
  const [access, setAccess] = useState('ro')
  const [days, setDays] = useState('30')
  const [revoke, setRevoke] = useState(null)
  const issue = async () => {
    try {
      const r = await rawSend(`${P}/${enc(ns)}/kubeconfig`, 'POST', { access, duration_days: parseInt(days, 10), owner_email: owner.trim() })
      downloadBlob(await r.blob(), `kubeconfig-${ns}.yaml`); load(); notifySuccess('Kubeconfig صادر شد')
    } catch (e) { notifyError(e.message) }
  }
  const doRevoke = async () => {
    const g = revoke; setRevoke(null)
    const r = await apiSend(`${P}/${enc(ns)}/kubeconfig/${enc(g.sa_name)}`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    load(); notifySuccess('Kubeconfig باطل شد')
  }
  return (
    <>
      <h3>Kubeconfig</h3>
      <div className="ak-row">
        <Field label="سطح دسترسی"><select className="ak-select" value={access} onChange={e => setAccess(e.target.value)}><option value="ro">فقط‌خواندنی</option><option value="rw">خواندن/نوشتن</option></select></Field>
        <Field label="مدت (روز)"><input className="ak-input" type="number" min="1" value={days} onChange={e => setDays(e.target.value)} /></Field>
      </div>
      <div className="ak-toolbar"><button className="ak-btn ak-primary" onClick={issue}>+ صدور و دانلود</button><div className="spacer" />{t.search()}</div>
      {all.length === 0 ? <p className="ak-muted">هنوز Kubeconfig صادر نشده است.</p> : (
        <><table className="ak-table"><thead><tr>{t.th('access', 'سطح دسترسی')}{t.th('issued_by', 'صادرکننده')}{t.th('issued_at', 'زمان صدور')}{t.th('expires_at', 'انقضا')}<th /></tr></thead>
          <tbody>{t.shown.map(g => (
            <tr key={g.sa_name}><td>{g.access === 'rw' ? 'خواندن/نوشتن' : 'فقط‌خواندنی'}</td><td><bdi dir="ltr">{g.issued_by || '—'}</bdi></td><td>{g.issued_at || '—'}</td><td>{g.expires_at || '—'}</td>
              <td><button className="ak-btn" onClick={() => setRevoke(g)}>ابطال</button></td></tr>
          ))}</tbody></table>{t.pager}</>
      )}
      {revoke && <ConfirmDialog danger title="این Kubeconfig باطل شود؟" confirmLabel="ابطال" onCancel={() => setRevoke(null)} onConfirm={doRevoke} />}
    </>
  )
}

function PortExposures({ ns, owner }) {
  const [all, load] = useList(`${P}/${enc(ns)}/port-exposures`, a => a.filter(e => e.status === 'approved'))
  const t = useTable(all, { keys: ['service_name', 'route_token'], sort: { key: 'service_name', dir: 'asc' } })
  const [svc, setSvc] = useState('')
  const [port, setPort] = useState('')
  const [revoke, setRevoke] = useState(null)
  const issue = async () => {
    if (!svc.trim() || !port.trim()) return
    const r = await apiPost(`${P}/${enc(ns)}/port-exposure`, { service_name: svc.trim(), service_port: parseInt(port, 10), owner_email: owner.trim() })
    if (r.error) { notifyError(r.error.message); return }
    setSvc(''); setPort(''); load(); notifySuccess('انتشار سرویس ثبت شد')
  }
  const doRevoke = async () => {
    const e = revoke; setRevoke(null)
    const r = await apiPost(`/admin-panel/api/admin/port-exposure-requests/${enc(e.id)}/revoke`, {})
    if (r.error) { notifyError(r.error.message); return }
    load(); notifySuccess('انتشار سرویس لغو شد')
  }
  return (
    <>
      <h3>انتشار پورت سرویس</h3>
      <div className="ak-row">
        <Field label="نام سرویس"><input className="ak-input" dir="ltr" placeholder="my-service" value={svc} onChange={e => setSvc(e.target.value)} /></Field>
        <Field label="پورت سرویس"><input className="ak-input" type="number" min="1" value={port} onChange={e => setPort(e.target.value)} /></Field>
      </div>
      <div className="ak-toolbar"><button className="ak-btn ak-primary" onClick={issue} disabled={!svc.trim() || !port.trim()}>+ افزودن</button><div className="spacer" />{t.search()}</div>
      {all.length === 0 ? <p className="ak-muted">هنوز سرویسی منتشر نشده است.</p> : (
        <><table className="ak-table"><thead><tr>{t.th('service_name', 'سرویس')}<th>آدرس</th><th /></tr></thead>
          <tbody>{t.shown.map(e => (
            <tr key={e.id}><td><bdi dir="ltr">{e.service_name}:{e.service_port}</bdi></td>
              <td>{e.route_token && <a href={`/x/${e.route_token}/`} target="_blank" rel="noopener"><bdi dir="ltr">/x/{e.route_token}/</bdi></a>}</td>
              <td><button className="ak-btn" onClick={() => setRevoke(e)}>لغو</button></td></tr>
          ))}</tbody></table>{t.pager}</>
      )}
      {revoke && <ConfirmDialog danger title="این انتشار سرویس لغو شود؟" confirmLabel="لغو انتشار" onCancel={() => setRevoke(null)} onConfirm={doRevoke} />}
    </>
  )
}

function HistoryTable({ items, keys, cols }) {
  const t = useTable(items, { keys, sort: { key: 'enabled_at', dir: 'desc' } })
  if (!items.length) return <p className="ak-muted">هنوز سابقه‌ای ثبت نشده است.</p>
  return (
    <>
      <div className="ak-toolbar"><div className="spacer" />{t.search()}</div>
      <table className="ak-table"><thead><tr>{cols.map(([k, l]) => t.th(k, l))}</tr></thead>
        <tbody>{t.shown.map((e, i) => <tr key={i}>{cols.map(([k, , render]) => <td key={k}>{render ? render(e) : e[k]}</td>)}</tr>)}</tbody></table>
      {t.pager}
    </>
  )
}

function Openhands({ ns }) {
  const [all, load] = useList(`${P}/${enc(ns)}/openhands/history`)
  const enabled = all.some(e => e.status === 'enabled')
  const [q, setQ] = useState({ cpuReq: '1', cpuLim: '2', memReq: '2', memLim: '4' })
  const [url, setUrl] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [pdf, setPdf] = useState(false)
  const enable = async () => {
    const r = await apiPost(`${P}/${enc(ns)}/openhands`, { cpu_request: q.cpuReq.trim(), cpu_limit: q.cpuLim.trim(), memory_request: `${q.memReq.trim()}Gi`, memory_limit: `${q.memLim.trim()}Gi` })
    if (r.error) { notifyError(r.error.message); return }
    setUrl(r.data?.url || ''); load(); notifySuccess('OpenHands فعال شد')
  }
  const disable = async () => {
    setConfirm(false)
    const r = await apiSend(`${P}/${enc(ns)}/openhands`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    load(); notifySuccess('OpenHands غیرفعال شد')
  }
  return (
    <>
      <h3>OpenHands</h3>
      <QuotaFields q={q} setQ={setQ} />
      <div className="ak-toolbar">
        {!enabled ? <button className="ak-btn ak-primary" onClick={enable}>فعال‌سازی</button>
          : <><button className="ak-btn ak-danger" onClick={() => setConfirm(true)}>غیرفعال‌سازی</button><button className="ak-btn" onClick={() => setPdf(true)}>برگه‌ی اتصال (PDF)</button></>}
      </div>
      {url && <p><a href={url} target="_blank" rel="noopener"><bdi dir="ltr">{url}</bdi></a></p>}
      <HistoryTable items={all} keys={['hostname', 'enabled_by', 'disabled_by']} cols={[
        ['status', 'وضعیت', e => (e.status === 'enabled' ? 'فعال' : 'غیرفعال')], ['hostname', 'میزبان', e => <bdi dir="ltr">{e.hostname || '—'}</bdi>],
        ['cpu_request', 'سهمیه', e => (e.cpu_request ? `${e.cpu_request}/${e.cpu_limit} CPU، ${e.memory_request}/${e.memory_limit}` : '—')],
        ['enabled_at', 'فعال‌سازی', e => actor(e.enabled_at, e.enabled_by)], ['disabled_at', 'غیرفعال‌سازی', e => actor(e.disabled_at, e.disabled_by)]]} />
      {confirm && <ConfirmDialog danger title="OpenHands برای این پروفایل غیرفعال شود؟" confirmLabel="غیرفعال کن" onCancel={() => setConfirm(false)} onConfirm={disable} />}
      {pdf && <PdfModal title="برگه‌ی اتصال OpenHands" url={`${P}/${enc(ns)}/openhands/pdf`} onClose={() => setPdf(false)} />}
    </>
  )
}

function QuotaFields({ q, setQ }) {
  const set = (k, v) => setQ(s => ({ ...s, [k]: v }))
  return (
    <div className="ak-row">
      <Field label="درخواست CPU (هسته)"><input className="ak-input" type="number" min="0" step="0.1" value={q.cpuReq} onChange={e => set('cpuReq', e.target.value)} /></Field>
      <Field label="سقف CPU (هسته)"><input className="ak-input" type="number" min="0" step="0.1" value={q.cpuLim} onChange={e => set('cpuLim', e.target.value)} /></Field>
      <Field label="درخواست حافظه (GiB)"><input className="ak-input" type="number" min="0" value={q.memReq} onChange={e => set('memReq', e.target.value)} /></Field>
      <Field label="سقف حافظه (GiB)"><input className="ak-input" type="number" min="0" value={q.memLim} onChange={e => set('memLim', e.target.value)} /></Field>
    </div>
  )
}

function Vm({ ns, gpus }) {
  const [all, load] = useList(`${P}/${enc(ns)}/vm/history`)
  const enabled = all.some(e => e.status === 'enabled')
  const [q, setQ] = useState({ cpuReq: '2', cpuLim: '4', memReq: '4', memLim: '8' })
  const wholeGpus = parseInt((gpus.find(g => g.type === 'nvidia.com/gpu') || {}).count, 10) || 0
  const [gpuCount, setGpuCount] = useState('0')
  const [result, setResult] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [pdf, setPdf] = useState(false)
  const withKey = async (path, body, ok) => {
    try {
      const r = await rawSend(path, 'POST', body)
      const vmNs = r.headers.get('X-Vm-Namespace'), ssh = r.headers.get('X-Ssh-Command')
      downloadBlob(await r.blob(), `${ns}-vm-id_ed25519`)
      setResult(`${ssh}  (${vmNs})`); load(); notifySuccess(ok)
    } catch (e) { notifyError(e.message) }
  }
  const enable = () => withKey(`${P}/${enc(ns)}/vm`, { cpu_request: q.cpuReq.trim(), cpu_limit: q.cpuLim.trim(), memory_request: `${q.memReq.trim()}Gi`, memory_limit: `${q.memLim.trim()}Gi`, gpu_count: parseInt(gpuCount, 10) || 0 }, 'VM فعال شد؛ کلید SSH دانلود شد')
  const regen = () => { setConfirm(null); withKey(`${P}/${enc(ns)}/vm/regenerate-key`, undefined, 'کلید SSH جدید ساخته و دانلود شد') }
  const disable = async () => {
    setConfirm(null)
    const r = await apiSend(`${P}/${enc(ns)}/vm`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    load(); notifySuccess('VM غیرفعال شد')
  }
  return (
    <>
      <h3>ماشین مجازی</h3>
      <QuotaFields q={q} setQ={setQ} />
      {wholeGpus > 0 && (
        <Field label={`GPU passthrough (از سهمیه‌ی ${wholeGpus} عددی nvidia.com/gpu این پروفایل)`} hint="کل GPU (نه MIG)؛ درایور NVIDIA در اولین راه‌اندازی خودکار نصب می‌شود.">
          <select className="ak-select" value={gpuCount} onChange={e => setGpuCount(e.target.value)}>{Array.from({ length: wholeGpus + 1 }, (_, i) => <option key={i} value={String(i)}>{i}</option>)}</select>
        </Field>
      )}
      <div className="ak-toolbar">
        {!enabled ? <button className="ak-btn ak-primary" onClick={enable}>فعال‌سازی</button>
          : <><button className="ak-btn" onClick={() => setConfirm('regen')}>کلید SSH جدید</button><button className="ak-btn ak-danger" onClick={() => setConfirm('disable')}>غیرفعال‌سازی</button>
            <button className="ak-btn" onClick={() => setPdf(true)}>برگه‌ی اتصال (PDF)</button></>}
      </div>
      {result && <p className="ak-muted"><bdi dir="ltr">{result}</bdi></p>}
      <HistoryTable items={all} keys={['vm_namespace', 'enabled_by', 'disabled_by', 'ssh_public_key_fingerprint']} cols={[
        ['status', 'وضعیت', e => (e.status === 'enabled' ? 'فعال' : e.status === 'rotated' ? 'کلید عوض شد' : 'غیرفعال')],
        ['nodeport', 'SSH', e => (e.nodeport ? <bdi dir="ltr">{`ssh -p ${e.nodeport} ubuntu@<node-ip>${e.vm_namespace ? ` [${e.vm_namespace}]` : ''}`}</bdi> : '')],
        ['cpu_request', 'سهمیه', e => (e.cpu_request ? `${e.cpu_request}/${e.cpu_limit} CPU، ${e.memory_request}/${e.memory_limit}${e.gpu_count ? `، ${e.gpu_count} GPU` : ''}` : '—')],
        ['enabled_at', 'فعال‌سازی', e => actor(e.enabled_at, e.enabled_by)], ['disabled_at', 'غیرفعال‌سازی', e => actor(e.disabled_at, e.disabled_by)]]} />
      {confirm === 'regen' && <ConfirmDialog title="کلید SSH جدید صادر شود؟" body="کلید قبلی دیگر کار نخواهد کرد." confirmLabel="کلید جدید" onCancel={() => setConfirm(null)} onConfirm={regen} />}
      {confirm === 'disable' && <ConfirmDialog danger title="VM این پروفایل غیرفعال شود؟" confirmLabel="غیرفعال کن" onCancel={() => setConfirm(null)} onConfirm={disable} />}
      {pdf && <PdfModal title="برگه‌ی اتصال VM" url={`${P}/${enc(ns)}/vm/pdf`} onClose={() => setPdf(false)} />}
    </>
  )
}

function Uploads({ ns }) {
  const [f, setF] = useState({ up: '', down: '', max: '', ext: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getJson(`${P}/${enc(ns)}/upload-policy?t=${Date.now()}`, { ttlMs: 0 }).then(r => {
      const d = r.data || {}
      const s = v => (v === null || v === undefined ? '' : String(v))
      setF({ up: s(d.upload_enabled), down: s(d.download_enabled), max: d.upload_max_size_mb || '', ext: d.upload_allowed_extensions || '' })
    })
  }, [ns])
  const save = async () => {
    setBusy(true)
    const b = v => (v === '' ? null : v === 'true')
    const r = await apiSend(`${P}/${enc(ns)}/upload-policy`, 'PUT', { upload_enabled: b(f.up), download_enabled: b(f.down), upload_max_size_mb: f.max, upload_allowed_extensions: f.ext })
    setBusy(false)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('تنظیمات آپلود این کاربر ذخیره شد')
  }
  const sel = (k, label) => (
    <Field label={label}><select className="ak-select" value={f[k]} onChange={e => setF(s => ({ ...s, [k]: e.target.value }))}>
      <option value="">پیش‌فرض پلتفرم</option><option value="true">فعال</option><option value="false">غیرفعال</option></select></Field>
  )
  return (
    <>
      <h3>استثنای آپلود/دانلود برای این کاربر</h3>
      <p className="ak-muted">هر فیلدی که روی «پیش‌فرض پلتفرم» بماند از تنظیم سراسری (تب تنظیمات) پیروی می‌کند.</p>
      <div className="ak-row">{sel('up', 'اجازه‌ی آپلود')}{sel('down', 'اجازه‌ی دانلود/خروجی')}</div>
      <div className="ak-row">
        <Field label="حداکثر حجم آپلود (MB)"><input className="ak-input" type="number" min="0" placeholder="پیش‌فرض پلتفرم" value={f.max} onChange={e => setF(s => ({ ...s, max: e.target.value }))} /></Field>
        <Field label="پسوندهای مجاز"><input className="ak-input" dir="ltr" placeholder="پیش‌فرض پلتفرم" value={f.ext} onChange={e => setF(s => ({ ...s, ext: e.target.value }))} /></Field>
      </div>
      <button className="ak-btn ak-primary" onClick={save} disabled={busy}>ذخیره</button>
    </>
  )
}

const SUBTABS = [['sla', 'تاریخچه‌ی SLA'], ['kubeconfig', 'Kubeconfig'], ['port-exposure', 'انتشار پورت'], ['openhands', 'OpenHands'], ['vm', 'ماشین مجازی'], ['uploads', 'آپلود']]

export default function ProfileEdit({ profile, vendors, cluster, onCancel, onSaved, reloadSla }) {
  const hard = profile.resource_quota?.hard || {}
  const [f, setF] = useState({
    owner: profile.owner || '', cpu: (hard.cpu || '').replace(/[^0-9.]/g, ''), mem: (hard.memory || '').replace(/Gi$/, ''),
    storage: (hard['requests.storage'] || '').replace(/Gi$/, ''), tier: profile.tier || '', taint: profile.tier_taint_value || '', restart: '',
    gpus: Object.keys(hard).filter(k => k.startsWith('nvidia.com/')).map(k => ({ type: k, count: hard[k] })),
  })
  const [sub, setSub] = useState('sla')
  const [nodes, setNodes] = useState([])
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const ns = profile.name
  const tierChanged = f.tier !== (profile.tier || '')

  const loadNodes = async () => { const r = await getJson(`/admin-panel/api/admin/sla-nodes?t=${Date.now()}`, { ttlMs: 0 }); setNodes(r.data || []) }
  useEffect(() => { if (f.tier === 'guaranteed') loadNodes() }, [f.tier])
  const onTier = v => {
    setF(s => {
      const next = { ...s, tier: v }
      if (v !== (profile.tier || '') && !s.restart) { const d = new Date(); d.setDate(d.getDate() + 3); next.restart = d.toISOString().slice(0, 10) }
      return next
    })
  }
  const toggleNode = async node => {
    const mine = node.reserved_for === ns
    const r = await apiPost(`/admin-panel/api/admin/sla-nodes/${enc(node.name)}/${mine ? 'release' : 'reserve'}`, mine ? undefined : { taint_value: ns })
    if (r.error) { notifyError(r.error.message); return }
    set('taint', mine ? '' : ns); loadNodes(); reloadSla?.()
    notifySuccess(mine ? 'نود آزاد شد' : 'نود رزرو شد')
  }
  const submit = async () => {
    setErr('')
    if (!f.owner.trim()) { setErr('ایمیل مالک را وارد کنید'); return }
    if (f.tier === 'guaranteed' && !f.taint) { setErr('پیش از ذخیره، یک نود برای سطح Guaranteed رزرو کنید'); return }
    setSaving(true)
    const gpus = f.gpus.filter(g => g.type && String(g.count).trim()).map(g => ({ type: g.type, count: String(g.count).trim() }))
    const r = await apiSend(`${P}/${enc(ns)}`, 'PATCH', {
      owner_email: f.owner.trim(), tier: f.tier, tier_taint_value: f.taint.trim(), tier_restart_date: tierChanged ? f.restart : '',
      cpu_limit: f.cpu.trim(), memory_limit: f.mem.trim() ? `${f.mem.trim()}Gi` : '', storage_limit: f.storage.trim() ? `${f.storage.trim()}Gi` : '', gpus,
    })
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(`پروفایل «${ns}» به‌روز شد`); onSaved()
  }

  return (
    <div className="ak-card">
      <h2>ویرایش پروفایل: <bdi dir="ltr">{ns}</bdi></h2>
      <div className="ak-row">
        <Field label="نام Namespace"><input className="ak-input" dir="ltr" value={ns} disabled /></Field>
        <Field label="ایمیل مالک"><input className="ak-input" dir="ltr" type="email" value={f.owner} onChange={e => set('owner', e.target.value)} /></Field>
      </div>
      <div className="ak-row">
        <Field label="سقف CPU (اختیاری)"><input className="ak-input" type="number" min="0" step="0.001" placeholder="8" value={f.cpu} onChange={e => set('cpu', e.target.value)} /></Field>
        <Field label="سقف حافظه Gi (اختیاری)"><input className="ak-input" type="number" min="0" placeholder="32" value={f.mem} onChange={e => set('mem', e.target.value)} /></Field>
        <Field label="سقف فضای ذخیره‌سازی Gi (اختیاری)"><input className="ak-input" type="number" min="0" placeholder="100" value={f.storage} onChange={e => set('storage', e.target.value)} /></Field>
        <Field label="سطح SLA (اختیاری)"><select className="ak-select" value={f.tier} onChange={e => onTier(e.target.value)}>
          <option value="">— هیچ —</option><option value="standard">استاندارد</option><option value="guaranteed">تضمینی (Guaranteed)</option></select></Field>
        {tierChanged && <Field label="تاریخ اعمال روی Podهای در حال اجرا"><input className="ak-input" type="date" min={today()} value={f.restart} onChange={e => set('restart', e.target.value)} /></Field>}
      </div>
      <div className="ak-muted" style={{ lineHeight: 1.9 }}>
        <div>استاندارد: بدون رزرو نود، فقط اولویت زمان‌بندی روی نودهای مشترک؛ بلافاصله پس از ذخیره اعمال می‌شود.</div>
        <div>تضمینی: یک نود کامل فقط برای این پروفایل رزرو (taint) می‌شود؛ از جدول زیر انتخاب کنید.</div>
        <div>Podهای در حال اجرای این پروفایل بلافاصله تغییر نمی‌کنند؛ با «تاریخ اعمال» زمان راه‌اندازی دوباره را تعیین کنید.</div>
      </div>

      {f.tier === 'guaranteed' && (
        <div className="ak-sub">
          <h3>رزرو نود (سطح تضمینی)</h3>
          {nodes.map(n => {
            const mine = n.reserved_for === ns, other = n.reserved_for && !mine
            return (
              <div key={n.name} className="ak-toolbar" style={{ borderBottom: '1px solid #f0f3f7', paddingBottom: 8 }}>
                <div><bdi dir="ltr">{n.name}</bdi><div className="ak-muted">{nodeDetail(n)}</div></div>
                <div className="spacer" />
                {mine && <Pill ok>رزرو برای این پروفایل</Pill>}
                {other && <span className="ak-muted">رزرو برای {n.reserved_for}</span>}
                {!other && <button className="ak-btn" onClick={() => toggleNode(n)}>{mine ? 'آزادسازی' : 'رزرو'}</button>}
              </div>
            )
          })}
          {!f.taint && <Err>پیش از ذخیره، یک نود رزرو کنید؛ سطح تضمینی به آن نیاز دارد.</Err>}
        </div>
      )}

      <div className="ak-sub">
        <h3>تخصیص GPU / MIG (اختیاری)</h3>
        {f.gpus.map((g, i) => {
          const v = vendors.find(x => x.limitsKey === g.type)
          return (
            <div key={i} className="ak-row">
              <select className="ak-select" dir="ltr" value={g.type} onChange={e => set('gpus', f.gpus.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                <option value="">— انتخاب —</option>{vendors.map(x => <option key={x.limitsKey} value={x.limitsKey}>{x.uiName || x.limitsKey}</option>)}
                {g.type && !v && <option value={g.type}>{g.type}</option>}
              </select>
              <input className="ak-input" type="number" min="1" max={v?.allocatable_total || undefined} value={g.count} onChange={e => set('gpus', f.gpus.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} />
              <button className="ak-btn" onClick={() => set('gpus', f.gpus.filter((_, j) => j !== i))}>حذف</button>
            </div>
          )
        })}
        <button className="ak-btn" onClick={() => set('gpus', [...f.gpus, { type: '', count: '' }])}>+ افزودن GPU</button>
        {cluster && <p className="ak-muted">منابع خوشه (قابل تخصیص/کل): {cluster.cpu_allocatable_cores}/{cluster.cpu_capacity_cores} هسته CPU، {cluster.memory_allocatable_gib}/{cluster.memory_capacity_gib} GiB حافظه</p>}
      </div>

      <Err>{err}</Err>
      <div className="ak-toolbar"><button className="ak-btn ak-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیره'}</button><button className="ak-btn" onClick={onCancel}>انصراف</button></div>

      <nav className="ak-tabs" style={{ marginTop: 18 }}>{SUBTABS.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>
      {sub === 'sla' && <SlaHistory ns={ns} reloadSchedule={reloadSla} />}
      {sub === 'kubeconfig' && <Kubeconfigs ns={ns} owner={f.owner} />}
      {sub === 'port-exposure' && <PortExposures ns={ns} owner={f.owner} />}
      {sub === 'openhands' && <Openhands ns={ns} />}
      {sub === 'vm' && <Vm ns={ns} gpus={f.gpus} />}
      {sub === 'uploads' && <Uploads ns={ns} />}
    </div>
  )
}
