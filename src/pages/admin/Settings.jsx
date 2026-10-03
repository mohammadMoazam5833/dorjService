import { useState, useEffect } from 'react'
import { apiSend, apiPost } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { Field, Err, useTable } from './kit.jsx'

const B = '/admin-panel/api/admin'
const fresh = p => getJson(`${p}${p.includes('?') ? '&' : '?'}t=${Date.now()}`, { ttlMs: 0 }).then(r => r.data)
const SUBS = [['pricing', 'قیمت‌گذاری'], ['smtp', 'SMTP'], ['login-note', 'پیام صفحه‌ی ورود'], ['ad', 'Active Directory'], ['session', 'نشست‌ها'], ['uploads', 'آپلود'], ['failed-logins', 'ورودهای ناموفق']]

function useSaver() {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const run = async (path, method, body, ok) => {
    setSaving(true); setErr('')
    const r = await (method === 'POST' ? apiPost(path, body) : apiSend(path, method, body))
    setSaving(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return false }
    notifySuccess(ok); return true
  }
  return { saving, err, run }
}

const num = (label, v, set, extra = {}) => <Field label={label}><input className="ak-input" type="number" min="0" value={v} onChange={e => set(e.target.value)} {...extra} /></Field>

function Pricing() {
  const [f, setF] = useState(null)
  const s = useSaver()
  useEffect(() => { fresh(`${B}/settings`).then(d => setF({ rate_mode: d?.rate_mode || 'manual', usd_to_irr_rate: d?.usd_to_irr_rate || '', price_cpu_core_hour: d?.price_cpu_core_hour || '',
    price_mem_gib_hour: d?.price_mem_gib_hour || '', price_gpu_vram_gib_hour: d?.price_gpu_vram_gib_hour || '', price_backup_gib: d?.price_backup_gib || '', sla_tier_warning_days: d?.sla_tier_warning_days || '' })) }, [])
  if (!f) return <p className="ak-muted">در حال بارگذاری…</p>
  const set = k => v => setF(x => ({ ...x, [k]: v }))
  return (
    <div className="ak-card">
      <h2>نرخ تبدیل دلار به ریال</h2>
      <div className="ak-row">
        <Field label="حالت نرخ"><select className="ak-select" value={f.rate_mode} onChange={e => set('rate_mode')(e.target.value)}><option value="manual">دستی</option><option value="live">زنده (اینترنت)</option></select></Field>
        {num('نرخ دستی (ریال به ازای هر دلار)', f.usd_to_irr_rate, set('usd_to_irr_rate'), { placeholder: '700000' })}
      </div>
      <h2>قیمت منابع (دلار به ازای ساعت)</h2>
      <div className="ak-row">
        {num('هر هسته‌ی CPU در ساعت', f.price_cpu_core_hour, set('price_cpu_core_hour'), { step: '0.0001', placeholder: '0.05' })}
        {num('هر GiB حافظه در ساعت', f.price_mem_gib_hour, set('price_mem_gib_hour'), { step: '0.0001', placeholder: '0.01' })}
        {num('هر GiB حافظه‌ی GPU در ساعت', f.price_gpu_vram_gib_hour, set('price_gpu_vram_gib_hour'), { step: '0.0001', placeholder: '0.02' })}
        {num('هر GiB بکاپ (یک‌بار)', f.price_backup_gib, set('price_backup_gib'), { step: '0.0001', placeholder: '0.01' })}
      </div>
      <div className="ak-row">{num('روزهای هشدار پیش از راه‌اندازی دوباره‌ی SLA', f.sla_tier_warning_days, set('sla_tier_warning_days'), { placeholder: '3' })}</div>
      <Err>{s.err}</Err>
      <button className="ak-btn ak-primary" disabled={s.saving} onClick={() => s.run(`${B}/settings`, 'PUT', f, 'قیمت‌گذاری ذخیره شد')}>ذخیره‌ی تغییرات</button>
    </div>
  )
}

