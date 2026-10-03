import { useState, useEffect, useRef } from 'react'
import { apiSend, invalidate } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { Field, Err, Modal } from './kit.jsx'

const API = '/admin-panel/api/admin/branding'
const MAX_BYTES = 2 * 1024 * 1024
const TARGETS = { favicon: { w: 64, h: 64 }, logo: { w: 480, h: 160 } }

// Crop to the exact output size (zoom slider/wheel + drag), same maths as the platform.
function Crop({ kind, src, onApply, onClose }) {
  const t = TARGETS[kind]
  const canvas = useRef(null)
  const st = useRef(null)
  const [zoom, setZoom] = useState(0)
  const render = () => {
    const s = st.current, c = canvas.current
    if (!s || !c) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, s.dw, s.dh)
    const w = s.img.naturalWidth * s.scale, h = s.img.naturalHeight * s.scale
    ctx.drawImage(s.img, s.ox - w / 2, s.oy - h / 2, w, h)
  }
  const clamp = () => {
    const s = st.current
    const w = s.img.naturalWidth * s.scale, h = s.img.naturalHeight * s.scale
    s.ox = Math.min(Math.max(s.ox, s.dw - w / 2), w / 2)
    s.oy = Math.min(Math.max(s.oy, s.dh - h / 2), h / 2)
  }
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const aspect = t.w / t.h, max = 320
      const dw = aspect >= 1 ? max : Math.round(max * aspect), dh = aspect >= 1 ? Math.round(max / aspect) : max
      canvas.current.width = dw; canvas.current.height = dh
      const min = Math.max(dw / img.naturalWidth, dh / img.naturalHeight)
      st.current = { img, dw, dh, min, scale: min, ox: dw / 2, oy: dh / 2, drag: false, lx: 0, ly: 0 }
      render()
    }
    img.src = src
  }, [src])
  const setZ = z => {
    const s = st.current; if (!s) return
    setZoom(z); s.scale = s.min + (z / 100) * (s.min * 3 - s.min); clamp(); render()
  }
  const pos = e => { const r = canvas.current.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top } }
  const down = e => { const s = st.current; if (!s) return; const p = pos(e); Object.assign(s, { drag: true, lx: p.x, ly: p.y }) }
  const move = e => {
    const s = st.current; if (!s?.drag) return
    const p = pos(e); s.ox += p.x - s.lx; s.oy += p.y - s.ly; s.lx = p.x; s.ly = p.y; clamp(); render()
  }
  const up = () => { if (st.current) st.current.drag = false }
  const apply = () => {
    const s = st.current; if (!s) return
    const out = document.createElement('canvas'); out.width = t.w; out.height = t.h
    const f = t.w / s.dw, w = s.img.naturalWidth * s.scale * f, h = s.img.naturalHeight * s.scale * f
    out.getContext('2d').drawImage(s.img, s.ox * f - w / 2, s.oy * f - h / 2, w, h)
    onApply(out.toDataURL('image/png'))
  }
  return (
    <Modal title="برش تصویر" onClose={onClose} actions={<><button className="ak-btn" onClick={onClose}>انصراف</button><button className="ak-btn ak-primary" onClick={apply}>اعمال</button></>}>
      <p className="ak-muted" dir="ltr">{t.w}×{t.h}px</p>
      <canvas ref={canvas} style={{ display: 'block', margin: '0 auto 10px', cursor: 'move', background: 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/16px 16px', touchAction: 'none' }}
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up} onTouchStart={down} onTouchMove={move} onTouchEnd={up}
        onWheel={e => setZ(Math.min(100, Math.max(0, zoom + (e.deltaY > 0 ? -5 : 5))))} />
      <input type="range" min="0" max="100" value={zoom} onChange={e => setZ(Number(e.target.value))} style={{ width: '100%' }} />
    </Modal>
  )
}

