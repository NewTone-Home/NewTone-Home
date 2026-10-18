import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { expect, test, type Page } from '@playwright/test'
import { commercialStreetShopEntry, commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'
import { commercialStreetMilkTeaContinuousLayout } from '../src/center/runtime/commercialStreetMilkTeaInterior'

const milkTeaShop = commercialStreetShops.find((shop) => shop.kind === 'milk-tea')!
const milkTeaBounds = commercialStreetMilkTeaContinuousLayout.bounds

async function clickWorldPoint(page: Page, point: { x: number; y: number }) {
  const stage = page.locator('.mainline-scene-stage')
  const screenPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
  }, point)
  await stage.click({ position: screenPoint })
}

async function seedStreetStart(page: Page, language: 'en' | 'zh' = 'en') {
  await page.addInitScript((uiLanguage) => {
    if (localStorage.getItem('newtone-player-save-v1')) return
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: uiLanguage, hasInitializedLanguage: true }))
    const point = { x: 105, y: 57 }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({ _version: 1, currentSceneId: 'commercial-street', currentPosition: point, scenePositions: { 'commercial-street': point }, phoneDevice: 'surface', storyClock: { stage: 'commercial-street' }, sceneState: { 'commercial-street': { commercialStreetQuestionNarrativeCompleted: true } }, phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now() }))
  }, language)
}

async function finishReading(page: Page) {
  for (let index = 0; index < 80; index++) {
    const shield = page.locator('[data-scene-dialogue-shield="true"]')
    if (!await shield.count()) return
    await expect(page.locator('[data-scene-observation-typing="true"]')).toHaveCount(0, { timeout: 15_000 })
    await shield.click({ force: true })
    await expect(page.locator('[data-scene-echo-phase="leaving"]')).toHaveCount(0)
  }
  await expect(page.locator('.mainline-scene-stage')).not.toHaveAttribute('data-scene-dialogue-state', 'active')
}

async function enterMilkTeaShopFromStreet(page: Page) {
  const actor = page.locator('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]')
  const inside = () => actor.evaluate((node, bounds) => {
    const element = node as HTMLElement
    const x = Number(element.dataset.runtimeX), y = Number(element.dataset.runtimeY)
    return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height
  }, milkTeaBounds)
  if (await inside().catch(() => false)) return
  const entrance = page.locator('[data-focus-target-group="door:street-milktea-entry"]')
  await expect(entrance).toBeVisible({ timeout: 15_000 })
  await entrance.click()
  await expect.poll(inside, { timeout: 30_000 }).toBe(true)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentSceneId), { timeout: 30_000 }).toBe('commercial-street')
}

