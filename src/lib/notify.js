// One shared toast for every mutating action (success or failure), appended to <body>.
let host = null
function ensureHost() {
  if (host && document.body.contains(host)) return host
  host = document.createElement('div')
  host.className = 'dj-toasts'
  host.setAttribute('aria-live', 'polite')
  document.body.appendChild(host)
  return host
}
function show(kind, message, ms) {
  const el = document.createElement('div')
  el.className = `dj-toast dj-toast-${kind}`
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  el.dir = 'auto'
  el.textContent = message
  ensureHost().appendChild(el)
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250) }, ms)
}
export const notifySuccess = m => show('success', m, 3500)
export const notifyError = m => show('error', m, 6500)
