import { useEffect, useMemo, useRef, useState } from 'react'
import { crossShopIds, formatReadableOrderNumber, type CrossShopOrder, type ShopOrderHistoryEntry } from './crossShopOrders'
import { commercialStreetDrinkCatalog, drinkCustomizationOptions } from './commercialStreetDrinkCatalog'
import { commercialCafeTakeawayCatalog } from './commercialCafeTakeawayCatalog'
import { shopPreparationGameMinutes } from './shopPreparationPolicy'
import { shopServiceCopy } from './shopServiceCopy'
import './drinkMarketApp.css'

type MarketProduct = {
  id: string
  name: string
  price: number
  description: string | null
  customization: { sugar: readonly string[] | null; ice: readonly string[] } | null
  hot: boolean
}

type MarketShop = { id: string; name: string; intro: string; products: MarketProduct[] }

const drinkShopIds = [crossShopIds.cafeTakeaway, crossShopIds.milkTea, crossShopIds.fruitTea] as const
const standardCustomization = { sugar: drinkCustomizationOptions.sugar, ice: drinkCustomizationOptions.ice }

function buildShops(): MarketShop[] {
  const streetProducts = (storeId: string): MarketProduct[] => commercialStreetDrinkCatalog
    .filter(product => product.storeId === storeId)
    .map(product => ({ id: product.id, name: product.name, price: product.price, description: product.description, customization: product.customization, hot: Boolean(product.recommendation) }))
  const cafe: MarketProduct[] = commercialCafeTakeawayCatalog.map((product, index) => ({
    id: product.id, name: product.name, price: product.price, description: null, customization: null, hot: index === 1,
  }))
  return [
    { id: crossShopIds.cafeTakeaway, name: '咖啡馆', intro: '现磨咖啡，享受惬意好时光', products: cafe },
    { id: crossShopIds.milkTea, name: '奶茶店', intro: '原味奶茶，香浓顺滑好心情', products: streetProducts(crossShopIds.milkTea) },
    { id: crossShopIds.fruitTea, name: '果茶店', intro: '果茶与鲜榨果汁，清爽解渴', products: streetProducts(crossShopIds.fruitTea) },
  ]
}

const allProductsById = new Map<string, { name: string; price: number }>()
for (const shop of buildShops()) for (const product of shop.products) allProductsById.set(product.id, { name: product.name, price: product.price })

function prepRangeLabel(products: readonly MarketProduct[]) {
  const minutes = products.map(product => shopPreparationGameMinutes[product.id]).filter((value): value is number => typeof value === 'number')
  if (!minutes.length) return null
  const low = Math.min(...minutes), high = Math.max(...minutes)
  return low === high ? `约 ${low} 分钟出餐` : `约 ${low}–${high} 分钟出餐`
}

function optionsLabel(options?: Record<string, string | number | boolean | null>) {
  if (!options) return ''
  return [options.sugar, options.ice].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' · ')
}

type OrderStatus = 'making' | 'served' | 'legacy'
function orderStatus(order: CrossShopOrder, gameTimeMs: number): OrderStatus {
  if (order.status === 'legacy-unmapped') return 'legacy'
  return order.readyAtGameTimeMs !== null && gameTimeMs >= order.readyAtGameTimeMs ? 'served' : 'making'
}

