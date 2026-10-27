import { expect, test } from '@playwright/test'

test('legacy unmapped milk tea order stays until explicit cancel, then releases only that shop slot', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    sessionStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    sessionStorage.setItem('newtone-e2e-shop-orders-synthetic-save-v1', '1')
    sessionStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2,
      currentSceneId: 'commercial-street', currentPosition: null, scenePositions: {}, phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 10, minute: 0, weatherCycle: 'sunny' },
      gameTimeMs: 36_000_000,
      shopOrders: { 'commercial-south-slot-5': { id: 'legacy-milk-tea-12', shopId: 'commercial-south-slot-5', productId: 'legacy-milk-tea-order', status: 'legacy-unmapped', placedAtGameTimeMs: null, readyAtGameTimeMs: null, legacySnapshot: { commercialStreetMilkTeaOrderNumber: 12 } } },
      heldConsumable: null,
      sceneState: { 'commercial-street': { commercialStreetMilkTeaOrderNumber: 12 } },
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: 1,
    }))
  })
  await page.goto('/?scene=commercial-street&e2eShopOrders=1&e2eShopId=commercial-south-slot-5')
  await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase', 'open')
  const shop = page.locator('.shop-order-app[data-shop-id="commercial-south-slot-5"]')
  console.log(`[legacy UI save before cancel] ${await page.evaluate(() => sessionStorage.getItem('newtone-player-save-v1'))}`)
  await expect(shop.locator('[data-order-status="legacy-unmapped"]')).toBeVisible()
  await expect(shop.getByText(/没有可靠的制作时间/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders?.['commercial-south-slot-5']?.status)).toBe('legacy-unmapped')
  await shop.getByRole('button', { name: '取消旧订单并重新下单' }).click()
  await expect(shop.locator('[data-order-status="legacy-unmapped"]')).toHaveCount(0)
  await expect(shop.locator('[data-shop-product-id="original-milk-tea"]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}')
    return [save.shopOrders?.['commercial-south-slot-5'] ?? null, save.sceneState?.['commercial-street']?.commercialStreetMilkTeaOrderNumber]
  })).toEqual([null, null])
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
})
