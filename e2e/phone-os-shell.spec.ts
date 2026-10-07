import { expect, test } from '@playwright/test'

test('Phone home uses story time and app navigation returns through the home indicator', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.goto('/?scene=jijia-ancestral-home')

  const phone = page.locator('.world-phone')
  await page.getByRole('button', { name: '打开手机' }).click()
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await expect(phone.getByLabel('剧情日历')).toContainText('四月 · 周六')
  await expect(phone.getByLabel('剧情日历')).toContainText('故事日 · 第一日')
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
