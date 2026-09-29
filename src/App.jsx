import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Notebooks from './pages/Notebooks.jsx'
import Volumes, { Vms } from './pages/Volumes.jsx'
import Mail from './pages/Mail.jsx'
import Usage from './pages/Usage.jsx'
import Help from './pages/Help.jsx'
import Login from './pages/Login.jsx'
import AdminPanel from './pages/admin/AdminPanel.jsx'
import UserWidget from './components/UserWidget.jsx'
import ResourcesWidget from './components/ResourcesWidget.jsx'

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
  let page
  switch (route) {
    case '': page = <Dashboard />; break
    case 'notebooks': page = <Notebooks />; break
    case 'volumes': page = <Volumes />; break
    case 'vms': page = <Vms />; break
    case 'mail': page = <Mail />; break
    case 'usage': page = <Usage />; break
    case 'help': page = <Help />; break
    case 'admin-panel': page = <AdminPanel />; break
    case 'login': page = <Login />; break
    default: page = <Dashboard />
  }
  const bare = route === 'login'
  return (
    <>
      {page}
      {!bare && <UserWidget />}
      {!bare && <ResourcesWidget />}
    </>
  )
}
