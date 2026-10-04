import { test, expect } from '@playwright/test'

// Keycloak dorj-v3 login page: the documentation panel opens, filters and closes, desktop + phone.
test('phones get only the sign-in panel (no top bar, docs or hero)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('https://platform.isigpu.local/')
  await expect(page.locator('input[type=password]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.lg-topbar')).toBeHidden()
  await expect(page.locator('.lg-brand')).toBeHidden()
})

for (const [w, h, tag] of [[1440, 900, 'desktop'], [820, 1180, 'tablet']]) test(`login page documentation panel (${tag})`, async ({ page }) => {
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.setViewportSize({ width: w, height: h })
  await page.goto('https://platform.isigpu.local/')
  await expect(page.locator('#lg-docs')).toBeHidden({ timeout: 30_000 })
  await page.locator('[data-docs-open]').click()
  await expect(page.locator('#lg-docs')).toBeVisible()
  await expect(page.locator('.lg-docs-sec')).toHaveCount(7)
  const sec = page.locator('.lg-docs-sec').nth(2)
  await sec.locator('summary').click()
  // the opened section's text stays inside its card
  const [card, para] = await Promise.all([sec.boundingBox(), sec.locator('p').boundingBox()])
  expect(para.x).toBeGreaterThanOrEqual(card.x - 1)
  expect(para.x + para.width).toBeLessThanOrEqual(card.x + card.width + 1)
  await page.locator('#lg-docs-search').fill('GPU')
  expect(await page.locator('.lg-docs-sec:not([hidden])').count()).toBeLessThan(7)
  await page.keyboard.press('Escape')
  await expect(page.locator('#lg-docs')).toBeHidden()
  expect(errs).toEqual([])
})
