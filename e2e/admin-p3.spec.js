import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Admin tabs against live data. Only reversible changes on objects the test creates itself
// (a throwaway group); nothing on real users/profiles is saved.
const G = 'https://goodarzi.isigpu.local'
const GROUP = 'dorj-p3-e2e-group'
test.setTimeout(5 * 60_000)

const api = (page, path, method = 'GET', body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: b ? JSON.stringify(b) : undefined })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, [path, method, body])

async function openTab(page, label) {
  await page.goto(`${G}/#/admin-panel`)
  await page.locator('.asn-item', { hasText: label }).first().click()
}

test('users, profiles, access load real data', async ({ page }) => {
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await openTab(page, 'کاربران')
  await expect(page.locator('.ak-table tbody tr').first()).toBeVisible()
  await page.locator('.ak-search').fill('clusteradmin')
  await expect(page.locator('.ak-table tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: '+ افزودن کاربر' }).click()
  await expect(page.locator('.ak-steps')).toBeVisible()
  await page.locator('.ak-modal').getByRole('button', { name: 'انصراف' }).click()

  await openTab(page, 'مدیریت پروفایل‌ها')
  await expect(page.locator('.ak-table tbody tr').first()).toBeVisible()
  await page.locator('.ak-table tbody tr').first().getByRole('button', { name: 'ویرایش' }).click()
  await expect(page.getByRole('heading', { name: /ویرایش پروفایل/ })).toBeVisible()
  for (const st of ['Kubeconfig', 'انتشار پورت', 'OpenHands', 'ماشین مجازی', 'آپلود', 'تاریخچه‌ی SLA']) {
    await page.locator('.ak-tabs button', { hasText: st }).click()
    await expect(page.locator('.ak-card h3').last()).toBeVisible()
  }
  await page.getByRole('button', { name: 'انصراف' }).last().click()
  await page.locator('.ak-tabs button', { hasText: 'نودهای SLA' }).click()
  await expect(page.locator('.ak-card h2', { hasText: 'نودهای SLA' })).toBeVisible()

  await openTab(page, 'دسترسی‌ها')
  await expect(page.locator('.ak-table tbody tr').first()).toBeVisible()
  await expect(page.locator('.ak-sub strong', { hasText: 'فضای مشترک مدل‌ها' })).toBeVisible()
})

test('groups: create, members dialog, delete a throwaway group', async ({ page }) => {
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  const existing = ((await api(page, '/admin-panel/api/admin/groups')).json || []).find(g => g.name === GROUP)
  if (existing) await api(page, `/admin-panel/api/admin/groups/${existing.id}`, 'DELETE')
  await openTab(page, 'گروه‌ها')
  await page.locator('input[placeholder="gpu-team"]').fill(GROUP)
  await page.getByRole('button', { name: 'ساخت', exact: true }).click()
  await expect(page.locator('.dj-toast-success').last()).toBeVisible()
  await page.locator('.ak-search').fill(GROUP)
  const row = page.locator('tr', { hasText: GROUP })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'اعضا' }).click()
  await expect(page.locator('.ak-modal .ak-check').first()).toBeVisible()
  await page.locator('.ak-modal').getByRole('button', { name: 'انصراف' }).click()
  await row.getByRole('button', { name: 'حذف' }).click()
  await page.locator('.cd-modal .cd-danger').click()
  await expect.poll(async () => ((await api(page, '/admin-panel/api/admin/groups')).json || []).some(g => g.name === GROUP), { timeout: 30_000 }).toBe(false)
})
