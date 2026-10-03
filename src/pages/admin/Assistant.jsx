import { useState, useEffect, useRef } from 'react'
import { apiPost, apiSend } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { markdownToHtml } from '../../lib/markdown.js'
import { wedges, PIE_COLORS } from '../../lib/admin/gpu.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { Err, useTable } from './kit.jsx'
import './monitoring.css'
import './assistant.css'
import Spinner from '../../components/Spinner.jsx'

// Port of the platform's admin troubleshooting assistant: tool-using LLM chat over cluster
// state (kubeflow-admin-panel /troubleshoot), with render_chart tool output drawn in-app.
const BASE = '/admin-panel/api/admin/troubleshoot'

function isChatModel(m) {
  return m.status === 'serving' && !(m.vllm_args || []).some(a => /^--runner=pooling\b/.test(a) || /^--task=embed\b/.test(a))
}

const chartsOf = trace => (trace || []).filter(t => t.tool === 'render_chart' && t.args?.labels && t.args?.datasets)
  .map(t => ({ type: t.args.chart_type || 'bar', title: t.args.title || '', labels: t.args.labels, datasets: t.args.datasets }))

function ToolChart({ c }) {
  const W = 520, H = 200, PL = 40, PB = 34
  if (c.type === 'pie' || c.type === 'doughnut') {
    const d = c.datasets[0]?.data || []
    const sl = wedges(d.map((v, i) => ({ weight: Number(v) || 0, label: c.labels[i] })))
    return (
      <div className="gp-pie-wrap" dir="ltr">
        <svg viewBox="0 0 220 220" className="gp-pie">{sl.map((s, i) => <path key={i} d={s.path} fill={PIE_COLORS[i % 10]} className="gp-slice"><title>{`${s.label}: ${s.weight} (${s.pct}%)`}</title></path>)}</svg>
        <div className="gp-legend">{sl.map((s, i) => <div key={i} className="gp-legend-row"><span className="gp-swatch" style={{ background: PIE_COLORS[i % 10] }} />{s.label}: {s.weight} ({s.pct}%)</div>)}</div>
      </div>
    )
  }
  const n = c.labels.length || 1
  const max = Math.max(1, ...c.datasets.flatMap(d => (d.data || []).map(Number).filter(Number.isFinite)))
  const iw = W - PL - 8, ih = H - PB - 8
  const y = v => 8 + ih - (Number(v) / max) * ih
  const bw = iw / n / (c.datasets.length + 1)
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="mo-svg">
        {[0, 0.5, 1].map(f => <g key={f}><line x1={PL} x2={W - 8} y1={y(max * f)} y2={y(max * f)} className="mo-gl" /><text x={PL - 4} y={y(max * f) + 4} className="mo-axis" textAnchor="end">{Math.round(max * f * 100) / 100}</text></g>)}
        {c.labels.map((l, i) => <text key={i} x={PL + (i + 0.5) * (iw / n)} y={H - 18} className="mo-axis" textAnchor="middle">{String(l).slice(0, 14)}</text>)}
        {c.datasets.map((d, k) => c.type === 'bar'
          ? (d.data || []).map((v, i) => <rect key={`${k}-${i}`} x={PL + i * (iw / n) + bw * (k + 0.5)} y={y(v)} width={bw} height={8 + ih - y(v)} fill={PIE_COLORS[k % 10]}><title>{`${d.label || ''} ${c.labels[i]}: ${v}`}</title></rect>)
          : <polyline key={k} fill="none" stroke={PIE_COLORS[k % 10]} strokeWidth="2" points={(d.data || []).map((v, i) => `${PL + (i + 0.5) * (iw / n)},${y(v)}`).join(' ')} />)}
      </svg>
      {c.datasets.length > 1 && <div className="mo-legend">{c.datasets.map((d, k) => <span key={k} className="mo-legend-item"><i style={{ background: PIE_COLORS[k % 10] }} />{d.label}</span>)}</div>}
    </div>
  )
}

function Message({ m }) {
  const user = m.role === 'user'
  const charts = user ? [] : chartsOf(m.toolTrace)
  return (
    <div className={`ts-row ${user ? 'ts-user' : 'ts-assistant'}`}>
      <div className="ts-bubble">
        <div className="ts-role">{user ? 'شما' : 'دستیار'}</div>
        {user ? <span dir="auto">{m.content}</span> : <div className="ts-content" dir="auto" dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} />}
        {charts.map((c, i) => <div key={i} className="ts-chart"><p dir="auto">{c.title}</p><ToolChart c={c} /></div>)}
        {m.toolTrace?.length > 0 && (
          <details className="ts-trace"><summary>{m.toolTrace.length} فراخوانی ابزار — {m.toolTrace.map(t => t.tool).join(', ')}</summary><pre dir="ltr">{JSON.stringify(m.toolTrace, null, 2)}</pre></details>
        )}
      </div>
    </div>
  )
}

