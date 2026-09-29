import { useState } from 'react'
import Card, { Hint } from '../../components/Card.jsx'
import Table, { Cell } from '../../components/Table.jsx'
import Button from '../../components/Button.jsx'
import { useApi, apiPost } from '../../lib/api.js'
import './admin-pages.css'

function SaveBar({ onSave, extra }) {
  const [msg, setMsg] = useState('')
  return (
    <div className="ap-savebar">
      <div className="actions">
        {extra}
        <Button onClick={() => { onSave && onSave(); setMsg('تغییرات ذخیره شد.'); setTimeout(() => setMsg(''), 3000) }}>ذخیره تغییرات</Button>
      </div>
      {msg && <span className="ap-saved">{msg}</span>}
    </div>
  )
}

export function NotebookOptions() {
  const { data } = useApi('/admin-panel/api/admin/notebook-options', [])
  const [images, setImages] = useState(null)
  const [gpus, setGpus] = useState(null)
  const imgs = images !== null ? images : (data?.images || [])
  const gpuOpts = gpus !== null ? gpus : (data?.gpu_options || [])
  return (
    <>
      <Card title="گزینه‌های Image نوت‌بوک">
        <Hint>این فهرست همان چیزی است که در فرم ایجاد نوت‌بوک به کاربران نمایش داده می‌شود.</Hint>
        {imgs.map((im, i) => (
          <div key={im} className="ap-row">
            <span className="ap-mono">{im}</span>
            <Button variant="ghost" onClick={() => setImages(imgs.filter((_, j) => j !== i))}>حذف</Button>
          </div>
        ))}
        <div className="actions"><Button onClick={() => setImages([...imgs, 'dorj/notebook-servers/custom:latest'])}>+ افزودن</Button></div>
      </Card>
      <Card title="گزینه‌های GPU / MIG">
        <Hint>هر ردیف یک گزینه در منوی کشویی GPU فرم ایجاد نوت‌بوک است (limitsKey / نام نمایشی).</Hint>
        {gpuOpts.map((g, i) => (
          <div key={g.key || g} className="ap-row">
            <label style={{ width: 220 }}>limitsKey</label>
            <input className="ap-search" value={g.key || g} readOnly />
            <label>نام نمایشی</label>
            <input className="ap-search" value={g.label || g} readOnly />
            <Button variant="ghost" onClick={() => setGpus(gpuOpts.filter((_, j) => j !== i))}>حذف</Button>
          </div>
        ))}
        <SaveBar />
      </Card>
    </>
  )
}

