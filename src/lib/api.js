const cache = new Map()

export async function api(path, fallback = null) {
  if (cache.has(path)) return cache.get(path)
  try {
    const r = await fetch(path, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json()
    cache.set(path, j)
    return j
  } catch {
    return fallback
  }
}

export async function apiPost(path, body) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    return await r.json().catch(() => ({}))
  } catch {
    return {}
  }
}

export function useApi(path, fallback = null, deps = []) {
  const [state, setState] = React.useState({ data: null, loading: true })
  React.useEffect(() => {
    let alive = true
    api(path, fallback).then(d => { if (alive) setState({ data: d, loading: false }) })
    return () => { alive = false }
  }, deps)
  return state
}

import React from 'react'
