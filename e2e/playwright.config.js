import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    ignoreHTTPSErrors: true,
    locale: 'fa-IR',
    launchOptions: {
      args: ['--host-resolver-rules=MAP goodarzi.isigpu.local 172.16.50.202, MAP platform.isigpu.local 172.16.50.202, MAP identity.isigpu.local 172.16.50.202'],
    },
  },
})
