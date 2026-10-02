import { defineConfig } from '@playwright/test'

const playwrightTestPort = Number(process.env.PLAYWRIGHT_TEST_PORT ?? 5182)
const playwrightTestUrl = `http://127.0.0.1:${playwrightTestPort}`

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  use: {
    baseURL: playwrightTestUrl,
    viewport: { width: 834, height: 1194 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${playwrightTestPort} --strictPort`,
    url: playwrightTestUrl,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
    timeout: 30_000,
  },
})
