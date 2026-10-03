import { useState, lazy, Suspense } from 'react'
import { useApi, apiPost, invalidate } from '../../lib/api.js'
import { adaptVolumes } from '../../lib/adapters/workloads.js'
import { fmt } from '../../lib/format.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Spinner, { Loading } from '../../components/Spinner.jsx'

const Terminal = lazy(() => import('../../components/Terminal.jsx'))
const enc = encodeURIComponent
const TABS = [['overview', 'نمای کلی'], ['volumes', 'فضاهای متصل'], ['yaml', 'YAML'], ['console', 'کنسول']]

function Overview({ name, data, reload }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const regen = async () => {
    setBusy(true); setConfirm(false)
    const r = await apiPost(`/api/vms/${enc(name)}/ssh/regenerate`, {})
    setBusy(false)
    if (r.error) { notifyError(r.error.message); return }
    invalidate('/api/vms'); reload()
    notifySuccess('کلید SSH جدید ساخته شد؛ ماشین مجازی دوباره راه‌اندازی می‌شود')
  }
  const rows = [
    ['وضعیت', `${data.phase}${data.ready_message ? ` — ${data.ready_message}` : ''}`],
    ['CPU', data.cpu_cores ?? '—'],
    ['حافظه (درخواست / سقف)', `${data.memory_request ?? '—'} / ${data.memory_limit ?? '—'}`],
    ['آدرس IP (داخلی)', <bdi dir="ltr">{data.ip_address || '—'}</bdi>],
    ['ایجاد', fmt.date(data.created_at)],
  ]
  return (
    <>
      <table className="nd-kv"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
      <h4 className="nd-h">اتصال SSH</h4>
      {data.ssh_info ? <code className="nd-code" dir="ltr">{data.ssh_info}</code> : <p className="nb-fhint">دسترسی SSH برای این ماشین مجازی تنظیم نشده است.</p>}
      <p className="nb-fhint">آدرس IP بالا فقط درون شبکه‌ی کلاستر معتبر است؛ برای اتصال از بیرون از دستور SSH یا کنسول استفاده کنید.</p>
      <div className="nd-toolbar"><button className="cd-btn" disabled={busy} onClick={() => setConfirm(true)}>{busy ? <Spinner label="در حال ساخت" /> : 'ساخت کلید SSH جدید'}</button></div>
      {confirm && <ConfirmDialog title="ساخت کلید SSH جدید؟" body="کلید قبلی از کار می‌افتد و ماشین مجازی دوباره راه‌اندازی می‌شود."
        confirmLabel="کلید جدید بساز" onCancel={() => setConfirm(false)} onConfirm={regen} />}
    </>
  )
}

function Volumes({ name, data, reload }) {
  const { data: vols } = useApi('/api/volumes', [], [], adaptVolumes)
  const attached = data.attached_volumes || []
  const candidates = (vols || []).filter(v => v.status === 'Bound' && !v.attached_to_vm && !attached.some(a => a.name === v.name))
  const [pick, setPick] = useState('')
  const [readonly, setReadonly] = useState(false)
  const [busy, setBusy] = useState('')
  const call = async (verb, volume, body, ok) => {
    setBusy(volume)
    const r = await apiPost(`/api/vms/${enc(name)}/${verb}`, body)
    setBusy('')
    if (r.error) { notifyError(r.error.message); return }
    invalidate('/api/vms'); invalidate('/api/volumes'); reload(); setPick('')
    notifySuccess(ok)
  }
  return (
    <>
      {attached.length === 0 ? <p className="nb-fhint">هیچ فضای ذخیره‌سازی‌ای به این ماشین مجازی متصل نیست.</p> : (
        <table className="nd-kv"><tbody>{attached.map(a => (
          <tr key={a.name}><th><bdi dir="ltr">{a.name}</bdi></th><td><code dir="ltr">{a.mount_point}</code>{' '}
            <button className="cd-btn" disabled={!!busy} onClick={() => call('detach-volume', a.name, { volume: a.name }, `«${a.name}» جدا شد`)}>{busy === a.name ? <Spinner label="در حال جدا کردن" /> : 'جدا کردن'}</button></td></tr>
        ))}</tbody></table>
      )}
      <h4 className="nd-h">اتصال فضای ذخیره‌سازی</h4>
      {!data.running ? <p className="nb-fhint">برای اتصال فضا، ماشین مجازی باید در حال اجرا باشد.</p> : (
        <div className="nd-toolbar">
          <select className="nb-finput" dir="ltr" style={{ maxWidth: 260 }} value={pick} onChange={e => setPick(e.target.value)}>
            <option value="">— انتخاب فضا —</option>
            {candidates.map(v => <option key={v.name} value={v.name}>{v.name} ({v.size})</option>)}
          </select>
          <label className="nb-fhint"><input type="checkbox" checked={readonly} onChange={e => setReadonly(e.target.checked)} /> فقط‌خواندنی</label>
          <button className="cd-btn cd-primary" disabled={!pick || !!busy} onClick={() => call('attach-volume', pick, { volume: pick, readonly }, `«${pick}» متصل شد`)}>{busy ? <Spinner label="در حال اتصال" /> : 'اتصال'}</button>
        </div>
      )}
    </>
  )
}

function Yaml({ name }) {
  const { data, error, loading } = useApi(`/api/vms/${enc(name)}/yaml`)
  return error ? <ErrorNote error={error} /> : loading ? <Loading /> : <pre className="nd-pre" dir="ltr">{data?.yaml}</pre>
}

export default function VmDetails({ vm, onClose }) {
  const [tab, setTab] = useState('overview')
  const { data, error, loading, reload } = useApi(`/api/vms/${enc(vm.name)}`)
  const running = data ? data.console_available : vm.status === 'Running'
  return (
    <>
      <div className="cd-backdrop" onClick={onClose} />
      <aside className="nd-drawer" dir="rtl" role="dialog" aria-modal="true">
        <header className="nd-head"><h3><bdi dir="ltr">{vm.name}</bdi></h3><button className="nb-modal-close" onClick={onClose}>✕</button></header>
        <nav className="nd-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} disabled={id === 'console' && !running}
              title={id === 'console' && !running ? 'کنسول فقط وقتی ماشین مجازی در حال اجراست در دسترس است' : undefined}>{label}</button>
          ))}
        </nav>
        <div className="nd-body">
          {error && <ErrorNote error={error} />}
          {loading && !data && <p className="nb-fhint"><Spinner label="در حال بارگذاری" text /></p>}
          {data && tab === 'overview' && <Overview name={vm.name} data={data} reload={reload} />}
          {data && tab === 'volumes' && <Volumes name={vm.name} data={data} reload={reload} />}
          {tab === 'yaml' && <Yaml name={vm.name} />}
          {tab === 'console' && running && (
            <Suspense fallback={<p className="nb-fhint"><Spinner label="در حال بارگذاری کنسول" text /></p>}><Terminal path={`/ws/vm-console/${enc(vm.name)}`} /></Suspense>
          )}
        </div>
      </aside>
    </>
  )
}
