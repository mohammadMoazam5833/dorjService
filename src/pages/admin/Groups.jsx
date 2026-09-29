import Card, { Hint } from '../../components/Card.jsx'
import Search from '../../components/Search.jsx'
import Button from '../../components/Button.jsx'
import { Chip, ChipRow } from '../../components/Chip.jsx'
import { useApi } from '../../lib/api.js'
import { faNum } from '../../lib/format.js'

export default function Groups() {
  const { data } = useApi('/admin-panel/api/admin/groups', [])
  const list = Array.isArray(data) ? data : []
  return (
    <>
      <Card title="ایجاد گروه جدید">
        <div className="field"><label>نام گروه</label><input className="ap-search" placeholder="gpu-team" readOnly /></div>
        <div className="actions"><Button>ایجاد</Button></div>
      </Card>
      <Card title={`گروه‌ها (${faNum(list.length)} گروه)`}>
        {list.map(g => {
          const chips = Object.entries(g.access || {}).filter(([, v]) => v).map(([k]) => k.replace(/^access-/, ''))
          return (
            <div key={g.id || g.name} style={{ background: '#f7f9fb', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <b>{g.name}</b>
                <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--muted)' }}>{faNum(g.member_count)} عضو</span>
              </div>
              <ChipRow>{chips.map(a => <Chip key={a}>{a}</Chip>)}</ChipRow>
            </div>
          )
        })}
      </Card>
    </>
  )
}
