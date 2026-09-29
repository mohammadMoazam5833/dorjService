import './Search.css'

export default function Search({ ph = 'Search...', value, onChange }) {
  return <input className="ap-search" placeholder={ph} value={value} onChange={e => onChange && onChange(e.target.value)} />
}
