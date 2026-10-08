// Monitoring tab helpers, ported from the platform's admin-panel-model-observability /
// admin-panel-model-trace (Prometheus + Loki + Tempo via kubeflow-admin-panel proxies).

export const PROM = '/admin-panel/api/admin/prometheus'
export const LOKI = '/admin-panel/api/admin/loki'
export const TEMPO = '/admin-panel/api/admin/tempo'
export const REFRESH_MS = 60000
export const COLORS = ['#2747B8', '#5B8CFF', '#E8A317', '#2BB6A8', '#8B7CF6', '#E76A5E', '#4CC3E0', '#5F6F92', '#B78BE8', '#F19A7F']
export const OTHERS_KEY = '__others__'
export const OTHERS_COLOR = '#9e9e9e'
export const DEFAULT_TRACEQL = '{ span.http.target =~ "/v1/.*" }'

// step keeps every range at roughly 100-170 points
export const RANGES = [
  { minutes: 15, label: '15m', step: 15 }, { minutes: 60, label: '1h', step: 30 }, { minutes: 360, label: '6h', step: 120 },
  { minutes: 1440, label: '1d', step: 600 }, { minutes: 10080, label: '1w', step: 3600 }, { minutes: 43200, label: '1m', step: 21600 },
]

const q95 = (m, sel = '') => `histogram_quantile(0.95, sum by (le) (rate(${m}_bucket${sel}[5m])))`
const qn = (n, m, sel = '') => `histogram_quantile(${n}, sum by (le) (rate(${m}_bucket${sel}[5m])))`

export const CHARTS = [
  { id: 'gen_tps', title: 'Generation tokens/sec (vLLM, per model)', queries: [{ expr: 'sum by (model_name) (rate(vllm:generation_tokens_total[1m]))', label: 'model_name' }] },
  { id: 'prompt_tps', title: 'Prompt tokens/sec (vLLM, per model)', queries: [{ expr: 'sum by (model_name) (rate(vllm:prompt_tokens_total[1m]))', label: 'model_name' }] },
  { id: 'inflight', title: 'In-flight requests (vLLM)', queries: [{ expr: 'sum(vllm:num_requests_running)', name: 'running' }, { expr: 'sum(vllm:num_requests_waiting)', name: 'waiting' }] },
  { id: 'ttft', title: 'Time to first token (seconds)', queries: [{ expr: qn(0.5, 'vllm:time_to_first_token_seconds'), name: 'p50' }, { expr: q95('vllm:time_to_first_token_seconds'), name: 'p95' }] },
  { id: 'itl', title: 'Inter-token latency (seconds)', queries: [{ expr: qn(0.5, 'vllm:inter_token_latency_seconds'), name: 'p50' }, { expr: q95('vllm:inter_token_latency_seconds'), name: 'p95' }] },
  // inner vector only: alias-collapsing label_replace + sum by are added at query time
  { id: 'llm_rps', title: 'LiteLLM requests/sec (by model)', queries: [{ expr: 'rate(litellm_proxy_total_requests_metric_total[5m])', label: 'requested_model', normalizeAlias: true }] },
  { id: 'llm_tps', title: 'LiteLLM tokens/sec (by model)', queries: [{ expr: 'rate(litellm_total_tokens_metric_total[1m])', label: 'requested_model', normalizeAlias: true }] },
  { id: 'active_users', title: 'Distinct active users (rolling 1h)', queries: [{ expr: 'count(count by (user) (increase(litellm_proxy_total_requests_metric_total[1h]) > 0))', name: 'users' }] },
]

// llama.cpp has no /metrics, so only vLLM and SGLang deployments are listed
export const RCA_DEPLOYS_EXPR = 'label_replace(group by (job, model_name) (vllm:num_requests_running), "engine", "vllm", "", "") or ' +
  'label_replace(group by (job, model_name) (sglang:num_running_reqs), "engine", "sglang", "", "")'

