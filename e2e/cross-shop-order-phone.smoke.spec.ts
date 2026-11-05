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
test('the unlocked fruit shop appears inside the single drink-order app and can switch shops', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('newtone-e2e-shop-orders-synthetic-save-v1', '1')
    sessionStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2, currentSceneId: 'commercial-street', currentPosition: null, scenePositions: {}, phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 10, minute: 0, weatherCycle: 'sunny' },
      gameTimeMs: 36_000_000, shopOrders: {}, heldConsumable: null,
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: 0,
    }))
  })
  await page.goto('/?scene=commercial-street&e2eShopOrders=1&e2eUnlockDrinkApp=1&e2eShopId=commercial-north-slot-1')
  const app = page.locator('.shop-order-app')
  await expect(app).toHaveAttribute('data-shop-id', 'commercial-north-slot-1')
  await expect(app.locator('[data-shop-option="commercial-south-slot-5"]')).toBeVisible()
  await expect(app.locator('[data-shop-option="commercial-north-slot-1"]')).toHaveAttribute('aria-pressed', 'true')
  await app.locator('[data-shop-option="commercial-south-slot-5"]').click()
  await expect(page.locator('.shop-order-app')).toHaveAttribute('data-shop-id', 'commercial-south-slot-5')
  await expect(page.locator('[data-shop-product-id="original-milk-tea"]')).toBeVisible()
  await app.screenshot({ path: 'test-results/drink-order-shop-selector.png' })
  await page.locator('.world-phone__home-indicator').click()
  await expect(page.locator('.world-phone__home-screen')).toBeVisible()
  await expect(page.locator('.world-phone__apps [data-app="milk-tea"]')).toHaveCount(1)
  await expect(page.locator('.world-phone__apps [data-app="fruit-tea"]')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
})