function Smtp() {
  const [f, setF] = useState(null)
  const s = useSaver()
  useEffect(() => { fresh('/admin-panel/api/smtp-settings').then(d => setF({ host: d?.host || '', port: d?.port || '', from: d?.from || '', fromDisplayName: d?.fromDisplayName || '',
    starttls: !!d?.starttls, ssl: !!d?.ssl, auth: !!d?.auth, user: d?.user || '', password: '' })) }, [])
  if (!f) return <p className="ak-muted">در حال بارگذاری…</p>
  const set = k => e => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  return (
    <div className="ak-card">
      <h2>ایمیل (SMTP) — فرستنده‌ی پلتفرم</h2>
      <div className="ak-row">
        <Field label="میزبان SMTP"><input className="ak-input" dir="ltr" placeholder="mx.isigpu.local" value={f.host} onChange={set('host')} /></Field>
        <Field label="پورت"><input className="ak-input" type="number" placeholder="587" value={f.port} onChange={set('port')} /></Field>
      </div>
      <div className="ak-row">
        <Field label="ایمیل فرستنده"><input className="ak-input" dir="ltr" type="email" placeholder="identity@isigpu.local" value={f.from} onChange={set('from')} /></Field>
        <Field label="نام نمایشی فرستنده"><input className="ak-input" value={f.fromDisplayName} onChange={set('fromDisplayName')} /></Field>
      </div>
      <label className="ak-check"><input type="checkbox" checked={f.starttls} onChange={set('starttls')} />STARTTLS</label>
      <label className="ak-check"><input type="checkbox" checked={f.ssl} onChange={set('ssl')} />SSL</label>
      <label className="ak-check"><input type="checkbox" checked={f.auth} onChange={set('auth')} />نیاز به احراز هویت</label>
      {f.auth && <div className="ak-row">
        <Field label="نام کاربری SMTP"><input className="ak-input" dir="ltr" value={f.user} onChange={set('user')} /></Field>
        <Field label="گذرواژه‌ی SMTP" hint="برای حفظ گذرواژه‌ی فعلی خالی بگذارید"><input className="ak-input" dir="ltr" type="password" value={f.password} onChange={set('password')} /></Field>
      </div>}
      <Err>{s.err}</Err>
      <div className="ak-toolbar">
        <button className="ak-btn ak-primary" disabled={s.saving} onClick={() => s.run('/admin-panel/api/smtp-settings', 'PUT', f, 'تنظیمات SMTP ذخیره شد')}>ذخیره‌ی تغییرات</button>
        <button className="ak-btn" disabled={s.saving} onClick={() => s.run('/admin-panel/api/smtp-settings/test', 'POST', f, 'ایمیل آزمایشی ارسال شد')}>ارسال ایمیل آزمایشی</button>
      </div>
    </div>
  )
}

function LoginNote() {
  const [f, setF] = useState(null)
  const s = useSaver()
  useEffect(() => { fresh(`${B}/login-note`).then(d => setF({ enabled: d?.enabled !== false, note_fa: d?.note_fa || '', note_en: d?.note_en || '' })) }, [])
  if (!f) return <p className="ak-muted">در حال بارگذاری…</p>
  return (
    <div className="ak-card">
      <h2>پیام صفحه‌ی ورود</h2>
      <label className="ak-check"><input type="checkbox" checked={f.enabled} onChange={e => setF(x => ({ ...x, enabled: e.target.checked }))} />نمایش این پیام در صفحه‌ی ورود</label>
      <Field label="متن فارسی (HTML مجاز است)"><textarea className="ak-textarea" maxLength={500} value={f.note_fa} onChange={e => setF(x => ({ ...x, note_fa: e.target.value }))} /></Field>
      <Field label="متن انگلیسی (HTML مجاز است)"><textarea className="ak-textarea" dir="ltr" maxLength={500} value={f.note_en} onChange={e => setF(x => ({ ...x, note_en: e.target.value }))} /></Field>
      <Err>{s.err}</Err>
      <button className="ak-btn ak-primary" disabled={s.saving} onClick={() => s.run(`${B}/login-note`, 'PUT', { ...f, position: 'top' }, 'پیام صفحه‌ی ورود ذخیره شد')}>ذخیره‌ی تغییرات</button>
    </div>
  )
}

function Ad() {
  const [on, setOn] = useState(null)
  const s = useSaver()
  useEffect(() => { fresh(`${B}/ad-sync`).then(d => setOn(!!d?.enabled)) }, [])
  if (on === null) return <p className="ak-muted">در حال بارگذاری…</p>
  const toggle = async v => { setOn(v); if (!(await s.run(`${B}/ad-sync`, 'PUT', { enabled: v }, 'تنظیم همگام‌سازی AD ذخیره شد'))) setOn(!v) }
  return (
    <div className="ak-card">
      <h2>کاربران جدید در Active Directory</h2>
      <p className="ak-muted">اگر فعال باشد، کاربرانی که از این پنل (یا ثبت‌نام) ساخته می‌شوند مستقیماً در Active Directory ساخته می‌شوند، نه در پایگاه‌داده‌ی محلی Keycloak.</p>
      <label className="ak-check"><input type="checkbox" checked={on} disabled={s.saving} onChange={e => toggle(e.target.checked)} />ساخت مستقیم کاربران جدید در AD</label>
      <Err>{s.err}</Err>
    </div>
  )
}

function Session() {
  const [f, setF] = useState(null)
  const s = useSaver()
  useEffect(() => { fresh('/admin-panel/api/session-settings').then(d => setF({ enabled: !!d?.enabled, max: String(d?.maxSessions || 1) })) }, [])
  if (!f) return <p className="ak-muted">در حال بارگذاری…</p>
  return (
    <div className="ak-card">
      <h2>نشست‌های هم‌زمان</h2>
      <p className="ak-muted">اگر فعال باشد، هر کاربر فقط از این تعداد مرورگر/دستگاه هم‌زمان می‌تواند وارد باشد؛ ورود اضافه تا پایان یک نشست قدیمی‌تر رد می‌شود.</p>
      <label className="ak-check"><input type="checkbox" checked={f.enabled} onChange={e => setF(x => ({ ...x, enabled: e.target.checked }))} />محدود کردن نشست‌های هم‌زمان هر کاربر</label>
      {f.enabled && num('حداکثر نشست هم‌زمان', f.max, v => setF(x => ({ ...x, max: v })), { min: 1 })}
      <Err>{s.err}</Err>
      <button className="ak-btn ak-primary" disabled={s.saving} onClick={() => s.run('/admin-panel/api/session-settings', 'PUT', { enabled: f.enabled, maxSessions: parseInt(f.max, 10) || 1 }, 'تنظیمات نشست ذخیره شد')}>ذخیره‌ی تغییرات</button>
    </div>
  )
}

