import { shopProductsFor } from './shopOrderCatalog'

export type ManualShopOrderChoice = Readonly<{ id: string; label: string }>
export type ManualShopOrderCustomization = Readonly<{ sugar: readonly string[] | null; ice: readonly string[] }>
export type ManualShopOrderProduct = Readonly<{
  id: string
  name: string
  price: number
  storeId: string
  customization?: ManualShopOrderCustomization
}>

export type ManualShopOrderSession = Readonly<{
  shopId: string
  idempotencyKey: string
  phase: 'catalog' | 'sugar' | 'ice' | 'confirm' | 'submitted'
  productId: string | null
  sugar: string | null
  ice: string | null
}>

export type ManualShopOrderView = Readonly<{
  text: string
  choices: readonly ManualShopOrderChoice[]
}>

export type ManualShopOrderConfirmation = Readonly<{
  shopId: string
  productId: string
  idempotencyKey: string
  options?: Record<string, string | number | boolean | null>
}>

export type ManualShopOrderSubmit = (input: ManualShopOrderConfirmation) => { ok: boolean; reason?: string }

export type ManualShopOrderStartResult =
  | { ok: true; session: ManualShopOrderSession }
  | { ok: false; reason: 'invalid-session' | 'unknown-shop' | 'shop-already-has-order' }

export type ManualShopOrderStepResult = Readonly<{
  session: ManualShopOrderSession | null
  view: ManualShopOrderView | null
  submitted?: { ok: boolean; reason?: string }
}>

const cancelChoice = { id: 'cancel', label: '我再看看吧' } as const

function productFor(session: ManualShopOrderSession): ManualShopOrderProduct | null {
  return shopProductsFor(session.shopId).find(product => product.id === session.productId) as ManualShopOrderProduct | undefined ?? null
}

function hasValidCustomization(product: ManualShopOrderProduct, session: ManualShopOrderSession) {
  const customization = product.customization
  return (!customization?.sugar || customization.sugar.includes(session.sugar ?? ''))
    && (!customization?.ice || customization.ice.includes(session.ice ?? ''))
}

export function startManualShopOrderSession(input: {
  shopId: string
  idempotencyKey: string
  shopAlreadyHasOrder: boolean
  preselectedProductId?: string | null
}): ManualShopOrderStartResult {
  if (!input.shopId || !input.idempotencyKey) return { ok: false, reason: 'invalid-session' }
  if (!shopProductsFor(input.shopId).length) return { ok: false, reason: 'unknown-shop' }
  if (input.shopAlreadyHasOrder) return { ok: false, reason: 'shop-already-has-order' }
  const session: ManualShopOrderSession = {
      shopId: input.shopId,
      idempotencyKey: input.idempotencyKey,
      phase: 'catalog',
      productId: null,
      sugar: null,
      ice: null,
  }
  const initialProduct = input.preselectedProductId
    ? shopProductsFor(input.shopId).find(product => product.id === input.preselectedProductId) as ManualShopOrderProduct | undefined
    : undefined
  if (input.preselectedProductId && !initialProduct) return { ok: false, reason: 'unknown-shop' }
  return {
    ok: true,
    session: initialProduct ? beginProduct(session, initialProduct) : session,
  }
}

