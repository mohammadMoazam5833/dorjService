import './Dialog.css'

export default function Dialog({ title, children }) {
  return (
    <div className="overlay" dir="rtl">
      <div className="dialog">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
