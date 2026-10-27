import type { PlayerChoiceValue, PlayerSceneState } from './playerSave'
import {
  commercialStreetMilkTeaDrinkKey,
  commercialStreetMilkTeaHeldDrinkKey,
  commercialStreetMilkTeaIceKey,
  commercialStreetMilkTeaLastOrderNumberKey,
  commercialStreetMilkTeaOrderNumberKey,
  commercialStreetMilkTeaReadyAtKey,
  commercialStreetMilkTeaCreatedAtKey,
  commercialStreetMilkTeaQueueAheadKey,
  commercialStreetMilkTeaSugarKey,
} from './commercialStreetMilkTea'

export const crossShopIds = {
  milkTea: 'commercial-south-slot-5',
  fruitTea: 'commercial-south-slot-5',
  yonghe: 'yonghe-eatery',
  cafeTakeaway: 'commercial-cafe-slot',
} as const

export type CrossShopOrder = {
  id: string
  shopId: string
  productId: string
  status: 'queued' | 'legacy-unmapped'
  placedAtGameTimeMs: number | null
  readyAtGameTimeMs: number | null
  /** Optional adapter-owned product choices such as sugar, ice, or takeaway packaging. */
  options?: Record<string, string | number | boolean | null>
  /** Non-authoritative old scene-state fields retained until legacy timing is decided. */
  legacySnapshot?: Record<string, PlayerChoiceValue>
}

export type HeldConsumable = {
  id: string
  shopId: string
  productId: string
  kind: 'drink' | 'meal' | 'legacy-unknown'
  sourceOrderId: string | null
}

export type CrossShopOrderState = {
  ordersByShop: Record<string, CrossShopOrder>
  heldConsumable: HeldConsumable | null
}

export const emptyCrossShopOrderState: CrossShopOrderState = { ordersByShop: {}, heldConsumable: null }

export type CrossShopResult<T> =
  | { ok: true; state: CrossShopOrderState; value: T }
  | { ok: false; state: CrossShopOrderState; reason: 'invalid-order' | 'shop-already-has-order' | 'no-order' | 'not-ready' | 'hand-full' | 'nothing-to-consume' }

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function sanitizeCrossShopOrderState(value: unknown): CrossShopOrderState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ordersByShop: {}, heldConsumable: null }
  const raw = value as Partial<CrossShopOrderState>
  const ordersByShop: Record<string, CrossShopOrder> = {}
  if (raw.ordersByShop && typeof raw.ordersByShop === 'object' && !Array.isArray(raw.ordersByShop)) {
    for (const [shopId, orderValue] of Object.entries(raw.ordersByShop)) {
      if (!orderValue || typeof orderValue !== 'object') continue
      const order = orderValue as CrossShopOrder
      if (!shopId || order.shopId !== shopId || typeof order.id !== 'string' || !order.id
        || typeof order.productId !== 'string' || !order.productId) continue
      if (order.status === 'legacy-unmapped') {
        ordersByShop[shopId] = {
          id: order.id, shopId, productId: order.productId, status: 'legacy-unmapped',
          placedAtGameTimeMs: null, readyAtGameTimeMs: null,
          ...(cleanOptions(order.options) ? { options: cleanOptions(order.options) } : {}),
          ...(cleanLegacy(order.legacySnapshot) ? { legacySnapshot: cleanLegacy(order.legacySnapshot) } : {}),
        }
      } else if (order.status === 'queued' && isFiniteNonNegative(order.placedAtGameTimeMs)
        && isFiniteNonNegative(order.readyAtGameTimeMs) && order.readyAtGameTimeMs >= order.placedAtGameTimeMs) {
        ordersByShop[shopId] = {
          id: order.id, shopId, productId: order.productId, status: 'queued',
          placedAtGameTimeMs: order.placedAtGameTimeMs, readyAtGameTimeMs: order.readyAtGameTimeMs,
          ...(cleanOptions(order.options) ? { options: cleanOptions(order.options) } : {}),
        }
      }
    }
  }
  const held = raw.heldConsumable
  const heldConsumable = held && typeof held === 'object'
    && typeof held.id === 'string' && typeof held.shopId === 'string' && typeof held.productId === 'string'
    && (held.kind === 'drink' || held.kind === 'meal' || held.kind === 'legacy-unknown')
    && (held.sourceOrderId === null || typeof held.sourceOrderId === 'string')
    ? { id: held.id, shopId: held.shopId, productId: held.productId, kind: held.kind, sourceOrderId: held.sourceOrderId }
    : null
  return { ordersByShop, heldConsumable }
}

