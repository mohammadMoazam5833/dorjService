import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Admin tabs against live data. Only reversible changes on objects the test creates itself
// (a throwaway group); nothing on real users/profiles is saved.
const G = 'https://goodarzi.isigpu.local'
const GROUP = `dorj-p3-e2e-${Date.now().toString(36)}`
test.setTimeout(5 * 60_000)

const api = (page, path, method = 'GET', body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: b ? JSON.stringify(b) : undefined })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, [path, method, body])

async function openTab(page, label) {
  await page.goto(`${G}/#/admin-panel`)
  await page.locator('.asn-item', { hasText: new RegExp(`^\s*${label}\s*$`) }).first().click()
}

test('users, profiles, access load real data', async ({ page }) => {
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await openTab(page, 'کاربران')
  await expect(page.locator('.ak-table tbody tr').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('.ak-search').fill('clusteradmin')
  await expect(page.locator('.ak-table tbody tr')).toHaveCount(1, { timeout: 30_000 })
  await page.getByRole('button', { name: '+ افزودن کاربر' }).click()
  await expect(page.locator('.ak-steps')).toBeVisible()
  await page.locator('.ak-modal').getByRole('button', { name: 'انصراف' }).click()

  await openTab(page, 'مدیریت پروفایل‌ها')
  await expect(page.locator('.ak-table tbody tr').first()).toBeVisible({ timeout: 30_000 })
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
  await expect(page.locator('.ak-table tbody tr').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.ak-sub strong', { hasText: 'فضای مشترک مدل‌ها' })).toBeVisible()
})

test('groups: create, members dialog, delete a throwaway group', async ({ page }) => {
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  const existing = ((await api(page, '/admin-panel/api/admin/groups')).json || []).find(g => g.name === GROUP)
  if (existing) await api(page, `/admin-panel/api/admin/groups/${existing.id}`, 'DELETE')
  await openTab(page, 'گروه‌ها')
  await page.locator('input[placeholder="gpu-team"]').fill(GROUP)
  await page.getByRole('button', { name: 'ساخت', exact: true }).click()
  await expect(page.locator('.dj-toast-success').last()).toBeVisible({ timeout: 30_000 })
  await page.locator('.ak-search').fill(GROUP)
  const row = page.locator('tr', { hasText: GROUP })
  await expect(row).toBeVisible({ timeout: 60_000 })
  await row.getByRole('button', { name: 'اعضا' }).click()
  await expect(page.locator('.ak-modal .ak-check').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('.ak-modal').getByRole('button', { name: 'انصراف' }).click()
  await row.getByRole('button', { name: 'حذف' }).click()
  await page.locator('.cd-modal .cd-danger').click()
  await expect.poll(async () => ((await api(page, '/admin-panel/api/admin/groups')).json || []).some(g => g.name === GROUP), { timeout: 30_000 }).toBe(false)
})

// Read-only on purpose: these tabs hold platform-wide settings (branding, SMTP, pricing, keys).
test('notebook options, branding, settings, broadcast, requests load', async ({ page }) => {
  const bad = []
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/admin-panel/api/') && r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`) })
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await openTab(page, 'تنظیمات نوت‌بوک')
  await expect(page.locator('.ak-card h2', { hasText: 'ایمیج‌های نوت‌بوک' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.ak-card input.ak-input').first()).toHaveValue(/.+/)
  await openTab(page, 'ظاهر پلتفرم')
  await expect(page.locator('.ak-card h2', { hasText: 'ظاهر پلتفرم' })).toBeVisible()
  await openTab(page, 'تنظیمات')
  for (const st of ['قیمت‌گذاری', 'SMTP', 'پیام صفحه‌ی ورود', 'Active Directory', 'نشست‌ها', 'آپلود', 'ورودهای ناموفق']) {
    await page.locator('.ak-tabs button', { hasText: st }).click()
    await expect(page.locator('.ak-card h2').first()).toBeVisible({ timeout: 30_000 })
  }
  await openTab(page, 'ارسال گروهی ایمیل')
  for (const st of ['ارسال گروهی', 'دسته‌ها', 'ارسال مستقیم', 'تاریخچه']) {
    await page.locator('.ak-tabs button', { hasText: st }).click()
    await expect(page.locator('.ak-card h2').first()).toBeVisible()
  }
  await openTab(page, 'درخواست‌ها')
  await expect(page.locator('.ak-checks .ak-check').first()).toBeVisible({ timeout: 30_000 })
  await page.locator('.ak-tabs button', { hasText: 'کلیدهای LLM' }).click()
  await expect(page.locator('.ak-table')).toBeVisible({ timeout: 30_000 })
  await page.locator('.ak-tabs button', { hasText: 'درخواست‌های انتشار سرویس' }).click()
  await expect(page.locator('.ak-table')).toBeVisible({ timeout: 30_000 })
  expect(bad, bad.join('\n')).toEqual([])
})

// Read-only on purpose: model lifecycle, gateway routes, rate limits and GPU bindings are live cluster state.
test('models, gateway, rate limits, gpu management load', async ({ page }) => {
  const bad = []
  page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/admin-panel/api/') && r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`) })
  await login(page, G, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  const sub = name => page.locator('.ak-tabs button').filter({ hasText: new RegExp(`^${name}$`) })
  await openTab(page, 'مدل‌ها')
  await expect(page.locator('.md-grid .md-tile, .md-grid > *').first()).toBeVisible({ timeout: 60_000 })
  await sub('جستجو').click()
  await sub('تنظیمات').click()
  await sub('Gateway').click()
  await expect(page.locator('.ak-table').first()).toBeVisible({ timeout: 30_000 })
  await sub('محدودیت نرخ').click()
  for (const st of ['مصرف زنده', 'پلن‌ها', 'هزینه‌ی مدل', 'تخصیص‌ها', 'سیاست‌ها']) {
    await sub(st).click({ timeout: 30_000 })
  }
  await openTab(page, 'مدیریت GPU')
  await expect(page.locator('.ak-card h2', { hasText: 'مدیریت GPU' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.gp-seg').first()).toBeVisible({ timeout: 30_000 })
  await sub('مصرف \\(جدول\\)').click()
  await expect(page.locator('.ak-table').first()).toBeVisible()
  await sub('مصرف \\(نمودار\\)').click()
  await expect(page.locator('.gp-pie, .ak-muted').first()).toBeVisible()
  await sub('سرمایه').click()
  expect(bad, bad.join('\n')).toEqual([])
})
