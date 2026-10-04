import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Sign-out ends the Keycloak SSO session (not only oauth2-proxy's cookie): after confirming, the
// app asks for the password again instead of silently signing back in.
for (const host of ['https://platform.isigpu.local', 'https://goodarzi.isigpu.local']) test(`sign out really signs out (${new URL(host).host})`, async ({ page }) => {
  await login(page, host, process.env.E2E_USER, process.env.E2E_PASS)
  await page.locator('.acc-logout').click()
  await page.waitForURL(/identity\.isigpu\.local\/realms\/dorj\/protocol\/openid-connect\/logout/)
  await expect(page.getByText('نامعتبر')).toHaveCount(0)
  await page.locator('input[type=submit], button[type=submit]').first().click()
  await page.goto(`${host}/#/notebooks`)
  await expect(page.locator('input[type=password]')).toBeVisible({ timeout: 30_000 })
})
