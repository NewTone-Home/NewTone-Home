import { expect, test, type Page } from '@playwright/test'
import {mainlineScenes,mainlineStorefrontInteractionRegion} from '../src/center/runtime/mainlineScenes'

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
test('the Milk Tea storefront interaction surface works from west, center, and east approaches during normal NPC activity', async ({ page }) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const phone = page.locator('.world-phone')
  for (const start of [{ x: 78, y: 54 }, { x: 110, y: 54 }, { x: 142, y: 54 }]) {
    await clickWorldPoint(page, start)
    await page.waitForFunction(({ x, y }) => {
      const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(actor && Math.hypot(Number(actor.dataset.runtimeX) - x, Number(actor.dataset.runtimeY) - y) < .6)
    }, start, { timeout: 30_000 })
    await page.getByRole('button', { name: '奶茶店', exact: true }).click()
    await expect(phone).toHaveClass(/is-open/, { timeout: 30_000 })
    const arrived = {
      x: Number(await protagonist.getAttribute('data-runtime-x')),
      y: Number(await protagonist.getAttribute('data-runtime-y')),
    }
    expect(arrived.x).toBeGreaterThan(101)
    expect(arrived.x).toBeLessThan(121)
    const region=mainlineStorefrontInteractionRegion(mainlineScenes['commercial-street'],mainlineScenes['commercial-street'].storefronts.find(s=>s.id==='commercial-south-slot-5')!)
    expect(Math.hypot(arrived.x-region.center.x,arrived.y-region.center.y)).toBeLessThanOrEqual(region.radius+.01)
    expect((arrived.x-region.center.x)*region.outward.x+(arrived.y-region.center.y)*region.outward.y).toBeGreaterThanOrEqual(0)
    await page.getByLabel('收起手机').click()
    await expect(phone).not.toHaveClass(/is-open/)
  }
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

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const store = page.getByRole('button', { name: '奶茶店', exact: true })
  await store.click()
  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible({ timeout: 30_000 })
  await expect(phone.getByText('远程点单', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-milk-tea-order-phase]')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-unlocked.png') })

  await phone.getByRole('button', { name: '黑糖珍珠奶茶', exact: true }).click()
  await phone.getByRole('button', { name: '正常', exact: true }).click()
  await phone.getByRole('button', { name: '少冰', exact: true }).click()
  await phone.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(phone.getByText('取餐号 001', { exact: true })).toBeVisible()
  await expect(phone.getByText(/前方还有/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-pending.png') })

  await page.getByLabel('收起手机').click()
  await expect(phone).not.toHaveClass(/is-open/)
  await finishReading(page)
  const notification = page.locator('[data-notification-app="milk-tea"]')
  await expect(notification).toContainText('奶茶已制作完成', { timeout: 45000 })
  await expect(phone).toHaveClass(/is-open/)
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await page.screenshot({ path: testInfo.outputPath('milk-tea-notification.png') })
  await page.locator('.world-phone__lock-hint').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'true')
  await page.reload()
  await finishReading(page)
  await page.getByLabel('打开手机').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'true')
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.getByText('已完成', { exact: true })).toBeVisible()
  await phone.getByLabel('返回手机主屏').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'false')
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.getByText('请到商业街奶茶店取餐。', { exact: true })).toBeVisible()
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
  await page.getByLabel('收起手机').click()

  await page.reload()
  await page.getByLabel('打开手机').click()
  await page.locator('.world-phone [data-app="milk-tea"]').click()
  await expect(page.getByText('已完成', { exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(readyEvents).toHaveLength(readyEventCount)
  await page.getByLabel('收起手机').click()

  await page.getByRole('button', { name: '奶茶店', exact: true }).click()
  await expect(page.locator('[data-scene-echo="commercial-south-slot-5"]')).toContainText('取到奶茶', { timeout: 15_000 })
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
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
  await page.getByRole('button', { name: '奶茶店', exact: true }).click()
  await expect(phone.getByText('远程点单', { exact: true })).toBeVisible({ timeout: 30000 })
  await phone.getByRole('button', { name: '原味奶茶', exact: true }).click()
  await phone.getByRole('button', { name: '少糖', exact: true }).click()
  await phone.getByRole('button', { name: '去冰', exact: true }).click()
  await phone.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(phone.getByText('取餐号 002', { exact: true })).toBeVisible()
  await page.getByLabel('收起手机').click()
  await expect(page.locator('[data-notification-app="milk-tea"]')).toBeVisible({ timeout: 45000 })
  await page.locator('[data-notification-app="milk-tea"]').click()
  await expect(phone.getByText('已完成', { exact: true })).toBeVisible()
  await phone.getByLabel('返回手机主屏').click()
  await expect(phone.locator('[data-app="milk-tea"]')).toHaveAttribute('data-unread', 'false')
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
  await expect(page.getByText(/前方还有/)).toBeVisible()
  await expect(page.getByRole('button', { name: /取餐|领取/ })).toHaveCount(0)
})
