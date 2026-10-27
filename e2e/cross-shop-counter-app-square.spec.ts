import { expect, test, type Page } from '@playwright/test'
import { mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineWorldScale } from '../src/center/runtime/mainlineViewport'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { commercialStreetQuestionNarrativeCompletedKey } from '../src/center/runtime/commercialStreetQuestionNarrative'
import { mainlineSceneRoomAtPosition } from '../src/center/runtime/mainlineSceneModel'

test.use({ viewport: { width: 1280, height: 720 } })

const street = mainlineScenes['commercial-street']

async function closePhone(page: Page) {
  const phone = page.locator('.world-phone')
  const dismissRegion = page.locator('.world-phone__dismiss-region')
  if (await phone.getAttribute('data-phone-open') === 'true' || await dismissRegion.count() > 0) {
    await dismissRegion.click()
    await expect(phone).toHaveAttribute('data-phone-open', 'false')
  }
  await expect(dismissRegion).toHaveCount(0, { timeout: 3_000 })
}

async function walkTo(page: Page, target: { x: number; y: number }) {
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  for (let step = 0; step < 80; step += 1) {
    const current = await actor.evaluate(element => ({
      x: Number((element as HTMLElement).dataset.runtimeX),
      y: Number((element as HTMLElement).dataset.runtimeY),
    }))
    const distance = Math.hypot(target.x - current.x, target.y - current.y)
    if (distance < .7) return
    const stageBox = await stage.boundingBox()
    if (!stageBox) throw new Error('Scene stage is not visible')
    const camera = await stage.evaluate(element => ({
      x: Number(element.getAttribute('data-camera-offset-x') ?? 0),
      y: Number(element.getAttribute('data-camera-offset-y') ?? 0),
    }))
    const scale = mainlineWorldScale({ width: stageBox.width, height: stageBox.height })
    const hop = Math.min(8, distance)
    const waypoint = { x: current.x + (target.x - current.x) * hop / distance, y: current.y + (target.y - current.y) * hop / distance }
    const screenPoint = {
      x: stageBox.width / 2 + scale * ((waypoint.x + camera.x) / 100 * sceneDesignReferenceMetrics.width - sceneDesignReferenceMetrics.width / 2),
      y: stageBox.height / 2 + scale * ((waypoint.y + camera.y) / 100 * sceneDesignReferenceMetrics.height - sceneDesignReferenceMetrics.height / 2),
    }
    await closePhone(page)
    await stage.click({ position: screenPoint, force: true })
    await page.waitForFunction(({ x, y }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < .7)
    }, waypoint, { timeout: 20_000 })
  }
  throw new Error(`Actor did not walk to ${target.x},${target.y}`)
}

async function enterStorefront(page: Page, id: string) {
  await closePhone(page)
  const storefront = street.storefronts.find(store => store.id === id)!
  const roomId = id === 'commercial-north-slot-1' ? 'commercial-north-n1-interior' : 'commercial-south-s5-interior'
  const room = street.rooms.find(item => item.id === roomId)!
  await walkTo(page, street.initialPlayerPosition)
  await walkTo(page, mainlineStorefrontApproach(street, storefront))
  const door = page.locator(`button[data-storefront-cell-id="${id}-character-1"]`)
  await expect(door).toBeVisible()
  await door.click()
  await page.waitForFunction(({ x, y, width, height }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    const px = Number(player?.dataset.runtimeX), py = Number(player?.dataset.runtimeY)
    return Boolean(player && px >= x && px <= x + width && py >= y && py <= y + height)
  }, room.bounds, { timeout: 20_000 })
  const position = await page.locator('[data-actor-id="protagonist"]').evaluate(element => ({
    x: Number((element as HTMLElement).dataset.runtimeX), y: Number((element as HTMLElement).dataset.runtimeY),
  }))
  expect(mainlineSceneRoomAtPosition(street, position)?.id).toBe(roomId)
  return { room, roomId }
}

