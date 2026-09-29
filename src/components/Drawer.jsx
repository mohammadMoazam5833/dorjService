import { useBranding } from '../lib/branding.js'
import Icon from './Icon.jsx'
import './Drawer.css'

const ITEMS = [
  { label: 'خانه', icon: 'home', route: '' },
  { label: 'نوت‌بوک‌ها', icon: 'book', route: 'notebooks' },
  { label: 'فضاهای ذخیره‌سازی', icon: 'storage', route: 'volumes' },
]

export default function Drawer({ active }) {
  const brand = useBranding()
  const logo = brand.logo_data_uri || '/img/logo.png'
  return (
    <aside className="drawer">
      <figure className="logo"><img src={logo} alt="دُرج" /></figure>
      <div className="scrollable">
        {ITEMS.map(it => (
          <a key={it.label} href={`#/${it.route}`}>
            <div className={`menu-item ${active === it.label ? 'iron-selected' : ''}`}>
              <Icon name={it.icon} size={19} />
              <span>{it.label}</span>
            </div>
          </a>
        ))}
      </div>
    </aside>
  )
}
