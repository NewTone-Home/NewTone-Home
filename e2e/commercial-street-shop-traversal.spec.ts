import { expect, test, type Page } from '@playwright/test'
import {
  commercialStreetShopEntry,
  commercialStreetShopPortalId,
  commercialStreetShopRegionId,
  commercialStreetShops,
} from '../src/center/runtime/commercialStreetWorldLayout'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const regularShops = commercialStreetShops.filter((shop) => shop.kind !== 'cafe' && shop.kind !== 'milk-tea')
const streetScene = mainlineScenes['commercial-street']

function streetRegionFor(shop: (typeof regularShops)[number]) {
  const x = commercialStreetShopEntry(shop).x
  return x < 72 ? 'commercial-street-west' : x < 136 ? 'commercial-street-center' : 'commercial-street-east'
}

async function verifyShop(page: Page, shop: (typeof regularShops)[number], testInfo: import('@playwright/test').TestInfo) {
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
  const actor = street.locator('[data-actor-id="protagonist"]')
  await expect.poll(() => actor.evaluate((node) => {
    const element = node as HTMLElement
    return { x: Number(element.dataset.runtimeX), y: Number(element.dataset.runtimeY) }
  })).toEqual(entry.streetApproach)

  const portalId = commercialStreetShopPortalId(shop)
  const exteriorDoorGroup = `door:${portalId}`
  const storefrontId = shop.storefrontIds[0]!
  const sign = page.locator(`[data-storefront-label-slot="true"][data-storefront-id="${storefrontId}"]`)
  const doorButton = page.locator(`.scene-mainline-door-button[data-focus-target-group="${exteriorDoorGroup}"]`)
  await expect(sign).toHaveText(shop.label.zh)
  await expect(doorButton).toContainText('门')
  const [signBox, doorBox] = await Promise.all([sign.boundingBox(), doorButton.boundingBox()])
  expect(signBox, `${shop.id} name sign`).not.toBeNull()
  expect(doorBox, `${shop.id} clickable door`).not.toBeNull()
  const overlapX = Math.min(signBox!.x + signBox!.width, doorBox!.x + doorBox!.width) - Math.max(signBox!.x, doorBox!.x)
  const overlapY = Math.min(signBox!.y + signBox!.height, doorBox!.y + doorBox!.height) - Math.max(signBox!.y, doorBox!.y)
  expect(overlapX <= 2 || overlapY <= 2, `${shop.id} name overlaps its 门 door glyph`).toBe(true)
  await expect(page.locator(`[data-focus-target-group="${exteriorDoorGroup}"]`)).toBeVisible({ timeout: 30_000 })
  await page.locator(`[data-focus-target-group="${exteriorDoorGroup}"]`).click()
  await expect(street).toHaveAttribute('data-active-display-region', commercialStreetShopRegionId(shop), { timeout: 30_000 })

  const furniture = streetScene.objects.filter((entity) => entity.id.startsWith(`${shop.id}-`) && entity.shopFurnitureVisual)
  expect(furniture.length, `${shop.id} should define three class-specific fixtures`).toBe(3)
  for (const entity of furniture) {
    const object = page.locator(`[data-object-id="${entity.id}"]`)
    await expect(object).toBeVisible()
    await expect(object.locator('.scene-shop-furniture-art')).toBeVisible()
    await expect(object.locator('.scene-shop-furniture-label')).toHaveText(entity.label)
  }
  const furnitureOverlaps = await page.locator('.scene-shop-furniture-label').evaluateAll((nodes) => {
    const boxes = nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { id: node.closest<HTMLElement>('[data-object-id]')?.dataset.objectId ?? '', left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    })
    const overlaps: Array<[string, string]> = []
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) overlaps.push([a.id, b.id])
    }
    return overlaps
  })
  expect(furnitureOverlaps).toEqual([])

  if (shop.kind === 'bookstore') {
    await expect(page.locator(`[data-object-id="${shop.id}-fixture-a"] .scene-shop-furniture-art`)).toBeVisible()
    expect(furniture.find((entity) => entity.id.endsWith('-fixture-a'))?.shopFurnitureVisual).toBe('bookshelf')
    expect(furniture.find((entity) => entity.id.endsWith('-fixture-b'))?.shopFurnitureVisual).toBe('table')
    await page.screenshot({ path: testInfo.outputPath('bookstore-interior.png') })
  }

  await expect(page.locator(`[data-focus-target-group="door:${portalId}"]`)).toBeVisible({ timeout: 30_000 })
  await page.locator(`[data-focus-target-group="door:${portalId}"]`).click()
  await expect(street).toHaveAttribute('data-active-display-region', streetRegionFor(shop), { timeout: 30_000 })
}

for (const shop of regularShops) {
  test(`${shop.id}: street door enters, class-specific fixtures render, and the door returns to street`, async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1280, height: 720 })
    await verifyShop(page, shop, testInfo)
  })
}
