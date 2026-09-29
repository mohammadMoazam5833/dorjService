import './Section.css'

export default function Section({ title, actions, children, className = '' }) {
  return (
    <div className={`section ${className}`}>
      <div className="section-head">
        <div className="section-title">{title}</div>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
