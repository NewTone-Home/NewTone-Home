import { expect, test, type Page } from '@playwright/test'
import {
  commercialStreetShopEntry,
  commercialStreetShopPortalId,
  commercialStreetShops,
} from '../src/center/runtime/commercialStreetWorldLayout'

async function verifyShopDoor(page: Page, shop: (typeof commercialStreetShops)[number]) {
  const entry = commercialStreetShopEntry(shop)
  await page.addInitScript(({ startPoint }) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'zh', hasInitializedLanguage: true }))
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 1,
      currentSceneId: 'commercial-street',
      currentPosition: startPoint,
      scenePositions: { 'commercial-street': startPoint },
      phoneDevice: 'surface',
      storyClock: { stage: 'commercial-street' },
      sceneState: { 'commercial-street': { commercialStreetQuestionNarrativeCompleted: true } },
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now(),
    }))
  }, { startPoint: entry.streetApproach })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  await expect(street).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentSceneId)).toBe('commercial-street')

  const portalId = commercialStreetShopPortalId(shop)
  const group = `door:${portalId}`
  const storefrontId = shop.kind === 'cafe' ? 'commercial-cafe-slot' : shop.storefrontIds[0]!
  const labelSelector = `[data-storefront-label-slot="true"][data-storefront-id="${storefrontId}"]`
  const doorSelector = `.scene-mainline-door-button[data-focus-target-group="${group}"]`
  const label = page.locator(labelSelector)
  const door = page.locator(doorSelector)
  await expect(label).toBeVisible()
  await expect(door).toBeVisible()

  const overlaps = await page.evaluate(({ labelSelector, doorSelector }) => {
    const labelRect = document.querySelector(labelSelector)?.getBoundingClientRect()
    const doorRect = document.querySelector(doorSelector)?.getBoundingClientRect()
    if (!labelRect || !doorRect) return null
    return Math.min(labelRect.right, doorRect.right) - Math.max(labelRect.left, doorRect.left) > 2
      && Math.min(labelRect.bottom, doorRect.bottom) - Math.max(labelRect.top, doorRect.top) > 2
  }, { labelSelector, doorSelector })
  expect(overlaps, `${shop.id} sign label must not overlap its door`).toBe(false)

  const actor = street.locator('[data-actor-id="protagonist"]')
  const startPosition = await actor.evaluate((node) => {
    const element = node as HTMLElement
    return { x: Number(element.dataset.runtimeX), y: Number(element.dataset.runtimeY) }
  })
  await door.click()
  await expect(page.getByText('本期暂未开放。')).toBeVisible()
  await expect(street).not.toHaveAttribute('data-active-display-region')
  await expect.poll(() => actor.evaluate((node) => {
    const element = node as HTMLElement
    return { x: Number(element.dataset.runtimeX), y: Number(element.dataset.runtimeY) }
  })).toEqual(startPosition)
}

for (const shop of commercialStreetShops) {
  test(`${shop.id}: storefront label clears the door and entry is locked`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1280, height: 720 })
    await verifyShopDoor(page, shop)
  })
}
