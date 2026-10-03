import { useState, useEffect, lazy, Suspense } from 'react'
import { useApi, apiPost, invalidate } from '../../lib/api.js'
import { fmt } from '../../lib/format.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

const TABS = [['overview', 'نمای کلی'], ['logs', 'گزارش‌ها'], ['yaml', 'YAML'], ['ssh', 'SSH'], ['console', 'کنسول']]
const enc = encodeURIComponent
// xterm is only fetched when a console tab actually opens
const Terminal = lazy(() => import('../../components/Terminal.jsx'))

function Overview({ name }) {
  const { data, error, loading } = useApi(`/api/notebooks/${enc(name)}`)
  if (loading) return <p className="nb-fhint">در حال بارگذاری…</p>
  if (error) return <ErrorNote error={error} />
  const rows = [
    ['ایمیج', <bdi dir="ltr">{data.image}</bdi>],
    ['وضعیت', `${data.phase}${data.phase_message ? ` — ${data.phase_message}` : ''}`],
    ['CPU (درخواست / سقف)', `${data.cpu_request ?? '—'} / ${data.cpu_limit ?? '—'}`],
    ['حافظه (درخواست / سقف)', `${data.memory_request ?? '—'} / ${data.memory_limit ?? '—'}`],
    ['Pod آماده', String(data.ready_replicas ?? 0)],
    ['ایجاد', fmt.date(data.created_at)],
  ]
  return (
    <>
      <table className="nd-kv"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
      {data.conditions?.length > 0 && (
        <>
          <h4 className="nd-h">رویدادها (Conditions)</h4>
          <table className="nd-kv"><tbody>{data.conditions.map((c, i) => (
            <tr key={i}><th dir="ltr">{c.type}</th><td dir="auto">{c.status}{c.reason ? ` · ${c.reason}` : ''}{c.message ? ` — ${c.message}` : ''}</td></tr>
          ))}</tbody></table>
        </>
      )}
    </>
  )
}

function Logs({ name }) {
  const { data, error, loading, reload } = useApi(`/api/notebooks/${enc(name)}/logs`)
  return (
    <>
      <div className="nd-toolbar"><button className="cd-btn" onClick={reload}>تازه‌سازی</button>{data?.pod && <span className="nb-fhint">Pod: <bdi dir="ltr">{data.pod}</bdi></span>}</div>
      {error ? <ErrorNote error={error} /> : <pre className="nd-pre" dir="ltr">{loading ? '…' : (data?.logs || '(خالی)')}</pre>}
    </>
  )
}

function Yaml({ name }) {
  const { data, error, loading } = useApi(`/api/notebooks/${enc(name)}/yaml`)
  return error ? <ErrorNote error={error} /> : <pre className="nd-pre" dir="ltr">{loading ? '…' : data?.yaml}</pre>
}

