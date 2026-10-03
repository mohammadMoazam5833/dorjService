import { test, expect } from '@playwright/test'
import { login } from './login.js'

const G = 'https://goodarzi.isigpu.local'
const ROUTES = ['', 'notebooks', 'volumes', 'vms', 'usage', 'mail', 'help']

// Playwright's request context resolves via Node DNS (goodarzi has no DNS record yet); fetch
// inside the page uses Chrome's --host-resolver-rules and the page's own cookies.
const browserGet = (page, path) => page.evaluate(async p => {
  const r = await fetch(p, { redirect: 'manual', headers: { Accept: 'application/json' } })
  let json = null
  try { json = await r.json() } catch { json = null }
  return { status: r.status, json }
}, path)

function trackApi(page) {
  const seen = []
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin-panel/api/')) seen.push({ path: u.pathname, status: r.status() }) })
  return seen
}

test('user: every page loads real data from goodarzi', async ({ page }) => {
  const seen = trackApi(page)
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  // the SPA shell (not centraldashboard) is served on goodarzi
  await expect(page.locator('#root')).toBeAttached()
  const ns = (await browserGet(page, '/api/resource-usage')).json?.namespace
  expect(ns).toBeTruthy()
  for (const r of ROUTES) {
    await page.goto(`${G}/#/${r}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.app-layout')).toBeVisible()
  }
  await page.goto(`${G}/#/`)
  await expect(page.locator('.ns-name')).toContainText(ns)
  const fiveXX = seen.filter(s => s.status >= 500 && !s.path.startsWith('/api/mail'))
  expect(fiveXX, JSON.stringify(fiveXX)).toEqual([])
  expect(seen.some(s => s.path === '/api/notebooks' && s.status === 200)).toBe(true)
  expect(await page.evaluate(() => window.__DORJ_MOCK_API__ === true)).toBe(false)
  // admin link only for admins
  await page.locator('.uw-trigger').click()
  const adminLinks = await page.locator('a[href="#/admin-panel"]').count()
  const isAdmin = (await browserGet(page, '/admin-panel/api/admin/whoami')).status === 200
  expect(adminLinks > 0).toBe(isAdmin)
})

test('user: notebook links stay on goodarzi', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  await page.goto(`${G}/#/notebooks`)
  await page.waitForLoadState('networkidle')
  for (const href of await page.locator('a.nb-action-btn').evaluateAll(as => as.map(a => a.getAttribute('href')))) {
    expect(href.startsWith('https://platform.isigpu.local')).toBe(false)
  }
})

test('admin: admin panel lists load', async ({ page }) => {
  const seen = trackApi(page)
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await page.goto(`${G}/#/admin-panel`)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.admin-layout')).toBeVisible()
  expect(seen.some(s => s.path === '/admin-panel/api/admin/profiles' && s.status === 200)).toBe(true)
})

test('logout ends the goodarzi session', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  // the menu's sign-out goes to /oauth2/sign_out?rd=%2F; assert the cleared session without
  // following rd (prompt=none + live Keycloak SSO session would log straight back in)
  await page.locator('.uw-trigger').click()
  const [req] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/oauth2/sign_out')),
    page.locator('.uw-item.danger').click(),
  ])
  expect(new URL(req.url()).search).toBe('?rd=%2F')
  await page.goto(G + '/#/help', { waitUntil: 'commit' }).catch(() => {})
  await browserGet(page, '/oauth2/sign_out?rd=%2F')
  expect([401, 403]).toContain((await browserGet(page, '/api/resource-usage')).status)
})
