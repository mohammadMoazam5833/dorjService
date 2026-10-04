import { useState, useEffect, useRef, useMemo } from 'react'
import { getJson } from '../../lib/http.js'
import { PROM, LOKI, TEMPO, REFRESH_MS, COLORS, OTHERS_KEY, DEFAULT_TRACEQL, RANGES, CHARTS, RCA_CHARTS, RCA_DEPLOYS_EXPR,
  aliasMap, aliasNormalizedExpr, topUsersExpr, traceQuery, parseTrace, visibleSpans, svcColor, userSlices, scaleSeries } from '../../lib/admin/obs.js'
import { wedges } from '../../lib/admin/gpu.js'
import { useTable } from './kit.jsx'
import './monitoring.css'
import Spinner from '../../components/Spinner.jsx'

// Port of the platform's admin Monitoring tab: Observability (Prometheus charts, top users,
// per-model slow-prompt RCA, Loki logs) and Traces (Tempo search + span waterfall). Read-only.

async function prom(path, params) {
  const r = await getJson(`${PROM}/${path}?${new URLSearchParams(params)}`, { ttlMs: 0 })
  if (r.error) throw new Error(r.error.message)
  if (r.data?.status !== 'success') throw new Error(r.data?.error || 'Prometheus error')
  return r.data.data?.result || []
}

const BUSY = Symbol('busy')
const showStatus = s => (s === BUSY ? <Spinner /> : s)

const fmtNum = v => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v >= 10 ? String(Math.round(v)) : String(Math.round(v * 100) / 100))

