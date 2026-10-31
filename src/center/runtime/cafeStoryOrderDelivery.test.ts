import { describe, expect, it } from 'vitest'
import { crossShopIds } from './crossShopOrders'
import {
  beginCafeStoryOrderDelivery, cafeStoryOrderStatus, completeCafeStoryOrderDeliveryPresentation,
  beginCafeTableOrderDelivery, completeCafeTableOrderDelivery, retargetCafeTableOrderDelivery,
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

  it('reserves a ready ordinary Cafe order for the current seat without claiming it, and restores/retargets it safely', () => {
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
    expect(completed.heldConsumable).toBeNull()
    expect(completed.phoneNotifications).toEqual([])
    expect(Object.values(completed.cafeStoryDeliveries)[0]).toMatchObject({ presentation: 'complete', deliveryKind: 'table' })
    expect(completeCafeTableOrderDelivery(completed, cafeOrder.id, 'seat-b')).toBe(completed)
  })

  it('releases a table reservation on leaving and preserves a separately held/full-hand state', () => {
    const pending = beginCafeTableOrderDelivery({ shopOrders: { [crossShopIds.cafeTakeaway]: { ...cafeOrder, readyAtGameTimeMs: 300 } }, heldConsumable: { shopId: crossShopIds.yonghe, sourceOrderId: 'meal-1' }, cafeStoryDeliveries: {} }, 'seat-a', 300)
    expect(pending.ok).toBe(true)
    if (!pending.ok) return
    const released = retargetCafeTableOrderDelivery(pending.state.cafeStoryDeliveries, null)
    expect(Object.keys(released)).toHaveLength(0)
    expect(pending.state.shopOrders[crossShopIds.cafeTakeaway]?.id).toBe(cafeOrder.id)
    expect(pending.state.heldConsumable?.shopId).toBe(crossShopIds.yonghe)
    expect(beginCafeTableOrderDelivery({ ...pending.state, cafeStoryDeliveries: released }, 'seat-b', 400)).toMatchObject({ ok: true, replayed: false })
  })
})