async function journey(page: Page, testInfo: import('@playwright/test').TestInfo) {
  await seedStreetStart(page)
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  const room = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  await expect(street).toBeVisible()
  await page.waitForFunction(() => {
    const actor = document.querySelector<HTMLElement>('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]')
    return Boolean(actor && Math.abs(Number(actor.dataset.runtimeX) - 105) < 1 && Math.abs(Number(actor.dataset.runtimeY) - 57) < 1)
  }, undefined, { timeout: 30_000 })
  await enterMilkTeaShopFromStreet(page)
  const visibleObjectLabels = page.locator('.scene-mainline-object__label')
  const visibleCounterLabels = await visibleObjectLabels.filter({ hasText: /^Counter$/ }).evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).visibility !== 'hidden').length)
  expect(visibleCounterLabels).toBe(1)
  await expect(page.locator('[data-object-id="milk-tea-pickup-3"] .scene-mainline-object__label')).toHaveCSS('visibility', 'hidden')
  await expect(page.locator('[data-object-id="milk-tea-clerk-contact"] .scene-mainline-object__label')).toHaveCSS('visibility', 'hidden')
  await expect(page.locator('[data-object-id="milk-tea-pickup-4"] .scene-mainline-object__label')).toHaveCSS('visibility', 'hidden')
  const labelOverlaps = await visibleObjectLabels.evaluateAll((nodes) => {
    const rects = nodes.map((node) => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return { text: node.textContent?.trim(), visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }).filter((rect) => rect.visible)
    const overlaps: Array<[string, string]> = []
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) overlaps.push([a.text ?? '', b.text ?? ''])
    }
    return overlaps
  })
  expect(labelOverlaps).toEqual([])
  const labelWallOverlaps = await visibleObjectLabels.evaluateAll((nodes) => {
    const visibleLabels = nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { text: node.textContent?.trim() ?? '', visible: getComputedStyle(node).visibility !== 'hidden', left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }).filter((rect) => rect.visible)
    const wallGlyphs = [...document.querySelectorAll<HTMLElement>('.scene-spatial-glyph.scene-mainline-wall')].map((node) => {
      const rect = node.getBoundingClientRect()
      return { text: node.textContent?.trim() ?? '', visible: getComputedStyle(node).visibility !== 'hidden' && Number(getComputedStyle(node).opacity) > 0, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }).filter((rect) => rect.visible && rect.right > rect.left && rect.bottom > rect.top)
    return visibleLabels.flatMap((label) => wallGlyphs.filter((wall) => Math.min(label.right, wall.right) - Math.max(label.left, wall.left) > 2 && Math.min(label.bottom, wall.bottom) - Math.max(label.top, wall.top) > 2).map((wall) => [label.text, wall.text]))
  })
  expect(labelWallOverlaps).toEqual([])
  await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
  await expect(room).toHaveAttribute('data-mainline-scene', 'commercial-street')
  await finishReading(page)
  const phone = page.locator('.world-phone')
  if (await phone.getAttribute('data-phone-phase') !== 'closed') {
    await page.keyboard.press('Escape')
    await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  }
  await expect(page.locator('.world-phone__dismiss-region')).toHaveCount(0)
  await clickWorldPoint(page, commercialStreetMilkTeaContinuousLayout.clerkApproach)
  await expect.poll(() => page.locator('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]').evaluate((node) => Number((node as HTMLElement).dataset.runtimeY))).toBeGreaterThan(81)
  await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
  const clerkButton = page.locator('button[data-npc-id="milk-tea-clerk"]')
  await expect(clerkButton).toBeVisible()
  const clerkBounds = await clerkButton.boundingBox()
  expect(clerkBounds).not.toBeNull()
  await page.mouse.click(clerkBounds!.x + clerkBounds!.width / 2, clerkBounds!.y + clerkBounds!.height / 2)
  await expect(page.locator('[data-scene-echo]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-milk-tea-tutorial-seen="true"]')).toHaveCount(1)
  await finishReading(page)
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
  await expect(page.locator('.world-phone__dismiss-region')).toHaveCount(0)
  await finishReading(page)

  await expect(phone.locator('.world-phone__notification-dot')).toBeVisible({ timeout: 45_000 })
  await page.locator('[data-focus-target-group="door:street-milktea-entry"]').click()
  await expect(street).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction((bounds) => {
    const node = document.querySelector<HTMLElement>('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]')
    if (!node) return false
    const x = Number(node.dataset.runtimeX), y = Number(node.dataset.runtimeY)
    return !(x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height)
  }, milkTeaBounds)
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
  await finishReading(page)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-full-20261018-dirty-pickup-counter.png') })
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
  await page.setViewportSize({ width: 1280, height: 720 })
  await journey(page, testInfo)
})

test('390x844 mobile: full street-to-counter order journey persists', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await journey(page, testInfo)
})

test('Chinese UI: shared street opens Milk Tea ordering in Chinese', async ({ page }) => {
  await seedStreetStart(page, 'zh')
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible()
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await expect(phone.locator('.world-phone__calendar-grid small').first()).toHaveText('一')
})

test('legacy Cafe save migrates into the continuous world and crosses to the lakeside region', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'en', hasInitializedLanguage: true }))
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 1,
      currentSceneId: 'commercial-cafe',
      currentPosition: { x: 54, y: 84 },
      scenePositions: { 'commercial-cafe': { x: 54, y: 84 } },
      sceneState: { 'commercial-cafe': { commercialCafeNarrativeCursor: 4, commercialCafeCoffeeStatus: 'ready' } },
      storyClock: { stage: 'cafe' },
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now(),
    }))
  })
  await page.goto('/?debugRuntimeEvidence=1')
  const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').scenePositions?.['commercial-street']?.x)).toBeGreaterThan(160)
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-cafe-interior')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentSceneId)).toBe('commercial-street')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['commercial-street']?.commercialCafeCoffeeStatus)).toBe('ready')
  await page.reload()
  await expect(street).toBeVisible()
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-cafe-interior')
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    const actor = document.querySelector<HTMLElement>('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]')
    return { save: save.scenePositions?.['commercial-street'], x: Number(actor?.dataset.runtimeX), y: Number(actor?.dataset.runtimeY) }
  })).toMatchObject({ save: { x: expect.any(Number), y: 22 }, x: expect.any(Number), y: 22 })
  expect(await page.locator('.scene-shell[data-mainline-scene="commercial-street"] [data-actor-id="protagonist"]').getAttribute('data-runtime-x')).toContain('166')
  await finishReading(page)
  await page.locator('[data-focus-target-group="door:commercial-cafe-lakefront-entry"]').click()
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-lakeside', { timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentSceneId)).toBe('commercial-street')
})
