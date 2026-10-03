import React from 'react'
import { getJson, send } from './http.js'

// Identity comes from the real backends; the namespace is whatever Profile the user owns
// (kubeflow-resource-usage resolve_namespace()), there is no ?ns= switch server-side.
export const LOGOUT_URL = '/oauth2/sign_out?rd=%2F'

export async function loadSession() {
  const [who, ru, adm] = await Promise.all([
    getJson('/api/change-password/whoami'),
    getJson('/api/resource-usage'),
    getJson('/admin-panel/api/admin/whoami'),
  ])
  return {
    email: who.data?.email || null,
    namespace: ru.data?.namespace || null,
    isAdmin: !adm.error && !!adm.data?.email,
    error: who.error || ru.error || null,
  }
}

export function initialsOf(email) {
  const s = (email || '').split('@')[0].replace(/[^A-Za-z؀-ۿ]/g, '')
  return s ? s.slice(0, 2).toUpperCase() : '?'
}

export async function changePassword(currentPassword, newPassword) {
  const { data, error } = await send('/api/change-password', { body: { currentPassword, newPassword } })
  if (error) return { ok: false, message: error.message }
  return { ok: data?.status === 'ok', message: data?.status === 'ok' ? '' : 'پاسخ نامعتبر از سرور' }
}

let memo = null
export function useSession() {
  const [s, setS] = React.useState({ email: null, namespace: null, isAdmin: false, loading: true, error: null })
  React.useEffect(() => {
    let alive = true
    memo = memo || loadSession()
    memo.then(v => { if (alive) setS({ ...v, loading: false }) })
    return () => { alive = false }
  }, [])
  return s
}
