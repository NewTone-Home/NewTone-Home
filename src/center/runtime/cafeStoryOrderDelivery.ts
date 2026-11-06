import { crossShopIds, sanitizeCrossShopOrderState, type CrossShopOrder } from './crossShopOrders'
import type { HeldConsumable } from './crossShopOrders'
import type { PhoneNotification } from './phoneNotifications'

export type CafeStoryDeliveryRecord = {
  eventId: string
  order: CrossShopOrder
  deliveredAtGameTimeMs: number
  presentation: 'pending' | 'complete'
  /** Missing on legacy records, which are Lao Zhou story deliveries. */
  deliveryKind?: 'story' | 'table'
  seatId?: string
  /** Persisted route phase lets an interrupted delivery resume toward the counter. */
  deliveryPhase?: 'to-seat' | 'returning-to-counter'
}

export type CafeStoryOrderState = {
  shopOrders: Record<string, CrossShopOrder>
  heldConsumable: HeldConsumable | { shopId: string; sourceOrderId: string | null } | null
  cafeStoryDeliveries: Record<string, CafeStoryDeliveryRecord>
  phoneNotifications?: PhoneNotification[]
}

export type CafeStoryOrderStatus = 'none' | 'queued' | 'ready' | 'legacy-unmapped' | 'claimed' | 'returning-to-counter' | 'delivered-pending-presentation' | 'delivered'

export type CafeTableOrderDeliveryState = 'none' | 'queued' | 'ready' | 'claimed' | 'returning-to-counter' | 'table-delivery-pending' | 'delivered'

export type CafeTableOrderDeliveryTarget =
  | { orderId: string; seatId: string; phase: 'to-seat' }
  | { orderId: string; seatId: string; phase: 'returning-to-counter' }

export type CafeTableDeliveryCompletion =
  | { ok: true; state: CafeStoryOrderState; heldConsumable: HeldConsumable }
  | { ok: false; state: CafeStoryOrderState; reason: 'not-at-target' | 'hand-full' | 'order-changed' }

function finiteGameTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function cafeStoryOrderStatus(state: CafeStoryOrderState, eventId: string, gameTimeMs: number): CafeStoryOrderStatus {
  const delivery = state.cafeStoryDeliveries[eventId]
  if (delivery && delivery.deliveryKind !== 'table') return delivery.presentation === 'complete' ? 'delivered' : 'delivered-pending-presentation'
  const order = state.shopOrders[crossShopIds.cafeTakeaway]
  const tableDelivery = order ? Object.values(state.cafeStoryDeliveries).find(record => record.deliveryKind === 'table' && record.order.id === order.id && record.presentation === 'pending') : undefined
  if (tableDelivery?.deliveryPhase === 'returning-to-counter') return 'returning-to-counter'
  if (tableDelivery) return 'claimed'
  if (order) {
    if (order.status === 'legacy-unmapped') return 'legacy-unmapped'
    return order.readyAtGameTimeMs !== null && finiteGameTime(gameTimeMs) && gameTimeMs >= order.readyAtGameTimeMs ? 'ready' : 'queued'
  }
  if (state.heldConsumable?.sourceOrderId && Object.values(state.cafeStoryDeliveries).some(record => record.deliveryKind === 'table' && record.order.id === state.heldConsumable?.sourceOrderId && record.presentation === 'complete')) return 'delivered'
  if (state.heldConsumable?.shopId === crossShopIds.cafeTakeaway) return 'claimed'
  if (Object.values(state.cafeStoryDeliveries).some(record => record.order.shopId === crossShopIds.cafeTakeaway && record.deliveryKind !== 'table')) return 'delivered'
  return 'none'
}

