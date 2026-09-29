import { useState } from 'react'
import AppShell from '../../components/AppShell.jsx'
import Tabs from '../../components/Tabs.jsx'
import Profiles from './Profiles.jsx'
import Users from './Users.jsx'
import Gpu from './Gpu.jsx'
import ModelsAdmin from './ModelsAdmin.jsx'
import Groups from './Groups.jsx'
import { NotebookOptions, Branding, Settings, AccessMatrix, Broadcast, LlmIssue, Assistant, Security, Monitoring } from './Misc.jsx'

export const ADMIN_TABS = ['مدیریت پروفایل‌ها', 'کاربران', 'تنظیمات نوت‌بوک', 'ظاهر پلتفرم', 'تنظیمات', 'دسترسی‌ها', 'گروه‌ها', 'ارسال گروهی ایمیل', 'درخواست‌ها', 'دستیار هوشمند', 'مدل‌ها', 'مدیریت GPU', 'امنیت', 'مانیتورینگ']

export default function AdminPanel({ tab = 0 }) {
  const [active, setActive] = useState(tab)
  const Page = ADMIN_TABS[active]
  return (
    <AppShell active="" admin tabs={<Tabs main tabs={ADMIN_TABS} active={active} onSelect={setActive} />}>
      <div className="ap-panel-body">
        {Page === 'مدیریت پروفایل‌ها' && <Profiles />}
        {Page === 'کاربران' && <Users />}
        {Page === 'تنظیمات نوت‌بوک' && <NotebookOptions />}
        {Page === 'ظاهر پلتفرم' && <Branding />}
        {Page === 'تنظیمات' && <Settings />}
        {Page === 'دسترسی‌ها' && <AccessMatrix />}
        {Page === 'گروه‌ها' && <Groups />}
        {Page === 'ارسال گروهی ایمیل' && <Broadcast />}
        {Page === 'درخواست‌ها' && <LlmIssue />}
        {Page === 'دستیار هوشمند' && <Assistant />}
        {Page === 'مدل‌ها' && <ModelsAdmin />}
        {Page === 'مدیریت GPU' && <Gpu />}
        {Page === 'امنیت' && <Security />}
        {Page === 'مانیتورینگ' && <Monitoring />}
      </div>
    </AppShell>
  )
}
