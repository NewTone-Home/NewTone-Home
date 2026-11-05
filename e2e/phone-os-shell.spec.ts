import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { expect, test } from '@playwright/test'
import { ACKNOWLEDGED, AUTHORITY, SAVE_EPOCH } from '../src/services/saveEpoch.mjs'

test('Phone home uses story time and app navigation returns through the home indicator', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.route('**/rest/v1/analytics_events**', route => route.fulfill({ status:201, body:'' }))
  await page.goto('/')
  await expect(page.locator('[data-save-entry-phase="start-ready"]')).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), AUTHORITY)).toBeNull()
  await page.locator('[data-entry-group-entry="create"]').click()
  await expect(page.locator('.center-experience--active')).toBeVisible()
  await expect(page.locator('.entry-surface')).toHaveCount(0)
  await expect.poll(() => page.evaluate(({ AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY) ?? 'null')
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED) ?? 'null')
    return Boolean(authority?.saveEpoch === SAVE_EPOCH && ack?.saveEpoch === SAVE_EPOCH
      && ack.generationId === authority.generation.id
      && ack.operationId === authority.operationReceipt.operationId)
  }, { AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH })).toBe(true)

  const phone = page.locator('.world-phone')
  // New games open Lao Zhou's message; do not suppress the production prompt.
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await phone.getByRole('button', { name: '返回手机首屏' }).click()
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await expect(phone.getByLabel('剧情日历')).toContainText('四月')
  await expect(phone.locator('[aria-current="date"]')).toHaveText('12')
  await expect(phone.getByLabel('剧情日历')).not.toContainText('故事日')
  await expect(phone.locator('.world-phone__world-status')).toContainText('10:00')
  await expect(phone.locator('.world-phone__apps button')).toHaveText(['地图', '叫车', '联系人', '反馈'])

  await phone.locator('[data-app="contacts"]').click()
  await expect(phone.getByRole('region', { name: '联系人' })).toBeVisible()
  await expect(phone.locator('.world-phone__app-back')).toHaveCount(0)
  const homeIndicator = phone.getByRole('button', { name: '返回手机主屏' })
  await expect(homeIndicator).toBeVisible()
  await homeIndicator.click()
  await expect(phone.getByLabel('剧情日历')).toBeVisible()
  expect(consoleErrors).toEqual([])
  await page.screenshot({ path: 'test-results/phone-os-shell-home.png' })
})
