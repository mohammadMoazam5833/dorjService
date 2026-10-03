import { expect } from '@playwright/test'

// Drives oauth2-proxy -> Dex -> Keycloak login form and waits to land back on baseURL.
export async function login(page, baseURL, user, pass) {
  if (!user || !pass) throw new Error('E2E credentials missing (E2E_USER/E2E_PASS or E2E_ADMIN_USER/E2E_ADMIN_PASS)')
  await page.goto(baseURL + '/', { waitUntil: 'commit' })
  // dorj-v2 theme keeps #username hidden (filled from a visible local-part field + "@isigpu.local"),
  // so drive the visible inputs of the form that holds the password field.
  const pw = page.locator('input[type="password"]:visible').first()
  await pw.waitFor({ timeout: 30_000 })
  const form = page.locator('form', { has: pw })
  await form.locator('input:visible:not([type="password"]):not([type="hidden"]):not([type="checkbox"])').first().fill(user)
  await pw.fill(pass)
  await pw.press('Enter')
  await page.waitForURL(u => u.origin === new URL(baseURL).origin, { timeout: 45_000, waitUntil: 'commit' })
  await expect(page).not.toHaveURL(/\/oauth2\/|\/dex\//)
}
