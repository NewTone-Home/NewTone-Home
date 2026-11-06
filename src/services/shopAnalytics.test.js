import { describe, it, expect } from 'vitest'
import { shopAnalyticsTransitions } from './shopAnalytics'
const shopId = 'commercial-cafe-slot'
const empty = { shopOrderPaymentReceipts: {}, shopOrders: {}, heldConsumable: null }
const order = { id: 'o1', shopId, completionNotified: false }
const placed = { ...empty, shopOrders: { [shopId]: order }, shopOrderPaymentReceipts: { p1: { shopId, orderId: 'o1' } } }
describe('committed shop facts', () => {
  it('records payment once; retries, hydration and failures have no delta', () => {
    expect(shopAnalyticsTransitions(empty, placed)).toEqual([{ name: 'center_interaction_completed', objectId: shopId, objectKind: 'shop', outcome: 'order-submitted' }])
    expect(shopAnalyticsTransitions(placed, placed)).toEqual([])
    expect(shopAnalyticsTransitions(empty, empty)).toEqual([])
  })
  it('does not count automatic preparation as player interaction; records actual table/counter receipt', () => {
    const ready = { ...placed, shopOrders: { [shopId]: { ...order, completionNotified: true } } }
    expect(shopAnalyticsTransitions(placed, ready)).toEqual([])
    const held = { ...ready, shopOrders: {}, heldConsumable: { id: 'h1', sourceOrderId: 'o1', shopId } }
    expect(shopAnalyticsTransitions(ready, held).map(e => e.outcome)).toEqual(['order-collected'])
    expect(shopAnalyticsTransitions(held, { ...held, heldConsumable: null }).map(e => e.outcome)).toEqual(['item-consumed'])
    expect(shopAnalyticsTransitions(held, held)).toEqual([])
  })
  it('never emits arbitrary IDs, customizations or text', () => {
    expect(JSON.stringify(shopAnalyticsTransitions(empty, placed))).not.toContain('o1')
    expect(shopAnalyticsTransitions(empty, { ...empty, shopOrderPaymentReceipts: { x: { shopId: 'unsafe user text?' } } })).toEqual([])
  })
})
