// Dev-server check (run against `npx vite --port 5173`): typing "report" in mail search must issue at most one list request
import { chromium } from '@playwright/test'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const qs = []
await p.exposeFunction('__rec', u => qs.push(u))
const wrap = () => p.evaluate(() => { const f = window.fetch; window.fetch = (...a) => { const u = String(a[0]); if (u.includes('/api/mail/messages') && u.includes('q=')) window.__rec(u); return f(...a) } })
await p.goto('http://127.0.0.1:5173/#/mail', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); await wrap()
await p.locator('.ml-search input').pressSequentially('report', { delay: 60 })
await p.waitForTimeout(1200)
console.log('search requests:', qs.length)
await b.close()
process.exit(qs.length <= 1 ? 0 : 1)
