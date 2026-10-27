import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShopOrderApp } from '../src/center/runtime/ShopOrderApp'
import { phoneAppForShopId } from '../src/center/runtime/WorldPhone'
import { crossShopIds } from '../src/center/runtime/crossShopOrders'

describe('shared drink ordering app', () => {
  it('routes milk tea and fruit tea into the same phone app key', () => {
    expect(phoneAppForShopId(crossShopIds.milkTea)).toBe('milk-tea')
    expect(phoneAppForShopId(crossShopIds.fruitTea)).toBe('milk-tea')
  })

  it('shows one in-app shop selector with the current shop selected', () => {
    const markup = renderToStaticMarkup(<ShopOrderApp
      shopId={crossShopIds.fruitTea}
      title="Fruit tea"
      products={[{ id: 'passionfruit-green-tea', name: 'Passionfruit green tea' }]}
      availableShops={[{ id: crossShopIds.milkTea, label: 'Milk tea' }, { id: crossShopIds.fruitTea, label: 'Fruit tea' }]}
      onShopSelect={vi.fn()}
      order={null}
      heldConsumable={null}
      gameTimeMs={0}
      preparationConfigured={false}
      onConfirm={() => ({ ok: false })}
    />)
    expect(markup.match(/data-shop-option=/g)).toHaveLength(2)
    expect(markup).toContain(`data-shop-id="${crossShopIds.fruitTea}"`)
    expect(markup).toContain(`data-shop-option="${crossShopIds.fruitTea}" aria-pressed="true"`)
    expect(markup).toContain('data-shop-product-id="passionfruit-green-tea"')
    const lockedMarkup = renderToStaticMarkup(<ShopOrderApp
      shopId={crossShopIds.milkTea} title="Milk tea" products={[]} order={null} heldConsumable={null}
      gameTimeMs={0} preparationConfigured={false} onConfirm={() => ({ ok: false })}
    />)
    expect(lockedMarkup).not.toContain('data-shop-option=')
  })
})
