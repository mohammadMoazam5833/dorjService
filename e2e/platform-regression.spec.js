import { test, expect } from '@playwright/test'
import { login } from './login.js'

const PLATFORM = 'https://platform.isigpu.local'

test('platform.isigpu.local: login, home and API still work', async ({ page }) => {
  await login(page, PLATFORM, process.env.E2E_USER, process.env.E2E_PASS)
  const ru = await page.request.get(PLATFORM + '/api/resource-usage')
  expect(ru.status()).toBe(200)
  expect((await ru.json()).namespace).toBeTruthy()
  const nb = await page.request.get(PLATFORM + '/api/notebooks')
  expect(nb.status()).toBe(200)
  // since the 2026-10-04 cutover (k8s-deploy script 138) dorj-service owns "/" on platform too
  const home = await page.request.get(PLATFORM + '/')
  expect(home.status()).toBe(200)
  expect(await home.text()).toContain('<div id="root"></div>')
  // the kubeflow web apps still load centraldashboard's shared lib from the platform root
  expect((await page.request.get(PLATFORM + '/dashboard_lib.bundle.js')).status()).toBe(200)
})

test('platform.isigpu.local: React pages load real data and old Polymer URLs redirect', async ({ page }) => {
  test.setTimeout(150_000)
  const bad = []
  page.on('response', r => { const u = new URL(r.url()); if (u.host === 'platform.isigpu.local' && u.pathname.startsWith('/api/') && r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`) })
  await login(page, PLATFORM, process.env.E2E_USER, process.env.E2E_PASS)
  await page.goto(PLATFORM + '/')
  await expect(page.locator('#root aside, #root nav').first()).toBeVisible({ timeout: 30_000 })
  for (const [path, hash] of [['/_/jupyter/', '#/notebooks'], ['/_/volumes/', '#/volumes'], ['/_/vms/', '#/vms'], ['/admin-panel', '#/admin-panel']]) {
    await page.goto(PLATFORM + path)
    await expect(page).toHaveURL(PLATFORM + '/' + hash)
    await expect(page.locator('#root nav').first()).toBeVisible({ timeout: 30_000 })
  }
  await page.goto(PLATFORM + '/#/notebooks')
  await expect(page.locator('table tbody tr, .nb-empty').first()).toBeVisible({ timeout: 60_000 })
  expect(bad, bad.join('\n')).toEqual([])
})

test('platform.isigpu.local: sign_out clears the session', async ({ page }) => {
  await login(page, PLATFORM, process.env.E2E_USER, process.env.E2E_PASS)
  // sign_out clears the oauth2-proxy session cookie; following rd=/ would silently log back in
  // (prompt=none + live Keycloak SSO session), so only the cleared session is asserted.
  const so = await page.request.get(PLATFORM + '/oauth2/sign_out?rd=%2F', { maxRedirects: 0 })
  expect([302, 303]).toContain(so.status())
  const r = await page.request.get(PLATFORM + '/api/resource-usage', { maxRedirects: 0 })
  expect([401, 403]).toContain(r.status())
})
