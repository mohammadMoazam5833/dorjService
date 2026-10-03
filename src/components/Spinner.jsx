import './Spinner.css'

// One animated busy indicator for the whole app, in place of "در حال …" texts. `label` is read by
// screen readers (and shown as a tooltip); `text` also shows it visibly next to the ring.
export default function Spinner({ label = 'در حال بارگذاری', size = 16, text = false, className = '' }) {
  return (
    <span className={`dj-spin-wrap ${className}`} role="status" aria-live="polite" title={label}>
      <svg className="dj-spin" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
        <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {text ? <span className="dj-spin-text">{label}</span> : <span className="dj-sr">{label}</span>}
    </span>
  )
}

// Block-level placeholder while a page, card or table loads.
export function Loading({ label = 'در حال بارگذاری', size = 28, minHeight = 120 }) {
  return (
    <div className="dj-loading" style={{ minHeight }}>
      <Spinner label={label} size={size} />
    </div>
  )
}
