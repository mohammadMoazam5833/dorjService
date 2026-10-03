import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Real lifecycle against the live backend: creates a tiny notebook, exercises every action,
// and removes it (and its workspace volume) again.
const G = 'https://goodarzi.isigpu.local'
const NB = 'dorj-p2-e2e'
test.setTimeout(15 * 60_000)

const api = (page, path, method = 'GET', body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: b ? JSON.stringify(b) : undefined })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, [path, method, body])

async function waitPhase(page, want, ms = 8 * 60_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const r = await api(page, '/api/notebooks')
    const nb = (r.json || []).find(n => n.name === NB)
    if (want === 'gone' ? !nb : nb && nb.phase === want) return nb
    await page.waitForTimeout(5000)
  }
  throw new Error(`notebook ${NB} never reached ${want}`)
}

test('notebook lifecycle through the UI', async ({ page }) => {
  await login(page, G, process.env.E2E_USER, process.env.E2E_PASS)
  // leftovers from an aborted run
  if ((await api(page, '/api/notebooks')).json?.some(n => n.name === NB)) {
    await api(page, `/api/notebooks/${NB}`, 'DELETE'); await waitPhase(page, 'gone')
  }
  await page.goto(`${G}/#/notebooks`)
  await page.getByRole('button', { name: /نوت‌بوک جدید/ }).click()
  const modal = page.locator('.nb-create-modal')
  await modal.locator('input[placeholder="my-notebook"]').fill(NB)
  const nums = modal.locator('input[type=number]')
  await nums.nth(0).fill('0.5'); await nums.nth(1).fill('1'); await nums.nth(2).fill('1')
  await modal.getByRole('button', { name: 'ایجاد نوت‌بوک' }).click()
  await expect(page.locator('.dj-toast-success')).toBeVisible({ timeout: 30_000 })
  await waitPhase(page, 'ready')

  // details: logs, yaml, console
  await page.goto(`${G}/#/notebooks`)
  await page.locator('.nb-linklike', { hasText: NB }).click()
  const drawer = page.locator('.nd-drawer')
  await drawer.getByRole('button', { name: 'YAML' }).click()
  await expect(drawer.locator('.nd-pre')).toContainText('kind: Notebook')
  await drawer.getByRole('button', { name: 'گزارش‌ها' }).click()
  await expect(drawer.locator('.nd-pre')).not.toHaveText('…')
  // console needs SSH: the console tab points to the SSH tab, enabling restarts the notebook
  await drawer.getByRole('button', { name: 'کنسول' }).click()
  await drawer.getByRole('button', { name: 'رفتن به تب SSH' }).click()
  await drawer.getByRole('button', { name: 'فعال‌سازی SSH' }).click()
  await expect(page.locator('.dj-toast-success').last()).toBeVisible({ timeout: 60_000 })
  await expect(drawer.locator('.nd-kv code')).toContainText('ssh -p', { timeout: 60_000 })
  await expect.poll(async () => (await api(page, `/api/notebooks/${NB}/ssh/status`)).json?.sidecar_active, { timeout: 6 * 60_000, intervals: [5000] }).toBe(true)
  await waitPhase(page, 'ready')
  await drawer.getByRole('button', { name: 'کنسول' }).click()
  const term = drawer.locator('.xterm')
  await expect(term).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3000)
  await term.click()
  await page.keyboard.type('echo dorj-$((40+2))-ok\n')
  await expect(drawer.locator('.xterm-rows')).toContainText('dorj-42-ok', { timeout: 30_000 })
  await drawer.locator('.nb-modal-close').click()

  // stop -> start
  const row = page.locator('tr', { has: page.locator('.nb-linklike', { hasText: NB }) })
  await row.getByTitle('توقف').click()
  await waitPhase(page, 'stopped')
  await page.goto(`${G}/#/notebooks`); await page.locator('.nb-action-btn[title="تازه‌سازی"]').click()
  await row.getByTitle('شروع').click()
  await waitPhase(page, 'ready')

  // resize CPU 0.5 -> 1
  await page.locator('.nb-action-btn[title="تازه‌سازی"]').click()
  await row.getByTitle('تغییر اندازه').click()
  const rz = page.locator('.cd-modal')
  await rz.locator('input[type=number]').first().fill('1')
  await rz.getByRole('button', { name: 'اعمال' }).click()
  await expect(page.locator('.dj-toast-success').last()).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => (await api(page, `/api/notebooks/${NB}`)).json?.cpu_limit, { timeout: 60_000 }).toBe('1')

  // delete via typed confirmation
  await page.locator('.nb-action-btn[title="تازه‌سازی"]').click()
  await row.getByTitle('حذف').click()
  await page.locator('.cd-modal .cd-input').fill(NB)
  await page.locator('.cd-modal .cd-danger').click()
  await waitPhase(page, 'gone')

  // cleanup: the workspace volume the notebook created
  const vols = (await api(page, '/api/volumes')).json || []
  for (const v of vols.filter(v => v.name.startsWith(NB))) {
    const r = await api(page, `/api/volumes/${v.name}`, 'DELETE', { captcha_a: 1, captcha_b: 1, captcha_answer: 2, password: process.env.E2E_PASS })
    expect(r.status).toBe(200)
  }
})