export default function Branding() {
  const [f, setF] = useState({ display_name: '', primary_color: '#12dec6', favicon_data_uri: '', logo_data_uri: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [crop, setCrop] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const load = () => getJson(`${API}?t=${Date.now()}`, { ttlMs: 0 }).then(r => r.data && setF({
    display_name: r.data.display_name || '', primary_color: r.data.primary_color || '#12dec6',
    favicon_data_uri: r.data.favicon_data_uri || '', logo_data_uri: r.data.logo_data_uri || '' }))
  useEffect(() => { load() }, [])

  const pick = kind => e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) { setErr('حجم فایل بیش از حد مجاز است (حداکثر ۲ مگابایت)'); return }
    const reader = new FileReader()
    reader.onload = () => setCrop({ kind, src: reader.result })
    reader.readAsDataURL(file)
  }
  const done = msg => { invalidate('/api/branding'); notifySuccess(msg); setTimeout(() => window.location.reload(), 800) }
  const save = async () => {
    setSaving(true); setErr('')
    const r = await apiSend(API, 'PUT', f)
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    done('ظاهر پلتفرم ذخیره شد؛ صفحه دوباره بارگذاری می‌شود')
  }
  const reset = async () => {
    setConfirmReset(false); setSaving(true)
    const r = await apiSend(API, 'DELETE')
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    done('ظاهر پلتفرم به حالت پیش‌فرض برگشت')
  }

  return (
    <div className="ak-card">
      <h2>ظاهر پلتفرم</h2>
      <p className="ak-muted">این تنظیمات برای همه‌ی کاربران اعمال می‌شود.</p>
      <div className="ak-row">
        <Field label="نام پلتفرم"><input className="ak-input" value={f.display_name} placeholder="My Platform" onChange={e => setF(s => ({ ...s, display_name: e.target.value }))} /></Field>
        <Field label="رنگ اصلی"><input className="ak-input" type="color" value={f.primary_color} onChange={e => setF(s => ({ ...s, primary_color: e.target.value }))} style={{ padding: 2 }} /></Field>
      </div>
      <div className="ak-row">
        <Field label="Favicon (دقیقاً ۶۴×۶۴، ورودی حداکثر ۲MB)">
          <input type="file" accept="image/*" onChange={pick('favicon')} />
          {f.favicon_data_uri && <div><img src={f.favicon_data_uri} alt="" style={{ height: 32 }} /> <button className="ak-btn" onClick={() => setF(s => ({ ...s, favicon_data_uri: '' }))}>حذف</button></div>}
        </Field>
        <Field label="لوگوی منوی کناری (حداکثر ۴۸۰×۱۶۰، ورودی حداکثر ۲MB)">
          <input type="file" accept="image/*" onChange={pick('logo')} />
          {f.logo_data_uri && <div><img src={f.logo_data_uri} alt="" style={{ height: 40, background: '#0B1B3A', padding: 4, borderRadius: 6 }} /> <button className="ak-btn" onClick={() => setF(s => ({ ...s, logo_data_uri: '' }))}>حذف</button></div>}
        </Field>
      </div>
      <Err>{err}</Err>
      <div className="ak-toolbar">
        <button className="ak-btn ak-primary" onClick={save} disabled={saving}>ذخیره‌ی تغییرات</button>
        <button className="ak-btn ak-danger" onClick={() => setConfirmReset(true)} disabled={saving}>بازگشت به پیش‌فرض</button>
      </div>
      {crop && <Crop kind={crop.kind} src={crop.src} onClose={() => setCrop(null)}
        onApply={uri => { setF(s => ({ ...s, [crop.kind === 'favicon' ? 'favicon_data_uri' : 'logo_data_uri']: uri })); setCrop(null) }} />}
      {confirmReset && <ConfirmDialog danger title="ظاهر پلتفرم به پیش‌فرض برگردد؟" body="نام، رنگ، favicon و لوگو برای همه‌ی کاربران پاک می‌شوند." confirmLabel="بازگشت به پیش‌فرض" onCancel={() => setConfirmReset(false)} onConfirm={reset} />}
    </div>
  )
}
