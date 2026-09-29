import './Chip.css'

export function Chip({ on = false, children }) {
  return <span className={`chip ${on ? 'on' : ''}`}>{children}</span>
}

export function ChipRow({ children }) {
  return <div className="chip-row">{children}</div>
}
