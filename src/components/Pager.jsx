import './Pager.css'

export default function Pager() {
  return (
    <nav className="pager" aria-label="صفحه‌بندی">
      <button className="pg-btn" type="button" aria-label="صفحه قبل">‹</button>
      <span className="pg-info">۱ / ۱</span>
      <button className="pg-btn" type="button" aria-label="صفحه بعد">›</button>
    </nav>
  )
}
