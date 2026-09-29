import { createRoot } from 'react-dom/client'
import { installMockApi } from './lib/mock.js'
import { PrefsProvider } from './lib/prefs.jsx'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/pages.css'

installMockApi()

createRoot(document.getElementById('root')!).render(
  <PrefsProvider>
    <App />
  </PrefsProvider>
)
