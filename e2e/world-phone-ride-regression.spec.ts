import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

test('the Office desk Phone Action switches the carried device in both directions', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.route('**/rest/v1/analytics_events**', async (route) => route.fulfill({ status: 201, body: '' }))
  await page.goto('/?scene=zhongshuyuan-office')

  const phone = page.locator('.world-phone')
  await expect(phone).toHaveAttribute('data-phone-device', 'surface')
  for (const target of ['inner', 'surface'] as const) {
    await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
    const echo = page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')
    const readingShield = page.locator('[data-scene-dialogue-shield="true"]')
    await expect(echo).toBeVisible({ timeout: 15_000 })
    await expect(readingShield).toBeVisible()
    await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 15_000 })
    await readingShield.click({ force: true })
    const switchAction = page.getByRole('button', { name: '换手机', exact: true })
    await expect(switchAction).toBeEnabled({ timeout: 15_000 })
    await switchAction.click()
    await expect(phone).toHaveAttribute('data-phone-device', target)
    await page.getByLabel('收起手机').click()
    await expect(phone).not.toHaveClass(/is-open/)
  }
  expect(consoleErrors).toEqual([])
})

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

test('Commercial Street can ride through the inner-world Phone back to the Zhongshuyuan Office', async ({ page }) => {
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
  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="map"]').click()
  await expect(phone.locator('[data-map-world="inner"] [data-scene-id="jijia-ancestral-home"]')).toHaveCount(0)
  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /中枢院.*从当前位置出发/ }).click()
  await phone.getByRole('button', { name: '呼叫车辆前往中枢院', exact: true }).click()

  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="zhongshuyuan-office"]')).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})
