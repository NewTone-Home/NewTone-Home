import { crossShopIds, sanitizeCrossShopOrderState, type CrossShopOrder } from './crossShopOrders'
import type { PhoneNotification } from './phoneNotifications'

export type CafeStoryDeliveryRecord = {
  eventId: string
  order: CrossShopOrder
  deliveredAtGameTimeMs: number
  presentation: 'pending' | 'complete'
}

export type CafeStoryOrderState = {
  shopOrders: Record<string, CrossShopOrder>
  heldConsumable: { shopId: string; sourceOrderId: string | null } | null
  cafeStoryDeliveries: Record<string, CafeStoryDeliveryRecord>
  phoneNotifications?: PhoneNotification[]
}

export type CafeStoryOrderStatus = 'none' | 'queued' | 'ready' | 'legacy-unmapped' | 'claimed' | 'delivered-pending-presentation' | 'delivered'

function finiteGameTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function cafeStoryOrderStatus(state: CafeStoryOrderState, eventId: string, gameTimeMs: number): CafeStoryOrderStatus {
  const delivery = state.cafeStoryDeliveries[eventId]
  if (delivery) return delivery.presentation === 'complete' ? 'delivered' : 'delivered-pending-presentation'
  const order = state.shopOrders[crossShopIds.cafeTakeaway]
  if (order) {
    if (order.status === 'legacy-unmapped') return 'legacy-unmapped'
    return order.readyAtGameTimeMs !== null && finiteGameTime(gameTimeMs) && gameTimeMs >= order.readyAtGameTimeMs ? 'ready' : 'queued'
  }
  if (state.heldConsumable?.shopId === crossShopIds.cafeTakeaway) return 'claimed'
  if (Object.values(state.cafeStoryDeliveries).some(record => record.order.shopId === crossShopIds.cafeTakeaway)) return 'delivered'
  return 'none'
}

/**
 * Atomically removes the current unclaimed cafe order from counter pickup and
 * records its one-time table delivery. A pending presentation can be replayed
 * after refresh; the business event itself is never applied twice.
 */
export function beginCafeStoryOrderDelivery(
  state: CafeStoryOrderState,
  eventId: string,
  gameTimeMs: number,
): { ok: true; state: CafeStoryOrderState; record: CafeStoryDeliveryRecord; replayed: boolean } | { ok: false; state: CafeStoryOrderState; reason: 'invalid-event' | 'no-order' | 'claimed' | 'legacy-unmapped' } {
  if (!eventId || !finiteGameTime(gameTimeMs)) return { ok: false, state, reason: 'invalid-event' }
  const existing = state.cafeStoryDeliveries[eventId]
  if (existing) return { ok: true, state, record: existing, replayed: true }
  const order = state.shopOrders[crossShopIds.cafeTakeaway]
  if (!order) {
    const claimed = state.heldConsumable?.shopId === crossShopIds.cafeTakeaway
    return { ok: false, state, reason: claimed ? 'claimed' : 'no-order' }
  }
  if (order.status === 'legacy-unmapped') return { ok: false, state, reason: 'legacy-unmapped' }
  const record: CafeStoryDeliveryRecord = {
    eventId,
    order,
    deliveredAtGameTimeMs: gameTimeMs,
    presentation: 'pending',
  }
  const shopOrders = { ...state.shopOrders }
  delete shopOrders[crossShopIds.cafeTakeaway]
  const phoneNotifications = state.phoneNotifications?.filter(notification => notification.id !== `shop-order-ready:${order.id}`)
  return {
    ok: true,
    state: {
      ...state,
      shopOrders,
      cafeStoryDeliveries: { ...state.cafeStoryDeliveries, [eventId]: record },
      ...(phoneNotifications ? { phoneNotifications } : {}),
    },
    record,
    replayed: false,
  }
}

export function completeCafeStoryOrderDeliveryPresentation(
  deliveries: Readonly<Record<string, CafeStoryDeliveryRecord>>,
  eventId: string,
): Readonly<Record<string, CafeStoryDeliveryRecord>> {
  const record = deliveries[eventId]
  if (!record || record.presentation === 'complete') return deliveries
  return { ...deliveries, [eventId]: { ...record, presentation: 'complete' } }
}

export function sanitizeCafeStoryDeliveries(value: unknown): Record<string, CafeStoryDeliveryRecord> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, CafeStoryDeliveryRecord> = {}
  for (const [eventId, raw] of Object.entries(value)) {
    if (!eventId || !raw || typeof raw !== 'object') continue
    const record = raw as CafeStoryDeliveryRecord
    if (record.eventId !== eventId || !record.order || record.order.shopId !== crossShopIds.cafeTakeaway
      || !finiteGameTime(record.deliveredAtGameTimeMs)
      || (record.presentation !== 'pending' && record.presentation !== 'complete')) continue
    const order = sanitizeCrossShopOrderState({ ordersByShop: { [crossShopIds.cafeTakeaway]: record.order }, heldConsumable: null }).ordersByShop[crossShopIds.cafeTakeaway]
    if (!order || order.status !== 'queued') continue
    result[eventId] = { eventId, order, deliveredAtGameTimeMs: record.deliveredAtGameTimeMs, presentation: record.presentation }
  }
  return result
}

/** Adapter for the scene owner: its save callback performs the same atomic persistence as ordinary claims. */
export function createCafeStoryOrderDeliveryController<TSave extends CafeStoryOrderState>(options: {
  readSave: () => TSave
  commitSave: (update: (current: TSave) => TSave) => void
  readGameTimeMs: () => number
}) {
  return {
    status(eventId: string) {
      return cafeStoryOrderStatus(options.readSave(), eventId, options.readGameTimeMs())
    },
    begin(eventId: string) {
      let outcome: ReturnType<typeof beginCafeStoryOrderDelivery> | null = null
      options.commitSave(current => {
        const result = beginCafeStoryOrderDelivery(current, eventId, options.readGameTimeMs())
        outcome = result
        if (!result.ok) return current
        return { ...current, ...result.state }
      })
      return outcome
    },
    completePresentation(eventId: string) {
      options.commitSave(current => {
        const deliveries = completeCafeStoryOrderDeliveryPresentation(current.cafeStoryDeliveries, eventId)
        return deliveries === current.cafeStoryDeliveries ? current : { ...current, cafeStoryDeliveries: deliveries }
      })
    },
  }
}