function cleanOptions(value: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = Object.entries(value).filter(([, item]) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
  return entries.length ? Object.fromEntries(entries) as Record<string, string | number | boolean | null> : undefined
}

function cleanLegacy(value: unknown): Record<string, PlayerChoiceValue> | undefined {
  return cleanOptions(value) as Record<string, PlayerChoiceValue> | undefined
}

export function migrateLegacyShopState(sceneState: Partial<Record<string, PlayerSceneState>>): CrossShopOrderState {
  const migrated: CrossShopOrderState = { ordersByShop: {}, heldConsumable: null }
  const street = sceneState['commercial-street']
  if (!street) return migrated
  const oldOrderNumber = street[commercialStreetMilkTeaOrderNumberKey]
  const hasOldOrder = typeof oldOrderNumber === 'number' && Number.isInteger(oldOrderNumber) && oldOrderNumber > 0
  if (hasOldOrder) {
    const legacySnapshot: Record<string, PlayerChoiceValue> = {}
    for (const key of [commercialStreetMilkTeaOrderNumberKey, commercialStreetMilkTeaLastOrderNumberKey,
      commercialStreetMilkTeaDrinkKey, commercialStreetMilkTeaSugarKey, commercialStreetMilkTeaIceKey,
      commercialStreetMilkTeaReadyAtKey, commercialStreetMilkTeaCreatedAtKey, commercialStreetMilkTeaQueueAheadKey]) {
      const item = street[key]
      if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) legacySnapshot[key] = item as PlayerChoiceValue
    }
    migrated.ordersByShop[crossShopIds.milkTea] = {
      id: `legacy-milk-tea-${oldOrderNumber}`,
      shopId: crossShopIds.milkTea,
      productId: 'legacy-milk-tea-order',
      status: 'legacy-unmapped',
      placedAtGameTimeMs: null,
      readyAtGameTimeMs: null,
      legacySnapshot,
    }
  }
  if (street[commercialStreetMilkTeaHeldDrinkKey] === 'milk-tea') {
    migrated.heldConsumable = { id: 'legacy-held-milk-tea', shopId: crossShopIds.milkTea,
      productId: 'legacy-milk-tea', kind: 'legacy-unknown', sourceOrderId: null }
  }
  return migrated
}

export function placeCrossShopOrder(
  state: CrossShopOrderState,
  input: { shopId: string; productId: string; placedAtGameTimeMs: number; preparationDurationMs: number; id: string; options?: Record<string, string | number | boolean | null> },
): CrossShopResult<CrossShopOrder> {
  if (!input.shopId || !input.productId || !input.id || !isFiniteNonNegative(input.placedAtGameTimeMs)
    || !isFiniteNonNegative(input.preparationDurationMs)) return { ok: false, state, reason: 'invalid-order' }
  if (state.ordersByShop[input.shopId]) return { ok: false, state, reason: 'shop-already-has-order' }
  const order: CrossShopOrder = {
    id: input.id, shopId: input.shopId, productId: input.productId, status: 'queued',
    placedAtGameTimeMs: input.placedAtGameTimeMs,
    readyAtGameTimeMs: input.placedAtGameTimeMs + input.preparationDurationMs,
    ...(input.options ? { options: input.options } : {}),
  }
  return { ok: true, state: { ...state, ordersByShop: { ...state.ordersByShop, [input.shopId]: order } }, value: order }
}

export function claimCrossShopOrder(
  state: CrossShopOrderState,
  shopId: string,
  nowGameTimeMs: number,
  kind: 'drink' | 'meal' = 'drink',
): CrossShopResult<HeldConsumable> {
  const order = state.ordersByShop[shopId]
  if (!order) return { ok: false, state, reason: 'no-order' }
  if (!isFiniteNonNegative(nowGameTimeMs) || order.status !== 'queued' || order.readyAtGameTimeMs === null
    || nowGameTimeMs < order.readyAtGameTimeMs) return { ok: false, state, reason: 'not-ready' }
  if (state.heldConsumable) return { ok: false, state, reason: 'hand-full' }
  const heldConsumable: HeldConsumable = { id: `held-${order.id}`, shopId, productId: order.productId, kind, sourceOrderId: order.id }
  const ordersByShop = { ...state.ordersByShop }
  delete ordersByShop[shopId]
  return { ok: true, state: { ordersByShop, heldConsumable }, value: heldConsumable }
}

export function consumeHeldConsumable(state: CrossShopOrderState): CrossShopResult<HeldConsumable> {
  if (!state.heldConsumable) return { ok: false, state, reason: 'nothing-to-consume' }
  return { ok: true, state: { ...state, heldConsumable: null }, value: state.heldConsumable }
}
