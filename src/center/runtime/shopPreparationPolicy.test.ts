import { describe, expect, it } from 'vitest'
import { crossShopIds } from './crossShopOrders'
import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { shopPreparationDurationGameMs } from './shopPreparationPolicy'

describe('shop preparation policy', () => {
  it('maps all 17 authored SKUs to exact game-clock minutes', () => {
    const expected: Record<string, number> = {
      'original-milk-tea': 5, 'brown-sugar-pearl-milk-tea': 7, 'taro-milk-tea': 7, 'jasmine-milk-green-tea': 5,
      'passionfruit-green-tea': 5, 'grape-jasmine-tea': 7, 'fresh-orange-juice': 5, 'strawberry-fruit-drink': 7,
      americano: 5, latte: 5, 'flat-white': 5, 'caramel-macchiato': 7, 'sea-salt-caramel-latte': 7,
      'yonghe-fresh-pork-wontons': 11, 'yonghe-minced-pork-noodles': 11,
      'yonghe-egg-fried-rice': 13, 'yonghe-pork-and-greens-rice': 13,
    }
    expect(Object.keys(expected)).toHaveLength(17)
    for (const product of commercialStreetDrinkCatalog) {
      expect(shopPreparationDurationGameMs(product.storeId, product.id)).toBe(expected[product.id]! * 60_000)
    }
    expect(shopPreparationDurationGameMs(crossShopIds.cafeTakeaway, 'americano')).toBe(5 * 60_000)
    expect(shopPreparationDurationGameMs(crossShopIds.yonghe, 'yonghe-egg-fried-rice')).toBe(13 * 60_000)
  })

  it('rejects unknown or cross-store SKUs and only accepts explicit isolated fixture overrides', () => {
    expect(shopPreparationDurationGameMs(crossShopIds.fruitTea, 'latte')).toBeNull()
    expect(shopPreparationDurationGameMs(crossShopIds.yonghe, 'unknown')).toBeNull()
  })

  it('accepts explicit per-SKU test durations without changing production defaults', () => {
    expect(shopPreparationDurationGameMs(crossShopIds.fruitTea, 'fresh-orange-juice', {
      overrides: { [`${crossShopIds.fruitTea}:fresh-orange-juice`]: 2_500 },
    })).toBe(2_500)
    expect(shopPreparationDurationGameMs(crossShopIds.yonghe, 'yonghe-egg-fried-rice', { overrides: { [crossShopIds.yonghe]: 1_000 } })).toBe(1_000)
  })
})
