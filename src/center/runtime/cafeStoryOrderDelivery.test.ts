import { describe, expect, it } from 'vitest'
import { crossShopIds } from './crossShopOrders'
import {
  beginCafeStoryOrderDelivery, cafeStoryOrderStatus, completeCafeStoryOrderDeliveryPresentation,
  sanitizeCafeStoryDeliveries, type CafeStoryOrderState,
} from './cafeStoryOrderDelivery'

const cafeOrder = {
  id: 'cafe-order-1', shopId: crossShopIds.cafeTakeaway, productId: 'americano', status: 'queued' as const,
  placedAtGameTimeMs: 100, readyAtGameTimeMs: 300_100, pricePaid: 3, paymentReceiptId: 'pay-1',
}

describe('Café story delivery bridge', () => {
  it('uses the current ordinary Café order, completes it at the story node, and persists replayable presentation', () => {
    const initial: CafeStoryOrderState = { shopOrders: { [crossShopIds.cafeTakeaway]: cafeOrder }, heldConsumable: null, cafeStoryDeliveries: {} }
    expect(cafeStoryOrderStatus(initial, 'lao-zhou-meeting-v1', 200_000)).toBe('queued')
    expect(cafeStoryOrderStatus(initial, 'lao-zhou-meeting-v1', 300_100)).toBe('ready')
    const delivery = beginCafeStoryOrderDelivery(initial, 'lao-zhou-meeting-v1', 200_000)
    expect(delivery).toMatchObject({ ok: true, replayed: false, record: { order: cafeOrder, presentation: 'pending' } })
    if (!delivery.ok) return
    expect(delivery.state.shopOrders[crossShopIds.cafeTakeaway]).toBeUndefined()
    expect(delivery.state.heldConsumable).toBeNull()
    expect(cafeStoryOrderStatus(delivery.state, 'lao-zhou-meeting-v1', 200_000)).toBe('delivered-pending-presentation')
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
})
