import { useState, useEffect, useMemo } from 'react'
import { apiSend, apiPost } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { groupUsage, wedges, weightText, resourceLabel, PIE_COLORS } from '../../lib/admin/gpu.js'
import { Field, Err, Modal, Pill, useTable, useCaptcha } from './kit.jsx'

const API = '/admin-panel/api/admin/gpu-passthrough'
const SUBS = [['passthrough', 'Passthrough'], ['usage', 'مصرف (جدول)'], ['usage-chart', 'مصرف (نمودار)'], ['capital', 'سرمایه']]
const usd = v => (v == null ? '—' : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
const irr = v => (v == null ? '—' : `${Math.round(v).toLocaleString()} ریال`)
const gib = v => (v == null ? '—' : `${v} GiB`)

function Pie({ slices, onPick, hint }) {
  if (!slices.length) return <p className="ak-muted">هیچ بار کاری‌ای GPU یا برش MIG درخواست نکرده است.</p>
  return (
    <div className="gp-pie-wrap" dir="ltr">
      <svg viewBox="0 0 220 220" className="gp-pie">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} className={`gp-slice ${s.drill ? 'click' : ''}`} onClick={() => s.drill && onPick(s.drill)}><title>{s.title || s.legend}</title></path>)}
      </svg>
      <div className="gp-legend" dir="auto">
        {slices.map((s, i) => (
          <div key={i} className={`gp-legend-row ${s.drill ? 'click' : ''}`} onClick={() => s.drill && onPick(s.drill)}>
            <span className="gp-swatch" style={{ background: s.color }} /><span>{s.legend}</span>
          </div>
        ))}
        {hint && <p className="ak-muted">{hint}</p>}
      </div>
    </div>
  )
}

function Reboot({ node, onClose, onDone }) {
  const cap = useCaptcha()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    if (!password || !cap.answer) { setErr('گذرواژه و کد امنیتی لازم است'); return }
    setBusy(true); setErr('')
    const r = await apiPost(`${API}/reboot`, { node, password, captcha_token: cap.token, captcha_answer: cap.answer })
    setBusy(false)
    if (r.error) { setErr(r.error.message); cap.reload(); return }
    notifySuccess(`${r.data?.rebooting || node} برای اعمال تنظیمات GPU در حال راه‌اندازی دوباره است؛ پس از بازگشت و هماهنگی GPUها خودکار از حالت cordon خارج می‌شود.`)
    onDone()
  }
  return (
    <Modal title={`راه‌اندازی دوباره‌ی ${node}`} onClose={onClose} busy={busy}
      actions={<><button className="ak-btn" onClick={onClose} disabled={busy}>انصراف</button><button className="ak-btn ak-danger" onClick={go} disabled={busy}>{busy ? 'در حال ارسال…' : 'راه‌اندازی دوباره‌ی نود'}</button></>}>
      <p className="ak-warn">این کار {node} را برای اعمال تغییر GPU دوباره راه‌اندازی می‌کند. همه‌ی بارهای کاری روی آن تخلیه می‌شوند؛ نود پیش از آن cordon و پس از بازگشت خودکار uncordon می‌شود.</p>
      <Field label="گذرواژه‌ی شما"><input className="ak-input" type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoFocus /></Field>
      {cap.view}
      <Err>{err}</Err>
    </Modal>
  )
}