const J = '{job="{job}"}'
export const RCA_CHARTS = [
  { id: 'rca_lat', title: 'Latency breakdown p95 (s): queue / prefill / decode / e2e', queriesByEngine: {
    vllm: [{ expr: q95('vllm:request_queue_time_seconds', J), name: 'queue' }, { expr: q95('vllm:request_prefill_time_seconds', J), name: 'prefill' },
      { expr: q95('vllm:request_decode_time_seconds', J), name: 'decode' }, { expr: q95('vllm:e2e_request_latency_seconds', J), name: 'e2e' }],
    // SGLang has no plain decode-phase metric outside PD-disaggregation; ITL stands in, labelled as such
    sglang: [{ expr: q95('sglang:queue_time_seconds', J), name: 'queue' }, { expr: q95('sglang:per_stage_req_latency_seconds', '{job="{job}",stage="prefill_forward"}'), name: 'prefill' },
      { expr: q95('sglang:inter_token_latency_seconds', J), name: 'decode (ITL)' }, { expr: q95('sglang:e2e_request_latency_seconds', J), name: 'e2e' }],
  } },
  { id: 'rca_ttft', title: 'Time to first token (s)', queriesByEngine: Object.fromEntries(['vllm', 'sglang'].map(e => [e,
    [0.5, 0.95, 0.99].map(n => ({ expr: qn(n, `${e}:time_to_first_token_seconds`, J), name: `p${Math.round(n * 100)}` }))])) },
  { id: 'rca_queue', title: 'Queue depth & preemptions/s (KV eviction)', queriesByEngine: {
    vllm: [{ expr: 'sum(vllm:num_requests_waiting{job="{job}"})', name: 'waiting' }, { expr: 'sum(vllm:num_requests_running{job="{job}"})', name: 'running' },
      { expr: 'sum(rate(vllm:num_preemptions_total{job="{job}"}[5m]))', name: 'preemptions/s' }],
    sglang: [{ expr: 'sum(sglang:num_queue_reqs{job="{job}"})', name: 'waiting' }, { expr: 'sum(sglang:num_running_reqs{job="{job}"})', name: 'running' }],
  } },
  { id: 'rca_cache', title: 'KV-cache used (%) & prefix-cache hit ratio', queriesByEngine: {
    vllm: [{ expr: 'max(vllm:kv_cache_usage_perc{job="{job}"}) * 100', name: 'kv-cache %' },
      { expr: '100 * sum(rate(vllm:prefix_cache_hits_total{job="{job}"}[5m])) / clamp_min(sum(rate(vllm:prefix_cache_queries_total{job="{job}"}[5m])), 1)', name: 'prefix hit %' }],
    sglang: [{ expr: 'max(sglang:full_token_usage{job="{job}"}) * 100', name: 'kv-cache %' }, { expr: 'max(sglang:cache_hit_rate{job="{job}"}) * 100', name: 'prefix hit %' }],
  } },
  { id: 'rca_gpu', title: 'GPU utilisation (%) per GPU', queries: [{ expr: 'DCGM_FI_DEV_GPU_UTIL{exported_container="{job}"}', label: 'gpu' }] },
  { id: 'rca_vram', title: 'GPU VRAM used (MiB) per GPU', queries: [{ expr: 'DCGM_FI_DEV_FB_USED{exported_container="{job}"}', label: 'gpu' }] },
  { id: 'rca_overhead', title: 'Gateway overhead vs model API latency p95 (s)', queries: [
    { expr: q95('litellm_overhead_latency_metric'), name: 'gateway overhead' }, { expr: q95('litellm_llm_api_latency_metric'), name: 'model api' }] },
]

export function aliasMap(models) {
  const out = {}
  for (const m of Array.isArray(models) ? models : []) {
    if (!m.id) continue
    for (const a of String(m.litellm_alias || '').split(',').map(x => x.trim()).filter(Boolean)) out[a] = m.id
  }
  return out
}

// Rewrites alias series to the real model name before Prometheus aggregates, so one model
// called through both names is one line, not two.
export function aliasNormalizedExpr(expr, map) {
  return Object.keys(map || {}).reduce((e, alias) => {
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return `label_replace(${e}, "requested_model", "${map[alias]}", "requested_model", "^${esc}$")`
  }, expr)
}

export function topUsersExpr(minutes, normalize) {
  const base = `increase(litellm_proxy_total_requests_metric_total{user!="None",requested_model!="None"}[${minutes}m])`
  return `topk(20, sum by (user, requested_model) (${normalize ? normalize(base) : base}))`
}

