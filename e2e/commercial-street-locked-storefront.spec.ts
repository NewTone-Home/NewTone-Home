import { expect, test } from '@playwright/test'
import { mainlineStorefrontApproach, mainlineScenes } from '../src/center/runtime/mainlineScenes'

test('clicking the locked milk tea portal shows its locked passage text without starting the order action', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')

  const street = mainlineScenes['commercial-street']
  const milkTea = street.storefronts.find((storefront) => storefront.id === 'commercial-south-slot-5')!
  const passage = street.passages.find((candidate) => candidate.portalId === milkTea.portalId)!
  const stage = page.locator('.mainline-scene-stage')
  const approach = mainlineStorefrontApproach(street, milkTea)
  const approachPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
  }, approach)
  await stage.click({ position: approachPoint })
  await page.waitForFunction(({ x, y }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < .6)
  }, approach, { timeout: 20_000 })
  const door = page.locator(`button[data-storefront-cell-id="${milkTea.id}-cell-2"]`)
  const echo = page.locator(`[data-scene-echo="${passage.entityId}"]`)
  const phone = page.locator('.world-phone')

  await expect(door).toHaveCount(1)
  await door.click()
  await expect(echo).toBeVisible({ timeout: 20_000 })
  await expect(echo).toContainText(passage.lockedText!.replace(/[。.!！?？]+$/, ''))
  await expect(phone).not.toHaveClass(/is-open/)
})

test('clicking the left-side fast-food entry crosses into its same-scene shell', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')

  const street = mainlineScenes['commercial-street']
  const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-south-slot-2')!
  const passage = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
  const room = street.rooms.find((candidate) => candidate.id === 'commercial-south-s2-interior')!
  const stage = page.locator('.mainline-scene-stage')
  const approach = mainlineStorefrontApproach(street, storefront)
  const approachPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
  }, approach)
  await stage.click({ position: approachPoint })
  await page.waitForFunction(({ x, y }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < .6)
  }, approach, { timeout: 20_000 })
  await page.locator(`button[data-storefront-cell-id="${storefront.id}-character-1"]`).click()
  await page.waitForFunction(({ x, y, width, height }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    const px = Number(player?.dataset.runtimeX)
    const py = Number(player?.dataset.runtimeY)
    return Boolean(player && px >= x && px <= x + width && py >= y && py <= y + height)
  }, room.bounds, { timeout: 20_000 })
  await expect(stage).toHaveAttribute('data-mainline-scene', 'commercial-street')
  expect(passage.targetSceneId).toBeUndefined()
})

test('clicking the north N2 entry crosses into its same-scene shell', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')

  const street = mainlineScenes['commercial-street']
  const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-north-slot-2')!
  const passage = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
  const room = street.rooms.find((candidate) => candidate.id === 'commercial-north-n2-interior')!
  const stage = page.locator('.mainline-scene-stage')
  const approach = mainlineStorefrontApproach(street, storefront)
  const approachPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
  }, approach)
  await stage.click({ position: approachPoint })
  await page.waitForFunction(({ x, y }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < .6)
  }, approach, { timeout: 20_000 })
  await page.locator(`button[data-storefront-cell-id="${storefront.id}-character-1"]`).click()
  await page.waitForFunction(({ x, y, width, height }) => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    const px = Number(player?.dataset.runtimeX)
    const py = Number(player?.dataset.runtimeY)
    return Boolean(player && px >= x && px <= x + width && py >= y && py <= y + height)
  }, room.bounds, { timeout: 20_000 })
  await expect(stage).toHaveAttribute('data-mainline-scene', 'commercial-street')
  expect(passage.targetSceneId).toBeUndefined()
})
