import { useEffect, useState } from 'react'

let cached = null
const subs = new Set()

export function useBranding() {
  const [b, setB] = useState(cached)
  useEffect(() => {
    if (cached) return
    fetch('/api/branding').then(r => r.json()).then(j => {
      cached = j || {}
      if (cached.primary_color) {
        document.documentElement.style.setProperty('--nav-active', cached.primary_color)
      }
      if (cached.display_name) document.title = cached.display_name
      if (cached.favicon_data_uri) {
        const link = document.querySelector('link[rel="icon"]')
        if (link) link.href = cached.favicon_data_uri
      }
      subs.forEach(f => f(cached))
    }).catch(() => {})
  }, [])
  useEffect(() => {
    const fn = v => setB(v)
    subs.add(fn)
    return () => subs.delete(fn)
  }, [])
  return b || {}
}
