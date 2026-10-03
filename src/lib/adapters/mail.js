// /api/mail/messages pages server-side (30 per page, 1-based, optional q).
export function mailListPath(folder, page0, q) {
  let p = `/api/mail/messages?folder=${encodeURIComponent(folder)}&page=${page0 + 1}`
  if (q) p += `&q=${encodeURIComponent(q)}`
  return p
}

export const adaptMailPage = raw => ({
  messages: Array.isArray(raw?.messages) ? raw.messages : [],
  totalPages: raw?.total_pages || 1,
  page: raw?.page || 1,
  address: raw?.address || '',
})

export const messagePath = (folder, uid) => `/api/mail/message?folder=${encodeURIComponent(folder)}&uid=${uid}`

export const adaptMailBody = raw => ({
  text: raw?.body_text || '',
  html: raw?.body_html || '',
  attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
})
