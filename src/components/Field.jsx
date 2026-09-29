import './Field.css'

export function Input({ value = '', ph, select, onWhite }) {
  return (
    <div className={`input${onWhite ? ' on-white' : ''}${select ? ' select' : ''}`}>
      <span className={ph && !value ? 'ph' : ''}>{value || ph || ''}</span>
    </div>
  )
}

export function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

export function FieldsRow({ children }) {
  return <div className="fields-row">{children}</div>
}

export function Actions({ children }) {
  return <div className="actions">{children}</div>
}
