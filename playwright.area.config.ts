import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['mainline-area-projection.spec.ts', 'world-furniture-glyph-pitch.spec.ts'],
  timeout: 40_000,
  workers: 1,
  outputDir: process.env.AREA_TEST_OUTPUT ?? '.tmp/area-projection-browser',
  use: { baseURL: process.env.AREA_TEST_URL ?? 'http://127.0.0.1:4185', channel: process.env.AREA_BROWSER_CHANNEL ?? 'chrome', screenshot: 'only-on-failure' },
})
