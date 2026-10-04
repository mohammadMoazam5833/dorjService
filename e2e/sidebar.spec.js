import { test, expect } from '@playwright/test'
import { login } from './login.js'

const P = 'https://platform.isigpu.local'

// Sidebar: every destination, the account foot (preferences, password dialog), collapse state.
test('sidebar destinations, account panel and collapse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, P, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await page.goto(`${P}/#/`)
  await page.evaluate(() => localStorage.removeItem('dorj.drawer.mini'))
  await page.reload()
  for (const route of ['notebooks', 'volumes', 'vms', 'backups', 'usage', 'mail', 'manage-users', 'admin-panel']) {
    await page.locator(`.drawer a[href="#/${route}"]`).click()
    await expect(page).toHaveURL(new RegExp(`#/${route}`))
    await expect(page.locator(`.drawer a[href="#/${route}"] .menu-item`)).toHaveClass(/iron-selected/)
  }
  await expect(page.locator('.drawer a[href="#/help"]')).toHaveCount(0)
  // account popover: Persian digits switch round-trips, password dialog opens/closes
  await page.locator('.acc-who').click()
  const digits = page.locator('.acc-pop [role="switch"]').first()
  const before = await digits.getAttribute('aria-checked')
  await digits.click()
  await expect(digits).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
  await digits.click()
  await expect(digits).toHaveAttribute('aria-checked', before)
  await page.locator('.acc-pop .acc-row', { hasText: 'تغییر گذرواژه' }).click()
  await expect(page.locator('.uw-modal')).toBeVisible()
  await page.locator('.uw-modal .uw-btn-sec').click()
  // collapse keeps a narrow rail with just the logo's first letter, and survives a reload
  await page.locator('.drawer-toggle').click()
  await expect(page.locator('.drawer')).toHaveClass(/mini/)
  await page.reload()
  await expect(page.locator('.drawer')).toHaveClass(/mini/)
  const crop = await page.locator('.drawer-head .logo > span').boundingBox()
  expect(crop.width).toBeLessThanOrEqual(40)
  await page.locator('.drawer-toggle').click()
  await expect(page.locator('.drawer')).not.toHaveClass(/mini/)
})
