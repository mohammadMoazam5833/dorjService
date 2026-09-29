import './Chip.css'

export function Chip({ on = false, onClick, children, style }) {
  return (
    <span
      className={`chip ${on ? 'on' : ''}`}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
    >
      {children}
    </span>
  )
}

export function ChipRow({ children }) {
  return <div className="chip-row">{children}</div>
}
