import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Live: create a 1Gi volume, toggle autoresize, open the file browser in-app, close it,
// then delete through the password + captcha dialog.
const G = 'https://goodarzi.isigpu.local'
const VOL = 'dorj-p2-e2e-vol'
test.setTimeout(10 * 60_000)

const api = (page, path, method = 'GET', body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: b ? JSON.stringify(b) : undefined })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, [path, method, body])
const vol = async page => ((await api(page, '/api/volumes')).json || []).find(v => v.name === VOL)

test('volume lifecycle through the UI', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  if (await vol(page)) await api(page, `/api/volumes/${VOL}`, 'DELETE', { captcha_a: 1, captcha_b: 1, captcha_answer: 2, password: process.env.E2E_PASS, force: true })
  await expect.poll(async () => !!(await vol(page)), { timeout: 120_000 }).toBe(false)

  await page.goto(`${G}/#/volumes`)
  await page.getByRole('button', { name: /ایجاد فضای ذخیره‌سازی/ }).first().click()
  await page.locator('.vl-create-modal input[placeholder="my-volume"]').fill(VOL)
  await page.locator('.vl-create-modal input[type=number]').fill('1')
  await page.locator('.vl-create-modal .vl-btn-create').click()
  await expect(page.locator('.dj-toast-success')).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => (await vol(page))?.status, { timeout: 180_000, intervals: [3000] }).toBe('Bound')

  const row = () => page.locator('tr', { hasText: VOL })
  const menu = async item => {
    await page.goto(`${G}/#/volumes`); await page.reload()
    await row().locator('.vl-menu-btn').click()
    await page.locator('.vl-menu-drop .vl-menu-item', { hasText: item }).click()
  }

  // autoresize on
  await menu('افزایش خودکار حجم')
  const ar = page.locator('.cd-modal')
  await ar.locator('input[type=checkbox]').check()
  await ar.getByRole('button', { name: 'ذخیره' }).click()
  await expect.poll(async () => (await vol(page))?.autoresize_enabled, { timeout: 30_000 }).toBe(true)

  // file browser inside the app shell
  await menu('مرور فایل‌ها')
  await expect(page).toHaveURL(/#\/embed\?u=%2Fpvcviewers%2F/, { timeout: 60_000 })
  await expect(page.locator('.app-layout .embed-frame')).toBeVisible()
  await expect.poll(async () => (await vol(page))?.has_viewer, { timeout: 30_000 }).toBe(true)

  // close the viewer
  await menu('بستن مرورگر فایل')
  await expect.poll(async () => (await vol(page))?.has_viewer, { timeout: 60_000 }).toBe(false)

  // delete: wrong captcha is rejected, right one deletes
  await menu('حذف')
  const d = page.locator('.cd-modal')
  await d.locator('input[type=password]').fill(process.env.E2E_PASS)
  const [a, b] = (await d.locator('.cd-label bdi').innerText()).split('+').map(x => Number(x.trim()))
  await d.locator('input[type=number]').fill(String(a + b + 1))
  await d.locator('.cd-danger').click()
  await expect(d.locator('.nb-form-err')).toBeVisible()
  await d.locator('input[type=number]').fill(String(a + b))
  await d.locator('.cd-danger').click()
  await expect.poll(async () => !!(await vol(page)), { timeout: 180_000, intervals: [3000] }).toBe(false)
})