function Ssh({ name }) {
  const base = `/api/notebooks/${enc(name)}/ssh`
  const { data, error, loading, reload } = useApi(`${base}/status`)
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [pdf, setPdf] = useState(false)
  const act = async (verb, okMsg) => {
    setBusy(verb); setConfirm(null)
    const r = await apiPost(`${base}/${verb}`, {})
    setBusy('')
    if (r.error) { notifyError(r.error.message); return }
    invalidate(base); reload(); notifySuccess(okMsg)
  }
  if (loading) return <p className="nb-fhint">در حال بارگذاری…</p>
  if (error) return <ErrorNote error={error} />
  return (
    <>
      {!data?.enabled ? (
        <>
          <p className="cd-body">دسترسی SSH برای این نوت‌بوک فعال نیست. با فعال‌سازی، یک کلید اختصاصی ساخته می‌شود و نوت‌بوک یک‌بار دوباره راه‌اندازی می‌شود.</p>
          <button className="cd-btn cd-primary" disabled={!!busy} onClick={() => act('enable', 'SSH فعال شد')}>{busy === 'enable' ? 'در حال فعال‌سازی…' : 'فعال‌سازی SSH'}</button>
        </>
      ) : (
        <>
          <table className="nd-kv"><tbody>
            <tr><th>دستور اتصال</th><td><code dir="ltr">{data.ssh_command}</code></td></tr>
            <tr><th>پورت</th><td dir="ltr">{data.nodeport}</td></tr>
          </tbody></table>
          <div className="nd-toolbar">
            <button className="cd-btn cd-primary" onClick={() => setPdf(true)}>برگه‌ی اتصال (PDF)</button>
            <button className="cd-btn" disabled={!!busy} onClick={() => setConfirm('regenerate')}>ساخت کلید جدید</button>
            <button className="cd-btn" disabled={!!busy} onClick={() => setConfirm('disable')}>غیرفعال‌سازی</button>
          </div>
          {pdf && (
            <div className="nd-pdf">
              <div className="nd-toolbar"><a className="cd-btn" href={`${base}/pdf`} download={`${name}-ssh.pdf`}>دانلود</a><button className="cd-btn" onClick={() => setPdf(false)}>بستن</button></div>
              <iframe title="ssh-pdf" src={`${base}/pdf`} />
            </div>
          )}
        </>
      )}
      {confirm && (
        <ConfirmDialog danger={confirm === 'disable'}
          title={confirm === 'disable' ? 'غیرفعال‌سازی SSH؟' : 'ساخت کلید جدید؟'}
          body={confirm === 'disable' ? 'اتصال‌های SSH فعلی قطع می‌شوند.' : 'کلید قبلی دیگر کار نمی‌کند و باید برگه‌ی اتصال جدید را دریافت کنید.'}
          confirmLabel={confirm === 'disable' ? 'غیرفعال کن' : 'کلید جدید بساز'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => act(confirm, confirm === 'disable' ? 'SSH غیرفعال شد' : 'کلید SSH جدید ساخته شد')} />
      )}
    </>
  )
}

// The notebook console is an SSH session from the backend into the pod (sshd :2222), so it
// needs the notebook's SSH access enabled first.
function ConsoleTab({ name, onOpenSsh }) {
  const { data, error, loading, reload } = useApi(`/api/notebooks/${enc(name)}/ssh/status`)
  // just enabled: the key only reaches the pod after its restart (sidecar_active)
  const pending = data?.enabled && !data?.sidecar_active
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => { invalidate(`/api/notebooks/${enc(name)}/ssh`); reload() }, 5000)
    return () => clearInterval(t)
  }, [pending, name, reload])
  if (loading && !data) return <p className="nb-fhint">در حال بررسی…</p>
  if (error) return <ErrorNote error={error} />
  if (pending) return <p className="cd-body">SSH فعال شد؛ منتظر راه‌اندازی دوباره‌ی نوت‌بوک هستیم تا کنسول در دسترس شود…</p>
  if (!data?.enabled) return (
    <>
      <p className="cd-body">کنسول از طریق دسترسی SSH داخلی نوت‌بوک کار می‌کند و این دسترسی هنوز فعال نیست. پس از فعال‌سازی، نوت‌بوک یک‌بار دوباره راه‌اندازی می‌شود.</p>
      <button className="cd-btn cd-primary" onClick={onOpenSsh}>رفتن به تب SSH</button>
    </>
  )
  return <Suspense fallback={<p className="nb-fhint">در حال بارگذاری کنسول…</p>}><Terminal path={`/ws/notebook-console/${enc(name)}`} /></Suspense>
}

export default function NotebookDetails({ nb, onClose }) {
  const [tab, setTab] = useState('overview')
  const running = nb.status === 'Running'
  return (
    <>
      <div className="cd-backdrop" onClick={onClose} />
      <aside className="nd-drawer" dir="rtl" role="dialog" aria-modal="true">
        <header className="nd-head">
          <h3><bdi dir="ltr">{nb.name}</bdi></h3>
          <button className="nb-modal-close" onClick={onClose}>✕</button>
        </header>
        <nav className="nd-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} disabled={id === 'console' && !running}
              title={id === 'console' && !running ? 'کنسول فقط وقتی نوت‌بوک در حال اجراست در دسترس است' : undefined}>{label}</button>
          ))}
        </nav>
        <div className="nd-body">
          {tab === 'overview' && <Overview name={nb.name} />}
          {tab === 'logs' && <Logs name={nb.name} />}
          {tab === 'yaml' && <Yaml name={nb.name} />}
          {tab === 'ssh' && <Ssh name={nb.name} />}
          {tab === 'console' && running && <ConsoleTab name={nb.name} onOpenSsh={() => setTab('ssh')} />}
        </div>
      </aside>
    </>
  )
}
