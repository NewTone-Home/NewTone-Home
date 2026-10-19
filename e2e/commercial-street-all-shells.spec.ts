import { expect, test } from '@playwright/test'
import { mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'

const street = mainlineScenes['commercial-street']

const roomFor = (storefrontId: string) => street.rooms.find((room) => (
  room.id === (storefrontId === 'commercial-cafe-slot'
    ? 'commercial-north-cafe-interior'
    : `commercial-${storefrontId.includes('-north-') ? 'north' : 'south'}-${storefrontId.includes('-north-') ? 'n' : 's'}${storefrontId.match(/-slot-(\d+)$/)?.[1]}-interior`)
))!

test('all fourteen storefronts enter and leave their empty same-scene shells through the front door', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')

  for (const storefront of street.storefronts) {
    const room = roomFor(storefront.id)
    const approach = mainlineStorefrontApproach(street, storefront)
    const screenPoint = await stage.evaluate((element, target) => {
      const rect = element.getBoundingClientRect()
      const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
      const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
      return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
    }, approach)
    await stage.click({ position: screenPoint })
    await page.waitForFunction(({ x, y }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < .6)
    }, approach, { timeout: 20_000 })

    const door = page.locator(`button[data-storefront-cell-id="${storefront.id}-character-1"]`)
    await expect(door, storefront.id).toHaveCount(1)
    await door.click()
    await page.waitForFunction(({ x, y, width, height }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      const px = Number(player?.dataset.runtimeX)
      const py = Number(player?.dataset.runtimeY)
      return Boolean(player && px >= x && px <= x + width && py >= y && py <= y + height)
    }, room.bounds, { timeout: 20_000 })
    await expect(stage).toHaveAttribute('data-mainline-scene', 'commercial-street')
    expect(Number(await actor.getAttribute('data-runtime-x'))).toBeGreaterThanOrEqual(room.bounds.x)
    expect(Number(await actor.getAttribute('data-runtime-y'))).toBeGreaterThanOrEqual(room.bounds.y)
    expect(Number(await actor.getAttribute('data-runtime-x'))).toBeLessThanOrEqual(room.bounds.x + room.bounds.width)
    expect(Number(await actor.getAttribute('data-runtime-y'))).toBeLessThanOrEqual(room.bounds.y + room.bounds.height)

    if (storefront.id === 'commercial-cafe-slot') {
      await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveCount(0)
      await expect(page.locator('[data-scene-dialogue]')).toHaveCount(0)
      await expect(page.locator('[data-actor-id^="cafe-"]')).toHaveCount(0)
    }

    await door.click()
    const entry = street.passages.find((passage) => passage.portalId === storefront.portalId)!
    const outside = entry.crossingTargets[1]!
    await page.waitForFunction(({ x, y }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < 1)
    }, outside, { timeout: 20_000 })
    await expect(stage).toHaveAttribute('data-mainline-scene', 'commercial-street')
  }
})
