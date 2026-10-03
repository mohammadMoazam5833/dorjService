import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mailListPath, adaptMailPage, messagePath, adaptMailBody } from '../src/lib/adapters/mail.js'

test('list path is 1-based and encodes folder and query', () => {
  assert.equal(mailListPath('INBOX', 0, ''), '/api/mail/messages?folder=INBOX&page=1')
  assert.equal(mailListPath('Sent Items', 2, 'gpu hi'), '/api/mail/messages?folder=Sent%20Items&page=3&q=gpu%20hi')
})

test('page adapter', () => {
  const p = adaptMailPage({ address: 'u@x', page: 2, total_pages: 5, messages: [{ uid: 9, seen: false, from: 'A <a@x>', subject: 's', date: 'd' }] })
  assert.equal(p.totalPages, 5)
  assert.equal(p.page, 2)
  assert.equal(p.messages[0].uid, 9)
  assert.deepEqual(adaptMailPage(null), { messages: [], totalPages: 1, page: 1, address: '' })
})

test('message path and body', () => {
  assert.equal(messagePath('INBOX', 9), '/api/mail/message?folder=INBOX&uid=9')
  assert.deepEqual(adaptMailBody({ body_text: 't', body_html: '<p>h</p>', attachments: [{ index: 0 }] }), { text: 't', html: '<p>h</p>', attachments: [{ index: 0 }] })
  assert.deepEqual(adaptMailBody(null), { text: '', html: '', attachments: [] })
})