export default function Assistant() {
  const [sub, setSub] = useState('chat')
  const [models, setModels] = useState([])
  const [model, setModel] = useState('qwen3')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [convId, setConvId] = useState('')
  const [convs, setConvs] = useState([])
  const [del, setDel] = useState(null)
  const end = useRef(null)
  const t = useTable(convs, { keys: ['title'], sort: { key: 'updated_at', dir: 'desc' } })

  const loadConvs = async () => { const r = await getJson(`${BASE}/conversations?t=${Date.now()}`, { ttlMs: 0 }); if (!r.error) setConvs(Array.isArray(r.data) ? r.data : []) }
  const loadModels = async () => {
    const r = await getJson('/admin-panel/api/admin/models', { ttlMs: 10_000 })
    const rows = (Array.isArray(r.data) ? r.data : []).filter(isChatModel).map(m => m.litellm_alias || m.served_model_name || m.id)
    setModels(rows)
    setModel(cur => (rows.length && !rows.includes(cur) ? rows[0] : cur))
  }
  useEffect(() => { loadConvs(); loadModels(); const i = setInterval(loadModels, 15000); return () => clearInterval(i) }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages, sending])

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft(''); setErr('')
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(ms => [...ms, { role: 'user', content: text }])
    setSending(true)
    const r = await apiPost(`${BASE}/chat`, { message: text, history, conversation_id: convId, model })
    setSending(false)
    if (r.error) { setErr(r.error.message); return }
    setMessages(ms => [...ms, { role: 'assistant', content: r.data?.reply || '', toolTrace: r.data?.tool_trace || [] }])
    if (r.data?.conversation_id) setConvId(r.data.conversation_id)
    loadConvs()
  }
  const open = async c => {
    setErr('')
    const r = await getJson(`${BASE}/conversations/${encodeURIComponent(c.id)}`, { ttlMs: 0 })
    if (r.error) { setErr(r.error.message); return }
    setMessages((r.data?.messages || []).filter(m => (m.role === 'user' || m.role === 'assistant') && m.content).map(m => ({ ...m, toolTrace: m.toolTrace || m.tool_trace || [] })))
    setConvId(r.data?.id || c.id); setSub('chat')
  }
  const remove = async () => {
    const c = del; setDel(null)
    const r = await apiSend(`${BASE}/conversations/${encodeURIComponent(c.id)}`, 'DELETE')
    if (r.error) { notifyError(r.error.message); return }
    if (c.id === convId) { setMessages([]); setConvId('') }
    notifySuccess('گفتگو حذف شد'); loadConvs()
  }

  return (
    <div className="ak-card">
      <h2>دستیار هوشمند</h2>
      <nav className="ak-tabs">{[['chat', 'گفتگو'], ['previous', 'گفتگوهای قبلی']].map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>
      <Err>{err}</Err>
      {sub === 'chat' && <>
        <div className="ak-toolbar">
          <span className="ak-label">مدل</span>
          <select className="ak-select" dir="ltr" value={model} onChange={e => setModel(e.target.value)}>
            {!models.length && <option value={model}>{model}</option>}
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="spacer" />
          <button className="ak-btn" onClick={() => { setMessages([]); setConvId(''); setDraft(''); setErr('') }}>گفتگوی جدید</button>
        </div>
        <div className="ts-messages">
          {!messages.length && !sending && <p className="ak-muted" style={{ textAlign: 'center', padding: 30 }}>درباره‌ی وضعیت خوشه، نوت‌بوک‌ها، مدل‌ها یا خطاها بپرسید؛ دستیار با ابزارهای فقط‌خواندنی وضعیت واقعی را بررسی می‌کند.</p>}
          {messages.map((m, i) => <Message key={i} m={m} />)}
          {sending && <div className="ts-row ts-assistant"><div className="ts-bubble ts-thinking"><Spinner label="در حال فکر کردن" text /></div></div>}
          <div ref={end} />
        </div>
        <div className="ak-toolbar" style={{ marginTop: 10 }}>
          <input className="ak-input" style={{ flex: 1 }} dir="auto" placeholder="سؤال خود را بنویسید…" value={draft} disabled={sending}
            onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
          <button className="ak-btn ak-primary" onClick={send} disabled={sending || !draft.trim()}>ارسال</button>
        </div>
      </>}
      {sub === 'previous' && <>
        <div className="ak-toolbar">{t.search('جستجو در عنوان…')}</div>
        <div className="ak-table-scroll"><table className="ak-table"><thead><tr>{t.th('title', 'عنوان')}{t.th('updated_at', 'به‌روزرسانی')}{t.th('message_count', 'پیام‌ها')}<th /></tr></thead>
          <tbody>{t.shown.map(c => (
            <tr key={c.id} className={c.id === convId ? 'gp-kind on' : ''}>
              <td dir="auto">{c.title || '—'}{c.id === convId && <span className="ak-pill ok">فعال</span>}</td>
              <td dir="ltr">{String(c.updated_at || '').replace('T', ' ').slice(0, 16)}</td><td>{c.message_count}</td>
              <td className="ak-actions-cell"><button className="ak-btn" onClick={() => open(c)}>باز کردن</button><button className="ak-btn ak-danger" onClick={() => setDel(c)}>حذف</button></td>
            </tr>))}</tbody></table></div>
        {t.pager}
      </>}
      {del && <ConfirmDialog danger title={`حذف گفتگوی «${del.title || del.id}»؟`} confirmLabel="حذف" onCancel={() => setDel(null)} onConfirm={remove} />}
    </div>
  )
}
