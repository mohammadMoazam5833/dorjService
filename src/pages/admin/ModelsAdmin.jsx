import { useState } from 'react'
import Card, { Hint } from '../../components/Card.jsx'
import Button from '../../components/Button.jsx'
import { useApi, apiPost } from '../../lib/api.js'

export default function ModelsAdmin() {
  const { data } = useApi('/admin-panel/api/admin/models', [])
  const list = Array.isArray(data) ? data : []
  const [toast, setToast] = useState('')
  const act = async (label, m) => {
    await apiPost('/admin-panel/api/admin/models/' + (label === 'استقرار' ? 'deploy' : 'remove'), { id: m.id })
    setToast(label + ' «' + m.display_name + '» انجام شد.')
    setTimeout(() => setToast(''), 3000)
  }
  return (
    <>
      {list.map(m => (
        <Card key={m.id}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{m.display_name}</h3>
          <Hint>{m.repo || m.engine}</Hint>
          {m.stop_note && <Hint>{m.stop_note}</Hint>}
          <div className="actions" style={{ marginTop: 10 }}>
            <Button onClick={() => act('استقرار', m)}>استقرار</Button>
            <Button variant="ghost" onClick={() => act('حذف', m)}>حذف</Button>
          </div>
        </Card>
      ))}
      {list.length === 0 && <Card><Hint>مدلی یافت نشد.</Hint></Card>}
      {toast && <div className="app-toast">{toast}</div>}
    </>
  )
}
