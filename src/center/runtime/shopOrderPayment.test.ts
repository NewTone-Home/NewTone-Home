import { describe, expect, it } from 'vitest'
import { crossShopIds, emptyCrossShopOrderState } from './crossShopOrders'
import { placePaidShopOrder } from './shopOrderPayment'

const prepared = {
  orderId: 'order-1', idempotencyKey: 'tap-1', shopId: crossShopIds.milkTea,
  productId: 'original-milk-tea', price: 5, placedAtGameTimeMs: 60_000,
  preparationDurationMs: 5 * 60_000,
}

describe('paid shop order transaction', () => {
  it('charges once with order creation and treats the same purchase key as a replay', () => {
    const first = placePaidShopOrder(emptyCrossShopOrderState, { walletBalance: 800, paymentReceipts: {} }, prepared)
    expect(first).toMatchObject({ ok: true, paymentState: { walletBalance: 795 } })
    if (!first.ok) return
    expect(first.order).toMatchObject({ status: 'queued', pricePaid: 5, paymentReceiptId: 'tap-1', readyAtGameTimeMs: 360_000 })
    const replay = placePaidShopOrder(first.orderState, first.paymentState, { ...prepared, orderId: 'retry-order' })
    expect(replay).toMatchObject({ ok: true, replayed: true, paymentState: { walletBalance: 795 } })
    expect(Object.keys(replay.orderState.ordersByShop)).toHaveLength(1)
    expect(Object.keys(replay.paymentState.paymentReceipts)).toHaveLength(1)
  })

  it('rejects insufficient funds without creating an order or receipt', () => {
    const result = placePaidShopOrder(emptyCrossShopOrderState, { walletBalance: 4, paymentReceipts: {} }, prepared)
    expect(result).toMatchObject({ ok: false, reason: 'insufficient-funds', orderState: emptyCrossShopOrderState, paymentState: { walletBalance: 4, paymentReceipts: {} } })
  })

  it('allows orders at different shops while charging each exactly once', () => {
    const milk = placePaidShopOrder(emptyCrossShopOrderState, { walletBalance: 800, paymentReceipts: {} }, prepared)
    if (!milk.ok) throw new Error(milk.reason)
    const fruit = placePaidShopOrder(milk.orderState, milk.paymentState, {
      ...prepared, orderId: 'fruit-1', idempotencyKey: 'tap-fruit', shopId: crossShopIds.fruitTea,
      productId: 'fresh-orange-juice', price: 5,
    })
    expect(fruit).toMatchObject({ ok: true, paymentState: { walletBalance: 790 } })
    if (!fruit.ok) return
    expect(Object.keys(fruit.orderState.ordersByShop)).toEqual([crossShopIds.milkTea, crossShopIds.fruitTea])
    const duplicateShopOrder = placePaidShopOrder(fruit.orderState, fruit.paymentState, {
      ...prepared, orderId: 'milk-2', idempotencyKey: 'tap-2',
    })
    expect(duplicateShopOrder).toMatchObject({ ok: false, reason: 'shop-already-has-order', paymentState: { walletBalance: 790 } })
  })

  it('rejects reuse of an idempotency key for different purchase details', () => {
    const first = placePaidShopOrder(emptyCrossShopOrderState, { walletBalance: 800, paymentReceipts: {} }, prepared)
    if (!first.ok) throw new Error(first.reason)
    const mismatch = placePaidShopOrder(first.orderState, first.paymentState, {
      ...prepared, shopId: crossShopIds.fruitTea, productId: 'fresh-orange-juice',
    })
    expect(mismatch).toMatchObject({ ok: false, reason: 'invalid-payment', paymentState: { walletBalance: 795 } })
  })
})
