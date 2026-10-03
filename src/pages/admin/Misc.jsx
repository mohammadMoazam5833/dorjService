import { SOON } from '../../lib/soon.js'

// Phase 3 wires these tabs to kubeflow-admin-panel; until then they point to the platform's panel
// instead of showing placeholder data.
function SoonPanel({ title }) {
  return (
    <div className="paper-card section" style={{ padding: 24 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p>این بخش در فاز بعدی به سرویس واقعی متصل می‌شود — {SOON}.</p>
      <p><a href="https://platform.isigpu.local/admin-panel/" target="_blank" rel="noopener">فعلاً از پنل مدیریت پلتفرم استفاده کنید ↗</a></p>
    </div>
  )
}

export const NotebookOptions = () => <SoonPanel title="تنظیمات نوت‌بوک" />
export const Branding = () => <SoonPanel title="ظاهر پلتفرم" />
export const Settings = () => <SoonPanel title="تنظیمات" />
export const AccessMatrix = () => <SoonPanel title="دسترسی‌ها" />
export const Broadcast = () => <SoonPanel title="ارسال گروهی ایمیل" />
export const LlmIssue = () => <SoonPanel title="درخواست‌ها" />
export const Assistant = () => <SoonPanel title="دستیار هوشمند" />
export const Security = () => <SoonPanel title="امنیت" />
export const Monitoring = () => <SoonPanel title="مانیتورینگ" />
