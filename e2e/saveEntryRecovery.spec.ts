import { test, expect } from '@playwright/test'

// QA runs these against an isolated local Vite server; each test gets a fresh context.
test.use({ locale: 'en-US' })
test.setTimeout(60_000)
const runtimeErrors = new WeakMap<object, { message: string; stack?: string }[]>()
test.beforeEach(async ({ page }) => {
  const errors: { message: string; stack?: string }[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack }))
})
test.afterEach(async ({ page }, testInfo) => {
  await testInfo.attach('runtime-page-errors', { body: Buffer.from(JSON.stringify(runtimeErrors.get(page) ?? [], null, 2)), contentType: 'application/json' })
})
test('a runtime render exception leaves a visible recovery screen', async ({ page }) => {
  await page.route(/\/src\/center\/CenterExperience\.jsx(?:\?.*)?$/, route => route.fulfill({
    contentType: 'text/javascript', body: `export default function BrokenRuntime(){throw new Error('BOUNDARY_RENDER_SENTINEL')}`,
  }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Start', exact: true }).click({ timeout: 15_000 })
  const recovery = page.locator('[data-runtime-recovery]')
  await expect(recovery).toBeVisible({ timeout: 15_000 })
  await expect(recovery).toHaveAttribute('data-recovery-first-reason', 'BOUNDARY_RENDER_SENTINEL')
  await expect(recovery.getByRole('button', { name: 'Back', exact: true })).toBeEnabled()
  await expect(recovery.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled()
  await recovery.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({ timeout: 15_000 })
  expect(runtimeErrors.get(page)).toEqual([])
})
test('legacy-source conflict preserves authority and recovers without a blank root', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start', exact: true }).click({ timeout: 15_000 })
  await expect(page.locator('.center-experience').first()).toBeVisible({ timeout: 15_000 })
  // Wait for normal entry acknowledgement and cover removal before injecting the conflict.
  await expect(page.locator('[data-world-entry-phase]')).toHaveCount(0, { timeout: 15_000 })
  const before = await page.evaluate(() => {
    const authority = localStorage.getItem('newtone-save-entry-authority-v2')
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({ isolatedTest: 'changed-source' }))
    return authority
  })
  const recovery = page.locator('[data-runtime-recovery]')
  await expect(recovery).toBeVisible({ timeout: 15_000 })
  await expect(recovery.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => localStorage.getItem('newtone-save-entry-authority-v2'))).toBe(before)
  await recovery.getByRole('button', { name: 'Check again', exact: true }).click()
  await expect(page.locator('[data-save-entry-phase="unknown"]')).toBeVisible()
})
