import { useState } from 'react'
import Card, { Hint } from '../../components/Card.jsx'
import Table, { Cell } from '../../components/Table.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import { useApi, apiPost } from '../../lib/api.js'

export default function Users() {
  const { data } = useApi('/admin-panel/api/admin/users', [])
  const list = Array.isArray(data) ? data : []
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState('')
  const [reg, setReg] = useState(false)
  const [nu, setNu] = useState('')
  const [ne, setNe] = useState('')
  const per = 10
  const pages = Math.max(1, Math.ceil(list.length / per))

  const act = async (label, path, body) => {
    await apiPost(path, body || {})
    setToast(label + ' انجام شد.')
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <Card title="کاربران">
      <div className="actions" style={{ marginBottom: 10 }}><Button onClick={() => setReg(true)}>+ ثبت‌نام کاربر جدید</Button></div>
      <Table
        cols={[Cell('نام کاربری', 'r'), Cell('ایمیل', 'r'), Cell('وضعیت'), Cell('منبع'), Cell('')]}
        rows={list.slice(page * per, page * per + per).map(u => [
          u.username, u.email,
          { jsx: (
            <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
              <Badge ok={u.enabled}>{u.enabled ? 'فعال' : 'غیرفعال'}</Badge>
              {u.is_platform_admin && <Badge ok>ادمین پلتفرم</Badge>}
              {u.pending_approval && <Badge>در انتظار تأیید</Badge>}
            </span>
          ) },
          u.federated ? 'AD' : 'محلی',
          { jsx: (
            <div className="actions" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => act('غیرفعال کردن', '/admin-panel/api/admin/users/disable', { username: u.username })}>غیرفعال کردن</Button>
              <Button variant="ghost" onClick={() => act(u.is_platform_admin ? 'حذف دسترسی ادمین' : 'اعطای دسترسی ادمین', '/admin-panel/api/admin/users/admin', { username: u.username })}>{u.is_platform_admin ? 'حذف دسترسی ادمین' : 'اعطای دسترسی ادمین'}</Button>
              <Button variant="ghost" onClick={() => act('بازنشانی رمز عبور', '/admin-panel/api/admin/users/reset-password', { username: u.username })}>بازنشانی رمز عبور</Button>
              <Button variant="ghost" onClick={() => act('خروج کاربر', '/admin-panel/api/admin/users/logout', { username: u.username })}>خروج کاربر</Button>
            </div>
          ) },
        ])} />
      <div className="ap-pager">
        <button className="ap-btn ap-btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))}>قبلی</button>
        <span className="ap-pager-label">{page + 1} / {pages}</span>
        <button className="ap-btn ap-btn-ghost" onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>بعدی</button>
      </div>
      {toast && <div className="app-toast">{toast}</div>}
      {reg && (
        <>
          <div className="modal-backdrop" onClick={() => setReg(false)} />
          <div className="vw-modal" dir="rtl">
            <h2>ثبت‌نام کاربر جدید</h2>
            <label className="field-label">نام کاربری</label>
            <input className="vw-field" value={nu} onChange={e => setNu(e.target.value)} />
            <label className="field-label">ایمیل</label>
            <input className="vw-field" value={ne} onChange={e => setNe(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setReg(false)}>انصراف</button>
              <button className="btn-primary" onClick={async () => { await apiPost('/admin-panel/api/admin/users', { username: nu, email: ne }); setReg(false); setToast('کاربر ثبت شد.'); setTimeout(() => setToast(''), 3000) }}>ثبت</button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
