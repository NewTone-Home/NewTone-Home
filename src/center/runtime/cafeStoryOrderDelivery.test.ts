import { describe, expect, it } from 'vitest'
import { crossShopIds, claimCrossShopOrder } from './crossShopOrders'
import {
  beginCafeStoryOrderDelivery, cafeStoryOrderStatus, completeCafeStoryOrderDeliveryPresentation,
  beginCafeTableOrderDelivery, completeCafeTableOrderDelivery, retargetCafeTableOrderDelivery,
  completeCafeTableOrderDeliveryReturn, cafeTableOrderDeliveryAfterRefresh, completeCafeTableOrderDeliveryResult,
  sanitizeCafeStoryDeliveries, type CafeStoryDeliveryRecord, type CafeStoryOrderState,
} from './cafeStoryOrderDelivery'

const cafeOrder = {
  id: 'cafe-order-1', shopId: crossShopIds.cafeTakeaway, productId: 'americano', status: 'queued' as const,
  placedAtGameTimeMs: 100, readyAtGameTimeMs: 300_100, pricePaid: 3, paymentReceiptId: 'pay-1',
}

describe('Café story delivery bridge', () => {
  it('uses the current ordinary Café order, completes it at the story node, clears its pickup notice, and persists replayable presentation', () => {
    const pickupNotice = { id: `shop-order-ready:${cafeOrder.id}`, app: 'cafe-takeaway' as const, shopId: crossShopIds.cafeTakeaway, title: 'ready', body: 'pickup', unread: true, presented: true }
    const unrelatedNotice = { id: 'ride-notice', app: 'ride' as const, title: 'ride', body: 'ride', unread: true, presented: true }
    const initial: CafeStoryOrderState = {
      shopOrders: { [crossShopIds.cafeTakeaway]: cafeOrder }, heldConsumable: null, cafeStoryDeliveries: {},
      phoneNotifications: [pickupNotice, unrelatedNotice],
    }
    expect(cafeStoryOrderStatus(initial, 'lao-zhou-meeting-v1', 200_000)).toBe('queued')
    expect(cafeStoryOrderStatus(initial, 'lao-zhou-meeting-v1', 300_100)).toBe('ready')
    const delivery = beginCafeStoryOrderDelivery(initial, 'lao-zhou-meeting-v1', 300_100)
    expect(delivery).toMatchObject({ ok: true, replayed: false, record: { order: cafeOrder, presentation: 'pending' } })
    if (!delivery.ok) return
    expect(delivery.state.shopOrders[crossShopIds.cafeTakeaway]).toBeUndefined()
    expect(delivery.state.heldConsumable).toBeNull()
    expect(delivery.state.phoneNotifications).toEqual([unrelatedNotice])
    expect(cafeStoryOrderStatus(delivery.state, 'lao-zhou-meeting-v1', 300_100)).toBe('delivered-pending-presentation')
    const restored = sanitizeCafeStoryDeliveries(JSON.parse(JSON.stringify(delivery.state.cafeStoryDeliveries)))
    const replay = beginCafeStoryOrderDelivery({ ...delivery.state, cafeStoryDeliveries: restored }, 'lao-zhou-meeting-v1', 400_000)
    expect(replay).toMatchObject({ ok: true, replayed: true, record: { order: cafeOrder, presentation: 'pending' } })
    if (!replay.ok) return
    const completed = completeCafeStoryOrderDeliveryPresentation(replay.state.cafeStoryDeliveries, 'lao-zhou-meeting-v1')
    expect(cafeStoryOrderStatus({ ...replay.state, cafeStoryDeliveries: completed }, 'lao-zhou-meeting-v1', 500_000)).toBe('delivered')
    expect(completeCafeStoryOrderDeliveryPresentation(completed, 'lao-zhou-meeting-v1')).toBe(completed)
  })

  it('skips when there is no order or it has already been claimed into the hand', () => {
    const empty: CafeStoryOrderState = { shopOrders: {}, heldConsumable: null, cafeStoryDeliveries: {} }
    expect(beginCafeStoryOrderDelivery(empty, 'meeting', 0)).toMatchObject({ ok: false, reason: 'no-order' })
    const claimed = { ...empty, heldConsumable: { shopId: crossShopIds.cafeTakeaway, sourceOrderId: cafeOrder.id } }
    expect(cafeStoryOrderStatus(claimed, 'meeting', 0)).toBe('claimed')
    expect(beginCafeStoryOrderDelivery(claimed, 'meeting', 0)).toMatchObject({ ok: false, reason: 'claimed' })
  })

  it('does not auto-deliver an unmapped legacy order', () => {
    const state: CafeStoryOrderState = {
      shopOrders: { [crossShopIds.cafeTakeaway]: { ...cafeOrder, status: 'legacy-unmapped', placedAtGameTimeMs: null, readyAtGameTimeMs: null } },
      heldConsumable: null, cafeStoryDeliveries: {},
    }
    expect(cafeStoryOrderStatus(state, 'meeting', 0)).toBe('legacy-unmapped')
    expect(beginCafeStoryOrderDelivery(state, 'meeting', 0)).toMatchObject({ ok: false, reason: 'legacy-unmapped' })
    expect(state.shopOrders[crossShopIds.cafeTakeaway]).toBeDefined()
  })

  it('reserves without claiming, then atomically completes ordinary table delivery into the hand exactly once', () => {
    const initial: CafeStoryOrderState = { shopOrders: { [crossShopIds.cafeTakeaway]: { ...cafeOrder, readyAtGameTimeMs: 300 } }, heldConsumable: null, cafeStoryDeliveries: {}, phoneNotifications: [{ id: `shop-order-ready:${cafeOrder.id}`, app: 'cafe-takeaway', shopId: crossShopIds.cafeTakeaway, title: 'ready', body: 'pickup', unread: true, presented: true }] }
    expect(beginCafeTableOrderDelivery({ shopOrders: {}, heldConsumable: null, cafeStoryDeliveries: {} }, 'seat-a', 300)).toMatchObject({ ok: false, reason: 'no-order' })
    expect(beginCafeTableOrderDelivery(initial, 'seat-a', 299)).toMatchObject({ ok: false, reason: 'not-ready' })
    const pending = beginCafeTableOrderDelivery(initial, 'seat-a', 300)
    expect(pending).toMatchObject({ ok: true, record: { deliveryKind: 'table', seatId: 'seat-a' } })
    if (!pending.ok) return
    expect(pending.state.shopOrders[crossShopIds.cafeTakeaway]?.id).toBe(cafeOrder.id)
    expect(pending.state.heldConsumable).toBeNull()
    expect(cafeStoryOrderStatus(pending.state, 'lao-zhou-meeting-v1', 300)).toBe('claimed')
    expect(beginCafeStoryOrderDelivery(pending.state, 'lao-zhou-meeting-v1', 300)).toMatchObject({ ok: false, reason: 'claimed' })
    const restored = sanitizeCafeStoryDeliveries(JSON.parse(JSON.stringify(pending.state.cafeStoryDeliveries)))
    const replay = beginCafeTableOrderDelivery({ ...pending.state, cafeStoryDeliveries: restored }, 'seat-b', 500)
    expect(replay).toMatchObject({ ok: true, replayed: true, record: { seatId: 'seat-a' } })
    const moved: Readonly<Record<string, CafeStoryDeliveryRecord>> = retargetCafeTableOrderDelivery(restored, 'seat-b')
    expect(Object.values(moved)[0]).toMatchObject({ seatId: 'seat-b' })
    const completed = completeCafeTableOrderDelivery({ ...pending.state, cafeStoryDeliveries: moved }, cafeOrder.id, 'seat-b')
    expect(completed.shopOrders[crossShopIds.cafeTakeaway]).toBeUndefined()
    expect(completed.heldConsumable).toEqual({ id: `held-${cafeOrder.id}`, shopId: crossShopIds.cafeTakeaway, productId: cafeOrder.productId, kind: 'drink', sourceOrderId: cafeOrder.id })
    expect(completed.phoneNotifications).toEqual([])
    expect(Object.values(completed.cafeStoryDeliveries)[0]).toMatchObject({ presentation: 'complete', deliveryKind: 'table' })
    expect(completeCafeTableOrderDelivery(completed, cafeOrder.id, 'seat-b')).toBe(completed)
    const durable = { ...completed, cafeStoryDeliveries: sanitizeCafeStoryDeliveries(JSON.parse(JSON.stringify(completed.cafeStoryDeliveries))) }
    expect(completeCafeTableOrderDelivery(durable, cafeOrder.id, 'seat-b')).toBe(durable)
    // Even after consuming the delivered item, no counter order remains to claim again.
    expect(claimCrossShopOrder({ ordersByShop: durable.shopOrders, heldConsumable: null }, crossShopIds.cafeTakeaway, 500)).toMatchObject({ ok: false, reason: 'no-order' })
    // This is ordinary table service, not Lao Zhou's story delivery/presentation.
    expect(beginCafeStoryOrderDelivery(durable, 'lao-zhou-meeting-v1', 500)).toMatchObject({ ok: false, reason: 'claimed' })
  })

  it('persists an interrupted table return until counter arrival and preserves the other held item', () => {
    const pending = beginCafeTableOrderDelivery({ shopOrders: { [crossShopIds.cafeTakeaway]: { ...cafeOrder, readyAtGameTimeMs: 300 } }, heldConsumable: { shopId: crossShopIds.yonghe, sourceOrderId: 'meal-1' }, cafeStoryDeliveries: {} }, 'seat-a', 300)
    expect(pending.ok).toBe(true)
    if (!pending.ok) return
    const returning = retargetCafeTableOrderDelivery(pending.state.cafeStoryDeliveries, null)
    expect(Object.values(returning)).toHaveLength(1)
    expect(Object.values(returning)[0]).toMatchObject({ deliveryKind: 'table', presentation: 'pending', deliveryPhase: 'returning-to-counter', seatId: 'seat-a' })
    const restored = { ...pending.state, cafeStoryDeliveries: sanitizeCafeStoryDeliveries(JSON.parse(JSON.stringify(returning))) }
    expect(cafeTableOrderDeliveryAfterRefresh(restored)).toEqual({ orderId: cafeOrder.id, seatId: 'seat-a', phase: 'returning-to-counter' })
    expect(restored.shopOrders[crossShopIds.cafeTakeaway]?.id).toBe(cafeOrder.id)
    expect(restored.heldConsumable).toBe(pending.state.heldConsumable)
    expect(beginCafeTableOrderDelivery(restored, 'seat-b', 400)).toMatchObject({ ok: false, reason: 'returning-to-counter' })
    expect(completeCafeTableOrderDelivery(restored, cafeOrder.id, 'seat-a')).toBe(restored)
    const released = completeCafeTableOrderDeliveryReturn(restored, cafeOrder.id)
    expect(Object.keys(released.cafeStoryDeliveries)).toHaveLength(0)
    expect(released.shopOrders[crossShopIds.cafeTakeaway]?.id).toBe(cafeOrder.id)
    expect(released.heldConsumable?.shopId).toBe(crossShopIds.yonghe)
    expect(completeCafeTableOrderDeliveryReturn(released, cafeOrder.id)).toBe(released)
    const retry = beginCafeTableOrderDelivery(released, 'seat-b', 400)
    expect(retry).toMatchObject({ ok: true, replayed: false })
    if (!retry.ok) return
    expect(completeCafeTableOrderDeliveryResult(retry.state, cafeOrder.id, 'seat-b')).toMatchObject({ ok: false, reason: 'hand-full', state: retry.state })
  })
})