export function DrinkMarketApp({
  shopOrders = {}, history: allHistory = [], gameTimeMs, preparationConfiguredByShop = {},
  initialShopId = null, initialProductId = null, availableShopIds, onConfirm, onOrderPlaced, onCancelLegacy,
}: {
  shopOrders?: Readonly<Record<string, CrossShopOrder>>
  history?: readonly ShopOrderHistoryEntry[]
  gameTimeMs: number
  preparationConfiguredByShop?: Readonly<Record<string, boolean>>
  initialShopId?: string | null
  initialProductId?: string | null
  availableShopIds?: readonly string[]
  onConfirm: (selection: { shopId: string; productId: string; idempotencyKey: string; options?: Record<string, string | number | boolean | null> }) => { ok: boolean; reason?: string }
  onOrderPlaced?: (selection: { shopId: string; productId: string }) => void
  onCancelLegacy?: (shopId: string) => { ok: boolean; reason?: string }
}) {
  const shops = useMemo(() => buildShops().filter(shop => !availableShopIds || availableShopIds.includes(shop.id)), [availableShopIds])
  const startsOnOrders = Boolean(initialShopId && shopOrders[initialShopId] && !initialProductId)
  const [tab, setTab] = useState<'shops' | 'orders'>(startsOnOrders ? 'orders' : 'shops')
  const [shopId, setShopId] = useState<string | null>(initialShopId && !startsOnOrders ? initialShopId : null)
  const [sheetProductId, setSheetProductId] = useState<string | null>(initialProductId)
  const [sheetSugar, setSheetSugar] = useState<string | null>(null)
  const [sheetIce, setSheetIce] = useState<string | null>(null)
  const [cart, setCart] = useState<{ shopId: string; productId: string; options: Record<string, string> } | null>(null)
  const [notice, setNotice] = useState('')
  const requestIdRef = useRef<string | null>(null)
  const readyDot = Object.values(shopOrders).some(order => orderStatus(order, gameTimeMs) === 'served')

  useEffect(() => { setNotice('') }, [shopId, tab])

  const shop = shopId ? shops.find(item => item.id === shopId) ?? null : null
  const sheetProduct = shop && sheetProductId ? shop.products.find(product => product.id === sheetProductId) ?? null : null
  const sheetCustomization = sheetProduct ? sheetProduct.customization ?? (shop?.id === crossShopIds.cafeTakeaway ? null : standardCustomization) : null
  const sheetComplete = Boolean(sheetProduct && !(sheetCustomization?.sugar && !sheetSugar) && !(sheetCustomization?.ice && !sheetIce))
  const cartProduct = cart && shop?.id === cart.shopId ? shop.products.find(product => product.id === cart.productId) ?? null : null
  const shopHasOrder = Boolean(shop && shopOrders[shop.id])

  const openSheet = (productId: string) => { setSheetProductId(productId); setSheetSugar(null); setSheetIce(null) }
  const closeSheet = () => setSheetProductId(null)
  const addToCart = () => {
    if (!shop || !sheetProduct || !sheetComplete) return
    requestIdRef.current = null
    setCart({ shopId: shop.id, productId: sheetProduct.id, options: { ...(sheetSugar ? { sugar: sheetSugar } : {}), ...(sheetIce ? { ice: sheetIce } : {}) } })
    setNotice('')
    closeSheet()
  }
  const placeOrder = () => {
    if (!cart || !cartProduct) return
    if (!requestIdRef.current) requestIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `shop-order-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const handFullCopy = shopServiceCopy('unlocked').heldFull
    const result = onConfirm({ shopId: cart.shopId, productId: cart.productId, idempotencyKey: requestIdRef.current, options: cart.options })
    if (result.ok) {
      onOrderPlaced?.({ shopId: cart.shopId, productId: cart.productId })
      setCart(null); requestIdRef.current = null; setNotice('')
      setShopId(null); setTab('orders')
      return
    }
    setNotice(result.reason === 'hand-full' ? handFullCopy
      : result.reason === 'insufficient-funds' ? '余额不足，无法下单'
        : result.reason === 'preparation-not-configured' ? '这款饮品暂时无法下单，请稍后再试'
          : result.reason === 'shop-already-has-order' ? '还有一笔订单没领，先去取餐吧'
            : result.reason ?? '订单暂时无法提交')
  }

  // Yonghe is not part of the phone ordering app, so its pickups never appear here.
  const history = allHistory.filter(entry => (drinkShopIds as readonly string[]).includes(entry.shopId))
  const inProgress = shops.map(item => shopOrders[item.id]).filter((order): order is CrossShopOrder => Boolean(order))
  const orderTitle = (order: CrossShopOrder) => allProductsById.get(order.productId)?.name ?? order.productId
  const shopName = (id: string) => buildShops().find(item => item.id === id)?.name ?? '店铺'

  return <div className="drink-market" data-drink-market-tab={tab}>
    <div className="drink-market__body">
      {tab === 'shops' && !shop && <section className="drink-market__shops" aria-label="商店">
        {shops.map(item => {
          const order = shopOrders[item.id]
          const status = order ? orderStatus(order, gameTimeMs) : null
          const hot = item.products.find(product => product.hot) ?? item.products[0]
          const prep = prepRangeLabel(item.products)
          return <button key={item.id} type="button" className="drink-market__shop-card" data-shop-card={item.id} onClick={() => { setShopId(item.id); setCart(null) }}>
            <span className="drink-market__shop-name">{item.name}{status && <em data-status={status}>{status === 'served' ? '已出餐' : status === 'making' ? '制作中' : '待核对'}</em>}</span>
            <span className="drink-market__shop-intro">{item.intro}</span>
            <span className="drink-market__shop-meta">{prep && <span>{prep}</span>}{hot && <span>热门 · {hot.name}</span>}</span>
          </button>
        })}
      </section>}

      {tab === 'shops' && shop && <section className="drink-market__shop" aria-label={shop.name} data-shop-id={shop.id}>
        <header className="drink-market__shop-head">
          <button type="button" className="drink-market__back" aria-label="返回商店" onClick={() => { setShopId(null); setCart(null); closeSheet() }}>‹</button>
          <div><strong>{shop.name}</strong><small>{prepRangeLabel(shop.products) ?? shop.intro}</small></div>
        </header>
        <ul className="drink-market__products">
          {shop.products.map(product => <li key={product.id}>
            <button type="button" className="drink-market__product" data-shop-product-id={product.id} aria-pressed={cart?.productId === product.id} onClick={() => openSheet(product.id)}>
              <span className="drink-market__product-text"><strong>{product.name}</strong>{product.description && <small>{product.description}</small>}</span>
              <span className="drink-market__product-price">{product.price}</span>
              <span className="drink-market__product-add" aria-hidden="true">+</span>
            </button>
          </li>)}
        </ul>
        {notice && <p className="drink-market__notice" role="status">{notice}</p>}
      </section>}

      {tab === 'orders' && <section className="drink-market__orders" aria-label="订单">
        {inProgress.length === 0 && history.length === 0 && <div className="drink-market__empty">
          <p>没有订单，可以去商店看看</p>
          <button type="button" onClick={() => setTab('shops')}>去商店</button>
        </div>}
        {(inProgress.length > 0 || history.length > 0) && <>
          <h3>进行中</h3>
          {inProgress.length === 0 && <p className="drink-market__none">没有进行中的订单</p>}
          {inProgress.map(order => {
            const status = orderStatus(order, gameTimeMs)
            return <article key={order.id} className="drink-market__order" data-order-status={status} data-shop-id={order.shopId}>
              <div className="drink-market__order-top"><strong>{status === 'legacy' ? '旧订单待核对' : orderTitle(order)}</strong><em data-status={status}>{status === 'served' ? '已出餐' : status === 'making' ? '制作中' : '待核对'}</em></div>
              <small>{shopName(order.shopId)} · 订单号 {formatReadableOrderNumber(order.id)}</small>
              {optionsLabel(order.options) && <small>{optionsLabel(order.options)}</small>}
              {status === 'legacy' && onCancelLegacy && <button type="button" className="drink-market__link" onClick={() => { const result = onCancelLegacy(order.shopId); if (!result.ok) setNotice(result.reason ?? '暂时无法取消旧订单') }}>取消旧订单并重新下单</button>}
            </article>
          })}
          {notice && <p className="drink-market__notice" role="status">{notice}</p>}
          <h3>历史订单</h3>
          {history.length === 0 && <p className="drink-market__none">还没有历史订单</p>}
          {history.map(entry => <article key={entry.id} className="drink-market__order drink-market__order--history" data-history-order={entry.id}>
            <div className="drink-market__order-top"><strong>{allProductsById.get(entry.productId)?.name ?? entry.productId}</strong>{entry.pricePaid !== undefined && <span>{entry.pricePaid}</span>}</div>
            <small>{shopName(entry.shopId)} · 订单号 {formatReadableOrderNumber(entry.id)}</small>
            {optionsLabel(entry.options) && <small>{optionsLabel(entry.options)}</small>}
          </article>)}
        </>}
      </section>}
    </div>

    {tab === 'shops' && shop && cartProduct && <div className="drink-market__cart" role="region" aria-label="已选饮品">
      <div className="drink-market__cart-line"><span>{[cartProduct.name, optionsLabel(cart?.options), String(cartProduct.price)].filter(Boolean).join(' · ')}</span><button type="button" aria-label="移除" onClick={() => { setCart(null); requestIdRef.current = null }}>✕</button></div>
      <button type="button" className="drink-market__cart-confirm" disabled={shopHasOrder || !preparationConfiguredByShop[shop.id]} onClick={placeOrder}>{shopHasOrder ? '还有订单没领，先去取餐' : '去下单'}</button>
    </div>}

    <nav className="drink-market__tabs" aria-label="点单导航">
      <button type="button" aria-pressed={tab === 'shops'} onClick={() => setTab('shops')}>商店</button>
      <button type="button" aria-pressed={tab === 'orders'} data-ready={String(readyDot)} onClick={() => { setTab('orders'); setShopId(null); closeSheet() }}>订单{readyDot && <i aria-hidden="true" />}</button>
    </nav>

    {tab === 'shops' && shop && sheetProduct && <div className="drink-market__sheet-backdrop" onClick={closeSheet}>
      <div className="drink-market__sheet" role="dialog" aria-label={sheetProduct.name} onClick={event => event.stopPropagation()}>
        <div className="drink-market__sheet-head"><strong>{sheetProduct.name}</strong><span>{sheetProduct.price}</span></div>
        {sheetProduct.description && <p>{sheetProduct.description}</p>}
        {sheetCustomization?.sugar && <fieldset><legend>糖度</legend><div>{sheetCustomization.sugar.map(option => <button key={option} type="button" aria-pressed={sheetSugar === option} onClick={() => setSheetSugar(option)}>{option}</button>)}</div></fieldset>}
        {sheetCustomization?.ice && <fieldset><legend>冰量</legend><div>{sheetCustomization.ice.map(option => <button key={option} type="button" aria-pressed={sheetIce === option} onClick={() => setSheetIce(option)}>{option}</button>)}</div></fieldset>}
        <button type="button" className="drink-market__sheet-add" disabled={!sheetComplete} onClick={addToCart}>{sheetComplete ? '加入' : sheetCustomization?.sugar && !sheetSugar ? '请选择糖度' : '请选择冰量'}</button>
      </div>
    </div>}
  </div>
}
