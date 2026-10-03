import Card, { Hint } from '../../components/Card.jsx'
import Table, { Cell } from '../../components/Table.jsx'
import Search from '../../components/Search.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import { useApi } from '../../lib/api.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import { soonProps, SOON } from '../../lib/soon.js'

export default function Users() {
  const { data, error } = useApi('/admin-panel/api/admin/users', [])
  const list = Array.isArray(data) ? data : []
  return (
    <Card title="کاربران">
      <ErrorNote error={error} />
      <div className="actions"><Button {...soonProps}>+ ثبت‌نام کاربر جدید</Button></div>
      <Search />
      <Table
        cols={[Cell('نام کاربری', 'r'), Cell('ایمیل', 'r'), Cell('وضعیت'), Cell('منبع'), Cell('عملیات')]}
        rows={list.map(u => [
          u.username, u.email,
          { jsx: (
            <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
              <Badge ok={u.enabled}>{u.enabled ? 'فعال' : 'غیرفعال'}</Badge>
              {u.is_platform_admin && <Badge ok>ادمین پلتفرم</Badge>}
              {u.pending_approval && <Badge>در انتظار تایید</Badge>}
            </span>
          ) },
          u.federated ? 'AD' : 'محلی',
          { jsx: (
            <div className="actions" style={{ justifyContent: 'center' }}>
              <Button {...soonProps} variant="ghost">بازنشانی رمز</Button>
              <Button {...soonProps} variant="ghost">{u.is_platform_admin ? 'حذف دسترسی ادمین' : 'اعطای دسترسی ادمین'}</Button>
            </div>
          ) },
        ])} />
    </Card>
  )
}
