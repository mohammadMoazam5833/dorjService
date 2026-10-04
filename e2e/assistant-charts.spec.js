import { test, expect } from '@playwright/test'
import { login } from './login.js'

// Smart Assistant: asks the real LLM for each render_chart type and checks the chart is drawn
// in-app. The throwaway conversation is deleted at the end.
const P = 'https://platform.isigpu.local'
const TYPES = [
  ['bar', 'rect'],
  ['line', 'polyline'],
  ['pie', 'path.gp-slice'],
  ['doughnut', 'path.gp-slice'],
]

test('assistant renders every render_chart type', async ({ page }) => {
  test.setTimeout(2_400_000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page, P, process.env.E2E_ADMIN_USER, process.env.E2E_ADMIN_PASS)
  await page.goto(`${P}/#/admin-panel?tab=troubleshoot`)
  await expect(page.locator('.ts-messages')).toBeVisible({ timeout: 30_000 })
  const model = await page.locator('.ak-card select.ak-select').inputValue()
  console.log('MODEL', model)
  const only = (process.env.CHART_TYPES || '').split(',').filter(Boolean)

  // leftovers of an interrupted earlier run
  await page.locator('.ak-tabs button', { hasText: 'گفتگوهای قبلی' }).click()
  await page.waitForTimeout(3000)
  while (await page.locator('tr', { hasText: 'e2e-chart-' }).count()) {
    await page.locator('tr', { hasText: 'e2e-chart-' }).first().getByRole('button', { name: 'حذف' }).click()
    await page.locator('.cd-modal .cd-danger').click()
    await page.waitForTimeout(2500)
  }

  for (const [type, shape] of TYPES.filter(([t]) => !only.length || only.includes(t))) {
    // one short conversation per chart type keeps every LLM turn fast
    const tag = `e2e-chart-${type}-${Date.now().toString(36)}`
    await page.locator('.ak-tabs button', { hasText: /^گفتگو$/ }).click()
    await page.getByRole('button', { name: 'گفتگوی جدید' }).click()
    await page.locator('.ak-card input.ak-input').fill(
      `[${tag}] Call the render_chart tool exactly once with chart_type "${type}", ` +
      'title "test", labels ["a","b","c"] and one dataset {label: "n", data: [3, 5, 2]}. Do not call any other tool.')
    const t0 = Date.now()
    await page.locator('.ak-card').getByRole('button', { name: 'ارسال', exact: true }).click()
    await expect(page.locator('.ts-thinking')).toHaveCount(0, { timeout: 420_000 })
    const last = page.locator('.ts-assistant .ts-bubble').last()
    const trace = await last.locator('.ts-trace pre').textContent().catch(() => '')
    const called = /"render_chart"/.test(trace || '')
    const n = await last.locator('.ts-chart').first().locator(shape).count()
    console.log('CHART', type, `${Math.round((Date.now() - t0) / 1000)}s`, 'tool_called=' + called, `${shape}=${n}`)
    await page.locator('.ak-tabs button', { hasText: 'گفتگوهای قبلی' }).click()
    const row = page.locator('tr', { hasText: tag }).first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    await row.getByRole('button', { name: 'حذف' }).click()
    await page.locator('.cd-modal .cd-danger').click()
    await expect(page.locator('tr', { hasText: tag })).toHaveCount(0, { timeout: 30_000 })
    expect(called, `${type}: model did not call render_chart`).toBe(true)
    expect(n, `${type}: chart not drawn`).toBeGreaterThan(0)
  }

  expect(errors, errors.join('\n')).toEqual([])
})
