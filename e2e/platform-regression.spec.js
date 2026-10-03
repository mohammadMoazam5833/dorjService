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
  // centraldashboard (not dorj-service) must still own "/" on platform
  const home = await page.request.get(PLATFORM + '/')
  expect(home.status()).toBe(200)
  expect(await home.text()).not.toContain('<div id="root"></div>')
})

test('platform.isigpu.local: sign_out clears the session', async ({ page }) => {
  await login(page, PLATFORM, process.env.E2E_USER, process.env.E2E_PASS)
  await page.goto(PLATFORM + '/oauth2/sign_out?rd=%2F')
  const r = await page.request.get(PLATFORM + '/api/resource-usage', { maxRedirects: 0 })
  expect([401, 403]).toContain(r.status())
})