function Uploads() {
  const [f, setF] = useState(null)
  const s = useSaver()
  useEffect(() => { fresh(`${B}/upload-policy`).then(d => setF({ upload_enabled: d?.upload_enabled !== false, download_enabled: d?.download_enabled !== false,
    upload_max_size_mb: d?.upload_max_size_mb || '', upload_allowed_extensions: d?.upload_allowed_extensions || '' })) }, [])
  if (!f) return <p className="ak-muted">در حال بارگذاری…</p>
  return (
    <div className="ak-card">
      <h2>آپلود/دانلود فایل در فضاهای ذخیره‌سازی</h2>
      <p className="ak-muted">برای مرورگر فایل همه‌ی کاربران (فضاهای ذخیره‌سازی ← مرور فایل‌ها) اعمال می‌شود و در سرور اجرا می‌شود، نه فقط در ظاهر.</p>
      <label className="ak-check"><input type="checkbox" checked={f.upload_enabled} onChange={e => setF(x => ({ ...x, upload_enabled: e.target.checked }))} />اجازه‌ی آپلود فایل</label>
      <label className="ak-check"><input type="checkbox" checked={f.download_enabled} onChange={e => setF(x => ({ ...x, download_enabled: e.target.checked }))} />اجازه‌ی دانلود/خروجی فایل</label>
      <div className="ak-row">
        {num('حداکثر حجم آپلود (MB)', f.upload_max_size_mb, v => setF(x => ({ ...x, upload_max_size_mb: v })), { placeholder: '۰ = نامحدود' })}
        <Field label="پسوندهای مجاز"><input className="ak-input" dir="ltr" placeholder="pdf,png,jpg,csv — خالی = همه" value={f.upload_allowed_extensions} onChange={e => setF(x => ({ ...x, upload_allowed_extensions: e.target.value }))} /></Field>
      </div>
      <Err>{s.err}</Err>
      <button className="ak-btn ak-primary" disabled={s.saving} onClick={() => s.run(`${B}/upload-policy`, 'PUT', f, 'تنظیمات آپلود ذخیره شد')}>ذخیره‌ی تغییرات</button>
    </div>
  )
}

function FailedLogins() {
  const [rows, setRows] = useState(null)
  useEffect(() => { fresh(`${B}/failed-logins?max=200`).then(d => setRows(d || [])) }, [])
  const t = useTable(rows || [], { keys: ['ip_address', 'client_id', 'error', 'username'], sort: { key: 'time', dir: 'desc' } })
  return (
    <div className="ak-card">
      <div className="ak-toolbar"><h2 style={{ margin: 0 }}>تلاش‌های ناموفق ورود</h2><div className="spacer" />{t.search('جستجوی IP، برنامه یا خطا…')}</div>
      <p className="ak-muted">نمای فقط‌خواندنی رویدادهای خطای ورود Keycloak (۷ روز نگه‌داری). Keycloak برای گذرواژه‌ی اشتباه نام کاربری را ثبت نمی‌کند.</p>
      {!rows ? <p className="ak-muted">در حال بارگذاری…</p> : rows.length === 0 ? <p className="ak-muted">ورود ناموفقی ثبت نشده است.</p> : (
        <div className="ak-table-scroll">
          <table className="ak-table"><thead><tr>{t.th('time', 'زمان')}{t.th('username', 'نام کاربری')}{t.th('ip_address', 'آدرس IP')}{t.th('client_id', 'برنامه')}{t.th('error', 'خطا')}</tr></thead>
            <tbody>{t.shown.map((e, i) => (
              <tr key={i}><td>{e.time ? new Date(e.time).toLocaleString('fa-IR') : '—'}</td><td><bdi dir="ltr">{e.username || '—'}</bdi></td>
                <td dir="ltr">{e.ip_address}</td><td dir="ltr">{e.client_id}</td><td dir="ltr">{e.error}</td></tr>
            ))}</tbody></table>
          {t.pager}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [sub, setSub] = useState('pricing')
  return (
    <>
      <nav className="ak-tabs">{SUBS.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => setSub(id)}>{l}</button>)}</nav>
      {sub === 'pricing' && <Pricing />}
      {sub === 'smtp' && <Smtp />}
      {sub === 'login-note' && <LoginNote />}
      {sub === 'ad' && <Ad />}
      {sub === 'session' && <Session />}
      {sub === 'uploads' && <Uploads />}
      {sub === 'failed-logins' && <FailedLogins />}
    </>
  )
}
