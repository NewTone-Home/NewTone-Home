import { useEffect, useMemo, useRef, useState } from 'react'
import type { CrossShopOrder, HeldConsumable } from './crossShopOrders'
import { milkTeaIceOptions, milkTeaSugarOptions } from './commercialStreetMilkTea'
import './shopOrderApp.css'

export type ShopOrderProduct = {
  id: string
  name: string
  price?: number
  customization?: { sugar: readonly string[] | null; ice: readonly string[] }
}

export function ShopOrderApp({
  shopId, title, products, order, heldConsumable, gameTimeMs, preparationConfigured,
  availableShops = [], onShopSelect, onConfirm, onCancelLegacy, initialProductId = null, onOrderPlaced, onOrderReady,
}: {
  shopId: string
  title: string
  products: readonly ShopOrderProduct[]
  order: CrossShopOrder | null
  heldConsumable: HeldConsumable | null
  gameTimeMs: number
  preparationConfigured: boolean
  initialProductId?: string | null
  onOrderPlaced?: (selection: { shopId: string; productId: string }) => void
  onOrderReady?: (order: { id: string; shopId: string; productId: string; productName: string }) => void
  availableShops?: readonly { id: string; label: string }[]
  onShopSelect?: (shopId: string) => void
  onConfirm: (selection: { shopId: string; productId: string; options?: Record<string, string | number | boolean | null> }) => { ok: boolean; reason?: string }
  onCancelLegacy?: (shopId: string) => { ok: boolean; reason?: string }
}) {
  const [productId, setProductId] = useState<string | null>(null)
  const [sugar, setSugar] = useState<string | null>(null)
  const [ice, setIce] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const readyNotifiedOrderId = useRef<string | null>(null)
  const selected = useMemo(() => products.find(product => product.id === productId) ?? null, [productId, products])
  const readiness = order?.status === 'queued' && order.readyAtGameTimeMs !== null && gameTimeMs >= order.readyAtGameTimeMs
  useEffect(() => { setNotice(''); setProductId(initialProductId) }, [shopId, order?.id, initialProductId])
  useEffect(() => {
    if (shopId !== 'yonghe-eatery' || !readiness || !order || readyNotifiedOrderId.current === order.id) return
    readyNotifiedOrderId.current = order.id
    onOrderReady?.({ id: order.id, shopId, productId: order.productId, productName: products.find(product => product.id === order.productId)?.name ?? order.productId })
  }, [onOrderReady, order, products, readiness, shopId])

  return <section className="shop-order-app" aria-label={`${title}点单`} data-shop-id={shopId}>
    {availableShops.length > 1 && <nav className="shop-order-app__shops" aria-label="Drink shops">{availableShops.map(shop => <button key={shop.id} type="button" data-shop-option={shop.id} aria-pressed={shop.id === shopId} onClick={() => onShopSelect?.(shop.id)}>{shop.label}</button>)}</nav>}
    {heldConsumable && <p className="shop-order-app__hand" role="status">手上已有一件物品；仍可下单，领取时检查手持状态。</p>}
    {order ? order.status === 'legacy-unmapped' ? <div className="shop-order-app__order" data-order-status="legacy-unmapped">
      <p>没有可靠的制作时间，不能安全估算。你可以保留旧记录，或明确取消后重新下单。</p>
      {onCancelLegacy && <button type="button" className="shop-order-app__cancel-legacy" onClick={() => {
        const result = onCancelLegacy(shopId)
        if (!result.ok) setNotice(result.reason ?? '暂时无法取消旧订单')
      }}>取消旧订单并重新下单</button>}
      {notice && <p role="status">{notice}</p>}
      <strong>有一笔旧订单需要恢复时间</strong>
      <p>旧订单保留着，当前资料不足以安全换算制作进度，暂不能领取或新下单。</p>
      <small>原订单：{order.id}</small>
    </div> : <div className="shop-order-app__order" data-order-status={readiness ? 'ready' : 'queued'}>
      <span>当前订单</span>
      <strong>{products.find(product => product.id === order.productId)?.name ?? order.productId}</strong>
      <p>{readiness ? shopId === 'yonghe-eatery' ? `${products.find(product => product.id === order.productId)?.name ?? order.productId}好了。` : '已做好，可以到柜台领取。' : '正在制作中。'}</p>
    </div> : <>
      <p className="shop-order-app__title">{title}</p>
      <div className="shop-order-app__products" aria-label="商品">
        {products.map(product => <button key={product.id} type="button" data-shop-product-id={product.id} aria-pressed={productId === product.id} onClick={() => { setProductId(product.id); setSugar(null); setIce(null); setNotice('') }}>
          <span>{product.name}</span>{product.price !== undefined && <small>{product.price}</small>}
        </button>)}
      </div>
      {selected?.customization?.sugar && <fieldset><legend>糖度</legend>{milkTeaSugarOptions.map(option => <button key={option} type="button" aria-pressed={sugar === option} onClick={() => setSugar(option)}>{option}</button>)}</fieldset>}
      {selected?.customization?.ice && <fieldset><legend>冰量</legend>{milkTeaIceOptions.map(option => <button key={option} type="button" aria-pressed={ice === option} onClick={() => setIce(option)}>{option}</button>)}</fieldset>}
      {!preparationConfigured && <p className="shop-order-app__blocked" role="status">本店制作时长尚未配置，暂时不能创建订单。</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="shop-order-app__confirm" type="button" disabled={!selected || !preparationConfigured
        || Boolean(selected.customization?.sugar && !sugar) || Boolean(selected.customization?.ice && !ice)} onClick={() => {
        if (!selected) return
        const result = onConfirm({ shopId, productId: selected.id, options: {
          ...(sugar ? { sugar } : {}), ...(ice ? { ice } : {}),
        } })
        if (result.ok) { setProductId(null); setSugar(null); setIce(null); setNotice('订单已提交。'); onOrderPlaced?.({ shopId, productId: selected.id }) }
        else setNotice(result.reason ?? '订单暂时无法提交。')
      }}>确认下单</button>
    </>}
  </section>
}

export const standardDrinkCustomization = { sugar: milkTeaSugarOptions, ice: milkTeaIceOptions } as const
