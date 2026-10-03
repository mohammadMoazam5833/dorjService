// Design-mode mock API. Intercepts /api and /admin-panel/api requests so every
// page renders with realistic Persian data without a live backend.
export const MOCK_MARKER = '__DORJ_MOCK_API__' // scripts/check-dist.mjs fails the build if this ships

const now = Date.now()
const iso = daysAgo => new Date(now - daysAgo * 864e5).toISOString()
const wave = (n, base, amp, seed = 1) =>
  Array.from({ length: n }, (_, i) => +(base + amp * (0.5 + 0.5 * Math.sin(i / 2.2 + seed)) + (i % 3) * 0.15 * amp).toFixed(2))

const points = vals => vals.map((v, i) => [Math.floor(now / 1000) - (vals.length - 1 - i) * 300, v])

const DB = {
  '/api/branding': { display_name: 'دُرج', primary_color: '#12dec6', favicon_data_uri: '', logo_data_uri: '' },
  '/api/change-password/whoami': { email: 'demo.user@isigpu.local', displayName: 'demo.user@isigpu.local' },
  '/admin-panel/api/admin/whoami': { email: 'demo.user@isigpu.local', role: 'platform-admin' },

  '/api/dashboard-summary': {
    active_notebooks: 3,
    profile_count: 2,
    monthly_cost: { amount_irr: 48250000 },
    cluster: { cpu_pct: 34.2, memory_pct: 58.7, storage_pct: 41.3 },
  },

  // real shape: Prometheus range points [[unixTs, value|null], ...] over 6 h at a 5 m step
  '/api/dashboard-usage-history': {
    namespace: 'demo', step_seconds: 300,
    cpu_cores: points(wave(72, 2.1, 3.4, 1)),
    memory_gib: points(wave(72, 9, 12, 2)),
    storage_gib: points(wave(72, 4.2, 1.8, 3)),
    gpu_util_pct: points(wave(72, 30, 40, 4)),
  },

  '/api/dashboard-cost': {
    namespace: 'demo', rate_source: 'mock',
    daily: Array.from({ length: 30 }, (_, i) => ({ date: new Date(now - (29 - i) * 864e5).toISOString().slice(0, 10), usd: 3 + (i % 5), irr: (3 + (i % 5)) * 1_050_000 })),
    by_pod: [{ pod: 'vision-train-0', usd: 61, irr: 64_050_000 }, { pod: 'nlp-finetune-0', usd: 35, irr: 36_750_000 }],
  },

  '/api/resource-usage': {
    namespace: 'demo',
    cpu: { used_cores: 2.7, requested_cores: 8, pct: 34.2 },
    memory: { used_gib: 18.8, requested_gib: 32, pct: 58.7 },
    storage: { used_gib: 4.1, capacity_gib: 10, pct: 41.3 },
    gpu: { slices_allocated: 1, util_pct: 62.4 },
    cost: { usd: 96, irr: 48250000 },
    backup_cost: { count: 4, usd: 3 },
  },

  // real kubeflow-resource-usage shapes (phase/stopped/url), see src/lib/adapters/workloads.js
  '/api/notebooks': [
    { name: 'vision-train',   phase: 'ready',   stopped: false, phase_message: 'Running', image: 'dorj/jupyter-pytorch-cuda-full:v1.10.0',    created_at: iso(2),  url: 'https://platform.isigpu.local/notebook/demo/vision-train/' },
    { name: 'nlp-finetune',   phase: 'ready',   stopped: false, phase_message: 'Running', image: 'dorj/jupyter-tensorflow-cuda-full:v1.10.0', created_at: iso(6),  url: 'https://platform.isigpu.local/notebook/demo/nlp-finetune/' },
    { name: 'data-prep',      phase: 'stopped', stopped: true,  phase_message: 'No Pods are currently running for this Notebook Server.', image: 'dorj/jupyter-scipy:v1.10.0', created_at: iso(13), url: 'https://platform.isigpu.local/notebook/demo/data-prep/' },
    { name: 'gpu-experiment', phase: 'waiting', stopped: false, phase_message: 'Waiting for the Pod to be scheduled.', image: 'dorj/jupyter-pytorch-cuda-full:v1.10.0', created_at: iso(0), url: 'https://platform.isigpu.local/notebook/demo/gpu-experiment/' },
    { name: 'old-test',       phase: 'warning', stopped: false, phase_message: 'ImagePullBackOff: image not found', image: 'dorj/jupyter-scipy:v1.10.0', created_at: iso(30), url: 'https://platform.isigpu.local/notebook/demo/old-test/' },
  ],

  '/api/notebooks/options': {
    image_options: [
      'dorj/notebook-servers/jupyter-pytorch-cuda-full:v1.10.0',
      'dorj/notebook-servers/jupyter-tensorflow-cuda-full:v1.10.0',
      'dorj/notebook-servers/jupyter-scipy:v1.10.0',
    ],
    image_default: 'dorj/notebook-servers/jupyter-pytorch-cuda-full:v1.10.0',
    quota: { cpu_remaining_cores: 5, cpu_total_cores: 8, memory_remaining_gib: 13, memory_total_gib: 32, storage_remaining_gib: 6, storage_total_gib: 10 },
  },

  '/api/volumes': [
    { name: 'vision-workspace', size: '20Gi', used_gib: 12, status: 'Bound', shared: false, in_use_by: 'vision-train', autoresize_enabled: true, viewer_url: 'https://platform.isigpu.local/pvcviewers/demo/vision-workspace/' },
    { name: 'datasets', size: '50Gi', used_gib: 33, status: 'Bound', shared: true, in_use_by: '', autoresize_enabled: false, viewer_url: null },
    { name: 'nlp-workspace', size: '15Gi', used_gib: null, status: 'Pending', shared: false, in_use_by: '', autoresize_enabled: false, viewer_url: null },
  ],
  '/api/volumes/quota': { quota: { storage_remaining_gib: 6 } },

  '/api/vms/enabled': { enabled: true },
  '/api/vms': [
    { name: 'inference-vm-01', phase: 'Running', cpu_cores: 8, memory_request: '32Gi', ip_address: '10.20.4.11', created_at: iso(9), console_available: true },
    { name: 'build-runner',    phase: 'Stopped', cpu_cores: 4, memory_request: '16Gi', ip_address: null, created_at: iso(21), console_available: false },
  ],

  '/api/mail/folders': {
    address: 'demo.user@isigpu.local',
    folders: [{ name: 'INBOX', total: 8, unseen: 2 }, { name: 'Sent', total: 3, unseen: 0 }, { name: 'Archive', total: 0, unseen: 0 }, { name: 'Trash', total: 0, unseen: 0 }],
  },

  '/api/backups': [
    { name: 'vision-workspace-snap', created_at: iso(1), phase: 'Completed', size_gib: 12 },
    { name: 'datasets-weekly',       created_at: iso(7), phase: 'Completed', size_gib: 33 },
  ],


  '/admin-panel/api/admin/users': [
    { username: 'godarzi', email: 'godarzi@isigpu.local', enabled: true, is_platform_admin: true, federated: false },
    { username: 'm.rezaei', email: 'm.rezaei@isigpu.local', enabled: true, is_platform_admin: false, federated: true },
    { username: 'sara.k', email: 'sara.k@isigpu.local', enabled: false, is_platform_admin: false, pending_approval: true, federated: false },
    { username: 'h.ahmadi', email: 'h.ahmadi@isigpu.local', enabled: true, is_platform_admin: false, federated: true },
  ],

  '/admin-panel/api/admin/profiles': [
    { name: 'godarzi', owner: 'godarzi', tier: 'gold', created_at: iso(120), resource_quota: { hard: { 'limits.cpu': '8', 'limits.memory': '32Gi', 'requests.storage': '10Gi', 'nvidia.com/gpu': 1 } } },
    { name: 'team-vision', owner: 'm.rezaei', tier: 'silver', created_at: iso(64), resource_quota: { hard: { 'limits.cpu': '16', 'limits.memory': '64Gi', 'requests.storage': '50Gi', 'nvidia.com/a100': 2 } } },
    { name: 'nlp-lab', owner: 'h.ahmadi', tier: 'bronze', created_at: iso(30), resource_quota: { hard: { 'limits.cpu': '4', 'limits.memory': '16Gi', 'requests.storage': '20Gi' } } },
  ],

  '/admin-panel/api/admin/sla-nodes': [
    { name: 'gpu-node-01', memory_capacity_gib: 512, cpu_capacity_cores: 96, pod_count: 14, gpu_summary: '4× A100 80GB', reserved_for: 'team-vision' },
    { name: 'gpu-node-02', memory_capacity_gib: 512, cpu_capacity_cores: 96, pod_count: 8, gpu_summary: '4× A100 80GB', reserved_for: '' },
  ],

  '/admin-panel/api/admin/gpu-passthrough': {
    gpus: [
      { node: 'gpu-node-01', bdf: '0000:17:00.0', model: 'NVIDIA A100 80GB', current_driver: 'vfio-pci', in_sync: true },
      { node: 'gpu-node-01', bdf: '0000:65:00.0', model: 'NVIDIA A100 80GB', current_driver: 'nvidia', in_sync: false },
      { node: 'gpu-node-02', bdf: '0000:17:00.0', model: 'NVIDIA A100 80GB', current_driver: 'vfio-pci', in_sync: true },
    ],
    capacity_summary: [{ total_vram_gib: 240, free_vram_gib: 96 }],
    gpu_workload_usage: [
      { namespace: 'team-vision', workload: 'vision-train', kind: 'Notebook', resource: 'nvidia.com/a100', vram_gib: 62, node: 'gpu-node-01' },
      { namespace: 'nlp-lab', workload: 'llm-serve', kind: 'Deployment', resource: 'nvidia.com/a100', vram_gib: 74, node: 'gpu-node-02' },
    ],
    capital_report: {
      total_vram_gib: 240, used_vram_gib: 144, free_vram_gib: 96, utilization_pct: 60,
      total: { usd_per_month: 9600 }, used: { usd_per_month: 5760 }, free: { usd_per_month: 3840 },
    },
    cost_by_department: {
      rows: [
        { namespace: 'team-vision', vram_gib: 62, usd_per_day: 24.8, irr_per_month: 372000000 },
        { namespace: 'nlp-lab', vram_gib: 74, usd_per_day: 29.6, irr_per_month: 444000000 },
      ],
    },
  },

  '/admin-panel/api/admin/models': [
    { id: 'm1', display_name: 'Qwen3 32B', engine: 'vLLM', gpu_required: 2, node: 'gpu-node-02', status: 'serving', litellm_alias: 'qwen3' },
    { id: 'm2', display_name: 'Llama 3.1 70B', engine: 'vLLM', gpu_required: 4, node: '', status: 'downloaded', litellm_alias: '' },
    { id: 'm3', display_name: 'Whisper Large v3', engine: 'faster-whisper', gpu_required: 1, node: '', status: 'not_downloaded', litellm_alias: '' },
  ],

  '/admin-panel/api/admin/groups': [
    { id: 'g1', name: 'gpu-team', member_count: 6, access: { 'access-notebooks': true, 'access-volumes': true, 'access-gpu': true } },
    { id: 'g2', name: 'nlp-lab', member_count: 4, access: { 'access-notebooks': true, 'access-models': true } },
    { id: 'g3', name: 'viewers', member_count: 11, access: { 'access-usage': true } },
  ],
}

