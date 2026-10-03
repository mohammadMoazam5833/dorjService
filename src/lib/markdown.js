// Small Markdown subset for LLM/third-party text (ported from the platform's markdown.js).
// The raw text is escaped first and tags are only built from escaped text, so the source can
// never inject markup — safe for dangerouslySetInnerHTML.
export const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function jsonToHtml(raw) {
  const t = raw.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return null
  try { return `<pre><code>${escapeHtml(JSON.stringify(JSON.parse(t), null, 2))}</code></pre>` } catch { return null }
}

export function markdownToHtml(raw) {
  raw = String(raw ?? '')
  const asJson = jsonToHtml(raw)
  if (asJson !== null) return asJson
  let text = escapeHtml(raw)
  const blocks = []
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => { blocks.push(code); return `@@CODEBLOCK${blocks.length - 1}@@` })
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  const out = []
  let ul = false, ol = false, bq = false
  const closeLists = () => { if (ul) { out.push('</ul>'); ul = false } if (ol) { out.push('</ol>'); ol = false } }
  const closeBq = () => { if (bq) { out.push('</blockquote>'); bq = false } }
  for (const line of text.split('\n')) {
    const h = line.match(/^(#{1,6})\s+(.*)$/), u = line.match(/^[-*]\s+(.*)$/), o = line.match(/^\d+\.\s+(.*)$/), q = line.match(/^&gt;\s?(.*)$/)
    if (h) { closeLists(); closeBq(); out.push(`<div style="font-weight:600;margin:6px 0 2px;">${h[2]}</div>`) }
    else if (q) { closeLists(); if (!bq) { out.push('<blockquote>'); bq = true } out.push(`${q[1]}<br>`) }
    else if (u) { closeBq(); if (!ol && !ul) { out.push('<ul>'); ul = true } out.push(`<li>${u[1]}</li>`) }
    else if (o) { closeBq(); if (!ul && !ol) { out.push('<ol>'); ol = true } out.push(`<li>${o[1]}</li>`) }
    else { closeLists(); closeBq(); out.push(line === '' ? '<br>' : `${line}<br>`) }
  }
  closeLists(); closeBq()
  return out.join('').replace(/@@CODEBLOCK(\d+)@@/g, (_, i) => `<pre><code>${blocks[i]}</code></pre>`)
}
