import { test } from 'node:test'
import assert from 'node:assert/strict'
import { markdownToHtml } from '../src/lib/markdown.js'

test('markdown escapes raw HTML before building tags', () => {
  const h = markdownToHtml('<img src=x onerror=alert(1)> **b**')
  assert.ok(!h.includes('<img'))
  assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt; <strong>b<\/strong>/)
})

test('markdown renders lists, headings, code and quotes', () => {
  assert.equal(markdownToHtml('- a\n- b'), '<ul><li>a</li><li>b</li></ul>')
  assert.equal(markdownToHtml('1. a'), '<ol><li>a</li></ol>')
  assert.match(markdownToHtml('## T'), /font-weight:600;[^>]*>T<\/div>/)
  assert.equal(markdownToHtml('```\nx<y\n```'), '<pre><code>\nx&lt;y\n</code></pre><br>')
  assert.equal(markdownToHtml('> q'), '<blockquote>q<br></blockquote>')
})

test('a bare JSON reply renders as a pretty code block', () => {
  assert.equal(markdownToHtml('{"a":1}'), '<pre><code>{\n  "a": 1\n}</code></pre>')
})
