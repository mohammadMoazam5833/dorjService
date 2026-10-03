import { useState, useEffect } from 'react'
import { apiPost } from '../../lib/api.js'
import { getJson } from '../../lib/http.js'
import { notifySuccess, notifyError } from '../../lib/notify.js'
import { Field, Err, useTable } from './kit.jsx'

const B = '/admin-panel/api/admin'
const fresh = p => getJson(`${p}?t=${Date.now()}`, { ttlMs: 0 }).then(r => r.data)
const SUBS = [['send', 'ارسال گروهی'], ['categories', 'دسته‌ها'], ['direct', 'ارسال مستقیم'], ['log', 'تاریخچه']]
const logDetail = i => [i.group && `گروه: ${i.group}`, i.to && `به: ${[].concat(i.to).join(', ')}`, i.sent !== undefined && `ارسال‌شده: ${i.sent}`, i.failed && `ناموفق: ${i.failed}`].filter(Boolean).join('، ') || '—'

export default function Broadcast() {
  const [sub, setSub] = useState('send')
  const [groups, setGroups] = useState([])
  const [tpls, setTpls] = useState({})
  const [log, setLog] = useState([])
  const [send, setSend] = useState({ group_id: '', category: '', subject: '', body: '' })
  const [cat, setCat] = useState({ key: '', label: '', from: '', from_display_name: '', subject: '', body: '' })
  const [direct, setDirect] = useState({ to: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const loadTpls = () => fresh(`${B}/mail-templates`).then(t => {
    setTpls(t || {})
    const first = Object.keys(t || {})[0]
    if (first) setSend(s => (s.category ? s : { ...s, category: first, subject: t[first].subject || '', body: t[first].body || '' }))
  })
  const loadLog = () => fresh(`${B}/mail-log`).then(l => setLog(l || []))
  useEffect(() => {
    fresh(`${B}/groups`).then(g => { setGroups(g || []); if (g?.length) setSend(s => ({ ...s, group_id: s.group_id || g[0].id })) })
    loadTpls(); loadLog()
  }, [])
  const logT = useTable(log, { keys: ['type', 'subject', 'group'], sort: { key: 'time', dir: 'desc' } })
  const cats = Object.entries(tpls).map(([key, v]) => ({ key, ...v }))
  const catT = useTable(cats, { keys: ['key', 'label', 'subject'], sort: { key: 'key', dir: 'asc' } })

  const post = async (path, body, ok, after) => {
    setBusy(true); setErr('')
    const r = await apiPost(path, body)
    setBusy(false)
    if (r.error) { setErr(r.error.message); notifyError(r.error.message); return }
    notifySuccess(ok(r.data || {})); after?.(); loadLog()
  }
  const pickCat = k => setSend(s => ({ ...s, category: k, subject: tpls[k]?.subject || '', body: tpls[k]?.body || '' }))

  return (
    <>
      <nav className="ak-tabs">{SUBS.map(([id, l]) => <button key={id} className={sub === id ? 'on' : ''} onClick={() => { setSub(id); setErr('') }}>{l}</button>)}</nav>
      <Err>{err}</Err>
      {sub === 'send' && (
        <div className="ak-card">
          <h2>ارسال ایمیل به یک گروه</h2>
          <div className="ak-row">
            <Field label="گروه"><select className="ak-select" dir="ltr" value={send.group_id} onChange={e => setSend(s => ({ ...s, group_id: e.target.value }))}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
            <Field label="دسته‌ی پیام"><select className="ak-select" dir="ltr" value={send.category} onChange={e => pickCat(e.target.value)}>{Object.keys(tpls).map(k => <option key={k} value={k}>{k}</option>)}</select></Field>
          </div>
          <Field label="موضوع"><input className="ak-input" dir="auto" value={send.subject} onChange={e => setSend(s => ({ ...s, subject: e.target.value }))} /></Field>
          <Field label="متن پیام" hint="برای شخصی‌سازی می‌توانید از {{name}} و {{email}} استفاده کنید."><textarea className="ak-textarea" dir="auto" rows={8} value={send.body} onChange={e => setSend(s => ({ ...s, body: e.target.value }))} /></Field>
          <button className="ak-btn ak-primary" disabled={busy || !send.group_id} onClick={() => post(`${B}/broadcast`, send, d => (d.sent !== undefined ? `ارسال شد: ${d.sent}${d.failed ? `، ناموفق: ${d.failed}` : ''}` : 'پیام گروهی ارسال شد'))}>ارسال</button>
        </div>
      )}
      {sub === 'categories' && (
        <>
          <div className="ak-card">
            <h2>دسته‌ی پیام جدید</h2>
            <div className="ak-row">
              <Field label="کلید دسته (انگلیسی، بدون فاصله)"><input className="ak-input" dir="ltr" placeholder="service_outage" value={cat.key} onChange={e => setCat(s => ({ ...s, key: e.target.value }))} /></Field>
              <Field label="نام نمایشی"><input className="ak-input" value={cat.label} onChange={e => setCat(s => ({ ...s, label: e.target.value }))} /></Field>
            </div>
            <div className="ak-row">
              <Field label="ایمیل فرستنده (اختیاری)"><input className="ak-input" dir="ltr" type="email" value={cat.from} onChange={e => setCat(s => ({ ...s, from: e.target.value }))} /></Field>
              <Field label="نام نمایشی فرستنده (اختیاری)"><input className="ak-input" value={cat.from_display_name} onChange={e => setCat(s => ({ ...s, from_display_name: e.target.value }))} /></Field>
            </div>
            <Field label="موضوع"><input className="ak-input" dir="auto" value={cat.subject} onChange={e => setCat(s => ({ ...s, subject: e.target.value }))} /></Field>
            <Field label="متن پیام"><textarea className="ak-textarea" dir="auto" rows={6} value={cat.body} onChange={e => setCat(s => ({ ...s, body: e.target.value }))} /></Field>
            <button className="ak-btn ak-primary" disabled={busy || !cat.key.trim()} onClick={() => post(`${B}/mail-templates`, cat, () => 'دسته‌ی پیام ساخته شد', () => { setCat({ key: '', label: '', from: '', from_display_name: '', subject: '', body: '' }); loadTpls() })}>ساخت دسته</button>
          </div>
          <div className="ak-card">
            <div className="ak-toolbar"><h2 style={{ margin: 0 }}>دسته‌های پیام</h2><div className="spacer" />{catT.search()}</div>
            <table className="ak-table"><thead><tr>{catT.th('key', 'کلید')}{catT.th('label', 'نام نمایشی')}{catT.th('subject', 'موضوع')}{catT.th('from', 'فرستنده')}</tr></thead>
              <tbody>{catT.shown.map(c => <tr key={c.key}><td dir="ltr">{c.key}</td><td>{c.label}</td><td dir="auto">{c.subject}</td><td dir="ltr">{c.from || '—'}</td></tr>)}</tbody></table>
            {catT.pager}
          </div>
        </>
      )}
      {sub === 'direct' && (
        <div className="ak-card">
          <h2>ارسال به آدرس مشخص</h2>
          <p className="ak-muted">فقط آدرس‌های isigpu.local مجاز است؛ چند آدرس را با کاما جدا کنید.</p>
          <Field label="گیرنده(ها)"><input className="ak-input" dir="ltr" placeholder="someone@isigpu.local" value={direct.to} onChange={e => setDirect(s => ({ ...s, to: e.target.value }))} /></Field>
          <Field label="موضوع"><input className="ak-input" dir="auto" value={direct.subject} onChange={e => setDirect(s => ({ ...s, subject: e.target.value }))} /></Field>
          <Field label="متن پیام"><textarea className="ak-textarea" dir="auto" rows={6} value={direct.body} onChange={e => setDirect(s => ({ ...s, body: e.target.value }))} /></Field>
          <button className="ak-btn ak-primary" disabled={busy || !direct.to.trim()} onClick={() => post(`${B}/send-mail`, direct, () => 'ایمیل ارسال شد', () => setDirect({ to: '', subject: '', body: '' }))}>ارسال</button>
        </div>
      )}
      {sub === 'log' && (
        <div className="ak-card">
          <div className="ak-toolbar"><h2 style={{ margin: 0 }}>تاریخچه‌ی ایمیل‌ها</h2><div className="spacer" />{logT.search()}</div>
          <table className="ak-table"><thead><tr>{logT.th('type', 'نوع')}{logT.th('time', 'زمان')}{logT.th('subject', 'موضوع / دسته')}<th>جزئیات</th></tr></thead>
            <tbody>{logT.shown.map((i, n) => <tr key={n}><td dir="ltr">{i.type}</td><td dir="ltr">{(i.time || '').replace('T', ' ').slice(0, 19)}</td><td dir="auto">{i.subject || '—'}</td><td dir="auto">{logDetail(i)}</td></tr>)}</tbody></table>
          {logT.pager}
        </div>
      )}
    </>
  )
}
