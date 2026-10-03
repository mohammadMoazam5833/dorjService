import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Notebooks from './pages/Notebooks.jsx'
import Volumes, { Vms } from './pages/Volumes.jsx'
import Mail from './pages/Mail.jsx'
import Usage from './pages/Usage.jsx'
import Help from './pages/Help.jsx'
import AdminPanel from './pages/admin/AdminPanel.jsx'
import Embed from './pages/Embed.jsx'
import Backups from './pages/Backups.jsx'
import Contributors from './pages/Contributors.jsx'
import Registration from './pages/Registration.jsx'
import { getJson } from './lib/http.js'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#\/?/, '').split('?')[0])
  useEffect(() => {
    const fn = () => setHash(window.location.hash.replace(/^#\/?/, '').split('?')[0])
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return hash
}

// /api/workgroup/exists: a signed-in user without a Profile gets the registration / no-workspace
// page instead of pages that would all fail; the admin panel and help stay reachable.
function useWorkgroup() {
  const [status, setStatus] = useState(null)
  const check = () => getJson(`/api/workgroup/exists?t=${Date.now()}`, { ttlMs: 0 }).then(r => setStatus(r.data || {}))
  useEffect(() => { check() }, [])
  return [status, check]
}

export default function App() {
  const route = useHash()
  const [wg, recheck] = useWorkgroup()
  if (wg?.hasAuth && wg.hasWorkgroup === false && !['admin-panel', 'help'].includes(route)) return <Registration status={wg} onDone={recheck} />
  switch (route) {
    case '': return <Dashboard />
    case 'notebooks': return <Notebooks />
    case 'volumes': return <Volumes />
    case 'vms': return <Vms />
    case 'mail': return <Mail />
    case 'usage': return <Usage />
    case 'help': return <Help />
    case 'admin-panel': return <AdminPanel />
    case 'embed': return <Embed />
    case 'backups': return <Backups />
    case 'manage-users': return <Contributors />
    default: return <Dashboard />
  }
}