export function manualShopOrderView(session: ManualShopOrderSession): ManualShopOrderView {
  const products = shopProductsFor(session.shopId) as readonly ManualShopOrderProduct[]
  if (session.phase === 'catalog') {
    return {
      text: '想点哪一款？',
      choices: [...products.map(product => ({ id: `product:${product.id}`, label: `${product.name} ${product.price}元` })), cancelChoice],
    }
  }

  const product = productFor(session)
  if (!product) return { text: '商品目录暂不可用', choices: [cancelChoice] }

  if (session.phase === 'sugar') {
    return {
      text: `${product.name}想要几分甜？`,
      choices: [...(product.customization?.sugar ?? []).map(value => ({ id: `sugar:${value}`, label: value })), cancelChoice],
    }
  }

  if (session.phase === 'ice') {
    return {
      text: product.customization?.sugar === null
        ? '糖是固定的噢，请问要多少冰呢？'
        : `${product.name}的糖度选好了，请问要多少冰呢？`,
      choices: [...(product.customization?.ice ?? []).map(value => ({ id: `ice:${value}`, label: value })), cancelChoice],
    }
  }

  if (session.phase === 'confirm') {
    const details = [session.sugar, session.ice].filter(Boolean).join('、')
    return {
      text: `${product.name}${details ? `，${details}` : ''}，合计${product.price}元，确认下单吗？`,
      choices: [{ id: 'confirm', label: '确认下单' }, cancelChoice],
    }
  }

  return { text: '订单已提交', choices: [] }
}

function beginProduct(session: ManualShopOrderSession, product: ManualShopOrderProduct): ManualShopOrderSession {
  const customization = product.customization
  const phase = customization?.sugar ? 'sugar' : customization?.ice ? 'ice' : 'confirm'
  return { ...session, phase, productId: product.id, sugar: null, ice: null }
}

function afterCustomization(session: ManualShopOrderSession, product: ManualShopOrderProduct): ManualShopOrderSession {
  if (product.customization?.sugar && !session.sugar) return { ...session, phase: 'sugar' }
  if (product.customization?.ice && !session.ice) return { ...session, phase: 'ice' }
  return { ...session, phase: 'confirm' }
}

/**
 * Pure dialogue-session adapter. `submitOrder` should be the existing shared
 * confirmShopOrder callback; this module never opens a phone or edits a ledger.
 */
export function chooseManualShopOrderOption(
  session: ManualShopOrderSession,
  choiceId: string,
  submitOrder: ManualShopOrderSubmit,
): ManualShopOrderStepResult {
  if (choiceId === 'cancel') return { session: null, view: null }

  if (session.phase === 'catalog') {
    if (!choiceId.startsWith('product:')) return { session, view: manualShopOrderView(session) }
    const productId = choiceId.slice('product:'.length)
    const product = shopProductsFor(session.shopId).find(candidate => candidate.id === productId) as ManualShopOrderProduct | undefined
    if (!product) return { session, view: manualShopOrderView(session) }
    const next = beginProduct(session, product)
    return { session: next, view: manualShopOrderView(next) }
  }

  const product = productFor(session)
  if (!product) return { session, view: manualShopOrderView(session) }

  if (choiceId.startsWith('sugar:') && session.phase === 'sugar') {
    const sugar = choiceId.slice('sugar:'.length)
    if (!product.customization?.sugar?.includes(sugar)) return { session, view: manualShopOrderView(session) }
    const next = afterCustomization({ ...session, sugar }, product)
    return { session: next, view: manualShopOrderView(next) }
  }

  if (choiceId.startsWith('ice:') && session.phase === 'ice') {
    const ice = choiceId.slice('ice:'.length)
    if (!product.customization?.ice.includes(ice)) return { session, view: manualShopOrderView(session) }
    const next = afterCustomization({ ...session, ice }, product)
    return { session: next, view: manualShopOrderView(next) }
  }

  if (choiceId !== 'confirm' || session.phase !== 'confirm' || !hasValidCustomization(product, session)) {
    return { session, view: manualShopOrderView(session) }
  }

  const options = {
    ...(session.sugar ? { sugar: session.sugar } : {}),
    ...(session.ice ? { ice: session.ice } : {}),
  }
  const submitted = submitOrder({
    shopId: session.shopId,
    productId: product.id,
    idempotencyKey: session.idempotencyKey,
    ...(Object.keys(options).length ? { options } : {}),
  })
  if (!submitted.ok) return { session, view: manualShopOrderView(session), submitted }
  const next = { ...session, phase: 'submitted' as const }
  return { session: next, view: manualShopOrderView(next), submitted }
}
