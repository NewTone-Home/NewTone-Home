import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { expect, test, type Page } from '@playwright/test'
import { mainlineScenes, mainlineStorefrontInteractionRegion } from '../src/center/runtime/mainlineScenes'
import { resolveMainlineStorefrontInteraction } from '../src/center/runtime/mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'

test.use({ viewport: { width: 1280, height: 720 } })

async function clickWorldPoint(page: import('@playwright/test').Page, point: { x: number; y: number }) {
  const stage = page.locator('.mainline-scene-stage')
  const screenPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
  }, point)
  await stage.click({ position: screenPoint })
}

async function finishReading(page: Page) {
  for(let index=0;index<25;index++){
    const shield=page.locator('[data-scene-dialogue-shield="true"]')
    if(!await shield.count()) return
    await expect(page.locator('[data-scene-observation-typing="true"]')).toHaveCount(0,{timeout:15000})
    await shield.click({force:true})
    await expect(page.locator('[data-scene-echo-phase="leaving"]')).toHaveCount(0)
  }
}

async function seedMilkTeaStreetPosition(page: Page, point: { x: number; y: number }, language: 'zh' | 'en' = 'zh') {
  await page.addInitScript(({ startPoint, selectedLanguage }) => {
    if (localStorage.getItem('newtone-player-save-v1')) return
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: selectedLanguage, hasInitializedLanguage: true }))
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 1,
      currentSceneId: 'commercial-street',
      currentPosition: startPoint,
      scenePositions: { 'commercial-street': startPoint },
      phoneDevice: 'surface',
      storyClock: { stage: 'commercial-street' },
      sceneState: { 'commercial-street': { commercialStreetQuestionNarrativeCompleted: true } },
      phoneNotifications: [],
      phoneNotes: [],
      phoneContactNotes: {},
      phoneCallHistory: [],
      updatedAt: Date.now(),
    }))
  }, { startPoint: point, selectedLanguage: language })
}

