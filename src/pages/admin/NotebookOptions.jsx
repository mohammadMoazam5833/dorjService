import { useState, useEffect } from 'react'
import { apiSend } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { Field, Err } from './kit.jsx'
import Spinner, { Loading } from '../../components/Spinner.jsx'

const API = '/admin-panel/api/admin/notebook-options'

// The image list and GPU/MIG dropdown users see in the notebook create form.
export default function NotebookOptions() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    getJson(`${API}?t=${Date.now()}`, { ttlMs: 0 }).then(r => {
      if (r.error) { setErr(r.error.message); return }
      setD({ image_default: r.data.image_default || '', image_options: r.data.image_options || [], gpu_vendors: r.data.gpu_vendors || [] })
    })
  }, [])
  if (!d) return <div className="ak-card"><Err>{err}</Err>{!err && <Loading />}</div>

  const imgs = d.image_options
  const dup = v => !!v.trim() && imgs.filter(x => (x || '').trim() === v.trim()).length > 1
  const anyDup = imgs.some(dup)
  const setImg = (i, v) => setD(s => ({ ...s, image_options: s.image_options.map((x, j) => (j === i ? v : x)) }))
  const setGpu = (i, k, v) => setD(s => ({ ...s, gpu_vendors: s.gpu_vendors.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }))
  const save = async () => {
    if (anyDup) { setErr('آدرس ایمیج تکراری وجود دارد؛ موارد تکراری را حذف کنید.'); return }
    setSaving(true); setErr('')
    const r = await apiSend(API, 'PUT', d)
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess('گزینه‌های نوت‌بوک ذخیره شد')
  }

  return (
    <>
      <div className="ak-card">
        <h2>ایمیج‌های نوت‌بوک</h2>
        <p className="ak-muted">همین فهرست در فرم ساخت نوت‌بوک به کاربران نمایش داده می‌شود.</p>
        <Field label="ایمیج پیش‌فرض">
          <select className="ak-select" dir="ltr" value={d.image_default} onChange={e => setD(s => ({ ...s, image_default: e.target.value }))}>
            {imgs.filter(Boolean).map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        {imgs.map((img, i) => (
          <div key={i} className="ak-row" style={{ alignItems: 'center' }}>
            <input className="ak-input" dir="ltr" style={{ flex: 1 }} value={img} onChange={e => setImg(i, e.target.value)} />
            <button className="ak-btn" onClick={() => setD(s => ({ ...s, image_options: s.image_options.filter((_, j) => j !== i) }))}>حذف</button>
            {dup(img) && <span className="ak-muted" style={{ color: '#b3261e' }}>تکراری</span>}
          </div>
        ))}
        <button className="ak-btn" style={{ marginTop: 8 }} onClick={() => setD(s => ({ ...s, image_options: [...s.image_options, ''] }))}>+ افزودن</button>
      </div>
      <div className="ak-card">
        <h2>گزینه‌های GPU / MIG</h2>
        <p className="ak-muted">هر ردیف یک گزینه در فهرست GPU فرم نوت‌بوک است (limitsKey / نام نمایشی).</p>
        {d.gpu_vendors.map((v, i) => (
          <div key={i} className="ak-row" style={{ alignItems: 'flex-end' }}>
            <Field label="limitsKey"><input className="ak-input" dir="ltr" value={v.limitsKey || ''} onChange={e => setGpu(i, 'limitsKey', e.target.value)} /></Field>
            <Field label="نام نمایشی"><input className="ak-input" dir="ltr" value={v.uiName || ''} onChange={e => setGpu(i, 'uiName', e.target.value)} /></Field>
            <button className="ak-btn" style={{ marginBottom: 12 }} onClick={() => setD(s => ({ ...s, gpu_vendors: s.gpu_vendors.filter((_, j) => j !== i) }))}>حذف</button>
          </div>
        ))}
        <button className="ak-btn" onClick={() => setD(s => ({ ...s, gpu_vendors: [...s.gpu_vendors, { limitsKey: '', uiName: '' }] }))}>+ افزودن</button>
      </div>
      <Err>{err}</Err>
      <button className="ak-btn ak-primary" onClick={save} disabled={saving || anyDup}>{saving ? <Spinner label="در حال ذخیره" /> : 'ذخیره‌ی تغییرات'}</button>
    </>
  )
}