export function Branding() {
  const { data } = useApi('/api/branding', [])
  const [name, setName] = useState(null)
  const [color, setColor] = useState(null)
  return (
    <Card title="ظاهر و برند پلتفرم">
      <div className="ap-form-row"><label>نام پلتفرم</label><input className="ap-search" value={name !== null ? name : (data?.platform_name || 'دُرج')} onChange={e => setName(e.target.value)} /></div>
      <div className="ap-form-row"><label>رنگ اصلی</label><input type="color" value={color !== null ? color : (data?.primary_color || '#0d9488')} onChange={e => setColor(e.target.value)} style={{ width: 60, height: 36, padding: 2, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} /></div>
      <div className="ap-form-row"><label>Favicon (دقیقاً ۶۴×۶۴ پیکسل، حداکثر حجم ورودی ۲ مگابایت)</label><input type="file" style={{ fontSize: 13 }} /><Button variant="ghost">حذف</Button></div>
      <div className="ap-form-row"><label>لوگوی نوار کناری (حداکثر ۴۸۰×۱۶۰ پیکسل، حداکثر حجم ورودی ۲ مگابایت)</label><input type="file" style={{ fontSize: 13 }} /></div>
      <SaveBar extra={<Button variant="ghost">بازگشت به حالت کارخانه</Button>} />
    </Card>
  )
}

export function Settings() {
  const [rate, setRate] = useState('manual')
  const [manual, setManual] = useState('950000')
  const [cpu, setCpu] = useState('0.04')
  const [mem, setMem] = useState('0.02')
  const [vram, setVram] = useState('0.11')
  const [bk, setBk] = useState('0.01')
  const [days, setDays] = useState('3')
  return (
    <>
      <Card title="نرخ تبدیل دلار به ریال">
        <div className="ap-form-row"><label>حالت نرخ</label>
          <select className="ap-search" style={{ width: 260 }} value={rate} onChange={e => setRate(e.target.value)}><option value="manual">دستی</option><option value="auto">خودکار</option></select>
        </div>
        {rate === 'manual' && <div className="ap-form-row"><label>نرخ دستی (ریال به ازای هر دلار)</label><input className="ap-search" style={{ width: 220 }} value={manual} onChange={e => setManual(e.target.value)} /></div>}
      </Card>
      <Card title="قیمت منابع (دلار در ساعت)">
        <div className="ap-form-row"><label>هر هسته CPU در ساعت</label><input className="ap-search" style={{ width: 160 }} value={cpu} onChange={e => setCpu(e.target.value)} /></div>
        <div className="ap-form-row"><label>هر GiB حافظه در ساعت</label><input className="ap-search" style={{ width: 160 }} value={mem} onChange={e => setMem(e.target.value)} /></div>
        <div className="ap-form-row"><label>هر GiB VRAM در ساعت</label><input className="ap-search" style={{ width: 160 }} value={vram} onChange={e => setVram(e.target.value)} /></div>
        <div className="ap-form-row"><label>هر GiB بکاپ (یک‌بار)</label><input className="ap-search" style={{ width: 160 }} value={bk} onChange={e => setBk(e.target.value)} /></div>
        <div className="ap-form-row"><label>تعداد روزهای هشدار روزانه قبل از ری‌استارت سطح SLA</label><input className="ap-search" style={{ width: 120 }} value={days} onChange={e => setDays(e.target.value)} /></div>
        <SaveBar />
      </Card>
    </>
  )
}

const FEATURES = ['Resources', 'VM', 'هزینه', 'فضای ذخیره‌سازی', 'دستیار', 'داشبوردها', 'گزارش‌ها', 'Backup', 'WebUI', 'Helm', 'LLM API', 'Send Mail']

export function AccessMatrix() {
  const { data } = useApi('/admin-panel/api/admin/users', [])
  const list = Array.isArray(data) ? data : []
  const [mode, setMode] = useState('selected')
  const [path, setPath] = useState('/models')
  const [page, setPage] = useState(0)
  const per = 10
  const pages = Math.max(1, Math.ceil(list.length / per))
  return (
    <Card title="دسترسی‌ها">
      <div className="actions" style={{ marginBottom: 12 }}>
        <Button variant={mode === 'off' ? 'primary' : 'ghost'} onClick={() => setMode('off')}>خاموش</Button>
        <Button variant={mode === 'all' ? 'primary' : 'ghost'} onClick={() => setMode('all')}>همه کاربران</Button>
        <Button variant={mode === 'selected' ? 'primary' : 'ghost'} onClick={() => setMode('selected')}>کاربران منتخب</Button>
      </div>
      <div className="ap-form-row"><label>مسیر اتصال</label><input className="ap-search" style={{ width: 260 }} value={path} onChange={e => setPath(e.target.value)} /><Button onClick={() => {}}>اعمال</Button></div>
      <Hint>11 models (2.1 TiB) - mounted in 40 namespaces</Hint>
      <Table
        cols={[Cell('کاربر', 'r'), ...FEATURES.map(f => Cell(f))]}
        rows={list.slice(page * per, page * per + per).map(u => [
          <span><b>{u.username}</b><br /><span className="hint">{u.email}</span></span>,
          ...FEATURES.map(f => ({ jsx: <input type="checkbox" defaultChecked={mode === 'all'} style={{ width: 16, height: 16 }} /> })),
        ])} />
      <div className="ap-pager">
        <button className="ap-btn ap-btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))}>قبلی</button>
        <span className="ap-pager-label">{page + 1} / {pages}</span>
        <button className="ap-btn ap-btn-ghost" onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>بعدی</button>
      </div>
      <SaveBar />
    </Card>
  )
}

export function Groups() {
  const { data } = useApi('/admin-panel/api/admin/groups', [])
  const list = Array.isArray(data) ? data : []
  const [name, setName] = useState('')
  const [created, setCreated] = useState('')
  return (
    <>
      <Card title="ایجاد گروه جدید">
        <div className="ap-form-row"><label>نام گروه</label><input className="ap-search" style={{ width: 260 }} value={name} onChange={e => setName(e.target.value)} /><Button onClick={() => { if (name) { setCreated(name); setName('') } }}>ایجاد</Button></div>
        {created && <Hint>گروه «{created}» ایجاد شد.</Hint>}
      </Card>
      <Card title="گروه‌ها">
        <Table
          cols={[Cell('Name', 'r'), Cell('Members'), Cell('')]}
          rows={list.map(g => [
            g.name, String(g.member_count ?? 0),
            { jsx: <div className="actions"><Button variant="ghost">Save</Button><Button variant="ghost">Delete</Button></div> },
          ])} />
      </Card>
    </>
  )
}

export function Broadcast() {
  const [grp, setGrp] = useState('admins')
  const [cat, setCat] = useState('اطلاع‌رسانی')
  const [subj, setSubj] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState('')
  return (
    <Card title="ارسال ایمیل به یک گروه">
      <div className="ap-form-row"><label>گروه</label>
        <select className="ap-search" style={{ width: 260 }} value={grp} onChange={e => setGrp(e.target.value)}><option>admins</option><option>app-service-dev</option><option>ml-gpu-platform-eng</option></select>
      </div>
      <div className="ap-form-row"><label>دسته پیام</label>
        <select className="ap-search" style={{ width: 260 }} value={cat} onChange={e => setCat(e.target.value)}><option>اطلاع‌رسانی</option><option>نگهداری</option><option>هشدار</option></select>
      </div>
      <div className="ap-form-row"><label>موضوع</label><input className="ap-search" value={subj} onChange={e => setSubj(e.target.value)} /></div>
      <div className="ap-form-row" style={{ alignItems: 'flex-start' }}><label>متن پیام</label><textarea className="ap-search" rows={5} style={{ width: '100%' }} value={body} onChange={e => setBody(e.target.value)} /></div>
      <div className="actions"><Button onClick={() => { setSent('ایمیل به گروه «' + grp + '» ارسال شد.'); setTimeout(() => setSent(''), 3000) }}>ارسال</Button></div>
      {sent && <span className="ap-saved">{sent}</span>}
    </Card>
  )
}

const KEY_MODELS = ['DeepSeekDeepSeek-R1-0528-AWQ', 'DeepSeekDeepSeek-V3-0324-AWQ', 'DeepSeekDeepSeek-V4-Flash-0731', 'gemmagemma-4-31B-it', 'GLMGLM-5.3-Flash', 'JinaJina-Embeddings-v3', 'KimiKimi-K3', 'LTXLTX-Video', 'QwenQwen2.5-72B-Instruct-AWQ', 'QwenQwen3.8-27B-FP8', 'RavenXRavenX-CyberAgent-v6.2-Experimental-GGUF', 'SeedVRSeedVR2-3B-FP8-e4m3fn', 'TrendyolTrendyol-Cybersecurity-LLM-v2-70B-Q4_K_M', 'WanWan_2.2_ComfyUI_Repackaged']

export function LlmIssue() {
  const [user, setUser] = useState('')
  const [ns, setNs] = useState('godarzi')
  const [exp, setExp] = useState('30')
  const [picked, setPicked] = useState([])
  const [done, setDone] = useState('')
  return (
    <Card title="صدور کلید API LLM">
      <Hint>رابط اصلی LLM پلتفرم (llm-api.isigpu.local).</Hint>
      <div className="ap-form-row"><label>کاربر (جستجو با نام/ایمیل/نام کاربری)</label><input className="ap-search" value={user} onChange={e => setUser(e.target.value)} /></div>
      <div className="ap-form-row"><label>فضای‌نام</label><input className="ap-search" style={{ width: 200 }} value={ns} onChange={e => setNs(e.target.value)} /></div>
      <div className="ap-form-row"><label>انقضا (روز، ۰ یعنی هرگز)</label><input className="ap-search" style={{ width: 120 }} value={exp} onChange={e => setExp(e.target.value)} /></div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontWeight: 700 }}>محدود کردن به مدل‌های خاص (برای دسترسی کامل همه را بدون تیک بگذارید)</label>
        <div className="ap-model-checks">
          {KEY_MODELS.map(m => (
            <label key={m} className="ap-check">
              <input type="checkbox" checked={picked.includes(m)} onChange={e => setPicked(p => e.target.checked ? [...p, m] : p.filter(x => x !== m))} />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="actions" style={{ marginTop: 12 }}><Button onClick={() => { setDone('کلید تولید و به ایمیل کاربر ارسال شد.'); setTimeout(() => setDone(''), 3000) }}>تولید و ایمیل کلید</Button></div>
      {done && <span className="ap-saved">{done}</span>}
    </Card>
  )
}

export function Assistant() {
  const [msgs, setMsgs] = useState([])
  const [txt, setTxt] = useState('')
  const send = () => {
    if (!txt.trim()) return
    setMsgs(m => [...m, { me: true, t: txt }, { me: false, t: 'بررسی می‌کنم — لاگ‌های پاد و رویدادهای کلاستر را تحلیل کردم. جزئیات بیشتری از خطا بفرستید.' }])
    setTxt('')
  }
  return (
    <Card title="دستیار عیب‌یابی">
      <div className="actions" style={{ marginBottom: 10 }}><Button variant="ghost" onClick={() => setMsgs([])}>گفتگوی جدید</Button></div>
      <div className="ap-chat">
        {msgs.map((m, i) => <div key={i} className={m.me ? 'ap-chat-me' : 'ap-chat-ai'}>{m.t}</div>)}
        {msgs.length === 0 && <Hint>مشکل را توضیح دهید تا دستیار بررسی کند.</Hint>}
      </div>
      <div className="ap-form-row"><input className="ap-search" placeholder="پیام…" value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} /><Button onClick={send}>ارسال</Button></div>
    </Card>
  )
}

const SEC_SEV = ['همه', 'بحرانی', 'بالا', 'متوسط', 'پایین']

export function Security() {
  const [cat, setCat] = useState('vulns')
  const [sev, setSev] = useState('همه')
  return (
    <Card title="امنیت">
      <div className="actions" style={{ marginBottom: 10 }}>
        <Button variant={cat === 'vulns' ? 'primary' : 'ghost'} onClick={() => setCat('vulns')}>آسیب‌پذیری‌ها</Button>
        <Button variant={cat === 'misconf' ? 'primary' : 'ghost'} onClick={() => setCat('misconf')}>پیکربندی‌های نادرست</Button>
        <Button variant={cat === 'comp' ? 'primary' : 'ghost'} onClick={() => setCat('comp')}>انطباق</Button>
        <Button variant={cat === 'cis' ? 'primary' : 'ghost'} onClick={() => setCat('cis')}>بنچمارک CIS</Button>
        <Button variant={cat === 'runtime' ? 'primary' : 'ghost'} onClick={() => setCat('runtime')}>هشدارهای زمان اجرا</Button>
      </div>
      <div className="actions" style={{ marginBottom: 10 }}>
        {SEC_SEV.map(s => <Button key={s} variant={sev === s ? 'primary' : 'ghost'} onClick={() => setSev(s)}>{s}</Button>)}
        <Button variant="ghost">‹</Button><Button variant="ghost">›</Button>
        <Button variant="ghost">تازه‌سازی</Button>
      </div>
      <Hint>در حال بارگذاری…</Hint>
    </Card>
  )
}

const MON_RANGES = ['1 دقیقه', '15 دقیقه', '1 ساعت', '6 ساعت', '1d', '1w']

export function Monitoring() {
  const [range, setRange] = useState('15 دقیقه')
  return (
    <Card title="مانیتورینگ">
      <div className="actions" style={{ marginBottom: 10 }}>
        {MON_RANGES.map(r => <Button key={r} variant={range === r ? 'primary' : 'ghost'} onClick={() => setRange(r)}>{r}</Button>)}
        <Button variant="ghost">تازه‌سازی</Button>
      </div>
      <Hint>نمودارهای LiteLLM و tokenها برای بازه {range}.</Hint>
    </Card>
  )
}