export function traceQuery(traceQl, ip) {
  let q = String(traceQl || '').trim()
  ip = String(ip || '').trim()
  if (!ip) return q
  const clause = `span.client_ip = "${ip}"`
  if (q.slice(-1) === '}') {
    q = q.slice(0, -1).trim()
    return q + (/\{\s*$/.test(q) ? ' ' : ' && ') + clause + ' }'
  }
  return `{ ${clause} }`
}

// Tempo trace JSON -> depth-first span list. Services on nodes with skewed clocks are shifted
// so each child starts inside its parent (durations stay exact); skewMs reports seconds-level skew.
export function parseTrace(data) {
  const raw = []
  for (const b of data?.batches || data?.resourceSpans || []) {
    const svc = ((b.resource?.attributes || []).find(a => a.key === 'service.name')?.value?.stringValue) || ''
    for (const sc of b.scopeSpans || b.instrumentationLibrarySpans || []) {
      for (const sp of sc.spans || []) {
        raw.push({ id: sp.spanId || Math.random().toString(36), parent: sp.parentSpanId || '', service: svc || '(unknown)', name: sp.name || '(span)',
          s0: Number(sp.startTimeUnixNano || 0) / 1e6, s1: Number(sp.endTimeUnixNano || 0) / 1e6 })
      }
    }
  }
  if (!raw.length) return { spans: [], total: 0, skewMs: 0, descendants: {} }
  const byId = Object.fromEntries(raw.map(s => [s.id, s]))
  const kids = {}, roots = []
  for (const s of raw) (s.parent && byId[s.parent] ? (kids[s.parent] = kids[s.parent] || []) : roots).push(s)
  const orderRoots = roots.slice().sort((a, b) => a.s0 - b.s0)
  const shift = { [orderRoots[0]?.service || '']: 0 }
  const setShifts = s => {
    const sSh = shift[s.service] || 0
    for (const c of kids[s.id] || []) {
      if (!(c.service in shift)) {
        if (c.service === s.service) shift[c.service] = sSh
        else {
          const gap = c.s0 - (s.s0 + sSh)
          shift[c.service] = gap >= -50 && gap <= (s.s1 - s.s0) + 50 ? sSh : (s.s0 + sSh) - c.s0
        }
      }
      setShifts(c)
    }
  }
  orderRoots.forEach(setShifts)
  let skew = 0
  for (const k of Object.keys(shift)) if (Math.abs(shift[k]) > Math.abs(skew)) skew = shift[k]
  let a0 = Infinity, a1 = 0
  for (const s of raw) { const sh = shift[s.service] || 0; a0 = Math.min(a0, s.s0 + sh); a1 = Math.max(a1, s.s1 + sh) }
  if (!isFinite(a0)) a0 = 0
  const seq = {}
  raw.slice().sort((x, y) => (x.s0 + (shift[x.service] || 0)) - (y.s0 + (shift[y.service] || 0))).forEach((s, i) => { seq[s.id] = i + 1 })
  const spans = [], descendants = {}
  const walk = (s, depth, parentId) => {
    const sh = shift[s.service] || 0
    const ks = (kids[s.id] || []).slice().sort((a, b) => a.s0 - b.s0)
    spans.push({ id: s.id, parentId, service: s.service, name: s.name, seq: seq[s.id], depth, s0ms: s.s0 + sh - a0, s1ms: s.s1 + sh - a0, hasChildren: ks.length > 0 })
    let n = 0
    for (const c of ks) n += 1 + walk(c, depth + 1, s.id)
    descendants[s.id] = n
    return n
  }
  orderRoots.forEach(r => walk(r, 0, null))
  return { spans, total: Math.max(1, a1 - a0), skewMs: Math.abs(skew) > 1000 ? Math.round(Math.abs(skew)) : 0, descendants }
}

export function visibleSpans(spans, collapsed) {
  const out = []
  let skip = null
  for (const s of spans) {
    if (skip !== null) { if (s.depth > skip) continue; skip = null }
    out.push(s)
    if (s.hasChildren && collapsed.has(s.id)) skip = s.depth
  }
  return out
}

export function svcColor(svc) {
  const s = String(svc || '').toLowerCase()
  if (/gateway|ingress|istio|envoy/.test(s)) return '#8e24aa'
  if (s.includes('litellm')) return '#1e88e5'
  if (/vllm|deepseek|qwen/.test(s)) return '#00897b'
  return '#7b8794'
}

const byUser = rows => {
  const t = new Map()
  for (const r of rows || []) t.set(r.user, (t.get(r.user) || 0) + r.value)
  return [...t.entries()].map(([user, value]) => ({ user, value })).sort((a, b) => b.value - a.value)
}

// Top-users pie: users under 4% fold into "Others"; drilling a user shows their per-model split,
// drilling Others lists the small users.
export function userSlices(rows, drill) {
  const PCT = 4
  let slices
  if (drill === OTHERS_KEY) {
    const agg = byUser(rows), g = agg.reduce((s, a) => s + a.value, 0) || 1
    slices = agg.filter(a => (a.value / g) * 100 < PCT).map(a => ({ key: a.user, label: a.user, value: a.value, drillable: false }))
  } else if (drill) {
    slices = (rows || []).filter(u => u.user === drill).map(u => ({ key: u.model, label: u.model, value: u.value, drillable: false }))
  } else {
    const agg = byUser(rows), g = agg.reduce((s, a) => s + a.value, 0) || 1
    const main = agg.filter(a => (a.value / g) * 100 >= PCT), rest = agg.filter(a => (a.value / g) * 100 < PCT)
    slices = main.map(a => ({ key: a.user, label: a.user, value: a.value, drillable: true }))
    if (rest.length) slices.push({ key: OTHERS_KEY, label: `Others (${rest.length} user(s))`, value: rest.reduce((s, a) => s + a.value, 0), drillable: true })
  }
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  return slices.map((s, i) => ({ ...s, color: s.key === OTHERS_KEY ? OTHERS_COLOR : COLORS[i % COLORS.length], pct: Math.round((s.value / total) * 1000) / 10 }))
}

// [{points:[[t, v], ...]}] -> pixel coordinates in a w x h box; time axis shared across series, y from 0.
export function scaleSeries(series, { w, h }) {
  const pts = series.flatMap(s => s.points)
  if (!pts.length) return { empty: true, series: [], yMax: 0, t0: 0, t1: 0 }
  let t0 = Infinity, t1 = -Infinity, yMax = 0
  for (const [t, v] of pts) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); if (Number.isFinite(v)) yMax = Math.max(yMax, v) }
  const ySpan = yMax || 1, tSpan = t1 - t0 || 1
  return {
    empty: false, yMax, t0, t1,
    series: series.map(s => ({ ...s, xy: s.points.filter(([, v]) => Number.isFinite(v)).map(([t, v]) => [((t - t0) / tSpan) * w, h - (v / ySpan) * h]) })),
  }
}