function TimeChart({ title, series, hidden, onToggle, longRange }) {
  const W = 600, H = 170, PL = 44, PB = 22, PT = 8
  const shown = useMemo(() => series.filter(s => !hidden.has(s.label)), [series, hidden])
  const sc = useMemo(() => scaleSeries(shown, { w: W - PL - 8, h: H - PB - PT }), [shown])
  const [hover, setHover] = useState(null)
  const fmtT = t => { const d = new Date(t * 1000); return longRange ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  const onMove = e => {
    if (sc.empty) return
    const r = e.currentTarget.getBoundingClientRect()
    const fx = ((e.clientX - r.left) / r.width * W - PL) / (W - PL - 8)
    if (fx < 0 || fx > 1) { setHover(null); return }
    const t = sc.t0 + fx * (sc.t1 - sc.t0)
    const vals = shown.map(s => {
      let best = null
      for (const p of s.points) if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p
      return best && { label: s.label, color: s.color, v: best[1], t: best[0] }
    }).filter(Boolean)
    setHover({ x: PL + fx * (W - PL - 8), t: vals[0]?.t ?? t, vals })
  }
  return (
    <div className="mo-card">
      <div className="mo-title">{title}</div>
      {!series.length ? <div className="mo-empty">داده‌ای نیست</div> : (
        <div className="mo-plot" dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} className="mo-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {[0, 0.5, 1].map(f => { const y = PT + (H - PB - PT) * (1 - f); return <g key={f}><line x1={PL} x2={W - 8} y1={y} y2={y} className="mo-gl" /><text x={PL - 6} y={y + 4} className="mo-axis" textAnchor="end">{fmtNum(sc.yMax * f)}</text></g> })}
            {!sc.empty && [0, 0.5, 1].map(f => <text key={f} x={PL + f * (W - PL - 8)} y={H - 6} className="mo-axis" textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{fmtT(sc.t0 + f * (sc.t1 - sc.t0))}</text>)}
            {sc.series.map(s => <polyline key={s.label} fill="none" stroke={s.color} strokeWidth="2" points={s.xy.map(([x, y]) => `${(x + PL).toFixed(1)},${(y + PT).toFixed(1)}`).join(' ')} />)}
            {hover && <line x1={hover.x} x2={hover.x} y1={PT} y2={H - PB} className="mo-cross" />}
          </svg>
          {hover && <div className="mo-tip" style={{ left: `${(hover.x / W) * 100}%` }}><b>{fmtT(hover.t)}</b>{hover.vals.map(v => <div key={v.label}><i style={{ background: v.color }} />{v.label}: {fmtNum(v.v)}</div>)}</div>}
        </div>
      )}
      <div className="mo-legend" dir="ltr">
        {series.map(s => <span key={s.label} className={`mo-legend-item ${hidden.has(s.label) ? 'off' : ''}`} title={s.label} onClick={() => onToggle(s.label)}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  )
}

function useHidden() {
  const [h, setH] = useState({})
  return [id => h[id] || new Set(), (id, label) => setH(x => { const s = new Set(x[id] || []); s.has(label) ? s.delete(label) : s.add(label); return { ...x, [id]: s } })]
}

function Observability() {
  const [range, setRange] = useState(60)
  const [status, setStatus] = useState('')
  const [data, setData] = useState({})
  const [rcaData, setRcaData] = useState({})
  const [aliases, setAliases] = useState(null)
  const [top, setTop] = useState([])
  const [drill, setDrill] = useState(null)
  const [deps, setDeps] = useState([])
  const [sel, setSel] = useState('')
  const [logs, setLogs] = useState({ lines: [], status: '' })
  const [logFilter, setLogFilter] = useState('')
  const [getHidden, toggle] = useHidden()
  const rangeCfg = RANGES.find(r => r.minutes === range) || RANGES[1]

  const loadChart = async (cfg, map, exprFn) => {
    const out = []
    let ci = 0
    for (const q of cfg.queries) {
      let expr = q.normalizeAlias ? `sum by (requested_model) (${aliasNormalizedExpr(q.expr, map)})` : q.expr
      if (exprFn) expr = exprFn(expr)
      let res = []
      try { res = await prom('query_range', { query: expr, minutes: String(rangeCfg.minutes), step: String(rangeCfg.step) }) } catch (e) { setStatus(e.message) }
      for (const s of res) {
        const label = q.name || (q.label && s.metric?.[q.label] ? (map[s.metric[q.label]] || s.metric[q.label]) : Object.values(s.metric || {})[0] || 'value')
        // histogram_quantile over an idle window is all NaN - such a series has nothing to draw
        const points = (s.values || []).map(v => [Number(v[0]), Number(v[1])]).filter(([, y]) => Number.isFinite(y))
        if (points.length) out.push({ label, color: COLORS[ci++ % COLORS.length], points })
      }
    }
    return out
  }
  const loadLogs = async job => {
    if (!job) return
    setLogs(l => ({ ...l, status: BUSY }))
    const r = await getJson(`${LOKI}/query_range?${new URLSearchParams({ query: `{namespace="vllm",pod=~"${job}-.*"}`, minutes: '30', limit: '400' })}`, { ttlMs: 0 })
    if (r.error || (r.data?.status && r.data.status !== 'success')) { setLogs({ lines: [], status: r.error?.message || r.data?.error || 'Loki error' }); return }
    const out = []
    for (const s of r.data?.data?.result || []) for (const v of s.values || []) out.push({ ts: Number(v[0]) / 1e6, line: v[1] })
    out.sort((a, b) => b.ts - a.ts)
    setLogs({ lines: out.slice(0, 400), status: `${Math.min(out.length, 400)} خط` })
  }
  const loadRca = async (job, list, map) => {
    if (!job) return
    const engine = list.find(d => d.job === job)?.engine || 'vllm'
    const res = {}
    for (const cfg of RCA_CHARTS) {
      const c = cfg.queriesByEngine ? { ...cfg, queries: cfg.queriesByEngine[engine] || cfg.queriesByEngine.vllm } : cfg
      res[cfg.id] = await loadChart(c, map, e => e.split('{job}').join(job))
    }
    setRcaData(res)
  }
  const refresh = async map => {
    setStatus(BUSY)
    const res = {}
    await Promise.all(CHARTS.map(async cfg => { res[cfg.id] = await loadChart(cfg, map) }))
    setData(res)
    try {
      const rows = await prom('query', { query: topUsersExpr(range, e => aliasNormalizedExpr(e, map)) })
      setTop(rows.map(r => ({ user: r.metric?.user || '(none)', model: r.metric?.requested_model || '(none)', value: Math.round(Number(r.value?.[1])) })).filter(u => u.value > 0))
    } catch { setTop([]) }
    let list = deps, job = sel
    if (!list.length) {
      try {
        const rows = await prom('query', { query: RCA_DEPLOYS_EXPR })
        const seen = new Set()
        list = rows.map(r => ({ job: r.metric?.job || '', model_name: r.metric?.model_name || r.metric?.job, engine: r.metric?.engine || 'vllm' }))
          .filter(d => d.job && !seen.has(d.job) && seen.add(d.job)).sort((a, b) => a.model_name.localeCompare(b.model_name))
        setDeps(list)
        if (!job && list.length) { job = list[0].job; setSel(job) }
      } catch { /* RCA section shows its empty state */ }
    }
    await loadRca(job, list, map)
    await loadLogs(job)
    setStatus(`به‌روز شده ${new Date().toLocaleTimeString()}`)
  }
  useEffect(() => { getJson('/admin-panel/api/admin/models').then(r => setAliases(aliasMap(r.data))) }, [])
  useEffect(() => {
    if (!aliases) return
    refresh(aliases)
    const t = setInterval(() => refresh(aliases), REFRESH_MS)
    return () => clearInterval(t)
  }, [aliases, range])

  const slices = userSlices(top, drill)
  const pie = wedges(slices.map(s => ({ ...s, weight: s.value })))
  const tuT = useTable(top, { keys: ['user', 'model'], sort: { key: 'value', dir: 'desc' } })
  const longRange = range > 360
  const logText = logs.lines.filter(l => !logFilter.trim() || l.line.toLowerCase().includes(logFilter.trim().toLowerCase()))
    .map(l => `${new Date(l.ts).toLocaleTimeString()}  ${l.line}`).join('\n') || '(خطی نیست)'

  return (
    <>
      <div className="ak-toolbar">
        <span className="ak-label">بازه</span>
        <span className="gp-seg">{RANGES.map(r => <button key={r.minutes} className={range === r.minutes ? 'on' : ''} onClick={() => setRange(r.minutes)}>{r.label}</button>)}</span>
        <button className="ak-btn" onClick={() => aliases && refresh(aliases)}>بارگذاری دوباره</button>
        <span className="ak-muted">{showStatus(status)}</span>
      </div>
      <div className="mo-grid">
        {CHARTS.map(c => <TimeChart key={c.id} title={c.title} series={data[c.id] || []} hidden={getHidden(c.id)} onToggle={l => toggle(c.id, l)} longRange={longRange} />)}
        <div className="mo-card mo-wide">
          <div className="mo-title">کاربران برتر به تفکیک مدل (آخرین {rangeCfg.label})</div>
          {!top.length ? <div className="mo-empty">داده‌ای نیست</div> : <>
            {drill && <div className="ak-toolbar"><button className="ak-btn" onClick={() => setDrill(null)}>← همه‌ی کاربران</button><span className="ak-muted">نمایش: {drill === OTHERS_KEY ? 'سایر (کاربران کوچک)' : drill}</span></div>}
            <div className="gp-pie-wrap" dir="ltr" style={{ justifyContent: 'center' }}>
              <svg viewBox="0 0 220 220" className="gp-pie">{pie.map((s, i) => <path key={i} d={s.path} fill={s.color} className={`gp-slice ${s.drillable ? 'click' : ''}`} onClick={() => s.drillable && setDrill(s.key)}><title>{`${s.label} — ${s.value} (${s.pct}%)`}</title></path>)}</svg>
              <div className="gp-legend">{slices.map(s => <div key={s.key} className={`gp-legend-row ${s.drillable ? 'click' : ''}`} onClick={() => s.drillable && setDrill(s.key)}><span className="gp-swatch" style={{ background: s.color }} /><span>{s.label} — {s.value} ({s.pct}%)</span></div>)}</div>
            </div>
            <div className="ak-toolbar">{tuT.search('فیلتر کاربر یا مدل…')}<span className="ak-muted">{tuT.count} از {top.length}</span></div>
            <table className="ak-table" dir="ltr"><thead><tr>{tuT.th('user', 'User')}{tuT.th('model', 'Model')}{tuT.th('value', 'Requests')}</tr></thead>
              <tbody>{tuT.shown.map((u, i) => <tr key={i}><td>{u.user}</td><td>{u.model}</td><td>{u.value}</td></tr>)}</tbody></table>
            {tuT.pager}
          </>}
        </div>
      </div>

      <h3 className="mo-rca-head">ریشه‌یابی پرامپت کند — به تفکیک مدل</h3>
      <p className="ak-muted">یک استقرار را انتخاب کنید: تأخیر کجا صرف می‌شود (صف / prefill / decode)، صف یا preemption یا فشار روی KV cache، بار GPU، سربار Gateway و لاگ خود مدل — همه در یک بازه‌ی زمانی.</p>
      <div className="ak-toolbar">
        <span className="ak-label">مدل</span>
        <select className="ak-select" dir="ltr" value={sel} onChange={e => { const j = e.target.value; setSel(j); setLogs({ lines: [], status: '' }); loadRca(j, deps, aliases || {}); loadLogs(j) }}>
          {deps.map(d => <option key={d.job} value={d.job}>{d.model_name} ({d.job})</option>)}
        </select>
      </div>
      {!sel ? <div className="mo-empty">هیچ استقرار vLLM/SGLang متریک گزارش نمی‌کند</div> : <>
        <div className="mo-grid">{RCA_CHARTS.map(c => <TimeChart key={c.id} title={c.title} series={rcaData[c.id] || []} hidden={getHidden(`rc-${c.id}`)} onToggle={l => toggle(`rc-${c.id}`, l)} longRange={longRange} />)}</div>
        <div className="mo-log-wrap">
          <div className="ak-toolbar mo-log-bar">
            <span className="mo-title" style={{ margin: 0 }}>لاگ‌ها (Loki، ۳۰ دقیقه‌ی اخیر)</span>
            <input className="ak-search" type="search" dir="ltr" placeholder="فیلتر…" value={logFilter} onChange={e => setLogFilter(e.target.value)} />
            <button className="ak-btn" onClick={() => loadLogs(sel)}>بارگذاری دوباره</button>
            <span className="ak-muted">{showStatus(logs.status)}</span>
          </div>
          <pre className="mo-log" dir="ltr">{logText}</pre>
        </div>
      </>}
    </>
  )
}

const BIG_TRACE = 300
const MAX_ROWS = 800

function Traces() {
  const [ql, setQl] = useState(DEFAULT_TRACEQL)
  const [ip, setIp] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [trace, setTrace] = useState(null)
  const [collapsed, setCollapsed] = useState(new Set())
  const [zoom, setZoom] = useState(null)
  const [drag, setDrag] = useState(null)
  const scope = useRef(null)
  const t = useTable(rows, { keys: ['svcList', 'traceID'], sort: { key: 'durationMs', dir: 'desc' }, per: 15 })

  const search = async () => {
    setLoading(true); setStatus(BUSY); setTrace(null)
    const r = await getJson(`${TEMPO}/search?${new URLSearchParams({ q: traceQuery(ql, ip), minutes: '60', limit: '150' })}`, { ttlMs: 0 })
    setLoading(false)
    if (r.error) { setRows([]); setStatus(r.error.message); return }
    const list = (r.data?.traces || []).map(x => ({
      ...x, durationMs: Number(x.durationMs || 0), start: Number(x.startTimeUnixNano || 0) / 1e6,
      spanCount: x.serviceStats ? Object.values(x.serviceStats).reduce((a, s) => a + Number(s.spanCount || 0), 0)
        : Number(x.spanSet?.matched || 0) || (x.spanSets || []).reduce((a, s) => a + Number(s.matched || 0), 0),
      svcList: x.serviceStats ? Object.keys(x.serviceStats).join(', ') : x.rootServiceName || '',
    }))
    setRows(list); setStatus(`${list.length} trace`)
  }
  useEffect(() => { search() }, [])
  const open = async id => {
    setStatus(BUSY)
    const r = await getJson(`${TEMPO}/trace/${encodeURIComponent(id)}`, { ttlMs: 0 })
    if (r.error) { setStatus(r.error.message); return }
    const p = parseTrace(r.data)
    // huge traces (seen live: 63k spans) start with every branch below the roots folded
    setTrace({ id, ...p }); setCollapsed(new Set(p.spans.length > BIG_TRACE ? p.spans.filter(x => x.hasChildren && x.depth >= 1).map(x => x.id) : [])); setZoom(null)
    setStatus(p.spans.length ? `${p.spans.length} span` : 'این trace هنوز span ندارد')
  }

  const from = zoom?.[0] ?? 0, to = zoom?.[1] ?? trace?.total ?? 1, win = Math.max(0.001, to - from)
  const allVis = trace ? visibleSpans(trace.spans, collapsed) : []
  const vis = allVis.slice(0, MAX_ROWS)
  const frac = e => { const r = scope.current.getBoundingClientRect(); return ((e.clientX - r.left) / r.width - 0.4) / 0.6 }
  const onDown = e => { const f = frac(e); if (f >= 0 && f <= 1) { setDrag([f, f]); e.preventDefault() } }
  const onMove = e => drag && setDrag([drag[0], Math.max(0, Math.min(1, frac(e)))])
  const onUp = () => {
    if (!drag) return
    let lo = Math.min(...drag), hi = Math.max(...drag)
    setDrag(null)
    if ((hi - lo) * scope.current.getBoundingClientRect().width < 24) return
    if (hi - lo < 0.01) { const m = (lo + hi) / 2; lo = Math.max(0, m - 0.005); hi = Math.min(1, lo + 0.01) }
    setZoom([from + lo * win, from + hi * win])
  }
  const toggleId = id => setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n })
  const left = s => ((s.s0ms - from) / win) * 100

  return (
    <>
      <p className="ak-muted">traceهای هر درخواست از Tempo — کلاینت ← API gateway ← LiteLLM ← vLLM. برای waterfall روی ردیف کلیک کنید.</p>
      <div className="ak-toolbar">
        <input className="ak-input" dir="ltr" style={{ flex: 2, minWidth: 220 }} placeholder="TraceQL" value={ql} onChange={e => setQl(e.target.value)} />
        <input className="ak-input" dir="ltr" style={{ flex: 1 }} placeholder="IP کلاینت (اختیاری)" value={ip} onChange={e => setIp(e.target.value)} />
        <button className="ak-btn ak-primary" onClick={search} disabled={loading}>جستجو</button>
        <span className="ak-muted">{showStatus(status)}</span>
      </div>
      {!loading && !rows.length && <div className="mo-empty">traceای نیست — TraceQL را بازتر کنید، فیلتر IP را بردارید یا چند درخواست بفرستید</div>}
      {rows.length > 0 && <>
        <div className="ak-toolbar">{t.search('فیلتر سرویس / trace id…')}</div>
        <table className="ak-table" dir="ltr"><thead><tr>{t.th('start', 'Time')}{t.th('svcList', 'Services in trace')}{t.th('spanCount', 'Spans')}{t.th('durationMs', 'Duration (ms)')}</tr></thead>
          <tbody>{t.shown.map(x => <tr key={x.traceID} className={`sec-click ${trace?.id === x.traceID ? 'gp-kind on' : ''}`} onClick={() => open(x.traceID)}>
            <td>{x.start ? new Date(x.start).toLocaleString() : ''}</td><td>{x.svcList}</td><td>{x.spanCount}</td><td>{Math.round(x.durationMs)}</td></tr>)}</tbody></table>
        {t.pager}
      </>}
      {trace && (
        <div className="tr-detail">
          <div className="ak-toolbar"><b dir="ltr">Trace {trace.id} · {Math.round(trace.total * 10) / 10} ms</b><div className="spacer" /><button className="ak-btn" onClick={() => setTrace(null)}>بستن</button></div>
          {trace.skewMs > 0 && <p className="ak-warn">⚠ ساعت نودها حدود {trace.skewMs} ms با هم اختلاف دارند — شروع spanها برای خوانایی با والدشان هم‌تراز شده است (مدت‌ها دقیق است).</p>}
          <div className="ak-toolbar">
            <button className="ak-btn" onClick={() => setCollapsed(new Set(trace.spans.filter(s => s.hasChildren).map(s => s.id)))}>بستن همه</button>
            <button className="ak-btn" onClick={() => setCollapsed(new Set())}>باز کردن همه</button>
            {zoom && <button className="ak-btn" onClick={() => setZoom(null)}>بازنشانی زوم (100%)</button>}
            <span className="ak-muted">{zoom ? `زوم روی ${Math.round(win)}ms — برای زوم بیشتر دوباره روی خط زمان بکشید` : 'برای زوم، روی خط زمان بکشید'}</span>
          </div>
          <div className="tr-wf" dir="ltr">
            <div className="tr-axis">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} style={{ left: `calc(40% + ${i * 12}%)` }}>+{Math.round(from + win * i / 5)}ms</span>)}</div>
            <div className="tr-scope" ref={scope} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
              <svg className="tr-overlay" viewBox={`0 0 1000 ${vis.length * 24 || 1}`} preserveAspectRatio="none">
                {[0, 1, 2, 3, 4, 5].map(i => <line key={i} x1={400 + i * 120} x2={400 + i * 120} y1="0" y2={vis.length * 24} stroke="currentColor" strokeOpacity=".15" strokeDasharray="2,3" />)}
                {vis.map((s, i) => {
                  const kids = vis.map((c, j) => (c.parentId === s.id ? j : -1)).filter(j => j >= 0)
                  if (!kids.length) return null
                  const x = 400 + Math.max(0, Math.min(100, left(s))) * 6
                  return <line key={s.id} x1={x} x2={x} y1={i * 24 + 12} y2={Math.max(...kids) * 24 + 12} stroke={svcColor(s.service)} strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="3,2" />
                })}
              </svg>
              {drag && <div className="tr-sel" style={{ left: `calc(40% + ${Math.min(...drag) * 60}%)`, width: `${Math.abs(drag[1] - drag[0]) * 60}%` }} />}
              {vis.map(s => {
                const l = left(s), w = Math.max(0.4, ((s.s1ms - s.s0ms) / win) * 100), end = Math.min(100, Math.max(0, l) + w), color = svcColor(s.service)
                const dur = Math.round((s.s1ms - s.s0ms) * 10) / 10
                const isC = s.hasChildren && collapsed.has(s.id)
                return (
                  <div key={s.id} className="tr-row">
                    <div className="tr-label" style={{ paddingLeft: s.depth * 14 }}>
                      <span className="tr-toggle" onMouseDown={e => e.stopPropagation()} onClick={() => s.hasChildren && toggleId(s.id)}>{s.hasChildren ? (isC ? '▸' : '▾') : ''}</span>
                      <span className="tr-seq">#{s.seq}</span><span className="tr-dot" style={{ background: color }} /><span className="tr-svc">{s.service}</span><span>{s.name}</span>
                      {isC && <span className="ak-muted"> (+{trace.descendants[s.id] || 0})</span>}
                    </div>
                    <div className="tr-track">
                      <div className="tr-bar" title={`#${s.seq} ${s.service} · start +${Math.round(s.s0ms)}ms · end +${Math.round(s.s1ms)}ms · dur ${dur}ms`} style={{ left: `${Math.max(0, l)}%`, width: `${w}%`, background: color }} />
                      <span className="tr-dur" style={end > 88 ? { left: `${Math.max(0, l)}%`, transform: 'translateX(calc(-100% - 4px))' } : { left: `${end}%`, transform: 'translateX(4px)' }}>{dur} ms</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {allVis.length > vis.length && <p className="ak-warn" dir="rtl">فقط {MAX_ROWS} span اول نمایش داده شده؛ {allVis.length - vis.length} span دیگر — شاخه‌ها را ببندید یا زوم کنید.</p>}
            <div className="tr-legend" dir="rtl">
              <span>#N = ترتیب زمانی شروع در کل trace</span>
              <span>خط‌چین عمودی = زمان شروع یک span تا جایی که فرزندانش شروع می‌شوند (فرزند همیشه روی/بعد از این خط شروع می‌شود)</span>
              <span>▸/▾ = بستن/باز کردن شاخه · (+N) = نوادگان پنهان</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Monitoring() {
  const [sub, setSub] = useState('observability')
  return (
    <div className="ak-card">
      <h2>مانیتورینگ</h2>
      <nav className="ak-tabs">{[['observability', 'Observability'], ['traces', 'Traces']].map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>
      {sub === 'observability' ? <Observability /> : <Traces />}
    </div>
  )
}
