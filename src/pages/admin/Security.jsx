import { useState, useEffect, useRef } from 'react'
import { apiSend } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { Err, Modal, useTable } from './kit.jsx'
import { Loading } from '../../components/Spinner.jsx'

// Port of the platform's admin-panel-security: Trivy Operator (CVEs, misconfig, compliance),
// kube-bench (CIS) and Falco runtime alerts. Lists are paged and searched server-side.
const API = '/admin-panel/api/admin/security'
const VIEWS = [['vuln', 'آسیب‌پذیری‌ها'], ['misconfig', 'پیکربندی نادرست'], ['compliance', 'انطباق'], ['cis', 'CIS Benchmark'], ['falco', 'هشدارهای زمان اجرا']]
const PATHS = { vuln: 'vulnerabilities', misconfig: 'misconfig', compliance: 'compliance', falco: 'falco' }
const SEVS = [['', 'همه'], ['CRITICAL', 'Critical'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']]
const PRIOS = [['', 'همه'], ['critical', 'Critical'], ['error', 'Error'], ['warning', 'Warning'], ['notice', 'Notice']]
const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }
const sevRank = r => RANK[String(r.severity || 'UNKNOWN').toUpperCase()] ?? 5
const num = v => (v == null ? '—' : Number(v).toLocaleString())

const Sev = ({ s }) => <span className={`sec-pill sev-${String(s || 'UNKNOWN').toUpperCase()}`}>{s || 'UNKNOWN'}</span>
const Cards = ({ items }) => <div className="sec-cards">{items.map(([k, v]) => <div key={k} className="sec-card"><div className="sec-k">{k}</div><div className="sec-v">{v}</div></div>)}</div>
const Seg = ({ items, value, onPick }) => (
  <span className="gp-seg">{items.map(([v, l]) => <button key={v || 'all'} className={value === v ? 'on' : ''} onClick={() => onPick(v)}>{l}</button>)}</span>
)

export default function Security() {
  const [summary, setSummary] = useState(null)
  const [err, setErr] = useState('')
  const [cis, setCis] = useState(null)
  const [view, setView] = useState('vuln')
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [severity, setSeverity] = useState('')
  const [priority, setPriority] = useState('')
  const [report, setReport] = useState('')
  const [list, setList] = useState({ rows: [], total: 0, total_pages: 1 })
  const [listLoading, setListLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [muteInput, setMuteInput] = useState('')
  const timer = useRef(null)
  const seq = useRef(0)
  const [qLive, setQLive] = useState('')

  const loadSummary = async () => {
    const r = await getJson(`${API}/summary?t=${Date.now()}`, { ttlMs: 0 })
    if (r.error) setErr(r.error.message); else { setErr(''); setSummary(r.data) }
  }
  const loadList = async () => {
    if (view === 'cis') return
    const my = ++seq.current
    setListLoading(true)
    const p = new URLSearchParams({ page: String(page) })
    if (q.trim()) p.set('q', q.trim())
    if (view === 'compliance' && report) p.set('report', report)
    if (view === 'falco' && priority) p.set('priority', priority)
    if (severity && view !== 'falco') p.set('severity', severity)
    const r = await getJson(`${API}/${PATHS[view]}?${p}`, { ttlMs: 0 })
    if (my !== seq.current) return // a newer request (other view/page/filter) owns the list now
    setListLoading(false)
    if (r.error) { notifyError(r.error.message); setList({ rows: [], total: 0, total_pages: 1, view }); return }
    setList({ ...(r.data || {}), view })
    if (view === 'compliance' && !report && r.data?.report) setReport(r.data.report)
  }
  useEffect(() => { loadSummary(); getJson(`${API}/cis`).then(r => r.data && setCis(r.data)) }, [])
  useEffect(() => { loadList() }, [view, page, q, severity, priority, report])

  // rows from the previous view must never render under the new view's columns
  const rows = list.view === view ? list.rows || [] : []
  const t = useTable(rows, { keys: [], sort: { key: '', dir: 'asc' }, per: 1000 })
  const cisT = useTable(cis?.failures || [], { keys: ['id', 'desc', 'status'], sort: { key: 'status', dir: 'asc' } })
  const pick = v => { if (v === view) return; setList({ rows: [], total: 0, total_pages: 1 }); setView(v); setPage(1); setSeverity(''); setPriority(''); setQ(''); setQLive('') }
  const onSearch = v => { setQLive(v); clearTimeout(timer.current); timer.current = setTimeout(() => { setPage(1); setQ(v) }, 350) }
  const openDetail = async r => {
    if (view !== 'vuln') return
    const x = await getJson(`${API}/vulnerabilities/${encodeURIComponent(r.namespace)}/${encodeURIComponent(r.report)}`, { ttlMs: 0 })
    if (x.error) notifyError(x.error.message); else setDetail(x.data)
  }
  const settings = { muted_rules: [], min_priority: '', priorities: [], ...(list.settings || {}) }
  const putFalco = async patch => {
    const r = await apiSend(`${API}/falco/settings`, 'PUT', patch)
    if (r.error) { notifyError(r.error.message); return }
    notifySuccess('تنظیمات هشدار ذخیره شد'); setPage(1); loadList()
  }
  const mute = rule => { rule = (rule || '').trim(); if (rule && !settings.muted_rules.includes(rule)) putFalco({ muted_rules: [...settings.muted_rules, rule] }) }

  if (err && !summary) return <div className="ak-card"><h2>امنیت</h2><Err>{err}</Err></div>
  if (!summary) return <div className="ak-card"><h2>امنیت</h2><Loading /></div>
  const v = summary.vulnerabilities || {}, m = summary.misconfigurations || {}
  const catalog = list.catalog || []
  const selected = list.selected || {}

  return (
    <div className="ak-card">
      <h2>امنیت</h2>
      <p className="ak-muted">CVEهای ایمیج‌ها، پیکربندی‌های نادرست و انطباق NSA/CIS/PSS از Trivy Operator، بررسی‌های CIS میزبان از kube-bench و هشدارهای زمان اجرا از Falco.</p>
      {!summary.operator_ready && <Err>Trivy Operator نصب یا آماده نیست — scripts/115-deploy-trivy-operator.sh را اجرا کنید. گزارش‌های زیر (اگر باشد) از اجرای قبلی است.</Err>}
      <Cards items={[['CVE بحرانی', num(v.critical)], ['CVE بالا', num(v.high)], ['CVE متوسط', num(v.medium)], ['CVE پایین', num(v.low)],
        ['پیکربندی نادرست (بحرانی/بالا)', `${num(m.critical)} / ${num(m.high)}`], ['رازهای افشاشده', num(summary.exposed_secrets)], ['بارهای کاری اسکن‌شده', num(summary.workloads_scanned)]]} />

      <nav className="ak-tabs">{VIEWS.map(([id, l]) => <button key={id} className={view === id ? 'on' : ''} onClick={() => pick(id)}>{l}</button>)}</nav>
      <div className="ak-toolbar">
        {view !== 'cis' && <input className="ak-search" type="search" placeholder="جستجو…" value={qLive} onChange={e => onSearch(e.target.value)} />}
        {['vuln', 'misconfig', 'compliance'].includes(view) && <Seg items={SEVS} value={severity} onPick={s => { setSeverity(s); setPage(1) }} />}
        {view === 'falco' && <Seg items={PRIOS} value={priority} onPick={s => { setPriority(s); setPage(1) }} />}
        <div className="spacer" />
        <button className="ak-btn" onClick={() => { loadSummary(); loadList() }}>بارگذاری دوباره</button>
      </div>

      {view === 'compliance' && catalog.length > 0 && (
        <div className="ak-toolbar" dir="ltr"><Seg items={catalog.map(c => [c.id, c.title])} value={report} onPick={r => { setReport(r); setPage(1) }} /></div>
      )}
      {view !== 'cis' && listLoading && <Loading />}

      {view === 'cis' && (!cis?.available ? <p className="ak-muted">هنوز kube-bench اجرا نشده — scripts/116-deploy-kube-bench.sh را اجرا کنید (روزانه هم اجرا می‌شود).</p> : <>
        <Cards items={[['Pass', cis.totals?.pass], ['Fail', cis.totals?.fail], ['Warn', cis.totals?.warn]]} />
        <table className="ak-table" dir="ltr"><thead><tr><th>Section</th><th>Pass</th><th>Fail</th><th>Warn</th></tr></thead>
          <tbody>{(cis.sections || []).map(s => <tr key={s.id}><td>{s.id} {s.text}</td><td>{s.pass}</td><td>{s.fail}</td><td>{s.warn}</td></tr>)}</tbody></table>
        <h3>یافته‌ها</h3>
        <div className="ak-toolbar">{cisT.search('فیلتر بررسی‌ها…')}</div>
        <table className="ak-table" dir="ltr"><thead><tr>{cisT.th('status', 'Status')}{cisT.th('id', 'Check')}{cisT.th('desc', 'Description')}</tr></thead>
          <tbody>{cisT.shown.map(f => <tr key={f.id}><td><span className={`sec-pill cis-${f.status}`}>{f.status}</span></td><td className="sec-mono">{f.id}</td><td className="sec-wrap">{f.desc}</td></tr>)}</tbody></table>
        {cisT.pager}
      </>)}

      {view === 'compliance' && !catalog.length && !listLoading && <p className="ak-muted">هنوز ClusterComplianceReport وجود ندارد — Trivy Operator گزارش‌های NSA / CIS / PSS را هر ۶ ساعت تولید می‌کند.</p>}
      {view === 'compliance' && selected.id && <>
        <p className="ak-muted" dir="auto">{selected.description}</p>
        <Cards items={[['Pass', num(selected.pass)], ['Fail', num(selected.fail)], ['Controls', catalog.length]]} />
      </>}

      {view === 'falco' && (!list.deployed ? (!listLoading && <Err>Falco نصب نشده — scripts/117-deploy-falco.sh را اجرا کنید.</Err>) : <>
        <Cards items={[['DaemonSet آماده', list.daemonset_ready || '—'], ['Critical / Alert', `${num(list.summary?.critical || 0)} / ${num(list.summary?.alert || 0)}`],
          ['Error', num(list.summary?.error || 0)], ['Warning', num(list.summary?.warning || 0)], ['هشدارهای ذخیره‌شده', num(list.total)]]} />
        <div className="ak-sub">
          <div className="ak-row" style={{ alignItems: 'center' }}>
            <span className="ak-label">حداقل اولویت برای ذخیره</span>
            <select className="ak-select" dir="ltr" value={settings.min_priority} onChange={e => e.target.value && e.target.value !== settings.min_priority && putFalco({ min_priority: e.target.value })}>
              {settings.priorities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="ak-row" style={{ alignItems: 'center', marginTop: 10 }}>
            <span className="ak-label">قوانین بی‌صدا</span>
            {!settings.muted_rules.length && <span className="ak-muted">هیچ</span>}
            {settings.muted_rules.map(r => <span key={r} className="sec-pill sev-UNKNOWN" dir="ltr">{r} <button className="sec-x" title="رفع بی‌صدا" onClick={() => putFalco({ muted_rules: settings.muted_rules.filter(x => x !== r) })}>×</button></span>)}
          </div>
          <div className="ak-toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
            <input className="ak-input" dir="ltr" placeholder="نام دقیق قانون برای بی‌صدا کردن…" value={muteInput} onChange={e => setMuteInput(e.target.value)} />
            <button className="ak-btn" onClick={() => { mute(muteInput); setMuteInput('') }}>بی‌صدا</button>
          </div>
        </div>
      </>)}

      {view !== 'cis' && !listLoading && !rows.length && (view !== 'compliance' || catalog.length > 0) && (view !== 'falco' || list.deployed) && <p className="ak-muted">یافته‌ای نیست.</p>}
      {view !== 'cis' && rows.length > 0 && (
        <div className="ak-table-scroll">
          {view === 'vuln' && <table className="ak-table" dir="ltr"><thead><tr>{t.th('namespace', 'Namespace')}{t.th('name', 'Workload', r => `${r.kind}/${r.name}`)}{t.th('image', 'Image')}{t.th('critical', 'C')}{t.th('high', 'H')}{t.th('medium', 'M')}{t.th('low', 'L')}</tr></thead>
            <tbody>{t.shown.map((r, i) => <tr key={i} className="sec-click" onClick={() => openDetail(r)}><td>{r.namespace}</td><td>{r.kind}/{r.name}</td><td className="sec-mono">{r.image}</td><td>{r.critical}</td><td>{r.high}</td><td>{r.medium}</td><td>{r.low}</td></tr>)}</tbody></table>}
          {view === 'misconfig' && <table className="ak-table" dir="ltr"><thead><tr>{t.th('severity', 'Severity', sevRank)}{t.th('namespace', 'Namespace')}{t.th('name', 'Resource', r => `${r.kind}/${r.name}`)}{t.th('category', 'Category')}{t.th('title', 'Check')}</tr></thead>
            <tbody>{t.shown.map((r, i) => <tr key={i}><td><Sev s={r.severity} /></td><td>{r.namespace}</td><td>{r.kind}/{r.name}</td><td>{r.category}</td><td className="sec-wrap">{r.title}</td></tr>)}</tbody></table>}
          {view === 'compliance' && <table className="ak-table" dir="ltr"><thead><tr>{t.th('status', 'Status')}{t.th('severity', 'Severity', sevRank)}{t.th('fail', 'Fail')}{t.th('id', 'Control')}<th>Description</th></tr></thead>
            <tbody>{t.shown.map((r, i) => <tr key={i}><td><span className={`sec-pill cm-${r.status}`}>{r.status}</span></td><td><Sev s={r.severity} /></td><td>{r.fail}</td><td className="sec-mono">{r.id} {r.name}</td><td className="sec-wrap">{r.description}</td></tr>)}</tbody></table>}
          {view === 'falco' && <table className="ak-table" dir="ltr"><thead><tr>{t.th('priority', 'Priority')}{t.th('rule', 'Rule')}{t.th('hostname', 'Node')}<th>Details</th><th /></tr></thead>
            <tbody>{t.shown.map((r, i) => <tr key={i}><td><span className={`sec-pill prio-${String(r.priority || '').toLowerCase()}`}>{r.priority}</span></td><td>{r.rule}</td><td className="sec-mono">{r.hostname}</td>
              <td className="sec-wrap"><div className="sec-mono">{r.output}</div>{Object.entries(r.fields || {}).map(([k, x]) => <span key={k} className="sec-pill sev-LOW">{k}={String(x)}</span>)}</td>
              <td><button className="ak-btn" onClick={() => mute(r.rule)}>بی‌صدا کردن قانون</button></td></tr>)}</tbody></table>}
        </div>
      )}
      {view !== 'cis' && (
        <div className="ak-pager">
          <button className="ak-btn ak-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
          <span>صفحه {page} از {list.total_pages || 1} ({num(list.total || 0)} مورد)</span>
          <button className="ak-btn ak-ghost" disabled={page >= (list.total_pages || 1)} onClick={() => setPage(page + 1)}>بعدی</button>
        </div>
      )}

      {detail && (
        <Modal wide title={`${detail.workload?.kind}/${detail.workload?.name} · ${detail.workload?.container}`} onClose={() => setDetail(null)} actions={<button className="ak-btn" onClick={() => setDetail(null)}>بستن</button>}>
          <DetailTable rows={detail.vulnerabilities || []} />
        </Modal>
      )}
    </div>
  )
}

function DetailTable({ rows }) {
  const t = useTable(rows, { keys: ['id', 'resource', 'severity'], sort: { key: 'severity', dir: 'asc', get: sevRank }, per: 15 })
  return <>
    <div className="ak-toolbar">{t.search('فیلتر CVE / بسته…')}</div>
    <div className="ak-table-scroll"><table className="ak-table" dir="ltr"><thead><tr>{t.th('severity', 'Severity', sevRank)}{t.th('id', 'CVE')}{t.th('resource', 'Package')}<th>Installed</th><th>Fixed</th></tr></thead>
      <tbody>{t.shown.map((v, i) => <tr key={i}><td><Sev s={v.severity} /></td><td className="sec-mono">{v.id}</td><td className="sec-mono">{v.resource}</td><td className="sec-mono">{v.installed}</td><td className="sec-mono">{v.fixed || '—'}</td></tr>)}</tbody></table></div>
    {t.pager}
  </>
}
