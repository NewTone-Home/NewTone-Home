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
// A removed network route does not invalidate an already evaluated ESM module.
// Keep the cached wrapper, but explicitly switch its fault off before rechecking.
test('Check again resumes the unacknowledged ticket after the real render fault is disabled', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, '__newtoneQaRuntimeFault', {
      value: { active: true, throws: 0, healthyRenders: 0 }, configurable: true,
    })
  })
  await page.route(/\/src\/center\/CenterExperience\.jsx(?:\?.*)?$/, async route => {
    const url = new URL(route.request().url())
    if (url.searchParams.has('qaRecoveryOriginal')) return route.continue()
    const original = await route.fetch()
    const source = await original.text()
    const reactImport = source.match(/from\s*["']([^"']*\/react\.js(?:\?[^"']*)?)["']/)
    if (!reactImport) throw Error('QA_HARNESS_REACT_IMPORT_NOT_FOUND')
    const originalModule = `${url.pathname}?qaRecoveryOriginal=1`
    await route.fulfill({ response: original, contentType: 'text/javascript', body: `
      import React from ${JSON.stringify(reactImport[1])};
      import RealRuntime from ${JSON.stringify(originalModule)};
      export default function RecoverableRuntime(props) {
        const fault = globalThis.__newtoneQaRuntimeFault;
        if (fault.active) { fault.throws++; throw Error('BOUNDARY_RENDER_SENTINEL'); }
        fault.healthyRenders++;
        return React.createElement(RealRuntime, props);
      }
    ` })
  })
  const facts = () => page.evaluate(() => {
    const authority = JSON.parse(localStorage.getItem('newtone-save-entry-authority-v2')!)
    const player = JSON.parse(authority.values['newtone-player-save-v1'])
    const pending = JSON.parse(localStorage.getItem('newtone-save-entry-pending-v2')!)
    return {
      generation: authority.generation, receipt: authority.operationReceipt,
      ticket: pending.ticket,
      walletBalance: player.walletBalance, shopOrders: player.shopOrders,
      shopOrderPaymentReceipts: player.shopOrderPaymentReceipts,
      monthlySalaryReceipts: player.monthlySalaryReceipts,
      laoZhouCafeSeatId: player.laoZhouCafeSeatId,
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start', exact: true }).click({ timeout: 15_000 })
  const recovery = page.locator('[data-runtime-recovery]')
  await expect(recovery).toBeVisible({ timeout: 15_000 })
  await expect(recovery).toHaveAttribute('data-recovery-first-reason', 'BOUNDARY_RENDER_SENTINEL')
  await expect(recovery.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled()
  const before = await facts()
  expect(await page.evaluate(() => localStorage.getItem('newtone-save-entry-acknowledged-v2'))).toBeNull()
  const disabled = await page.evaluate(() => {
    const fault = (globalThis as typeof globalThis & {
      __newtoneQaRuntimeFault: { active: boolean; throws: number; healthyRenders: number }
    }).__newtoneQaRuntimeFault
    if (!fault.active || fault.throws < 1) throw Error('QA_FAULT_NOT_OBSERVED')
    fault.active = false
    return { ...fault }
  })
  expect(disabled.active).toBe(false)
  await recovery.getByRole('button', { name: 'Check again', exact: true }).click()
  // Commit happened before the render error; no ACK yet. Resolve the SAME
  // ticket directly into a fresh usable session, rather than demanding Continue.
  await expect(page.locator('.center-experience').first()).toBeVisible({ timeout: 15_000 })
  await expect(recovery).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('[data-world-entry-phase]')).toHaveCount(0, { timeout: 15_000 })
  const after = await facts()
  expect(after).toEqual(before)
  const healthy = await page.evaluate(() => ({ ...(globalThis as typeof globalThis & {
    __newtoneQaRuntimeFault: { active: boolean; throws: number; healthyRenders: number }
  }).__newtoneQaRuntimeFault }))
  expect(healthy.throws).toBe(disabled.throws)
  expect(healthy.healthyRenders).toBeGreaterThan(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('newtone-save-entry-acknowledged-v2')!))).toMatchObject({
    operationId: before.receipt.operationId, generationId: before.generation.id,
  })
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
