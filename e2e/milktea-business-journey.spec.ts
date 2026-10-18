import { expect, test, type Page } from '@playwright/test'

async function seedStreetStart(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('newtone-player-save-v1')) return
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'en', hasInitializedLanguage: true }))
    const point = { x: 105, y: 57 }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({ _version: 1, currentSceneId: 'commercial-street', currentPosition: point, scenePositions: { 'commercial-street': point }, phoneDevice: 'surface', storyClock: { stage: 'commercial-street' }, sceneState: { 'commercial-street': { commercialStreetQuestionNarrativeCompleted: true } }, phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now() }))
  })
}

async function finishReading(page: Page) {
  for (let index = 0; index < 80; index++) {
    const shield = page.locator('[data-scene-dialogue-shield="true"]')
    if (!await shield.count()) return
    await expect(page.locator('[data-scene-observation-typing="true"]')).toHaveCount(0, { timeout: 15_000 })
    await shield.click({ force: true })
    await expect(page.locator('[data-scene-echo-phase="leaving"]')).toHaveCount(0)
  }
  await expect(stage).not.toHaveAttribute('data-scene-dialogue-state', 'active')
}

async function walkToWorld(page: Page, x: number, y: number) {
  const stage = page.locator('.mainline-scene-stage')
  const target = await stage.evaluate((element, point) => {
    const rect = element.getBoundingClientRect()
    const offsetX = Number((element as HTMLElement).dataset.cameraOffsetX ?? 0)
    const offsetY = Number((element as HTMLElement).dataset.cameraOffsetY ?? 0)
    return {
      x: Math.max(0, Math.min(rect.width, rect.width * (point.x + offsetX) / 100)),
      y: Math.max(0, Math.min(rect.height, rect.height * (point.y + offsetY) / 100)),
    }
  }, { x, y })
  await stage.click({ position: target })
}

async function enterMilkTeaShopFromStreet(page: Page) {
  const interior = page.locator('.scene-shell[data-mainline-scene="commercial-milktea-interior"]')
  if (await interior.count()) return
  const entrance = page.locator('[data-focus-target-group="door:street-milktea-entry"]')
  if (await entrance.count()) await entrance.click()
  else await walkToWorld(page, 111, 54)
  await expect(interior).toBeVisible({ timeout: 30_000 })
}

async function journey(page: Page, testInfo: import('@playwright/test').TestInfo) {
  await seedStreetStart(page)
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  const room = page.locator('.scene-shell[data-mainline-scene="commercial-milktea-interior"]')
  await expect(street).toBeVisible()
  await page.waitForFunction(() => {
    const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Boolean(actor && Math.abs(Number(actor.dataset.runtimeX) - 105) < 1 && Math.abs(Number(actor.dataset.runtimeY) - 57) < 1)
  }, undefined, { timeout: 30_000 })
  await enterMilkTeaShopFromStreet(page)
  await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
  await expect(room).toHaveAttribute('data-mainline-scene', 'commercial-milktea-interior')
  await finishReading(page)
  const phone = page.locator('.world-phone')
  if (await phone.getAttribute('data-phone-phase') !== 'closed') {
    await page.keyboard.press('Escape')
    await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  }
  // Selecting the clerk runs the normal in-world approach and interaction.
  await page.locator('button[data-npc-id="milk-tea-clerk"]').click()
  await expect(page.locator('[data-scene-echo]')).toBeVisible({ timeout: 15_000 })
  await expect(phone).toHaveClass(/is-open/, { timeout: 15_000 })
  await expect(page.locator('[data-milk-tea-tutorial-seen="true"]')).toHaveCount(1)
  await expect(phone.locator('[data-app-view="milk-tea"]')).toBeVisible()
  await phone.getByRole('button', { name: 'Classic Milk Tea' }).click()
  await phone.getByRole('button', { name: 'Less sugar' }).click()
  await phone.getByRole('button', { name: 'No ice' }).click()
  await phone.getByRole('button', { name: 'Place Order' }).click()
  await expect(phone.locator('[data-milk-tea-status="pending"]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['commercial-street']?.commercialStreetMilkTeaOrderNumber))).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('journey-order-pending.png') })
  await page.keyboard.press('Escape')
  await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  await finishReading(page)

  await expect(phone.locator('.world-phone__notification-dot')).toBeVisible({ timeout: 45_000 })
  await page.locator('[data-focus-target-group="door:milktea-street-exit"]').click()
  await expect(street).toBeVisible({ timeout: 30_000 })
  await expect(phone.locator('.world-phone__notification-dot')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('journey-ready-notification-street.png') })
  await phone.locator('.world-phone__handle').click()
  const notification = page.locator('[data-notification-app="milk-tea"]')
  await expect(notification).toBeVisible()
  await notification.click()
  await expect(phone.locator('[data-milk-tea-status="ready"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  await page.reload()
  await expect(street).toBeVisible()
  await expect(phone.locator('.world-phone__notification-dot')).toHaveCount(0)
  await phone.locator('.world-phone__handle').click()
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.locator('[data-milk-tea-status="ready"]')).toBeVisible()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await enterMilkTeaShopFromStreet(page)
  await page.getByRole('button', { name: /Counter|柜台/ }).nth(1).click()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  await expect(room).toHaveAttribute('data-milk-tea-order-status', 'held')
  await page.screenshot({ path: testInfo.outputPath('journey-pickup-counter.png') })
  await finishReading(page)
  await page.getByRole('button', { name: /Counter|柜台/ }).nth(2).click()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  await expect(room).toHaveAttribute('data-milk-tea-order-status', 'held')
  await page.reload()
  await expect(room).toBeVisible()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  await expect(room).toHaveAttribute('data-milk-tea-order-status', 'held')
}

test('desktop: full street-to-counter order journey persists', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await journey(page, testInfo)
})

test('390x844 mobile: full street-to-counter order journey persists', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await journey(page, testInfo)
})
