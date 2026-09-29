import './Term.css'

export default function Term({ lines, minH }) {
  return (
    <div className="term" style={minH ? { minHeight: minH } : null}>
      {lines.map((l, i) => <span key={i} className={l.startsWith('$') ? 'cmd' : ''}>{l}</span>)}
    </div>
  )
}
