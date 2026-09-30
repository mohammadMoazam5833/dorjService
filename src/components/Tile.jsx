import Icon from './Icon.jsx'
import './Tile.css'

export default function Tile({ icon, color = 'blue', label, value, suffix, sub, small }) {
  return (
    <div className="tile">
      <div className="tile-text">
        <div className="tile-label">{label}</div>
        <div className={`tile-value ${small ? 'small' : ''}`}>
          {value}
          {suffix && <span className="suffix">{suffix}</span>}
          {sub && <div className="tile-sub">{sub}</div>}
        </div>
      </div>
      <div className={`tile-icon icon-${color}`}><Icon name={icon} size={20} /></div>
    </div>
  )
}
