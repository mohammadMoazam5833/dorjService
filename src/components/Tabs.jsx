import './Tabs.css'

export default function Tabs({ tabs, active = 0, onSelect, main = false }) {
  return (
    <div className={`ap-tabs${main ? ' main-tabs' : ''}`}>
      {tabs.map((t, i) => (
        <div
          key={typeof t === 'string' ? t : t.key}
          className={`tab ${i === active ? 'selected' : ''}`}
          onClick={onSelect ? () => onSelect(i) : undefined}
        >
          <span>{typeof t === 'string' ? t : t.label}</span>
        </div>
      ))}
    </div>
  )
}
