import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'commercialStreetGridProjection.spec.ts',
  timeout: 30_000,
  use: {
    browserName: 'chromium',
    channel: 'chrome',
    viewport: { width: 390, height: 560 },
  },
})
