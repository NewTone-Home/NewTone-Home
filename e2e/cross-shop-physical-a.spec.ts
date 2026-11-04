import { expect, test, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetQuestionNarrativeCompletedKey } from '../src/center/runtime/commercialStreetQuestionNarrative'
import { mainlineSceneRoomAtPosition } from '../src/center/runtime/mainlineSceneModel'

test.use({ viewport: { width: 1280, height: 720 } })

const street = mainlineScenes['commercial-street']
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
  const room = street.rooms.find(item => item.id === (id === 'commercial-north-slot-1' ? 'commercial-north-n1-interior' : 'commercial-south-s5-interior'))!
  const entry = street.passages.find(passage => passage.portalId === storefront.portalId)!
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
  return { door, room, entry }
}

async function exitStorefront(page: Page, door: ReturnType<Page['locator']>, entry: (typeof street.passages)[number]) {
  await closePhone(page)
  const before = await page.evaluate((target) => {
    const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')
    const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    const phone = document.querySelector<HTMLElement>('.world-phone')
    return { sceneId: stage?.dataset.mainlineScene ?? null, x: Number(actor?.dataset.runtimeX), y: Number(actor?.dataset.runtimeY), phoneOpen: phone?.getAttribute('data-phone-open') ?? null, phonePhase: phone?.dataset.phonePhase ?? null, dialogueState: stage?.dataset.sceneDialogueState ?? null, dialogue: document.querySelector('[data-scene-dialogue]')?.textContent?.trim() ?? null, target }
  }, entry.crossingTargets[0])
  const activeRoom = mainlineSceneRoomAtPosition(street, { x: before.x, y: before.y })?.id ?? null
  console.log(`[cross-shop exit diagnostic] ${JSON.stringify({ ...before, activeRoom, portalId: entry.portalId, doorCount: await door.count() })}`)
  await walkTo(page, entry.crossingTargets[0]!)
  await expect(door).toBeVisible()
  await door.click()
  await page.waitForFunction(({ x, y }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < 1)
  }, entry.crossingTargets[1]!, { timeout: 20_000 })
}

async function closePhone(page: Page) {
  const phone = page.locator('.world-phone')
  const dismissRegion = page.locator('.world-phone__dismiss-region')
  if (await phone.getAttribute('data-phone-open') === 'true' || await dismissRegion.count() > 0) {
    await dismissRegion.click()
    await expect(phone).toHaveAttribute('data-phone-open', 'false')
  }
  await expect(dismissRegion).toHaveCount(0, { timeout: 3_000 })
}

async function orderFromCounter(page: Page, entityId: string, productId: string, expectsOptions: boolean) {
  const interaction = page.locator(`button[data-counter-service-id="${entityId}"]`)
  await expect(interaction).toBeVisible()
  await interaction.click()
  const shop = page.locator('.shop-order-app')
  await expect(shop).toBeVisible({ timeout: 20_000 })
  await shop.locator(`[data-shop-product-id="${productId}"]`).click()
  if (expectsOptions) {
    await shop.locator('fieldset').nth(0).getByRole('button').first().click()
    await shop.locator('fieldset').nth(1).getByRole('button').last().click()
  }
  await shop.getByRole('button', { name: /确认下单/ }).click()
  await expect(shop.locator('[data-order-status="ready"]')).toBeVisible({ timeout: 40_000 })
}

test('physical storefront orders and held item persist through reload', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(({ completedKey }) => {
    sessionStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    if (sessionStorage.getItem('newtone-e2e-shop-orders-synthetic-save-v1') !== '1') {
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
    }
  }, { completedKey: commercialStreetQuestionNarrativeCompletedKey })
  await page.goto('/?scene=commercial-street&e2eShopOrders=1&debugRuntimeEvidence=1')
  await expect(page.locator('.center-experience')).toBeVisible()
  await expect(page.locator('[data-scene-dialogue]')).toHaveCount(0)
  const actor = page.locator('[data-actor-id="protagonist"]')

  const milk = await enterStorefront(page, 'commercial-south-slot-5')
  await orderFromCounter(page, 'commercial-s5-milk-tea-order-service-label', 'original-milk-tea', true)
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders?.['commercial-south-slot-5']?.status)).toBe('queued')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
  await closePhone(page)
  await exitStorefront(page, milk.door, milk.entry)

  const fruit = await enterStorefront(page, 'commercial-north-slot-1')
  await orderFromCounter(page, 'fruit-tea-trial-order', 'passionfruit-green-tea', true)
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders?.['commercial-north-slot-1']?.status)).toBe('queued')
  await closePhone(page)

  const fruitPickup = page.locator('button[data-counter-service-id="fruit-tea-trial-pickup"]')
  await fruitPickup.click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable?.shopId)).toBe('commercial-north-slot-1')
  await exitStorefront(page, fruit.door, fruit.entry)

  const milkAgain = await enterStorefront(page, 'commercial-south-slot-5')
  const milkPickup = page.locator('button[data-counter-service-id="commercial-s5-milk-tea-pickup-service-label"]')
  await milkPickup.click()
  await expect(page.locator('.center-experience__boundary')).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders?.['commercial-south-slot-5']?.status)).toBe('queued')
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable?.shopId)).toBe('commercial-north-slot-1')
  await page.locator('.scene-protagonist__held-action').click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable)).toBeNull()
  await milkPickup.click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable?.shopId)).toBe('commercial-south-slot-5')
  await page.reload()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable?.shopId)).toBe('commercial-south-slot-5')
  expect(await actor.count()).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
  const sessionSnapshot = await page.evaluate(() => Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, index) => {
    const key = sessionStorage.key(index)!
    return [key, sessionStorage.getItem(key)!]
  })))
  const saveKey = 'newtone-player-save-v1'
  const savedPlayer = JSON.parse(sessionSnapshot[saveKey] ?? '{}')
  expect(savedPlayer.heldConsumable).toMatchObject({ shopId: 'commercial-south-slot-5', productId: 'original-milk-tea', kind: 'drink' })
  const storageStatePath = resolve('.test-tmp/a-held.storage.json')
  const sessionStatePath = resolve('.test-tmp/a-held.session.json')
  await mkdir(dirname(storageStatePath), { recursive: true })
  await page.context().storageState({ path: storageStatePath })
  await writeFile(sessionStatePath, JSON.stringify(sessionSnapshot, null, 2), 'utf8')
  const persistedSession = JSON.parse(await readFile(sessionStatePath, 'utf8')) as Record<string, string>
  const persistedHeld = JSON.parse(persistedSession[saveKey] ?? '{}').heldConsumable
  expect(persistedHeld).toEqual(savedPlayer.heldConsumable)
  console.log(`[A saved held state] ${JSON.stringify({ storageStatePath, sessionStatePath, held: persistedHeld, shopOrders: savedPlayer.shopOrders })}`)
})
