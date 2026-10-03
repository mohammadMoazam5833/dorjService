// Kubeflow workgroup (profile membership) helpers for the contributors page and the
// no-workspace/registration gate; rules mirror the platform's centraldashboard api_workgroup.ts.
const EMAIL_RGX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
export const isEmail = s => EMAIL_RGX.test(String(s || ''))
export const validNamespace = s => /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(String(s || ''))
export const suggestNamespace = user => String(user || '').replace(/[^\w]|\./g, '-').replace(/^-+|-+$|_/g, '').toLowerCase()

export function roleBreakdown(namespaces) {
  return ['owner', 'contributor', 'viewer']
    .map(role => ({ role, namespaces: (namespaces || []).filter(n => n.role === role).map(n => n.namespace) }))
    .filter(r => r.namespaces.length)
}
