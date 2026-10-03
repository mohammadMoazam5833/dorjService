import { test, expect } from '@playwright/test'
import { login } from './login.js'

const G = 'https://goodarzi.isigpu.local'
// Throwaway contributor on the test user's own profile: added, then removed again.
const C = `e2e-contrib-${Date.now().toString(36)}@example.invalid`

test('manage contributors: memberships load, add and remove a throwaway contributor', async ({ page }) => {
  test.setTimeout(150_000)
  const bad = []
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/workgroup/') && r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`) })
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  await expect(page.locator('.rg-card')).toHaveCount(0)
  await page.goto(`${G}/#/manage-users`)
  await expect(page.locator('.ak-card h2', { hasText: 'اطلاعات حساب' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.ak-card td', { hasText: 'مالک' })).toBeVisible({ timeout: 30_000 })
  const card = page.locator('.ak-card', { has: page.locator('h2', { hasText: 'همکاران' }) }).first()
  await expect(card.locator('.ct-chips')).toBeVisible({ timeout: 30_000 })
  await card.locator('input[type=email]').fill(C)
  await card.getByRole('button', { name: 'افزودن همکار' }).click()
  const chip = card.locator('.ct-chip', { hasText: C })
  await expect(chip).toBeVisible({ timeout: 60_000 })
  await chip.locator('button').click()
  await page.locator('.cd-modal .cd-danger').click()
  await expect(chip).toHaveCount(0, { timeout: 60_000 })
  expect(bad, bad.join('\n')).toEqual([])
})
