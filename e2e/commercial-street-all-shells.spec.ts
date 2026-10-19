import { expect, test, type Page } from '@playwright/test'
import { mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'

const street = mainlineScenes['commercial-street']

const roomFor = (storefrontId: string) => street.rooms.find((room) => (
  room.id === (storefrontId === 'commercial-cafe-slot'
    ? 'commercial-north-cafe-interior'
    : `commercial-${storefrontId.includes('-north-') ? 'north' : 'south'}-${storefrontId.includes('-north-') ? 'n' : 's'}${storefrontId.match(/-slot-(\d+)$/)?.[1]}-interior`)
))!

async function walkTo(page: Page, target: { x: number; y: number }) {
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  for (let step = 0; step < 80; step += 1) {
    const current = await actor.evaluate((element) => ({
      x: Number((element as HTMLElement).dataset.runtimeX),
      y: Number((element as HTMLElement).dataset.runtimeY),
    }))
    const distance = Math.hypot(target.x - current.x, target.y - current.y)
    if (distance < .7) return
    const hop = Math.min(8, distance)
    const waypoint = {
      x: current.x + (target.x - current.x) * hop / distance,
      y: current.y + (target.y - current.y) * hop / distance,
    }
    const screenPoint = await stage.evaluate((element, point) => {
      const rect = element.getBoundingClientRect()
      const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
      const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
      return { x: rect.width * (point.x + cameraX) / 100, y: rect.height * (point.y + cameraY) / 100 }
    }, waypoint)
    await stage.click({ position: screenPoint })
    await page.waitForFunction(({ x, y }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < .7)
    }, waypoint, { timeout: 20_000 })
  }
  throw new Error(`Actor did not walk to ${target.x},${target.y}`)
}

test('all fourteen storefronts enter and leave their empty same-scene shells through the front door', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')

  for (const storefront of street.storefronts) {
    const room = roomFor(storefront.id)
    const approach = mainlineStorefrontApproach(street, storefront)
    const entry = street.passages.find((passage) => passage.portalId === storefront.portalId)!
    await walkTo(page, approach)

    const door = page.locator(`button[data-storefront-cell-id="${storefront.id}-character-1"]`)
    await expect(door, storefront.id).toHaveCount(1)
    await expect(door).toBeVisible()
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

    const interiorCenter = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    await walkTo(page, interiorCenter)
    const inside = entry.crossingTargets[0]!
    await walkTo(page, inside)
    await expect(door).toBeVisible()
    await door.click()
    const outside = entry.crossingTargets[1]!
    await page.waitForFunction(({ x, y }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < 1)
    }, outside, { timeout: 20_000 })
    await expect(stage).toHaveAttribute('data-mainline-scene', 'commercial-street')
  }
})
