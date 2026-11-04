import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { commercialCafeTakeawayCatalog } from './commercialCafeTakeawayCatalog'
import type { HeldConsumable } from './crossShopOrders'
import { crossShopIds } from './crossShopOrders'
import { yongheTakeawayCatalog } from './yongheTakeawayCatalog'

const knownProducts = [...commercialStreetDrinkCatalog, ...commercialCafeTakeawayCatalog, ...yongheTakeawayCatalog]

export type HeldConsumableVisualKind = 'coffee' | 'milk-tea' | 'fruit-drink' | 'food' | 'unknown'

export type HeldConsumablePresentation = {
  name: string
  action: 'drink' | 'eat'
  actionLabel: string
  isMilkTea: boolean
  visualKind: HeldConsumableVisualKind
}

export function isTrueMilkTea(item: HeldConsumable | null | undefined): boolean {
  if (!item || item.kind !== 'drink') return false
  return commercialStreetDrinkCatalog.some(product => product.storeId === item.shopId
    && product.storeId === 'commercial-south-slot-5'
    && product.id === item.productId)
}

export function heldConsumablePresentation(item: HeldConsumable | null | undefined): HeldConsumablePresentation | null {
  if (!item) return null
  const action = item.kind === 'meal' ? 'eat' : 'drink'
  const product = knownProducts.find(candidate => candidate.storeId === item.shopId && candidate.id === item.productId)
  const isMilkTea = isTrueMilkTea(item)
  const visualKind: HeldConsumableVisualKind = item.kind === 'legacy-unknown' ? 'unknown'
    : item.kind === 'meal' ? 'food'
      : isMilkTea ? 'milk-tea'
        : item.shopId === crossShopIds.cafeTakeaway ? 'coffee'
          : item.shopId === crossShopIds.fruitTea ? 'fruit-drink' : 'unknown'
  const name = item.kind === 'legacy-unknown' ? '饮品'
    : product?.name ?? (item.kind === 'meal' ? '餐食' : '饮品')
  return {
    name,
    action,
    actionLabel: action === 'eat' ? '吃掉' : '喝掉',
    isMilkTea,
    visualKind,
  }
}