/** Reserve a ready dine-in order for the seated player without removing it from save or hand. */
export function beginCafeTableOrderDelivery(state: CafeStoryOrderState, seatId: string, gameTimeMs: number) {
  if (!seatId || !finiteGameTime(gameTimeMs)) return { ok: false as const, state, reason: 'invalid-seat' as const }
  const existing = Object.values(state.cafeStoryDeliveries).find(record => record.deliveryKind === 'table' && record.order.shopId === crossShopIds.cafeTakeaway)
  if (existing) return existing.deliveryPhase === 'returning-to-counter'
    ? { ok: false as const, state, reason: 'returning-to-counter' as const }
    : { ok: true as const, state, record: existing, replayed: true }
  const order = state.shopOrders[crossShopIds.cafeTakeaway]
  if (!order) return { ok: false as const, state, reason: state.heldConsumable?.shopId === crossShopIds.cafeTakeaway ? 'claimed' as const : 'no-order' as const }
  if (order.status === 'legacy-unmapped') return { ok: false as const, state, reason: 'legacy-unmapped' as const }
  if (order.readyAtGameTimeMs === null || gameTimeMs < order.readyAtGameTimeMs) return { ok: false as const, state, reason: 'not-ready' as const }
  const eventId = `cafe-table-order:${order.id}`
  const record: CafeStoryDeliveryRecord = { eventId, order, deliveredAtGameTimeMs: gameTimeMs, presentation: 'pending', deliveryKind: 'table', seatId, deliveryPhase: 'to-seat' }
  return { ok: true as const, state: { ...state, cafeStoryDeliveries: { ...state.cafeStoryDeliveries, [eventId]: record } }, record, replayed: false }
}

export function retargetCafeTableOrderDelivery(
  deliveries: Readonly<Record<string, CafeStoryDeliveryRecord>>,
  seatId: string | null,
): Readonly<Record<string, CafeStoryDeliveryRecord>> {
  const entry = Object.entries(deliveries).find(([, record]) => record.deliveryKind === 'table')
  if (!entry) return deliveries
  const [eventId, record] = entry
  if (!seatId) return record.deliveryPhase === 'returning-to-counter' ? deliveries : { ...deliveries, [eventId]: { ...record, deliveryPhase: 'returning-to-counter' } }
  if (record.deliveryPhase === 'returning-to-counter' || (record.seatId === seatId && record.deliveryPhase === 'to-seat')) return deliveries
  return { ...deliveries, [eventId]: { ...record, seatId, deliveryPhase: 'to-seat' } }
}

export function completeCafeTableOrderDelivery(state: CafeStoryOrderState, orderId: string, seatId: string) {
  const entry = Object.entries(state.cafeStoryDeliveries).find(([, record]) => record.deliveryKind === 'table' && record.order.id === orderId && record.seatId === seatId)
  const current = state.shopOrders[crossShopIds.cafeTakeaway]
  if (!entry || entry[1].deliveryPhase === 'returning-to-counter' || current?.id !== orderId || current.status !== 'queued' || state.heldConsumable) return state
  const [eventId, record] = entry
  const shopOrders = { ...state.shopOrders }; delete shopOrders[crossShopIds.cafeTakeaway]
  const phoneNotifications = state.phoneNotifications?.filter(notification => notification.id !== `shop-order-ready:${orderId}`)
  const heldConsumable: HeldConsumable = { id: `held-${record.order.id}`, shopId: record.order.shopId, productId: record.order.productId, kind: 'drink', sourceOrderId: record.order.id }
  return { ...state, shopOrders, heldConsumable, cafeStoryDeliveries: { ...state.cafeStoryDeliveries, [eventId]: { ...record, presentation: 'complete' as const } }, ...(phoneNotifications ? { phoneNotifications } : {}) }
}

export function cafeTableOrderDelivery(state: CafeStoryOrderState) {
  const record = Object.values(state.cafeStoryDeliveries).find(item => item.deliveryKind === 'table' && item.presentation === 'pending')
  return record ? { orderId: record.order.id, seatId: record.seatId!, phase: record.deliveryPhase ?? 'to-seat' } as CafeTableOrderDeliveryTarget : null
}

/** Release the return route only after the floor server reaches its counter point. */
export function completeCafeTableOrderDeliveryReturn(state: CafeStoryOrderState, orderId: string): CafeStoryOrderState {
  const entry = Object.entries(state.cafeStoryDeliveries).find(([, record]) => record.deliveryKind === 'table' && record.order.id === orderId && record.presentation === 'pending' && record.deliveryPhase === 'returning-to-counter')
  if (!entry) return state
  const [eventId, record] = entry
  const current = state.shopOrders[crossShopIds.cafeTakeaway]
  if (current && current.id !== orderId) return state
  const shopOrders = current ? state.shopOrders : { ...state.shopOrders, [crossShopIds.cafeTakeaway]: record.order }
  const cafeStoryDeliveries = { ...state.cafeStoryDeliveries }
  delete cafeStoryDeliveries[eventId]
  return { ...state, shopOrders, cafeStoryDeliveries }
}

