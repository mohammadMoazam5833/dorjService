import './Button.css'

export default function Button({ variant = 'primary', children, ...p }) {
  return <button className={`btn btn-${variant}`} {...p}>{children}</button>
}
