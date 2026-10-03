import { createRoot } from 'react-dom/client'
import { PrefsProvider } from './lib/prefs.jsx'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/pages.css'
import './components/ConfirmDialog.css'

// Design-time mock API only under `vite dev`; production talks to the real backends.
const ready: Promise<unknown> = import.meta.env.DEV
  ? import('./lib/mock.js').then(m => m.installMockApi())
  : Promise.resolve()

ready.then(() => {
  createRoot(document.getElementById('root')!).render(
    <PrefsProvider>
      <App />
    </PrefsProvider>
  )
})
