import AppShell from '../components/AppShell.jsx'

// Same-origin in-cluster apps (Jupyter at /notebook/..., the volume file viewer at
// /pvcviewers/...) open inside the app shell, never as a new browser tab.
const ALLOWED = /^\/(notebook|pvcviewers)\//

export function openInApp(url, title = '') {
  if (!url || !ALLOWED.test(url)) return
  window.location.hash = `#/embed?u=${encodeURIComponent(url)}&t=${encodeURIComponent(title)}`
}

export default function Embed() {
  const qs = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const url = qs.get('u') || ''
  const title = qs.get('t') || ''
  const ok = ALLOWED.test(url)
  return (
    <AppShell active="">
      <div className="embed-view">
        <div className="embed-bar">
          <button className="cd-btn" onClick={() => window.history.back()}>‹ بازگشت</button>
          <bdi dir="ltr" className="embed-title">{title || url}</bdi>
        </div>
        {ok ? <iframe className="embed-frame" title={title || 'app'} src={url} /> : <p style={{ padding: 24 }}>آدرس نامعتبر است.</p>}
      </div>
    </AppShell>
  )
}
