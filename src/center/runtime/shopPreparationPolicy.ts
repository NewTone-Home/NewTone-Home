import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { commercialCafeTakeawayCatalog } from './commercialCafeTakeawayCatalog'
import { yongheTakeawayCatalog } from './yongheTakeawayCatalog'

/** Overrides must be explicitly supplied by an isolated test fixture. */
export type ShopPreparationOverrides = Readonly<Record<string, number>>

export const shopPreparationGameMinutes: Readonly<Record<string, number>> = {
  'original-milk-tea': 5,
  'brown-sugar-pearl-milk-tea': 7,
  'taro-milk-tea': 7,
  'jasmine-milk-green-tea': 5,
  'passionfruit-green-tea': 5,
  'grape-jasmine-tea': 7,
  'fresh-orange-juice': 5,
  'strawberry-fruit-drink': 7,
  americano: 5,
  latte: 5,
  'flat-white': 5,
  'caramel-macchiato': 7,
  'sea-salt-caramel-latte': 7,
  'yonghe-fresh-pork-wontons': 11,
  'yonghe-minced-pork-noodles': 11,
  'yonghe-egg-fried-rice': 13,
  'yonghe-pork-and-greens-rice': 13,
}

const productStoreById = new Map([
  ...commercialStreetDrinkCatalog.map(product => [product.id, product.storeId] as const),
  ...commercialCafeTakeawayCatalog.map(product => [product.id, product.storeId] as const),
  ...yongheTakeawayCatalog.map(product => [product.id, product.storeId] as const),
])

/** Returns game-clock milliseconds; no wall-clock timer or fallback duration is used. */
export function shopPreparationDurationGameMs(
  shopId: string,
  productId: string,
  options: { overrides?: ShopPreparationOverrides } = {},
): number | null {
  const override = options.overrides?.[`${shopId}:${productId}`] ?? options.overrides?.[shopId]
  if (override !== undefined) return Number.isFinite(override) && override >= 0 ? override : null
  if (productStoreById.get(productId) !== shopId) return null
  const minutes = shopPreparationGameMinutes[productId]
  return minutes === undefined ? null : minutes * 60_000
}
