import { useState, useMemo, useEffect } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useApi, apiPost, apiSend, invalidate } from '../lib/api.js'
import { fmt } from '../lib/format.js'
import { notifySuccess, notifyError } from '../lib/notify.js'
import ErrorNote from '../components/ErrorNote.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import './Notebooks.css'

const enc = encodeURIComponent
const PHASE = { New: 'در صف', InProgress: 'در حال انجام', Completed: 'کامل', PartiallyFailed: 'ناقص', Failed: 'ناموفق', Deleting: 'در حال حذف', FailedValidation: 'نامعتبر' }
const DONE = new Set(['Completed', 'PartiallyFailed', 'Failed', 'FailedValidation'])
const rnd = () => 2 + Math.floor(Math.random() * 9)

function useSorted(rows, query, keys, initial) {
  const [sort, setSort] = useState(initial)
  const [page, setPage] = useState(0)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => !q || keys.some(k => String(r[k] ?? '').toLowerCase().includes(q)))
      .sort((a, b) => { const x = a[sort.key] ?? '', y = b[sort.key] ?? ''; return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1) })
  }, [rows, query, sort])
  const PER = 10
  const pages = Math.max(1, Math.ceil(list.length / PER))
  const shown = list.slice(Math.min(page, pages - 1) * PER, Math.min(page, pages - 1) * PER + PER)
  const th = (k, l) => <th className="sortable" onClick={() => setSort(s => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}>{l}{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
  const pager = pages > 1 && (
    <div className="nb-pager">
      <button className="nb-action-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
      <span>{Math.min(page, pages - 1) + 1} / {pages}</span>
      <button className="nb-action-btn" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>›</button>
    </div>
  )
  return { shown, th, pager, count: list.length, resetPage: () => setPage(0) }
}

function RestoreDialog({ backup, onClose, onDone }) {
  const [step, setStep] = useState('confirm')
  const [cap] = useState(() => ({ a: rnd(), b: rnd() }))
  const [answer, setAnswer] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async force => {
    setBusy(true); setErr('')
    const body = force ? { force: true, captcha_a: cap.a, captcha_b: cap.b, captcha_answer: Number(answer), password } : {}
    const r = await apiPost(`/api/backups/${enc(backup.name)}/restore`, body)
    setBusy(false)
    if (r.error) {
      // the backend answers {error:"existing_pvcs", existing_pvcs:[...]} when volumes with the same names exist
      if (r.error.message === 'existing_pvcs') { setStep('force'); return }
      setErr(r.error.message); notifyError(r.error.message); return
    }
    notifySuccess(`بازیابی از «${backup.name}» شروع شد`)
    onDone()
  }
  return (
    <>
      <div className="cd-backdrop" onClick={busy ? undefined : onClose} />
      <div className="cd-modal" dir="rtl" role="dialog" aria-modal="true">
        <h3>بازیابی از «<bdi dir="ltr">{backup.name}</bdi>»</h3>
        {step === 'confirm' ? (
          <p className="cd-body">فضاهای ذخیره‌سازی موجود در این بکاپ در Namespace شما بازیابی می‌شوند.</p>
        ) : (
          <>
            <p className="cd-body">فضاهای ذخیره‌سازی هم‌نام از قبل وجود دارند. بازیابی اجباری آن‌ها را با محتوای بکاپ جایگزین می‌کند و داده‌ی فعلی‌شان از بین می‌رود.</p>
            <label className="cd-label">گذرواژه‌ی فعلی</label>
            <input className="cd-input" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            <label className="cd-label"><bdi dir="ltr">{cap.a} + {cap.b}</bdi> = ؟</label>
            <input className="cd-input" type="number" dir="ltr" value={answer} onChange={e => setAnswer(e.target.value)} />
          </>
        )}
        {err && <div className="nb-form-err" role="alert" dir="auto">{err}</div>}
        <div className="cd-actions">
          <button className="cd-btn" onClick={onClose} disabled={busy}>انصراف</button>
          {step === 'confirm'
            ? <button className="cd-btn cd-primary" onClick={() => run(false)} disabled={busy}>{busy ? 'در حال بررسی…' : 'بازیابی'}</button>
            : <button className="cd-btn cd-danger" onClick={() => run(true)} disabled={busy || !password || answer === ''}>{busy ? 'در حال بازیابی…' : 'بازیابی اجباری'}</button>}
        </div>
      </div>
    </>
  )
}

export default function Backups() {
  const { data, error, loading, reload } = useApi('/api/backups', [])
  const { data: restores, error: rErr, reload: reloadR } = useApi('/api/restores', [])
  const backups = Array.isArray(data) ? data : []
  const rest = Array.isArray(restores) ? restores : []
  const [query, setQuery] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [del, setDel] = useState(null)
  const [restore, setRestore] = useState(null)
  const [busy, setBusy] = useState('')
  const refresh = () => { invalidate('/api/backups'); invalidate('/api/restores'); reload(); reloadR() }
  const b = useSorted(backups, query, ['name', 'description', 'phase'], { key: 'created_at', dir: 'desc' })
  const r = useSorted(rest, '', ['name'], { key: 'created_at', dir: 'desc' })

  const pending = backups.some(x => !DONE.has(x.phase)) || rest.some(x => !DONE.has(x.phase))
  useEffect(() => {
    if (!pending) return
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [pending])

  const create = async () => {
    setCreating(true)
    const res = await apiPost('/api/backups', { description: desc.trim() })
    setCreating(false)
    if (res.error) { notifyError(res.error.message); return }
    setDesc(''); notifySuccess(`بکاپ «${res.data?.name || ''}» شروع شد`); refresh()
  }
  const remove = async () => {
    const x = del
    setBusy(x.name)
    const res = await apiSend(`/api/backups/${enc(x.name)}`, 'DELETE')
    setBusy(''); setDel(null)
    if (res.error) { notifyError(res.error.message); return }
    notifySuccess(res.data?.cancelled ? `بکاپ «${x.name}» لغو شد` : `حذف بکاپ «${x.name}» آغاز شد`); refresh()
  }
  // POST .../download prepares a signed URL; it can take a few seconds (503 until ready)
  const download = async x => {
    setBusy(x.name)
    for (let i = 0; i < 10; i++) {
      const res = await apiPost(`/api/backups/${enc(x.name)}/download`, {})
      if (!res.error && res.data?.download_url) {
        setBusy('')
        const a = document.createElement('a'); a.href = res.data.download_url; a.download = `${x.name}.tar.gz`; a.click()
        notifySuccess(`دانلود «${x.name}» شروع شد`); return
      }
      if (res.error && res.error.status !== 503) { setBusy(''); notifyError(res.error.message); return }
      await new Promise(ok => setTimeout(ok, 2000))
    }
    setBusy(''); notifyError('آماده‌سازی دانلود بیش از حد طول کشید؛ دوباره تلاش کنید')
  }
  const removeRestore = async x => {
    const res = await apiSend(`/api/restores/${enc(x.name)}`, 'DELETE')
    if (res.error) { notifyError(res.error.message); return }
    notifySuccess('سابقه‌ی بازیابی حذف شد'); refresh()
  }

  return (
    <AppShell active="بکاپ‌ها">
      <div className="nb-page">
        <div className="nb-title-row"><h1>بکاپ‌ها</h1></div>
        <div className="nb-bar">
          <input className="nb-search-input" style={{ maxWidth: 360 }} placeholder="توضیح بکاپ جدید (اختیاری)" maxLength={200} value={desc} onChange={e => setDesc(e.target.value)} />
          <button className="nb-new-btn" onClick={create} disabled={creating}>{creating ? 'در حال ایجاد…' : 'بکاپ جدید'}</button>
          <div className="spacer" />
          <input className="nb-search-input" style={{ maxWidth: 240 }} placeholder="جستجو…" value={query} onChange={e => { setQuery(e.target.value); b.resetPage() }} />
        </div>
        <p className="nb-fhint" style={{ padding: '0 24px' }}>بکاپ از همه‌ی فضاهای ذخیره‌سازی Namespace شما گرفته می‌شود و ۳۰ روز نگه‌داری می‌شود.</p>
        <ErrorNote error={error} />
        {loading && !error && <p className="nb-fhint" style={{ padding: 24 }}>در حال بارگذاری…</p>}
        {!loading && !error && backups.length === 0 && <div className="nb-empty-state"><h3>هنوز بکاپی ندارید</h3></div>}
        {b.shown.length > 0 && (
          <div className="nb-table-wrap">
            <table className="nb-tbl">
              <thead><tr>{b.th('name', 'نام')}{b.th('phase', 'وضعیت')}{b.th('size_gib', 'حجم')}{b.th('created_at', 'ایجاد')}{b.th('expiration', 'انقضا')}{b.th('description', 'توضیح')}<th /></tr></thead>
              <tbody>{b.shown.map(x => (
                <tr key={x.name}>
                  <td><bdi dir="ltr" className="nb-name">{x.name}</bdi></td>
                  <td>{PHASE[x.phase] || x.phase}</td>
                  <td dir="ltr">{x.size_gib != null ? `${x.size_gib} GiB` : '—'}</td>
                  <td>{fmt.date(x.created_at)}</td>
                  <td>{x.expiration ? fmt.date(x.expiration) : '—'}</td>
                  <td dir="auto">{x.description || '—'}</td>
                  <td><div className="nb-actions">
                    <button className="cd-btn" disabled={x.phase !== 'Completed' || !!busy} onClick={() => setRestore(x)}>بازیابی</button>
                    <button className="cd-btn" disabled={x.phase !== 'Completed' || !!busy} onClick={() => download(x)}>{busy === x.name ? '…' : 'دانلود'}</button>
                    <button className="cd-btn" disabled={!!busy} onClick={() => setDel(x)}>{DONE.has(x.phase) ? 'حذف' : 'لغو'}</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {b.pager}
          </div>
        )}

        <h2 style={{ fontSize: 16, padding: '24px 24px 0' }}>سابقه‌ی بازیابی</h2>
        <ErrorNote error={rErr} />
        {rest.length === 0 ? <p className="nb-fhint" style={{ padding: '8px 24px' }}>هنوز بازیابی‌ای انجام نشده است.</p> : (
          <div className="nb-table-wrap">
            <table className="nb-tbl">
              <thead><tr>{r.th('name', 'نام')}{r.th('backup_name', 'از بکاپ')}{r.th('phase', 'وضعیت')}{r.th('created_at', 'زمان')}<th /></tr></thead>
              <tbody>{r.shown.map(x => (
                <tr key={x.name}>
                  <td><bdi dir="ltr">{x.name}</bdi></td><td><bdi dir="ltr">{x.backup_name}</bdi></td>
                  <td>{PHASE[x.phase] || x.phase}</td><td>{fmt.date(x.created_at)}</td>
                  <td><button className="cd-btn" disabled={!DONE.has(x.phase)} onClick={() => removeRestore(x)}>حذف سابقه</button></td>
                </tr>
              ))}</tbody>
            </table>
            {r.pager}
          </div>
        )}
      </div>
      {del && <ConfirmDialog danger title={DONE.has(del.phase) ? `حذف بکاپ «${del.name}»؟` : `لغو بکاپ «${del.name}»؟`}
        body={DONE.has(del.phase) ? 'محتوای بکاپ برای همیشه پاک می‌شود.' : 'بکاپ در حال انجام متوقف می‌شود.'}
        confirmLabel={DONE.has(del.phase) ? 'حذف' : 'لغو بکاپ'} busy={busy === del.name} onCancel={() => setDel(null)} onConfirm={remove} />}
      {restore && <RestoreDialog backup={restore} onClose={() => setRestore(null)} onDone={() => { setRestore(null); refresh() }} />}
    </AppShell>
  )
}
