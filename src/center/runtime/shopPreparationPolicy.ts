import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { commercialStreetMilkTeaStorefrontId, milkTeaPreparationDurationMs } from './commercialStreetMilkTea'

/** Overrides must be explicitly supplied by a test fixture or an authored, approved policy. */
export type ShopPreparationOverrides = Readonly<Record<string, number>>

/**
 * Returns game-clock milliseconds, or null when the shop/SKU has no approved
 * duration. The old milk-tea code measured real milliseconds; at the existing
 * 30x game-clock baseline, its 15–30 second legacy range maps to 7.5–15 game
 * minutes. This conversion is compatibility-only, not a new product duration.
 */
export function shopPreparationDurationGameMs(
  shopId: string,
  productId: string,
  options: { random?: () => number; overrides?: ShopPreparationOverrides } = {},
): number | null {
  const override = options.overrides?.[`${shopId}:${productId}`] ?? options.overrides?.[shopId]
  if (override !== undefined) return Number.isFinite(override) && override >= 0 ? override : null
  const isLegacyMilkTea = shopId === commercialStreetMilkTeaStorefrontId
    && commercialStreetDrinkCatalog.slice(0, 4).some(product => product.id === productId)
  return isLegacyMilkTea ? milkTeaPreparationDurationMs(options.random) * 30 : null
}
