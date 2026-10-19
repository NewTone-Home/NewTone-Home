import { expect, test } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const street = mainlineScenes['commercial-street']
const clothing = street.storefronts.find((storefront) => storefront.id === 'commercial-south-slot-7')!

test('a locked storefront notice yields to the next street movement input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const actor = page.locator('[data-actor-id="protagonist"]')
  const echo = page.locator(`[data-scene-echo="${clothing.id}"]`)
  const stage = page.locator('.mainline-scene-stage')

  await page.getByRole('button', { name: clothing.label, exact: true }).first().click()
  await expect(echo).toBeVisible({ timeout: 30_000 })
  await expect(actor).not.toHaveClass(/is-moving/)

  const target = { x: 42, y: 58 }
  const pixels = await stage.evaluate((element, point) => {
    const rect = element.getBoundingClientRect()
    return {
      x: ((point.x + Number(element.getAttribute('data-camera-offset-x') ?? 0)) / 100) * rect.width,
      y: ((point.y + Number(element.getAttribute('data-camera-offset-y') ?? 0)) / 100) * rect.height,
    }
  }, target)
  await stage.click({ position: pixels })
  await expect(actor).toHaveClass(/is-moving/)
  await expect(actor).not.toHaveClass(/is-moving/, { timeout: 30_000 })
  await expect.poll(async () => Number(await actor.getAttribute('data-runtime-x'))).toBeCloseTo(target.x, 0)
  await expect.poll(async () => Number(await actor.getAttribute('data-runtime-y'))).toBeCloseTo(target.y, 0)
})

test('all fourteen exterior storefront doors render as street controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const doorGroups = await page.locator('button[data-focus-target-group^="door:street-"]').evaluateAll((buttons) =>
    [...new Set(buttons.map((button) => button.getAttribute('data-focus-target-group')))],
  )
  expect(doorGroups).toHaveLength(14)
  for (const storefront of street.storefronts) {
    await expect(page.locator(`[data-focus-target-group="door:${storefront.portalId}"]`).first()).toBeVisible()
  }
})

test('the player dot remains visible at the legal right-hand lane boundary', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')

  for (let step = 0; step < 8; step += 1) {
    const box = (await stage.boundingBox())!
    await stage.click({ position: { x: box.width * .98, y: box.height * .5 } })
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 30_000 })
  }

  const visibility = await page.evaluate(() => {
    const stage = document.querySelector('.mainline-scene-stage')!.getBoundingClientRect()
    const dot = document.querySelector('[data-actor-id="protagonist"] .scene-protagonist__dot')!.getBoundingClientRect()
    return { stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom }, dot: { left: dot.left, right: dot.right, top: dot.top, bottom: dot.bottom } }
  })
  expect(visibility.dot.left).toBeGreaterThanOrEqual(visibility.stage.left)
  expect(visibility.dot.right).toBeLessThanOrEqual(visibility.stage.right)
  expect(visibility.dot.top).toBeGreaterThanOrEqual(visibility.stage.top)
  expect(visibility.dot.bottom).toBeLessThanOrEqual(visibility.stage.bottom)
  expect(Number(await actor.getAttribute('data-runtime-x'))).toBeGreaterThan(175)
})
