// Fails if production output contains mock code or is missing the app shell.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MARKER = '__DORJ_MOCK_API__'
const files = []
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p) } }
walk('dist')
const bad = files.filter(f => /\.(js|html)$/.test(f) && readFileSync(f, 'utf8').includes(MARKER))
if (bad.length) { console.error('mock code in production build:', bad.join(', ')); process.exit(1) }
// air-gapped cluster: any external fetch (e.g. Google Fonts @import) stalls page load
const ext = files.filter(f => /\.(css|html)$/.test(f) && /(@import|url\(|href=|src=)\s*["']?https?:\/\//.test(readFileSync(f, 'utf8')))
if (ext.length) { console.error('external resource reference in production build:', ext.join(', ')); process.exit(1) }
if (!readFileSync('dist/index.html', 'utf8').includes('id="root"')) { console.error('dist/index.html has no #root'); process.exit(1) }
console.log(`check-dist OK (${files.length} files, no mock)`)
