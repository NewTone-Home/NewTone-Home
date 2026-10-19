import { expect, test } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

test('clicking the locked milk tea portal shows its locked passage text without starting the order action', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')

  const street = mainlineScenes['commercial-street']
  const milkTea = street.storefronts.find((storefront) => storefront.id === 'commercial-south-slot-5')!
  const passage = street.passages.find((candidate) => candidate.portalId === milkTea.portalId)!
  const portal = page.locator(`.scene-portal-characters[data-storefront-id="${milkTea.id}"]`)
  const door = portal.locator(`button[data-storefront-cell-id^="${milkTea.id}-"]`)
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
  const portal = page.locator(`.scene-portal-characters[data-storefront-id="${simpleMeal.id}"]`)
  const door = portal.locator(`button[data-storefront-cell-id^="${simpleMeal.id}-"]`)
  const echo = page.locator(`[data-scene-echo="${passage.entityId}"]`)

  await expect(door).toHaveCount(1)
  await door.click()
  await expect(echo).toBeVisible({ timeout: 20_000 })
  await expect(echo).toContainText(passage.lockedText!.replace(/[。.!！?？]+$/, ''))
})
