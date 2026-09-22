import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:5182',
    viewport: { width: 834, height: 1194 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5182',
    url: 'http://127.0.0.1:5182',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
