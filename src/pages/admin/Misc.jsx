import Card, { Hint } from '../../components/Card.jsx'
import Search from '../../components/Search.jsx'
import Tabs from '../../components/Tabs.jsx'

export function NotebookOptions() {
  return (
    <Card title="گزینه‌های Image نوت‌بوک">
      <Hint>این فهرست همان چیزی است که در فرم ایجاد نوت‌بوک نمایش داده می‌شود.</Hint>
      <Hint>بارگذاری از API...</Hint>
    </Card>
  )
}

export function Branding() {
  return (
    <Card title="ظاهر و برند پلتفرم">
      <Hint>نام پلتفرم، رنگ اصلی و لوگوها از تنظیمات برند خوانده می‌شود.</Hint>
    </Card>
  )
}

export function Settings() {
  return (
    <>
      <Tabs tabs={['قیمت‌گذاری', 'SMTP', 'پیام ورود', 'Active Directory', 'نشست‌ها']} />
      <Card title="نرخ تبدیل دلار به ریال"><Hint>بارگذاری از API...</Hint></Card>
    </>
  )
}

export function AccessMatrix() {
  return (
    <Card title="دسترسی‌ها">
      <Search />
      <Hint>ماتریس دسترسی کاربر × سرویس</Hint>
    </Card>
  )
}

export function Broadcast() {
  return (
    <>
      <Tabs tabs={['ارسال گروهی', 'دسته‌ها', 'ارسال مستقیم', 'تاریخچه']} />
      <Card title="ارسال ایمیل به یک گروه"><Hint>می‌توانید از {'{{name}}'} و {'{{email}}'} برای شخصی‌سازی استفاده کنید.</Hint></Card>
    </>
  )
}

export function LlmIssue() {
  return (
    <>
      <Tabs tabs={['صدور کلید LLM', 'کلیدهای LLM', 'درخواست‌های انتشار سرویس']} />
      <Card title="صدور کلید API LLM"><Hint>رابط اصلی LLM پلتفرم (llm-api.isigpu.local).</Hint></Card>
    </>
  )
}

export function Assistant() {
  return (
    <>
      <Tabs tabs={['گفتگو', 'گفتگوهای قبلی']} />
      <Card title="دستیار عیب‌یابی"><Hint>دستیار با انتخاب مدل (qwen3) در دسترس است.</Hint></Card>
    </>
  )
}

export function Security() {
  return (
    <Card title="امنیت">
      <Hint>میزبان CVE و انطباق ایمیج‌ها از Trivy Operator، CIS از kube-bench، هشدارهای زمان اجرا از Falco.</Hint>
      <Hint>موردی یافت نشد.</Hint>
    </Card>
  )
}

export function Monitoring() {
  return (
    <>
      <Tabs tabs={['مشاهده‌پذیری', 'تریس‌ها']} />
      <Card title="مانیتورینگ"><Hint>نمودارهای LiteLLM و tokenها.</Hint></Card>
    </>
  )
}
