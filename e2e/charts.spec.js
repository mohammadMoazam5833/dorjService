import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Every chart in the app: it must render real data, or an explicit empty state - never a blank
// box or a JS error. Prints a per-chart report.
const P = 'https://platform.isigpu.local'
const report = []
const note = (page, chart, state) => { report.push(`${page.padEnd(12)} ${state.padEnd(6)} ${chart}`) }

async function admin(page, label) {
  await page.goto(`${P}/#/admin-panel`)
  await page.locator('.asn-item', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().click()
}

test('all charts render data or an explicit empty state', async ({ page }) => {
  test.setTimeout(420_000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page, P, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)

  // canvas charts (components/Chart.jsx): Dashboard + Usage
  for (const [route, name] of [['#/', 'dashboard'], ['#/usage', 'usage']]) {
    await page.goto(`${P}/${route}`)
    await page.waitForTimeout(6000)
    const n = await page.locator('.chart canvas, .chart-empty').count()
    expect(n, `${name}: no chart containers`).toBeGreaterThan(0)
    for (let i = 0; i < n; i++) {
      const el = page.locator('.chart canvas, .chart-empty').nth(i)
      const title = (await el.evaluate(e => e.closest('.card, section, .paper-card, div')?.querySelector('h2,h3,h4,.card-title')?.textContent || '')).trim().slice(0, 40)
      if (await el.evaluate(e => e.classList.contains('chart-empty'))) { note(name, `${i} ${title}`, 'EMPTY'); continue }
      const painted = await el.evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let j = 3; j < d.length; j += 4) if (d[j]) k++; return k })
      expect(painted, `${name} chart ${i} canvas is blank`).toBeGreaterThan(200)
      note(name, `${i} ${title}`, 'DATA')
    }
  }

  // Monitoring: 8 Prometheus charts, top-users pie, 7 RCA charts
  await admin(page, 'مانیتورینگ')
  await expect(page.locator('.mo-card').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.ak-toolbar .ak-muted', { hasText: 'به‌روز شده' })).toBeVisible({ timeout: 150_000 })
  const cards = page.locator('.mo-card')
  for (let i = 0; i < await cards.count(); i++) {
    const c = cards.nth(i)
    const title = (await c.locator('.mo-title').first().textContent()).trim()
    const lines = await c.locator('polyline').evaluateAll(ps => ps.filter(p => (p.getAttribute('points') || '').split(' ').length > 1).length)
    const slices = await c.locator('path.gp-slice').count()
    const empty = await c.locator('.mo-empty').count()
    expect(lines + slices + empty, `monitoring "${title}" renders nothing`).toBeGreaterThan(0)
    note('monitoring', title, lines + slices ? 'DATA' : 'EMPTY')
  }
  // series legend toggle hides a line
  const legend = page.locator('.mo-legend-item').first()
  if (await legend.count()) { await legend.click(); await expect(legend).toHaveClass(/off/); await legend.click() }

  // GPU: usage pie with drill-down, capital pie
  await admin(page, 'مدیریت GPU')
  await expect(page.locator('.gp-seg').first()).toBeVisible({ timeout: 60_000 })
  await page.locator('.ak-tabs button', { hasText: 'مصرف (نمودار)' }).click()
  const pie = page.locator('svg.gp-pie path.gp-slice')
  if (await pie.count()) {
    note('gpu', `usage pie (${await pie.count()} slices)`, 'DATA')
    await page.locator('.gp-legend-row.click').first().click()
    await expect(page.locator('.ak-toolbar button', { hasText: 'همه‌ی انواع' })).toBeVisible()
    expect(await page.locator('svg.gp-pie path.gp-slice').count()).toBeGreaterThan(0)
    note('gpu', 'usage pie drill-down', 'DATA')
  } else note('gpu', 'usage pie', 'EMPTY')
  await page.locator('.ak-tabs button', { hasText: 'سرمایه' }).click()
  const cap = page.locator('svg.gp-pie path.gp-slice')
  note('gpu', 'capital pie', (await cap.count()) ? 'DATA' : 'EMPTY')

  console.log('\nCHART REPORT\n' + report.join('\n'))
  expect(errors, errors.join('\n')).toEqual([])
})
