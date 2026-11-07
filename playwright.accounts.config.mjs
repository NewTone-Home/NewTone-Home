import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_TEST_PORT ?? 5197)
const url = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: ['accountSaveSlots.spec.ts', 'playerAccountHost.spec.ts'],
  timeout: 45_000,
  workers: 1,
  use: { baseURL: url, channel: process.env.PLAYWRIGHT_CHANNEL, screenshot: 'off', trace: 'off' },
  // This storage-contract test must not enable the gameplay clock/order trial
  // flags used by the general scene E2E configuration.
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
    timeout: 30_000,
  },
})
