// Same role list as the platform's ap-access-roles.js (Keycloak realm roles).
export const ACCESS_ROLES = [
  { id: 'access-resources', short: 'منابع', label: 'درخواست منابع' },
  { id: 'access-vm', short: 'VM', label: 'ماشین مجازی' },
  { id: 'access-cost', short: 'هزینه', label: 'داشبورد هزینه' },
  { id: 'access-storage', short: 'ذخیره‌سازی', label: 'فضای ذخیره‌سازی' },
  { id: 'access-assistant', short: 'دستیار', label: 'دستیار هوشمند OpenHands' },
  { id: 'access-dashboards', short: 'داشبورد', label: 'داشبوردها' },
  { id: 'access-logs', short: 'لاگ', label: 'لاگ‌ها' },
  { id: 'access-backup', short: 'بکاپ', label: 'بکاپ و بازیابی' },
  { id: 'access-openwebui', short: 'WebUI', label: 'Open WebUI' },
  { id: 'access-helm-packages', short: 'Helm', label: 'استقرار بسته‌ی Helm' },
  { id: 'access-llm-api', short: 'LLM API', label: 'دسترسی مستقیم API مدل زبانی' },
  { id: 'access-send-mail', short: 'ایمیل', label: 'ارسال ایمیل مدیریتی' },
  { id: 'access-shared-models', short: 'مدل‌ها', label: 'فضای مشترک مدل‌ها (فقط‌خواندنی)' },
]
export const SHARED_MODELS_ROLE = 'access-shared-models'
