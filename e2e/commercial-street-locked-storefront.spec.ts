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

test('clicking the left-side simple-meal storefront entry shows its locked passage text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')

  const street = mainlineScenes['commercial-street']
  const simpleMeal = street.storefronts.find((storefront) => storefront.id === 'commercial-south-slot-2')!
  const passage = street.passages.find((candidate) => candidate.portalId === simpleMeal.portalId)!
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  const approach = mainlineStorefrontApproach(street, simpleMeal)
  const echo = page.locator(`[data-scene-echo="${passage.entityId}"]`)
  const signs = page.locator(`[data-storefront-cell-id^="${simpleMeal.id}-cell-"]`).filter({ hasText: /简|餐/ })
  await expect(signs).toHaveCount(2)

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

  const door = page.locator(`button[data-storefront-cell-id="${simpleMeal.id}-cell-1"]`)
  await expect(signs).toHaveCount(0)
  await expect(door).toHaveCount(1)
  await door.click()
  await expect(echo).toBeVisible({ timeout: 20_000 })
  await expect(echo).toContainText(passage.lockedText!.replace(/[。.!！?？]+$/, ''))
})