async function openAtCounter(page: Page, serviceId: string, shopId: string, roomId: string) {
  const service = street.objects.find(object => object.id === serviceId)
  expect(service).toBeDefined()
  const contactSide = service!.interactionContactSides?.[0]
  const nearCounter = { ...service!.position }
  if (contactSide === 'left') nearCounter.x -= 3
  else if (contactSide === 'right') nearCounter.x += 3
  else if (contactSide === 'top') nearCounter.y -= 3
  else if (contactSide === 'bottom') nearCounter.y += 3
  await walkTo(page, nearCounter)
  const position = await page.locator('[data-actor-id="protagonist"]').evaluate(element => ({
    x: Number((element as HTMLElement).dataset.runtimeX), y: Number((element as HTMLElement).dataset.runtimeY),
  }))
  expect(mainlineSceneRoomAtPosition(street, position)?.id).toBe(roomId)
  const square = page.locator(`button[data-counter-app-square="true"][data-counter-service-id="${serviceId}"]`)
  await expect(square).toBeVisible()
  const group = roomId === 'commercial-north-n1-interior' ? 'fruit-tea-trial-L-counter' : 'milk-tea-trial-L-counter'
  const counter = page.locator(`svg[data-counter-outline-group="${group}"]`)
  await expect(counter).toBeVisible()
  await expect(counter).toHaveAttribute('data-interior-active', 'true')
  const counterBox = await counter.boundingBox()
  const squareBox = await square.boundingBox()
  expect(counterBox).not.toBeNull()
  expect(squareBox).not.toBeNull()
  expect(squareBox!.x).toBeGreaterThan(counterBox!.x)
  expect(squareBox!.y).toBeGreaterThan(counterBox!.y)
  expect(squareBox!.x + squareBox!.width).toBeLessThan(counterBox!.x + counterBox!.width)
  expect(squareBox!.y + squareBox!.height).toBeLessThan(counterBox!.y + counterBox!.height)
  const stageBox = await page.locator('.mainline-scene-stage').boundingBox()
  expect(stageBox).not.toBeNull()
  expect(squareBox!.x).toBeGreaterThanOrEqual(stageBox!.x)
  expect(squareBox!.y).toBeGreaterThanOrEqual(stageBox!.y)
  expect(squareBox!.x + squareBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width)
  expect(squareBox!.y + squareBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height)
  await page.locator('.mainline-scene-stage').screenshot({ path: `test-results/${serviceId}.png` })
  const before = await square.evaluate(element => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height, background: style.backgroundColor, border: style.borderColor }
  })
  await square.hover()
  const after = await square.evaluate(element => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height, background: style.backgroundColor, border: style.borderColor }
  })
  expect(after).toEqual(before)
  expect(before.width).toBeGreaterThan(0)
  expect(before.height).toBeGreaterThan(0)
  await square.click()
  await expect(page.locator('.world-phone .world-phone__app-view[data-app-view="milk-tea"]')).toBeVisible()
  await expect(page.locator(`.shop-order-app[data-shop-id="${shopId}"]`)).toBeVisible()
  await closePhone(page)
  await expect(page.locator(`button[data-counter-service-id="${serviceId === 'fruit-tea-trial-app-square' ? 'fruit-tea-trial-order' : 'commercial-s5-milk-tea-order-service-label'}"]`)).toBeVisible()
  const afterClose = await page.locator('[data-actor-id="protagonist"]').evaluate(element => ({
    x: Number((element as HTMLElement).dataset.runtimeX), y: Number((element as HTMLElement).dataset.runtimeY),
  }))
  expect(mainlineSceneRoomAtPosition(street, afterClose)?.id).toBe(roomId)
}

async function startSyntheticStreet(page: Page) {
  await page.addInitScript(({ completedKey }) => {
    sessionStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    sessionStorage.setItem('newtone-e2e-shop-orders-synthetic-save-v1', '1')
    sessionStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2,
      currentSceneId: 'commercial-street',
      currentPosition: null,
      scenePositions: {},
      phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 10, minute: 0, weatherCycle: 'sunny' },
      gameTimeMs: 36_000_000,
      shopOrders: {},
      heldConsumable: null,
      sceneState: { 'commercial-street': { [completedKey]: true } },
      phoneNotifications: [],
      phoneNotes: [],
      phoneContactNotes: {},
      phoneCallHistory: [],
      updatedAt: 1,
    }))
  }, { completedKey: commercialStreetQuestionNarrativeCompletedKey })
  await page.goto('/?scene=commercial-street&e2eShopOrders=1&debugRuntimeEvidence=1')
  await expect(page.locator('.center-experience')).toBeVisible()
  await expect(page.locator('[data-scene-dialogue]')).toHaveCount(0)
}

test('milk tea counter square opens shared app preselected to milk tea; manual counter remains available', async ({ page }) => {
  test.setTimeout(120_000)
  await startSyntheticStreet(page)
  const milk = await enterStorefront(page, 'commercial-south-slot-5')
  await openAtCounter(page, 'commercial-s5-milk-tea-app-square', 'commercial-south-slot-5', milk.roomId)
})

test('fruit tea counter square opens shared app preselected to fruit tea; manual counter remains available', async ({ page }) => {
  test.setTimeout(120_000)
  await startSyntheticStreet(page)
  const fruit = await enterStorefront(page, 'commercial-north-slot-1')
  await openAtCounter(page, 'fruit-tea-trial-app-square', 'commercial-north-slot-1', fruit.roomId)
})
