import React from 'react'
import { getJson, send, invalidate } from './http.js'

export { invalidate }

export async function api(path, fallback = null) {
  const { data, error } = await getJson(path)
  return error ? fallback : data
}

export function apiPost(path, body) {
  return send(path, { method: 'POST', body })
}

export function apiSend(path, method, body) {
  return send(path, { method, body })
}

const identity = x => x

export function useApi(path, fallback = null, deps = [], adapt = identity) {
  const [state, setState] = React.useState({ data: fallback, loading: !!path, error: null })
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!path) { setState({ data: fallback, loading: false, error: null }); return }
    let alive = true
    setState(s => ({ ...s, loading: true }))
    getJson(path).then(({ data, error }) => {
      if (!alive) return
      setState({ data: error ? fallback : adapt(data), loading: false, error })
    })
    return () => { alive = false }
  }, [path, tick, ...deps])
  const reload = React.useCallback(() => { invalidate(path || ''); setTick(t => t + 1) }, [path])
  return { ...state, reload }
}