export default function Gpu() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [sub, setSub] = useState('passthrough')
  const [dirty, setDirty] = useState({})
  const [saving, setSaving] = useState(false)
  const [reboot, setReboot] = useState(null)
  const [drill, setDrill] = useState(null)
  const [capDrill, setCapDrill] = useState(null)
  const [nmFilter, setNmFilter] = useState('')
  const load = async () => {
    const r = await getJson(`${API}?t=${Date.now()}`, { ttlMs: 0 })
    if (r.error) { setErr(r.error.message); return }
    setD(r.data); setDirty({})
  }
  useEffect(() => { load() }, [])

  const gpus = d?.gpus || []
  const usage = d?.gpu_workload_usage || []
  const key = g => `${g.node}|${g.bdf}`
  const desiredOf = g => dirty[key(g)]?.desired || g.desired_driver
  const gT = useTable(gpus, { keys: ['node', 'bdf', 'model'], sort: { key: 'node', dir: 'asc' }, per: 12 })
  const nmRows = useMemo(() => usage.filter(u => !nmFilter || u.kind === nmFilter), [usage, nmFilter])
  const nT = useTable(nmRows, { keys: ['kind', 'namespace', 'workload', 'node', 'resource'], sort: { key: 'kind', dir: 'asc' }, per: 12 })
  const kinds = useMemo(() => groupUsage(usage, u => u.kind).sort((a, b) => b.weight - a.weight), [usage])
  const cT = useTable(d?.capacity_summary || [], { keys: ['label'], sort: { key: 'label', dir: 'asc' } })
  const deptRows = d?.cost_by_department?.rows || []
  const dT = useTable(deptRows, { keys: ['namespace'], sort: { key: 'usd_per_day', dir: 'desc' } })

  if (err) return <div className="ak-card"><Err>{err}</Err></div>
  if (!d) return <div className="ak-card"><p className="ak-muted">در حال بارگذاری…</p></div>

  const pending = (d.nodes || []).filter(n => n.pending_reboot)
  const setDesired = (g, desired) => {
    if (!g.free) return
    setDirty(x => { const n = { ...x }; if (desired === g.desired_driver) delete n[key(g)]; else n[key(g)] = { node: g.node, bdf: g.bdf, desired }; return n })
  }
  const save = async () => {
    const bindings = Object.values(dirty); if (!bindings.length) return
    setSaving(true)
    const r = await apiSend(API, 'PUT', { bindings })
    setSaving(false)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess(`${r.data?.saved} تنظیم ذخیره شد. نودهای منتظر: ${(r.data?.pending_nodes || []).join('، ') || 'هیچ'}`); load()
  }
  const status = g => (!g.free ? ['در حال استفاده', 'warn'] : desiredOf(g) !== g.current_driver ? ['منتظر راه‌اندازی دوباره / هماهنگی', 'warn'] : ['هماهنگ', 'ok'])
  const migText = g => {
    if (!g.mig_capable) return '—'
    let t = `${g.mig_mode === 'Enabled' ? 'Enabled' : 'Disabled'} (${g.mig_config || '?'})`
    if (g.mig_config_state && g.mig_config_state !== 'success') t += ` · ${g.mig_config_state}`
    return t
  }

  const kindSlices = wedges(kinds).map((x, i) => ({ path: x.path, color: PIE_COLORS[i % 10], drill: x.key, legend: `${x.key} — ${weightText(x)}، ${x.pct}%`, title: `${x.key} — ${weightText(x)} (${x.pct}%) — برای دیدن بارهای کاری کلیک کنید` }))
  const detailSlices = drill ? wedges(groupUsage(usage.filter(u => u.kind === drill), u => `${u.namespace}|${u.workload}`)).map((x, i) => ({
    path: x.path, color: PIE_COLORS[i % 10], legend: `${x.sample.namespace}/${x.sample.workload} — ${weightText(x)}، ${x.pct}%`, title: `${drill} · ${x.sample.namespace}/${x.sample.workload} — ${x.parts.join(', ')}` })) : []
  const cap = d.capital_report || {}
  const capSlices = !cap.available ? [] : capDrill === 'used'
    ? wedges(deptRows.map(r => ({ weight: r.vram_gib, row: r }))).map((x, i) => ({ path: x.path, color: PIE_COLORS[i % 10], legend: `${x.row.namespace} — ${gib(x.row.vram_gib)} (${x.pct}%) — ${usd(x.row.usd_per_month)}/ماه` }))
    : wedges([{ weight: cap.used_vram_gib || 0, k: 'used' }, { weight: cap.free_vram_gib || 0, k: 'free' }]).map(x => ({
      path: x.path, color: x.k === 'used' ? '#ea4335' : '#34a853', drill: x.k === 'used' ? 'used' : null,
      legend: `${x.k === 'used' ? 'در حال استفاده' : 'آزاد'} — ${Math.round(x.weight * 10) / 10} GiB (${x.pct}%) — ${usd((x.k === 'used' ? cap.used : cap.free)?.usd_per_month)}/ماه${x.k === 'used' ? ' — برای ریز مصرف کاربران کلیک کنید' : ''}` }))

  return (
    <div className="ak-card">
      <h2>مدیریت GPU</h2>
      <p className="ak-muted">یک GPU از نودهای worker را برای passthrough کامل به ماشین مجازی KubeVirt به vfio-pci، یا برای محاسبه / MIG به درایور nvidia متصل کنید. فقط GPUهای آزاد قابل تغییرند و تغییر پس از راه‌اندازی دوباره‌ی نود اعمال می‌شود.</p>
      <nav className="ak-tabs">{SUBS.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>

      {sub === 'passthrough' && <>
        {pending.length > 0 && (
          <div className="ak-sub">
            <h3 style={{ marginTop: 0 }}>راه‌اندازی دوباره برای اعمال</h3>
            <p className="ak-muted">این نودها تغییر ذخیره‌شده‌ی اعمال‌نشده دارند. راه‌اندازی دوباره همه‌ی بارهای کاری روی نود را تخلیه می‌کند.</p>
            {pending.map(n => (
              <div key={n.node} className="ak-toolbar"><span dir="ltr">{n.node} — {(n.pending_gpus || []).map(x => `${x.bdf}: ${x.from}→${x.to}`).join(', ')}{n.cordoned ? ' (cordoned)' : ''}</span>
                <div className="spacer" /><button className="ak-btn ak-danger" onClick={() => setReboot(n.node)}>راه‌اندازی دوباره‌ی {n.node}</button></div>
            ))}
          </div>
        )}
        <div className="ak-toolbar">{gT.search('فیلتر نود / PCI / مدل…')}<span className="ak-muted">{d.free_count || 0} آزاد · {gpus.length} GPU · نودهای گزارش‌دهنده: {(d.reported_nodes || []).length}</span></div>
        {!gpus.length ? <p className="ak-muted">هنوز داده‌ی GPU نیامده؛ ممکن است DaemonSet عامل gpu-passthrough هنوز در حال شروع باشد.</p> : <>
          <div className="ak-table-scroll">
            <table className="ak-table" dir="ltr"><thead><tr>{gT.th('node', 'Node')}{gT.th('bdf', 'PCI')}{gT.th('model', 'Model')}{gT.th('current_driver', 'Current')}<th>Desired</th><th>MIG</th><th>Status</th></tr></thead>
              <tbody>{gT.shown.map(g => {
                const [sl, sv] = status(g)
                return (
                  <tr key={key(g)}>
                    <td>{g.node}</td><td>{g.bdf}</td><td>{g.model}</td><td><Pill ok={g.free} warn={!g.free}>{g.current_driver}</Pill></td>
                    <td><span className="gp-seg">{['nvidia', 'vfio-pci'].map(v => <button key={v} className={desiredOf(g) === v ? 'on' : ''} disabled={!g.free} onClick={() => setDesired(g, v)}>{v}</button>)}</span></td>
                    <td><span className="ak-muted">{migText(g)}</span>{g.mig_capable && g.mig_node_usage?.length > 0 && <div className="gp-note">MIG on this node: {g.mig_node_usage.map(r => `${r.label} ${r.used_units}/${r.total_units} busy`).join(', ')}</div>}</td>
                    <td dir="rtl"><Pill ok={sv === 'ok'} warn={sv === 'warn'}>{sl}</Pill>{!g.free && g.in_use_by?.length > 0 && <div className="gp-note" dir="ltr">in use by: {g.in_use_by.join(' · ')}</div>}</td>
                  </tr>
                )
              })}</tbody></table>
          </div>
          {gT.pager}
          <button className="ak-btn ak-primary" style={{ marginTop: 12 }} disabled={saving || !Object.keys(dirty).length} onClick={save}>ذخیره‌ی تغییرات ({Object.keys(dirty).length})</button>
        </>}
      </>}

      {sub === 'usage' && <>
        <p className="ak-muted">کدام بار کاری (نوت‌بوک یا مدل سرویس‌دهنده) هم‌اکنون کدام GPU/برش MIG را روی کدام نود گرفته است.</p>
        <h3>ظرفیت آزاد GPU/MIG (کل خوشه)</h3>
        {!(d.capacity_summary || []).length ? <p className="ak-muted">هنوز هیچ نودی منبع GPU/MIG گزارش نکرده است.</p> : (
          <table className="ak-table" dir="ltr"><thead><tr>{cT.th('label', 'Resource')}{cT.th('free_units', 'Free / total (units)')}<th>VRAM free / total</th></tr></thead>
            <tbody>{cT.shown.map(c => <tr key={c.label}><td>{c.label}</td><td>{c.free_units} / {c.total_units}</td><td>{c.free_vram_gib == null || c.total_vram_gib == null ? '—' : `${c.free_vram_gib} / ${c.total_vram_gib} GiB`}</td></tr>)}</tbody></table>
        )}
        <h3>هزینه‌ی زیرساخت به تفکیک واحد</h3>
        <p className="ak-muted">قیمت دلاری GPU از تب تنظیمات خوانده می‌شود.</p>
        {!d.cost_by_department?.available ? <p className="ak-muted">برای دیدن برآورد هزینه به تفکیک واحد، قیمت هر GiB-ساعت GPU را در تنظیمات وارد کنید.</p>
          : !deptRows.length ? <p className="ak-muted">هیچ واحدی هم‌اکنون ظرفیت GPU/MIG درخواست نکرده است.</p> : <>
            <table className="ak-table" dir="ltr"><thead><tr>{dT.th('namespace', 'Department (namespace)')}{dT.th('vram_gib', 'GPU VRAM used (GiB)')}{dT.th('usd_per_day', 'Est. daily cost')}{dT.th('usd_per_month', 'Est. monthly cost')}</tr></thead>
              <tbody>{dT.shown.map(r => <tr key={r.namespace}><td>{r.namespace}</td><td>{r.vram_gib}</td><td>{usd(r.usd_per_day)}</td><td>{usd(r.usd_per_month)} ({irr(r.irr_per_month)})</td></tr>)}</tbody></table>
            {dT.pager}
          </>}
        {kinds.length > 0 && <>
          <table className="ak-table" dir="ltr" style={{ marginTop: 12 }}><thead><tr><th>Kind</th><th>Workloads</th><th>Total GPU/VRAM used</th></tr></thead>
            <tbody>{kinds.map(k => <tr key={k.key} className={`gp-kind ${nmFilter === k.key ? 'on' : ''}`} onClick={() => setNmFilter(f => (f === k.key ? '' : k.key))}><td>{k.key}</td><td>{k.total}</td><td>{weightText(k)}</td></tr>)}</tbody></table>
          <p className="ak-muted">روی ردیف هر نوع کلیک کنید تا جدول زیر فقط آن را نشان دهد؛ کلیک دوباره فیلتر را برمی‌دارد.</p>
        </>}
        <div className="ak-toolbar">{nT.search('فیلتر نوع / namespace / بار کاری / نود / منبع…')}<span className="ak-muted">{nT.count} بار کاری</span></div>
        {!usage.length ? <p className="ak-muted">هیچ بار کاری‌ای GPU یا برش MIG درخواست نکرده است.</p> : <>
          <div className="ak-table-scroll"><table className="ak-table" dir="ltr"><thead><tr>{nT.th('kind', 'Kind')}{nT.th('workload', 'Namespace / Workload', u => `${u.namespace}/${u.workload}`)}{nT.th('node', 'Node')}{nT.th('resource', 'MIG / GPU resource')}{nT.th('count', 'Count')}{nT.th('vram_gib', 'VRAM (GiB)')}{nT.th('phase', 'Phase')}</tr></thead>
            <tbody>{nT.shown.map((u, i) => <tr key={i}><td>{u.kind}</td><td>{u.namespace} / {u.workload}</td><td>{u.node}</td><td>{resourceLabel(u.resource)}</td><td>{u.count}</td><td>{u.vram_gib ?? '—'}</td><td>{u.phase}</td></tr>)}</tbody></table></div>
          {nT.pager}
        </>}
      </>}

      {sub === 'usage-chart' && <>
        <p className="ak-muted">{drill ? `همه‌ی بارهای کاری از نوع «${drill}» — برای جزئیات روی هر بخش نگه دارید.` : 'هر بخش یک نوع بار کاری است؛ روی بخش (یا راهنمای آن) کلیک کنید تا بارهای کاری را ببینید.'}</p>
        {drill && <div className="ak-toolbar"><button className="ak-btn" onClick={() => setDrill(null)}>← همه‌ی انواع</button><span className="ak-muted">نمایش: {drill}</span></div>}
        <Pie slices={drill ? detailSlices : kindSlices} onPick={setDrill} />
      </>}

      {sub === 'capital' && <>
        <p className="ak-muted">چه مقدار از ارزش دلاری ناوگان GPU هم‌اکنون در حال استفاده است و چه مقدار بیکار، با همان قیمت هر GiB-ساعت تنظیمات.</p>
        {!cap.available ? <p className="ak-muted">برای دیدن گزارش سرمایه، قیمت هر GiB-ساعت GPU را در تنظیمات وارد کنید.</p> : <>
          <p className="ak-kv"><b>ارزش کل ناوگان:</b><strong>{usd(cap.total?.usd_per_month)}/ماه</strong> <span className="ak-muted">({irr(cap.total?.irr_per_month)}/ماه، {gib(cap.total_vram_gib)} VRAM)</span></p>
          {capDrill && <div className="ak-toolbar"><button className="ak-btn" onClick={() => setCapDrill(null)}>← استفاده در برابر آزاد</button><span className="ak-muted">نمایش: ریز VRAM و هزینه‌ی در حال استفاده به تفکیک کاربر</span></div>}
          {capDrill && !capSlices.length ? <p className="ak-muted">هیچ واحدی روی این VRAM قیمت‌گذاری نشده است.</p> : <Pie slices={capSlices} onPick={setCapDrill} />}
        </>}
      </>}

      {reboot && <Reboot node={reboot} onClose={() => setReboot(null)} onDone={() => { setReboot(null); load() }} />}
    </div>
  )
}
