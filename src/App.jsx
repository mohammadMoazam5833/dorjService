import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Notebooks from './pages/Notebooks.jsx'
import Volumes, { Vms } from './pages/Volumes.jsx'
import Mail from './pages/Mail.jsx'
import Usage from './pages/Usage.jsx'
import Help from './pages/Help.jsx'
import AdminPanel from './pages/admin/AdminPanel.jsx'
import Embed from './pages/Embed.jsx'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#\/?/, '').split('?')[0])
  useEffect(() => {
    const fn = () => setHash(window.location.hash.replace(/^#\/?/, '').split('?')[0])
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return hash
}

export default function App() {
  const route = useHash()
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
    default: return <Dashboard />
  }
}
