import { useState } from 'react'
import { apiPost, useApi, invalidate } from '../../lib/api.js'
import { adaptVolumes } from '../../lib/adapters/workloads.js'
import { createPayload, validName } from '../../lib/notebookApi.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'

// Form shortcuts only; real limits come from the namespace quota (/api/notebooks/options).
const PRESETS = [
  { id: 'sm', icon: '🌱', name: 'کوچک', cpu: '1', mem: '4', ws: '10' },
  { id: 'md', icon: '⚡', name: 'متوسط', cpu: '4', mem: '16', ws: '20' },
  { id: 'lg', icon: '🚀', name: 'بزرگ', cpu: '8', mem: '32', ws: '40' },
]

const gpuLabel = v => `${v.uiName || v.limitsKey}${v.vram_gib ? ` (${v.vram_gib}GiB)` : ''}${v.remaining !== undefined ? ` — ${v.remaining} باقی‌مانده` : ''}`

export default function CreateNotebook({ opts, onClose, onCreated }) {
  const images = opts?.image_options?.length ? opts.image_options : (opts?.image_default ? [opts.image_default] : [])
  const q = opts?.quota || {}
  const vendors = opts?.gpu_vendors || []
  const { data: vols } = useApi('/api/volumes', [], [], adaptVolumes)
  const freeVols = (vols || []).filter(v => !v.in_use_by && !v.shared && v.status === 'Bound')

  const [f, setF] = useState({ name: '', image: opts?.image_default || images[0] || '', cpu: '1', memory: '4', storage: '10',
    gpuKey: '', gpuCount: '1', workspace: 'new', existingPvc: '', accessMode: 'ReadWriteOnce' })
  const [preset, setPreset] = useState('sm')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const applyPreset = p => { setPreset(p.id); setF(s => ({ ...s, cpu: p.cpu, memory: p.mem, storage: p.ws })) }

  const over = (val, rem) => rem !== undefined && Number(val) > rem
  const nameOk = validName(f.name)
  const canCreate = nameOk && f.image && Number(f.cpu) > 0 && Number(f.memory) > 0 &&
    (f.workspace === 'new' ? Number(f.storage) > 0 : !!f.existingPvc) && !saving

  const submit = async () => {
    setSaving(true); setErr('')
    const r = await apiPost('/api/notebooks', createPayload(f))
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    invalidate('/api/notebooks'); invalidate('/api/volumes'); invalidate('/api/resource-usage')
    notifySuccess(`نوت‌بوک «${f.name.trim()}» ایجاد شد و در حال راه‌اندازی است`)
    onCreated(f.name.trim())
  }

  return (
    <>
      <div className="nb-create-backdrop" onClick={saving ? undefined : onClose} />
      <div className="nb-create-modal" dir="rtl" role="dialog" aria-modal="true">
        <div className="nb-modal-head">
          <h2>ایجاد نوت‌بوک جدید</h2>
          <button className="nb-modal-close" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <div className="nb-presets">
          {PRESETS.map(p => (
            <button key={p.id} className={`nb-preset ${preset === p.id ? 'active' : ''}`} onClick={() => applyPreset(p)}>
              <div className="nb-preset-icon">{p.icon}</div>
              <div className="nb-preset-name">{p.name}</div>
              <div className="nb-preset-spec">{p.cpu} هسته · {p.mem} GiB · {p.ws} GiB دیسک</div>
            </button>
          ))}
        </div>
        <div className="nb-modal-body">
          <div className="nb-form-col">
            <label className="nb-flabel">نام نوت‌بوک</label>
            <input className="nb-finput" dir="ltr" placeholder="my-notebook" value={f.name} onChange={e => set('name', e.target.value.toLowerCase())} autoFocus />
            {f.name && !nameOk && <div className="nb-field-err">فقط حروف کوچک انگلیسی، عدد و «-»؛ با حرف شروع و حداکثر ۵۲ نویسه.</div>}

            <label className="nb-flabel">ایمیج</label>
            <select className="nb-finput" dir="ltr" value={f.image} onChange={e => set('image', e.target.value)}>
              {images.map(i => <option key={i} value={i}>{i.split('/').pop()}</option>)}
            </select>

            <label className="nb-flabel">منابع</label>
            <div className="nb-finput-row">
              <div>
                <div className="nb-fhint">CPU (هسته){q.cpu_remaining_cores !== undefined && ` — ${q.cpu_remaining_cores} باقی`}</div>
                <input className={`nb-finput ${over(f.cpu, q.cpu_remaining_cores) ? 'bad' : ''}`} type="number" min="0.5" step="0.5" value={f.cpu} onChange={e => set('cpu', e.target.value)} />
              </div>
              <div>
                <div className="nb-fhint">RAM (GiB){q.memory_remaining_gib !== undefined && ` — ${q.memory_remaining_gib} باقی`}</div>
                <input className={`nb-finput ${over(f.memory, q.memory_remaining_gib) ? 'bad' : ''}`} type="number" min="1" value={f.memory} onChange={e => set('memory', e.target.value)} />
              </div>
              {f.workspace === 'new' && (
                <div>
                  <div className="nb-fhint">دیسک (GiB){q.storage_remaining_gib !== undefined && ` — ${q.storage_remaining_gib} باقی`}</div>
                  <input className={`nb-finput ${over(f.storage, q.storage_remaining_gib) ? 'bad' : ''}`} type="number" min="1" value={f.storage} onChange={e => set('storage', e.target.value)} />
                </div>
              )}
            </div>

            <label className="nb-flabel">GPU</label>
            {vendors.length === 0 ? (
              <div className="nb-fhint">سهمیه‌ی GPU برای این Namespace تعریف نشده یا تمام شده است.</div>
            ) : (
              <div className="nb-finput-row">
                <select className="nb-finput" dir="ltr" value={f.gpuKey} onChange={e => set('gpuKey', e.target.value)}>
                  <option value="">بدون GPU</option>
                  {vendors.map(v => <option key={v.limitsKey} value={v.limitsKey}>{gpuLabel(v)}</option>)}
                </select>
                {f.gpuKey && <input className="nb-finput" type="number" min="1" value={f.gpuCount} onChange={e => set('gpuCount', e.target.value)} />}
              </div>
            )}

            <label className="nb-flabel">فضای کاری (Workspace)</label>
            <div className="nb-seg">
              <button className={f.workspace === 'new' ? 'on' : ''} onClick={() => set('workspace', 'new')}>فضای ذخیره‌سازی جدید</button>
              <button className={f.workspace === 'existing' ? 'on' : ''} onClick={() => set('workspace', 'existing')} disabled={freeVols.length === 0}>استفاده از فضای موجود</button>
            </div>
            {f.workspace === 'existing' && (
              <select className="nb-finput" dir="ltr" value={f.existingPvc} onChange={e => set('existingPvc', e.target.value)}>
                <option value="">— انتخاب کنید —</option>
                {freeVols.map(v => <option key={v.name} value={v.name}>{v.name} ({v.size})</option>)}
              </select>
            )}
            {f.workspace === 'new' && (
              <>
                <label className="nb-flabel">حالت دسترسی</label>
                <select className="nb-finput" value={f.accessMode} onChange={e => set('accessMode', e.target.value)}>
                  <option value="ReadWriteOnce">ReadWriteOnce — اختصاصی</option>
                  <option value="ReadWriteMany">ReadWriteMany — اشتراکی</option>
                </select>
              </>
            )}
            {err && <div className="nb-form-err" role="alert" dir="auto">{err}</div>}
          </div>

          <div className="nb-sidebar-col">
            <div className="nb-cost-head">سهمیه‌ی باقی‌مانده‌ی Namespace</div>
            {[['CPU', q.cpu_remaining_cores, f.cpu, 'هسته'], ['RAM', q.memory_remaining_gib, f.memory, 'GiB'], ['دیسک', q.storage_remaining_gib, f.workspace === 'new' ? f.storage : 0, 'GiB']].map(([l, rem, want, u]) => (
              <div key={l} className="nb-cost-line">
                <span className="nb-cost-label">{l}</span>
                <span className={`nb-cost-val ${over(want, rem) ? 'bad' : ''}`}>{rem === undefined ? 'بدون سقف' : `${rem} ${u}`}</span>
              </div>
            ))}
            <p className="nb-fhint" style={{ marginTop: 12 }}>نوت‌بوک پس از ایجاد چند دقیقه طول می‌کشد تا آماده شود.</p>
          </div>
        </div>
        <div className="nb-modal-foot">
          <button className="nb-btn-cancel" onClick={onClose} disabled={saving}>انصراف</button>
          <button className="nb-btn-create" onClick={submit} disabled={!canCreate}>{saving ? 'در حال ایجاد…' : 'ایجاد نوت‌بوک'}</button>
        </div>
      </div>
    </>
  )
}
