import './Table.css'

export function Cell(label, align, jsx) {
  return { label, align, jsx }
}

export default function Table({ cols, rows, empty }) {
  if (!rows || rows.length === 0) {
    return empty || <div className="hint" style={{ padding: '20px 0' }}>موردی یافت نشد.</div>
  }
  return (
    <div className="ap-table-scroll">
      <table className="ap-table">
        <thead>
          <tr>{cols.map((c, i) => <th key={i} className={c.align || ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c, j) => (
                <td key={j} className={c.align || ''}>{typeof r[j] === 'object' ? r[j].jsx : r[j]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
