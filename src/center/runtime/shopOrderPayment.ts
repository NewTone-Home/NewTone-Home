import { placeCrossShopOrder, type CrossShopOrder, type CrossShopOrderState } from './crossShopOrders'

export type ShopOrderPaymentReceipt = {
  idempotencyKey: string
  orderId: string
  shopId: string
  productId: string
  amount: number
}

export type ShopOrderPaymentState = {
  walletBalance: number
  paymentReceipts: Record<string, ShopOrderPaymentReceipt>
}

export type PaidOrderResult =
  | { ok: true; orderState: CrossShopOrderState; paymentState: ShopOrderPaymentState; order: CrossShopOrder | null; replayed: boolean }
  | { ok: false; reason: 'invalid-payment' | 'insufficient-funds' | 'shop-already-has-order' | 'preparation-not-configured' | 'invalid-order'; orderState: CrossShopOrderState; paymentState: ShopOrderPaymentState }

/**
 * Atomically plans the order and one wallet debit in pure data. Callers persist
 * both returned states together in the same PlayerSave update.
 */
export function placePaidShopOrder(
  orderState: CrossShopOrderState,
  paymentState: ShopOrderPaymentState,
  input: {
    shopId: string
    productId: string
    orderId: string
    idempotencyKey: string
    price: number
    placedAtGameTimeMs: number
    preparationDurationMs: number | null
    options?: Record<string, string | number | boolean | null>
  },
): PaidOrderResult {
  const existing = paymentState.paymentReceipts[input.idempotencyKey]
  if (existing) {
    if (existing.shopId !== input.shopId || existing.productId !== input.productId || existing.amount !== input.price) {
      return { ok: false, reason: 'invalid-payment', orderState, paymentState }
    }
    return { ok: true, orderState, paymentState, order: orderState.ordersByShop[existing.shopId] ?? null, replayed: true }
  }
  if (!input.idempotencyKey || !input.orderId || !input.shopId || !input.productId
    || !Number.isSafeInteger(input.price) || input.price <= 0
    || !Number.isSafeInteger(paymentState.walletBalance) || paymentState.walletBalance < 0) {
    return { ok: false, reason: 'invalid-payment', orderState, paymentState }
  }
  if (paymentState.walletBalance < input.price) return { ok: false, reason: 'insufficient-funds', orderState, paymentState }

  const placed = placeCrossShopOrder(orderState, {
    shopId: input.shopId,
    productId: input.productId,
    id: input.orderId,
    placedAtGameTimeMs: input.placedAtGameTimeMs,
    preparationDurationMs: input.preparationDurationMs,
    options: input.options,
  })
  if (!placed.ok) {
    return { ok: false, reason: placed.reason as Extract<PaidOrderResult, { ok: false }>['reason'], orderState, paymentState }
  }

  const receipt: ShopOrderPaymentReceipt = {
    idempotencyKey: input.idempotencyKey,
    orderId: input.orderId,
    shopId: input.shopId,
    productId: input.productId,
    amount: input.price,
  }
  const order: CrossShopOrder = { ...placed.value, pricePaid: input.price, paymentReceiptId: input.idempotencyKey }
  return {
    ok: true,
    orderState: {
      ...placed.state,
      ordersByShop: { ...placed.state.ordersByShop, [input.shopId]: order },
    },
    paymentState: {
      walletBalance: paymentState.walletBalance - input.price,
      paymentReceipts: { ...paymentState.paymentReceipts, [input.idempotencyKey]: receipt },
    },
    order,
    replayed: false,
  }
}

export function cleanShopOrderPaymentState(value: unknown): ShopOrderPaymentState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { walletBalance: 0, paymentReceipts: {} }
  const source = value as Partial<ShopOrderPaymentState>
  const walletBalance = Number.isSafeInteger(source.walletBalance) && (source.walletBalance as number) >= 0
    ? source.walletBalance as number
    : 0
  const paymentReceipts: Record<string, ShopOrderPaymentReceipt> = {}
  if (source.paymentReceipts && typeof source.paymentReceipts === 'object' && !Array.isArray(source.paymentReceipts)) {
    for (const [key, raw] of Object.entries(source.paymentReceipts)) {
      if (!raw || typeof raw !== 'object') continue
      const receipt = raw as ShopOrderPaymentReceipt
      if (key && receipt.idempotencyKey === key && typeof receipt.orderId === 'string' && receipt.orderId
        && typeof receipt.shopId === 'string' && receipt.shopId
        && typeof receipt.productId === 'string' && receipt.productId
        && Number.isSafeInteger(receipt.amount) && receipt.amount > 0) {
        paymentReceipts[key] = { idempotencyKey: key, orderId: receipt.orderId, shopId: receipt.shopId, productId: receipt.productId, amount: receipt.amount }
      }
    }
  }
  return { walletBalance, paymentReceipts }
}
