import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { crossShopIds } from '../src/center/runtime/crossShopOrders'
import { placePaidShopOrder } from '../src/center/runtime/shopOrderPayment'
import { beginCafeStoryOrderDelivery } from '../src/center/runtime/cafeStoryOrderDelivery'

describe('shop wallet save migration', () => {
  it('gives a legacy save the single 800 test opening balance once and retains transaction receipts thereafter', () => {
    const fresh = createInitialPlayerSave()
    const legacy: Record<string, unknown> = { ...fresh }
    delete legacy.walletBalance
    delete legacy.shopOrderPaymentReceipts
    const migrated = sanitizePlayerSave(legacy, fresh.currentSceneId)
    expect(migrated.walletBalance).toBe(800)
    const placed = placePaidShopOrder({ ordersByShop: {}, heldConsumable: null }, { walletBalance: migrated.walletBalance, paymentReceipts: migrated.shopOrderPaymentReceipts }, {
      orderId: 'order-save', idempotencyKey: 'wallet-save-key', shopId: crossShopIds.cafeTakeaway,
      productId: 'americano', price: 5, placedAtGameTimeMs: 100, preparationDurationMs: 5 * 60_000,
    })
    if (!placed.ok) throw new Error(placed.reason)
    const restored = sanitizePlayerSave({
      ...migrated, shopOrders: placed.orderState.ordersByShop,
      walletBalance: placed.paymentState.walletBalance,
      shopOrderPaymentReceipts: placed.paymentState.paymentReceipts,
    }, fresh.currentSceneId)
    expect(restored.walletBalance).toBe(795)
    expect(restored.shopOrderPaymentReceipts['wallet-save-key']).toMatchObject({ orderId: 'order-save', amount: 5 })
    expect(restored.shopOrders[crossShopIds.cafeTakeaway]).toMatchObject({ pricePaid: 5, readyAtGameTimeMs: 300_100 })
    expect(sanitizePlayerSave(restored, fresh.currentSceneId).walletBalance).toBe(795)
  })

  it('restores two independent shop orders and their shared wallet after a save reload', () => {
    const fresh = createInitialPlayerSave()
    const first = placePaidShopOrder({ ordersByShop: {}, heldConsumable: null }, { walletBalance: 800, paymentReceipts: {} }, {
      orderId: 'milk-order', idempotencyKey: 'milk-purchase', shopId: crossShopIds.milkTea,
      productId: 'original-milk-tea', price: 5, placedAtGameTimeMs: 10_000, preparationDurationMs: 5 * 60_000,
    })
    if (!first.ok) throw new Error(first.reason)
    const second = placePaidShopOrder(first.orderState, first.paymentState, {
      orderId: 'fruit-order', idempotencyKey: 'fruit-purchase', shopId: crossShopIds.fruitTea,
      productId: 'passionfruit-green-tea', price: 5, placedAtGameTimeMs: 20_000, preparationDurationMs: 5 * 60_000,
    })
    if (!second.ok) throw new Error(second.reason)
    const restored = sanitizePlayerSave({
      ...fresh, shopOrders: second.orderState.ordersByShop,
      walletBalance: second.paymentState.walletBalance,
      shopOrderPaymentReceipts: second.paymentState.paymentReceipts,
    }, fresh.currentSceneId)
    expect(restored.walletBalance).toBe(790)
    expect(restored.shopOrders[crossShopIds.milkTea]).toMatchObject({ id: 'milk-order', pricePaid: 5, readyAtGameTimeMs: 310_000 })
    expect(restored.shopOrders[crossShopIds.fruitTea]).toMatchObject({ id: 'fruit-order', pricePaid: 5, readyAtGameTimeMs: 320_000 })
    expect(Object.keys(restored.shopOrderPaymentReceipts)).toEqual(['milk-purchase', 'fruit-purchase'])
  })

  it('does not turn malformed saved balance into free money', () => {
    const fresh = createInitialPlayerSave()
    expect(sanitizePlayerSave({ ...fresh, walletBalance: -10 }, fresh.currentSceneId).walletBalance).toBe(0)
  })

  it('preserves existing queued order timestamps without recalculating them from the new catalog duration', () => {
    const fresh = createInitialPlayerSave()
    const legacyOrder = {
      id: 'pending-before-update', shopId: crossShopIds.milkTea, productId: 'original-milk-tea', status: 'queued',
      placedAtGameTimeMs: 10_000, readyAtGameTimeMs: 452_000,
    }
    const restored = sanitizePlayerSave({ ...fresh, shopOrders: { [crossShopIds.milkTea]: legacyOrder }, walletBalance: 500 }, fresh.currentSceneId)
    expect(restored.shopOrders[crossShopIds.milkTea]).toMatchObject({ placedAtGameTimeMs: 10_000, readyAtGameTimeMs: 452_000 })
    expect(restored.walletBalance).toBe(500)
  })

  it('persists an in-progress Café delivery presentation for refresh recovery', () => {
    const fresh = createInitialPlayerSave('commercial-cafe')
    const before = {
      ...fresh,
      shopOrders: {
        [crossShopIds.cafeTakeaway]: {
          id: 'cafe-pending', shopId: crossShopIds.cafeTakeaway, productId: 'latte', status: 'queued' as const,
          placedAtGameTimeMs: 0, readyAtGameTimeMs: 300_000, pricePaid: 5, paymentReceiptId: 'cafe-pay',
        },
      },
    }
    const delivery = beginCafeStoryOrderDelivery(before, 'lao-zhou-meeting-v1', 200_000)
    if (!delivery.ok) throw new Error(delivery.reason)
    const restored = sanitizePlayerSave({ ...before, ...delivery.state }, fresh.currentSceneId)
    expect(restored.shopOrders[crossShopIds.cafeTakeaway]).toBeUndefined()
    expect(restored.cafeStoryDeliveries['lao-zhou-meeting-v1']).toMatchObject({ presentation: 'pending', order: { id: 'cafe-pending', pricePaid: 5 } })
  })
})
