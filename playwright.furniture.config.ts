import { defineConfig } from '@playwright/test'

// Uses an explicitly frozen preview; never starts or replaces a server.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'world-furniture-glyph-pitch.spec.ts',
  timeout: 30_000,
  workers: 1,
  outputDir: process.env.FURNITURE_TEST_OUTPUT ?? '.tmp/furniture-pitch-playwright',
  use: {
    baseURL: process.env.FURNITURE_TEST_URL ?? 'http://127.0.0.1:4184',
    channel: 'chrome',
    screenshot: 'only-on-failure',
  },
})
