import Card, { Hint } from '../../components/Card.jsx'
import Search from '../../components/Search.jsx'
import Button from '../../components/Button.jsx'
import Badge from '../../components/Badge.jsx'
import { useApi } from '../../lib/api.js'
import { faNum } from '../../lib/format.js'
import ErrorNote from '../../components/ErrorNote.jsx'
import { soonProps, SOON } from '../../lib/soon.js'

const MODEL_STATUS = {
  serving: 'در حال سرو', downloaded: 'دانلودشده', not_downloaded: 'دانلود نشده',
  deploy_blocked: 'غیرقابل دیپلوی', downloading: 'در حال دانلود', deploying: 'در حال استقرار',
}

export default function ModelsAdmin() {
  const { data, error } = useApi('/admin-panel/api/admin/models', [])
  const list = Array.isArray(data) ? data : []
  return (
    <div className="model-cards">
      <ErrorNote error={error} />
      {list.map(m => (
        <div key={m.id} className="model-card">
          <b style={{ fontSize: 15 }}>{m.display_name}</b>
          <Hint>{m.engine} · {faNum(m.gpu_required)}× GPU{m.node ? ` · ${m.node}` : ''}</Hint>
          <div><Badge ok={m.status === 'serving'}>{MODEL_STATUS[m.status] || m.status}</Badge></div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m.litellm_alias ? `نام مستعار: ${m.litellm_alias}` : '—'}</div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            <Button {...soonProps}>استقرار</Button><Button {...soonProps} variant="danger">حذف</Button>
          </div>
        </div>
      ))}
      {list.length === 0 && <Card className="empty"><Hint>مدلی ثبت نشده است.</Hint></Card>}
    </div>
  )
}
