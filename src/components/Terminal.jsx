import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

// Browser terminal over kubeflow-resource-usage's websockets (/ws/notebook-console/<name>,
// /ws/vm-console/<name>); same-origin, so the oauth2-proxy cookie authenticates it.
export function wsUrl(path) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${path}`
}

const MAX_RETRIES = 3

export default function Terminal({ path }) {
  const box = useRef(null)
  const [state, setState] = useState('connecting')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const term = new XTerm({ convertEol: true, fontFamily: 'Menlo, Consolas, monospace', fontSize: 12, cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' } })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(box.current)
    fit.fit()
    const onResize = () => fit.fit()
    window.addEventListener('resize', onResize)
    let closedByUs = false
    let retryTimer
    const ws = new WebSocket(wsUrl(path))
    ws.onopen = () => { setState('open'); term.focus() }
    ws.onmessage = ev => term.write(typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data))
    ws.onclose = () => {
      if (closedByUs) return
      if (attempt < MAX_RETRIES) {
        term.write(`\r\n\x1b[33m[اتصال قطع شد؛ تلاش دوباره ${attempt + 1}/${MAX_RETRIES}…]\x1b[0m\r\n`)
        retryTimer = setTimeout(() => setAttempt(a => a + 1), 2000)
      } else {
        setState('closed')
        term.write('\r\n\x1b[31m[اتصال بسته شد.]\x1b[0m\r\n')
      }
    }
    ws.binaryType = 'arraybuffer'
    const sub = term.onData(d => { if (ws.readyState === WebSocket.OPEN) ws.send(d) })
    return () => {
      closedByUs = true
      clearTimeout(retryTimer)
      sub.dispose(); ws.close(); term.dispose()
      window.removeEventListener('resize', onResize)
    }
  }, [path, attempt])

  return (
    <div className="dj-term">
      <div ref={box} className="dj-term-box" dir="ltr" />
      {state === 'closed' && (
        <button className="cd-btn" style={{ marginTop: 8 }} onClick={() => { setState('connecting'); setAttempt(0) }}>اتصال دوباره</button>
      )}
    </div>
  )
}