const SENDERS = ['واحد زیرساخت', 'سامانه پایش', 'مدیر سیستم', 'تیم پشتیبانی', 'اعلان‌های GPU']
const SUBJECTS = [
  'گزارش هفتگی مصرف منابع',
  'هشدار: نزدیک شدن به سقف سهمیه فضای ذخیره‌سازی',
  'به‌روزرسانی درایور GPU روی gpu-node-01',
  'تأیید ایجاد نوت‌بوک vision-train',
  'زمان‌بندی بازراه‌اندازی SLA',
]
// real shape: /api/mail/messages pages 30 per page; bodies come from /api/mail/message
function mailMessages(folder, page) {
  const n = folder === 'Trash' ? 0 : folder === 'Sent' ? 3 : 8
  const all = Array.from({ length: n }, (_, i) => ({
    uid: 100 - i,
    seen: i > 1, answered: false, flagged: false,
    from: `${SENDERS[i % SENDERS.length]} <noreply@isigpu.local>`,
    subject: SUBJECTS[i % SUBJECTS.length],
    date: new Date(now - i * 6.4e7).toUTCString(),
  }))
  return { address: 'demo.user@isigpu.local', folder, page, page_size: 30, total: n, total_pages: 1, capped: false, messages: all.slice((page - 1) * 30, page * 30) }
}

function resolve(path) {
  const qs = new URLSearchParams(path.split('?')[1] || '')
  if (path.startsWith('/api/mail/messages')) return mailMessages(qs.get('folder') || 'INBOX', Number(qs.get('page') || 1))
  if (path.startsWith('/api/mail/message?')) {
    return { from: 'تیم پشتیبانی <noreply@isigpu.local>', to: 'demo.user@isigpu.local', cc: '', subject: 'نمونه', date: new Date(now).toUTCString(),
      body_text: 'این یک پیام نمونه برای نمایش طراحی صفحه‌ی ایمیل است. محتوای واقعی از سرور IMAP بارگذاری می‌شود.', body_html: '',
      attachments: [{ index: 0, filename: 'report.pdf', content_type: 'application/pdf', size: 20480 }] }
  }
  if (path in DB) return DB[path]
  return null
}

export function installMockApi() {
  window[MOCK_MARKER] = true
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    if (path.startsWith('/api/') || path.startsWith('/admin-panel/api/')) {
      if (init && init.method && init.method !== 'GET') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      const data = resolve(path)
      const body = data == null ? 'null' : JSON.stringify(data)
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return real(input, init)
  }
}
