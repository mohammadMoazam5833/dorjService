import { createContext, useContext, useState, useEffect } from 'react'
import { fmt, rial, usd } from './format.js'

const STORAGE_KEY = 'dorj_prefs'

export const DEFAULTS = {
  digits:   'latin',    // 'latin' | 'persian'
  calendar: 'jalali',   // 'jalali' | 'gregorian'
  currency: 'rial',
  lang:     'fa',       // 'fa' | 'en'
}

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } }
  catch { return DEFAULTS }
}

const Ctx = createContext(null)

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load)

  const update = patch => setPrefs(p => {
    const next = { ...p, ...patch }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    return next
  })

  useEffect(() => {
    document.documentElement.dir  = prefs.lang === 'en' ? 'ltr' : 'rtl'
    document.documentElement.lang = prefs.lang
  }, [prefs.lang])

  return <Ctx.Provider value={{ prefs, update }}>{children}</Ctx.Provider>
}

export const usePrefs = () => useContext(Ctx)

// Formatting helpers bound to current preferences
export function useFmt() {
  const ctx = usePrefs()
  const prefs = ctx?.prefs ?? DEFAULTS
  return {
    date:  iso => fmt.date(iso, { calendar: prefs.calendar, digits: prefs.digits }),
    short: iso => fmt.dateShort(iso, { calendar: prefs.calendar }),
    num:   (n, dec = 0) => n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: dec }),
    rial,
    usd,
    prefs,
  }
}
