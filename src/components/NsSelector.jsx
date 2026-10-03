import Icon from './Icon.jsx'
import { useApi } from '../lib/api.js'
import { useSession } from '../lib/session.js'
import './NsSelector.css'

// kubeflow-resource-usage resolves the namespace from the Profile the user owns and takes no
// ?ns= parameter, so this shows that namespace read-only (no switcher).
export default function NsSelector({ admin }) {
  const { namespace } = useSession()
  const { data: opts } = useApi('/api/notebooks/options')
  const quota = opts?.quota || {}
  return (
    <div className="ns-root">
      <div className="ns-btn" title="Namespace شما">
        <span className="ns-avatar"><Icon name="person" size={16} color="#0a3b71" /></span>
        <div className="ns-btn-body">
          <span className="ns-name"><bdi dir="ltr">{namespace || '—'}</bdi></span>
          <span className="ns-role">مالک</span>
        </div>
      </div>
      {!admin && (
        <div className="ns-quota-strip">
          <span className="ns-quota-item" title="هسته CPU باقی‌مانده">
            <span className="ns-quota-dot cpu" /><span>{quota.cpu_remaining_cores ?? '—'} هسته</span>
          </span>
          <span className="ns-quota-sep" />
          <span className="ns-quota-item" title="حافظه RAM باقی‌مانده">
            <span className="ns-quota-dot mem" /><span>{quota.memory_remaining_gib ?? '—'} GiB</span>
          </span>
        </div>
      )}
    </div>
  )
}