async function enterMilkTeaShopFromStreet(page: Page) {
  const region = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  const actor = region.locator('[data-actor-id="protagonist"]')
  const isInside = () => actor.evaluate((node) => {
    const element = node as HTMLElement
    const x = Number(element.dataset.runtimeX), y = Number(element.dataset.runtimeY)
    return x >= 100 && x <= 122 && y >= 64 && y <= 116
  })
  if (await isInside().catch(() => false)) return
  const entrance = page.locator('[data-focus-target-group="door:street-milktea-entry"]')
  if (await entrance.count() > 0) await entrance.click()
  else await clickWorldPoint(page, { x: 111, y: 54 })
  await expect.poll(isInside, { timeout: 30_000 }).toBe(true)
}
test('the storefront portal enters and exits the Milk Tea display region', async ({ page }) => {
  await seedMilkTeaStreetPosition(page, { x: 105, y: 57 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await enterMilkTeaShopFromStreet(page)
  await expect(page.locator('[data-milk-tea-order-status="none"]')).toHaveCount(1)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible()
  await page.locator('[data-focus-target-group="door:street-milktea-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 30_000 })
})

test('a first physical visit unlocks the Phone app, while ordering stays remote and pickup stays physical', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  const readyEvents: unknown[] = []
  test.setTimeout(120_000)
  await page.route('**/rest/v1/analytics_events**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '[]')
    const events = Array.isArray(body) ? body : [body]
    const matchingEvents = events.filter((event) => event?.event_name === 'milk_tea_order_ready')
    readyEvents.push(...matchingEvents)
    await route.fulfill({ status: 201, body: '' })
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await seedMilkTeaStreetPosition(page, { x: 105, y: 57 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await page.waitForFunction(() => {
    const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Boolean(actor && Math.abs(Number(actor.dataset.runtimeX) - 105) < 1 && Math.abs(Number(actor.dataset.runtimeY) - 57) < 1)
  }, undefined, { timeout: 30_000 })
  await enterMilkTeaShopFromStreet(page)
  await page.locator('button[data-npc-id="milk-tea-clerk"]').click()
  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible({ timeout: 30_000 })
  await expect(phone.locator('[data-app-view="milk-tea"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-milk-tea-order-phase]')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-unlocked.png') })

  await phone.getByRole('button', { name: '黑糖珍珠奶茶', exact: true }).click()
  await phone.getByRole('button', { name: '正常', exact: true }).click()
  await phone.getByRole('button', { name: '少冰', exact: true }).click()
  await phone.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(phone.getByText('取餐号 001', { exact: true })).toBeVisible()
  await expect(phone.getByText(/前.{0,2}还有/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-pending.png') })

  await page.keyboard.press('Escape'); await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
  await expect(phone).not.toHaveClass(/is-open/)
  await finishReading(page)
  const notification = page.locator('[data-notification-app="milk-tea"]')
  await page.locator('[data-focus-target-group="door:street-milktea-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible()
  await expect(phone.locator('.world-phone__notification-dot')).toBeVisible({ timeout: 45000 })
  await expect(phone).toHaveAttribute('data-phone-phase', 'closed')
  await page.getByLabel('打开手机').click()
  await expect(notification).toContainText('柜台取餐')
  await expect(phone).toHaveClass(/is-open/)
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await page.screenshot({ path: testInfo.outputPath('milk-tea-notification.png') })
  await page.locator('.world-phone__lock-hint').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'true')
  await page.reload()
  await finishReading(page)
  await page.getByLabel('打开手机').click()
  await expect(phone.getByLabel('手机通知')).toContainText('柜台取餐')
  await page.locator('.world-phone__lock-hint').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'true')
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.locator('[data-milk-tea-status="ready"]')).toBeVisible()
  await phone.getByLabel('返回手机主屏').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'false')
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.locator('[data-milk-tea-status="ready"]')).toBeVisible()
  await expect(phone.getByRole('button', { name: /取餐|领取/ })).toHaveCount(0)
  await page.waitForFunction(() => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    const state = save.sceneState?.['commercial-street'] ?? {}
    return state.commercialStreetMilkTeaReadyAnalyticsMarker === `${state.commercialStreetMilkTeaOrderNumber}:${state.commercialStreetMilkTeaReadyAt}`
  })
  await page.waitForLoadState('networkidle')
  const readyEventCount = readyEvents.length
  expect(readyEventCount).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-ready.png') })
  await page.keyboard.press('Escape'); await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')

  await page.reload()
  await page.getByLabel('打开手机').click()
  await page.locator('.world-phone [data-app="milk-tea"]').click()
  await expect(phone.locator('[data-milk-tea-status="ready"]')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(readyEvents).toHaveLength(readyEventCount)
  await page.keyboard.press('Escape'); await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')

  await enterMilkTeaShopFromStreet(page)
  await page.getByRole('button', { name: /Counter|柜台/ }).nth(1).click()
  await expect(page.locator('[data-scene-echo]')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: testInfo.outputPath('milk-tea-picked-up.png') })
  await page.reload()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  const icon = page.getByLabel('修杰带着奶茶，点击饮用')
  const iconBox = (await icon.boundingBox())!, dotBox = (await page.locator('.scene-protagonist__dot').boundingBox())!
  expect(iconBox.x - (dotBox.x + dotBox.width)).toBeGreaterThan(5)
  expect(await icon.evaluate(e => getComputedStyle(e).animationName)).toBe('held-drink-glow')
  await icon.hover()
  await expect(icon).toHaveCSS('transform', /matrix\(1\.18/)
  await page.screenshot({ path: testInfo.outputPath('milk-tea-hover.png') })
  await icon.click()
  await expect(page.locator('[data-scene-echo="commercial-south-slot-5"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '喝掉奶茶', exact: true })).toBeVisible()
  await expect(page.locator('[data-scene-action="commercial-south-slot-5"]')).toHaveCSS('opacity', '1')
  await page.screenshot({ path: testInfo.outputPath('milk-tea-direct-action.png') })
  await page.getByRole('button', { name: '喝掉奶茶', exact: true }).click()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('milk-tea-consumed.png') })
  await page.reload()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toHaveCount(0)
  await finishReading(page)
  await enterMilkTeaShopFromStreet(page)
  await page.getByRole('button', { name: /Scan to Order|扫码点单/ }).click()
  await expect(phone.locator('[data-app-view="milk-tea"]')).toBeVisible({ timeout: 30_000 })
  await phone.getByRole('button', { name: '原味奶茶', exact: true }).click()
  await phone.getByRole('button', { name: '少糖', exact: true }).click()
  await phone.getByRole('button', { name: '去冰', exact: true }).click()
  await phone.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(phone.getByText('取餐号 002', { exact: true })).toBeVisible()
  await expect(phone.locator('[data-milk-tea-status="pending"]')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('the unlocked app remains usable for remote status checks in Café without creating a physical pickup', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe')
  await page.evaluate(() => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected a player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'] = {
      commercialStreetMilkTeaAppUnlocked: true,
      commercialStreetMilkTeaOrderNumber: 37,
      commercialStreetMilkTeaLastOrderNumber: 37,
      commercialStreetMilkTeaDrink: '原味奶茶',
      commercialStreetMilkTeaSugar: '少糖',
      commercialStreetMilkTeaIce: '去冰',
      commercialStreetMilkTeaCreatedAt: Date.now() - 5_000,
      commercialStreetMilkTeaReadyAt: Date.now() + 15_000,
      commercialStreetMilkTeaQueueAhead: 2,
    }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  })
  await page.reload()
  await page.getByLabel('打开手机').click()
  await page.locator('.world-phone [data-app="milk-tea"]').click()
  await expect(page.getByText('取餐号 037', { exact: true })).toBeVisible()
  await expect(page.getByText('制作中', { exact: true })).toBeVisible()
  await expect(page.getByText(/前.{0,2}还有/)).toBeVisible()
  await expect(page.getByRole('button', { name: /取餐|领取/ })).toHaveCount(0)
})
