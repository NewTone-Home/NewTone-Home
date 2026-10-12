import { expect, type Page } from '@playwright/test'

/** The arrival now signals the capsule; opening its notification is a real user action. */
export async function openRideArrivalNotification(page: Page, timeout = 30000) {
  const phone = page.locator('.world-phone')
  if (await phone.getAttribute('data-phone-phase') !== 'closed') {
    await page.keyboard.press('Escape')
    await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  }
  await expect(phone.locator('.world-phone__notification-dot')).toBeVisible({ timeout })
  await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  await page.getByLabel('打开手机').click()
  await expect(phone.locator('[data-notification-app="ride"]')).toBeVisible()
}
