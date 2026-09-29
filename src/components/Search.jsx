import './Search.css'

export default function Search({ ph = 'جستجو…', value, onChange }) {
  return <input className="ap-search" placeholder={ph} value={value} onChange={e => onChange && onChange(e.target.value)} />
}
