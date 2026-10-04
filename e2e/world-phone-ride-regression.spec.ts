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
  await page.getByRole('button', { name: '换手机', exact: true }).click({ timeout: 15_000 })

  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible()
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /商业街.*从当前位置出发/ }).click()
  await phone.getByRole('button', { name: '呼叫车辆前往商业街', exact: true }).click()

  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})

test('Commercial Street can ride through the inner-world Phone to the Ancestral Home', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  // Establish the inner-world device through its real Office desk Action;
  // a fresh save correctly starts with the surface phone and is offline here.
  await page.goto('/?scene=zhongshuyuan-office')
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  const deskEcho = page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')
  const readingShield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(deskEcho).toBeVisible({ timeout: 15_000 })
  await expect(readingShield).toBeVisible()
  await expect(deskEcho).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 15_000 })
  const innerPhoneAction = page.getByRole('button', { name: '换手机', exact: true })
  await readingShield.click({ force: true })
  await expect(innerPhoneAction).toBeEnabled()
  await innerPhoneAction.click()
  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible()
  await expect(phone).toHaveAttribute('data-phone-device', 'inner')
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /商业街.*从当前位置出发/ }).click()
  await phone.getByRole('button', { name: '呼叫车辆前往商业街', exact: true }).click()

  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('打开手机').click()
  await expect(phone).toHaveAttribute('data-phone-device', 'inner')
  await expect(phone.locator('section[aria-label="叫车"]')).toBeVisible()
  await phone.getByRole('button', { name: /姬家祖宅.*从当前位置出发/ }).click()
  await phone.getByRole('button', { name: '呼叫车辆前往姬家祖宅', exact: true }).click()

  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="jijia-ancestral-home"]')).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})
