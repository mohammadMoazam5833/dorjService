import './Card.css'

export default function Card({ title, children, className = '', ...p }) {
  return (
    <div className={`ap-card ${className}`} {...p}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  )
}

export function Hint({ children }) {
  return <div className="hint">{children}</div>
}
