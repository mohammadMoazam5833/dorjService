import { expect } from '@playwright/test'

// Drives oauth2-proxy -> Dex -> Keycloak (#username/#password) and waits to land back on baseURL.
export async function login(page, baseURL, user, pass) {
  if (!user || !pass) throw new Error('E2E credentials missing (E2E_USER/E2E_PASS or E2E_ADMIN_USER/E2E_ADMIN_PASS)')
  await page.goto(baseURL + '/')
  await page.locator('#username').waitFor({ timeout: 30_000 })
  await page.locator('#username').fill(user)
  await page.locator('#password').fill(pass)
  await page.locator('#password').press('Enter')
  await page.waitForURL(u => u.origin === new URL(baseURL).origin, { timeout: 45_000 })
  await expect(page).not.toHaveURL(/\/oauth2\/|\/dex\//)
}
