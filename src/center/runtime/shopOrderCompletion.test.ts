import { describe, expect, it } from 'vitest'
import { crossShopIds, type CrossShopOrder } from './crossShopOrders'
import { notifyDueShopOrders } from './shopOrderCompletion'

const order = (id: string, shopId: string, readyAtGameTimeMs: number): CrossShopOrder => ({
  id, shopId, productId: id, status: 'queued', placedAtGameTimeMs: 0, readyAtGameTimeMs,
})

describe('game-clock shop order completion notices', () => {
  it('notifies milk and fruit orders from their saved ready times and durably marks each once', () => {
    const orders = {
      [crossShopIds.milkTea]: order('milk-1', crossShopIds.milkTea, 300_000),
      [crossShopIds.fruitTea]: order('fruit-1', crossShopIds.fruitTea, 360_000),
      [crossShopIds.yonghe]: order('meal-1', crossShopIds.yonghe, 720_000),
      [crossShopIds.cafeTakeaway]: order('coffee-1', crossShopIds.cafeTakeaway, 300_000),
    }
    const before = notifyDueShopOrders(orders, [], 299_999)
    expect(before.changed).toBe(false)
    const ready = notifyDueShopOrders(orders, [], 300_000)
    expect(ready.orders[crossShopIds.milkTea]?.completionNotified).toBe(true)
    expect(ready.orders[crossShopIds.fruitTea]?.completionNotified).toBeUndefined()
    expect(ready.notifications[0]).toMatchObject({ id: 'shop-order-ready:milk-1', shopId: crossShopIds.milkTea })
    expect(ready.notifications.map(item => item.shopId)).toEqual([crossShopIds.milkTea, crossShopIds.cafeTakeaway])
    const next = notifyDueShopOrders(ready.orders, ready.notifications, 360_000)
    expect(next.orders[crossShopIds.fruitTea]?.completionNotified).toBe(true)
    expect(next.notifications.map(item => item.shopId)).toEqual([crossShopIds.milkTea, crossShopIds.cafeTakeaway, crossShopIds.fruitTea])
    const mealReady = notifyDueShopOrders(next.orders, next.notifications, 720_000)
    expect(mealReady.orders[crossShopIds.yonghe]?.completionNotified).toBe(true)
    expect(mealReady.notifications.map(item => item.shopId)).toEqual([crossShopIds.milkTea, crossShopIds.cafeTakeaway, crossShopIds.fruitTea, crossShopIds.yonghe])
    expect(notifyDueShopOrders(mealReady.orders, mealReady.notifications, 10_000_000).changed).toBe(false)
  })

  it('uses no wall-time catch-up and ignores malformed game-time samples', () => {
    const orders = { [crossShopIds.milkTea]: order('later', crossShopIds.milkTea, 1_000) }
    expect(notifyDueShopOrders(orders, [], Number.NaN).changed).toBe(false)
    expect(notifyDueShopOrders(orders, [], 999).changed).toBe(false)
    expect(notifyDueShopOrders(orders, [], 1_000).changed).toBe(true)
  })
})
