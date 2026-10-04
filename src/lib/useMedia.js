import { useSyncExternalStore } from 'react'

// Phone/tablet layout switch (matches the 860px breakpoint in the CSS).
const QUERY = '(max-width: 860px)'
const subscribe = cb => { const m = window.matchMedia(QUERY); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
export const useIsMobile = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
