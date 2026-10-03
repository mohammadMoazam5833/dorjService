import { useState } from 'react'
import { apiSend, invalidate } from '../../lib/api.js'
import { resizePayload } from '../../lib/notebookApi.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import Spinner from '../../components/Spinner.jsx'

const num = q => (q == null ? '' : String(q).replace(/Gi$/, ''))

// PATCH /api/notebooks/<name> {resize:{...}} - the notebook restarts with the new limits.
export default function ResizeNotebook({ nb, opts, onClose, onDone }) {
  const vendors = opts?.gpu_vendors || []
  const q = opts?.quota || {}
  const [f, setF] = useState({ cpu: num(nb.cpu_limit), memory: num(nb.memory_limit), storage: num(nb.storage), gpuKey: nb.gpu_key || '', gpuCount: nb.gpu_count || '1' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const changed = {
    cpu: f.cpu !== num(nb.cpu_limit) ? f.cpu : '',
    memory: f.memory !== num(nb.memory_limit) ? f.memory : '',
    storage: f.storage !== num(nb.storage) ? f.storage : '',
    gpuKey: f.gpuKey !== (nb.gpu_key || '') || (f.gpuKey && f.gpuCount !== (nb.gpu_count || '1')) ? f.gpuKey : '',
    gpuCount: f.gpuCount,
  }
  const dirty = changed.cpu || changed.memory || changed.storage || changed.gpuKey
  const storageShrink = f.storage && nb.storage && Number(f.storage) < Number(num(nb.storage))

  const submit = async () => {
    setSaving(true); setErr('')
    const r = await apiSend(`/api/notebooks/${encodeURIComponent(nb.name)}`, 'PATCH', resizePayload(changed))
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    invalidate('/api/notebooks'); invalidate('/api/resource-usage')
    notifySuccess(`اندازه‌ی نوت‌بوک «${nb.name}» تغییر کرد؛ نوت‌بوک دوباره راه‌اندازی می‌شود`)
    onDone()
  }

  return (
    <>
      <div className="cd-backdrop" onClick={saving ? undefined : onClose} />
      <div className="cd-modal" dir="rtl" role="dialog" aria-modal="true" style={{ width: 'min(480px, calc(100vw - 32px))' }}>
        <h3>تغییر اندازه: <bdi dir="ltr">{nb.name}</bdi></h3>
        <p className="cd-body">نوت‌بوک با منابع جدید دوباره راه‌اندازی می‌شود؛ فایل‌های فضای کاری حفظ می‌شوند. فضای ذخیره‌سازی فقط افزایش می‌یابد.</p>
        <div className="nb-finput-row">
          <div><div className="nb-fhint">CPU{q.cpu_remaining_cores !== undefined && ` (${q.cpu_remaining_cores} باقی)`}</div>
            <input className="nb-finput" type="number" min="0.5" step="0.5" value={f.cpu} onChange={e => set('cpu', e.target.value)} /></div>
          <div><div className="nb-fhint">RAM GiB{q.memory_remaining_gib !== undefined && ` (${q.memory_remaining_gib} باقی)`}</div>
            <input className="nb-finput" type="number" min="1" value={f.memory} onChange={e => set('memory', e.target.value)} /></div>
          <div><div className="nb-fhint">دیسک GiB{q.storage_remaining_gib !== undefined && ` (${q.storage_remaining_gib} باقی)`}</div>
            <input className={`nb-finput ${storageShrink ? 'bad' : ''}`} type="number" min="1" value={f.storage} onChange={e => set('storage', e.target.value)} /></div>
        </div>
        {vendors.length > 0 && (
          <div className="nb-finput-row" style={{ marginTop: 10 }}>
            <select className="nb-finput" dir="ltr" value={f.gpuKey} onChange={e => set('gpuKey', e.target.value)}>
              <option value="">بدون GPU</option>
              {vendors.map(v => <option key={v.limitsKey} value={v.limitsKey}>{v.uiName || v.limitsKey}</option>)}
            </select>
            {f.gpuKey && <input className="nb-finput" type="number" min="1" value={f.gpuCount} onChange={e => set('gpuCount', e.target.value)} />}
          </div>
        )}
        {storageShrink && <div className="nb-field-err">کاهش فضای ذخیره‌سازی ممکن نیست.</div>}
        {err && <div className="nb-form-err" role="alert" dir="auto">{err}</div>}
        <div className="cd-actions">
          <button className="cd-btn" onClick={onClose} disabled={saving}>انصراف</button>
          <button className="cd-btn cd-primary" onClick={submit} disabled={!dirty || storageShrink || saving}>{saving ? <Spinner label="در حال اعمال" /> : 'اعمال'}</button>
        </div>
      </div>
    </>
  )
}
