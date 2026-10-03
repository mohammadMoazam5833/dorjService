import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Read-only on purpose: the test account's VM and volumes are real, so this checks details,
// YAML, the serial console connection and the backups page without changing anything.
const G = 'https://goodarzi.isigpu.local'

const api = (page, path) => page.evaluate(async p => {
  const r = await fetch(p, { headers: { Accept: 'application/json' } })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, path)

test('VM details, YAML and serial console', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  const vms = (await api(page, '/api/vms')).json || []
  test.skip(vms.length === 0, 'test account has no VM')
  const vm = vms.find(v => v.phase === 'Running') || vms[0]
  await page.goto(`${G}/#/vms`)
  await page.locator('.nb-linklike', { hasText: vm.name }).click()
  const drawer = page.locator('.nd-drawer')
  await expect(drawer.locator('.nd-kv')).toBeVisible()
  await drawer.getByRole('button', { name: 'YAML' }).click()
  await expect(drawer.locator('.nd-pre')).toContainText('kind: VirtualMachine')
  await drawer.getByRole('button', { name: 'فضاهای متصل' }).click()
  await expect(drawer.locator('.nd-body')).toContainText(/فضا/)
  if (vm.phase === 'Running') {
    await drawer.getByRole('button', { name: 'کنسول' }).click()
    await expect(drawer.locator('.xterm')).toBeVisible({ timeout: 30_000 })
    // the serial console prints something (login prompt) once the socket is open
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await drawer.locator('.xterm-rows').innerText()).trim().length, { timeout: 30_000 }).toBeGreaterThan(0)
  }
})

test('backups page lists backups and restores', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  const seen = []
  page.on('response', r => { const u = new URL(r.url()); if (/^\/api\/(backups|restores)$/.test(u.pathname)) seen.push(r.status()) })
  await page.goto(`${G}/#/backups`)
  await expect(page.getByRole('heading', { name: 'بکاپ‌ها' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'سابقه‌ی بازیابی' })).toBeVisible()
  await expect.poll(() => seen.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2)
  expect(seen.every(s => s === 200)).toBe(true)
  // user menu entry leads here
  await page.goto(`${G}/#/`)
  await page.locator('.uw-trigger').click()
  await page.locator('a.uw-item[href="#/backups"]').click()
  await expect(page).toHaveURL(/#\/backups/)
})
