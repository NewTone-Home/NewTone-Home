import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

test('the inner-world Phone keeps the existing Office to Commercial Street ride handoff', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=zhongshuyuan-office')
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  const readingShield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(readingShield).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(900)
  await readingShield.click({ force: true })
  await page.getByRole('button', { name: '里世界手机', exact: true }).click({ timeout: 15_000 })

  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible()
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /商业街.*从当前位置出发/ }).click()
  await phone.getByRole('button', { name: '呼叫车辆前往商业街', exact: true }).click()

  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})
