import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

test('the isolated shop-order UI fixture submits fruit orders into session-only save state', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()) })
  await page.addInitScript(() => {
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
      sceneState: {},
      phoneNotifications: [],
      phoneNotes: [],
      phoneContactNotes: {},
      phoneCallHistory: [],
      updatedAt: 0,
    }))
  })
  await page.goto('/?scene=commercial-street&e2eShopOrders=1&e2eShopId=commercial-north-slot-1')
  await expect(page.locator('.center-experience')).toBeVisible()
  const fruitPage = page.locator('.shop-order-app[data-shop-id="commercial-north-slot-1"]')
  await expect(fruitPage).toBeVisible({ timeout: 30_000 })
  await fruitPage.locator('[data-shop-product-id="passionfruit-green-tea"]').click()
  await fruitPage.locator('fieldset').nth(0).getByRole('button').first().click()
  await fruitPage.locator('fieldset').nth(1).getByRole('button').last().click()
  await fruitPage.getByRole('button', { name: /\u786e\u8ba4\u4e0b\u5355/ }).click()
  await expect(fruitPage.locator('[data-order-status="queued"]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders?.['commercial-north-slot-1']?.productId)).toBe('passionfruit-green-tea')
  await expect(fruitPage.locator('[data-order-status="ready"]')).toBeVisible({ timeout: 5_000 })
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
  expect(runtimeErrors).toEqual([])
})