it('counter pickup before a delayed table callback cannot deliver the same ordinary order twice', () => {
  const initial: CafeStoryOrderState = { shopOrders: { [crossShopIds.cafeTakeaway]: { ...cafeOrder, readyAtGameTimeMs: 300 } }, heldConsumable: null, cafeStoryDeliveries: {} }
  const pending = beginCafeTableOrderDelivery(initial, 'seat-a', 300)
  expect(pending.ok).toBe(true)
  if (!pending.ok) return
  const counter = claimCrossShopOrder({ ordersByShop: pending.state.shopOrders, heldConsumable: null }, crossShopIds.cafeTakeaway, 300)
  expect(counter.ok).toBe(true)
  if (!counter.ok) return
  const current: CafeStoryOrderState = { ...pending.state, shopOrders: counter.state.ordersByShop, heldConsumable: counter.value }
  expect(completeCafeTableOrderDelivery(current, cafeOrder.id, 'seat-a')).toBe(current)
  expect(completeCafeTableOrderDeliveryResult(current, cafeOrder.id, 'seat-a')).toMatchObject({ ok: false, reason: 'order-changed', state: current })
  expect(current.heldConsumable?.sourceOrderId).toBe(cafeOrder.id)
  expect(current.shopOrders[crossShopIds.cafeTakeaway]).toBeUndefined()
})
