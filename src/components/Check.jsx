import './Check.css'

export default function Check({ on = false }) {
  return <span className={`checkbox ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
}