/** Authoritative completion result distinguishes a full-hand return from a delivered order. */
export function completeCafeTableOrderDeliveryResult(state: CafeStoryOrderState, orderId: string, seatId: string): CafeTableDeliveryCompletion {
  const delivery = cafeTableOrderDelivery(state)
  if (!delivery || delivery.phase !== 'to-seat' || delivery.orderId !== orderId || delivery.seatId !== seatId) return { ok: false, state, reason: 'not-at-target' }
  const current = state.shopOrders[crossShopIds.cafeTakeaway]
  if (!current || current.id !== orderId || current.status !== 'queued') return { ok: false, state, reason: 'order-changed' }
  if (state.heldConsumable) return { ok: false, state, reason: 'hand-full' }
  const next = completeCafeTableOrderDelivery(state, orderId, seatId)
  const heldConsumable = next.heldConsumable as HeldConsumable
  return next === state ? { ok: false, state, reason: 'order-changed' } : { ok: true, state: next, heldConsumable }
}

/** A persisted pending target is the refresh contract: resume from the saved seat or counter route. */
export function cafeTableOrderDeliveryAfterRefresh(state: CafeStoryOrderState): CafeTableOrderDeliveryTarget | null {
  return cafeTableOrderDelivery(state)
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
  if (Object.values(state.cafeStoryDeliveries).some(record => record.deliveryKind === 'table' && record.order.id === order.id && record.presentation === 'pending')) return { ok: false, state, reason: 'claimed' }
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
      || (record.presentation !== 'pending' && record.presentation !== 'complete')
      || (record.deliveryKind !== undefined && record.deliveryKind !== 'story' && record.deliveryKind !== 'table')
      || (record.deliveryKind === 'table' && (typeof record.seatId !== 'string' || (record.deliveryPhase !== undefined && record.deliveryPhase !== 'to-seat' && record.deliveryPhase !== 'returning-to-counter')))) continue
    const order = sanitizeCrossShopOrderState({ ordersByShop: { [crossShopIds.cafeTakeaway]: record.order }, heldConsumable: null }).ordersByShop[crossShopIds.cafeTakeaway]
    if (!order || order.status !== 'queued') continue
    result[eventId] = { eventId, order, deliveredAtGameTimeMs: record.deliveredAtGameTimeMs, presentation: record.presentation, ...(record.deliveryKind ? { deliveryKind: record.deliveryKind } : {}), ...(record.seatId ? { seatId: record.seatId } : {}), ...(record.deliveryPhase ? { deliveryPhase: record.deliveryPhase } : {}) }
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
    beginTableDelivery(seatId: string) {
      let outcome: ReturnType<typeof beginCafeTableOrderDelivery> | null = null
      options.commitSave(current => {
        const result = beginCafeTableOrderDelivery(current, seatId, options.readGameTimeMs())
        outcome = result
        return result.ok && result.state !== current ? { ...current, ...result.state } : current
      })
      return outcome
    },
    retargetTableDelivery(seatId: string | null) {
      options.commitSave(current => {
        const deliveries = retargetCafeTableOrderDelivery(current.cafeStoryDeliveries, seatId)
        return deliveries === current.cafeStoryDeliveries ? current : { ...current, cafeStoryDeliveries: deliveries }
      })
    },
    tableDelivery() { return cafeTableOrderDelivery(options.readSave()) },
    completeTableDelivery(orderId: string, seatId: string) {
      options.commitSave(current => {
        const result = completeCafeTableOrderDelivery(current, orderId, seatId)
        return result === current ? current : { ...current, ...result }
      })
    },
    completeTableDeliveryResult(orderId: string, seatId: string) {
      let outcome: CafeTableDeliveryCompletion | null = null
      options.commitSave(current => {
        const result = completeCafeTableOrderDeliveryResult(current, orderId, seatId)
        outcome = result
        return result.ok ? { ...current, ...result.state } : current
      })
      return outcome
    },
    completeTableDeliveryReturn(orderId: string) {
      options.commitSave(current => {
        const deliveries = completeCafeTableOrderDeliveryReturn(current, orderId).cafeStoryDeliveries
        return deliveries === current.cafeStoryDeliveries ? current : { ...current, cafeStoryDeliveries: deliveries }
      })
    },
  }
}
