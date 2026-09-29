import './Badge.css'

export default function Badge({ ok = false, children }) {
  return <span className={`badge ${ok ? 'badge-success' : 'badge-neutral'}`}>{children}</span>
}
