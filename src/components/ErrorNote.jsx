import './ErrorNote.css'

const TEXT = {
  0: 'ارتباط با سرور برقرار نشد.',
  403: 'دسترسی به این بخش برای حساب شما فعال نیست.',
  404: 'موردی یافت نشد.',
}

export default function ErrorNote({ error }) {
  if (!error) return null
  const text = TEXT[error.status] || 'خطا در دریافت اطلاعات از سرور.'
  return (
    <div className="err-note" role="alert">
      <b>{text}</b>
      {error.message && <span className="err-note-detail" dir="auto">{error.message}</span>}
    </div>
  )
}
