import { describe, expect, it } from 'vitest'
import { crossShopIds } from './crossShopOrders'
import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { shopPreparationDurationGameMs } from './shopPreparationPolicy'

describe('shop preparation policy', () => {
  it('converts the old 15–30 second milk-tea real-time range through the 30x game clock', () => {
    expect(shopPreparationDurationGameMs(crossShopIds.milkTea, commercialStreetDrinkCatalog[0]!.id, { random: () => 0 })).toBe(450_000)
    expect(shopPreparationDurationGameMs(crossShopIds.milkTea, commercialStreetDrinkCatalog[0]!.id, { random: () => 1 })).toBe(900_000)
  })

  it('does not invent formal fruit-tea, Yonghe, or cafe preparation durations', () => {
    expect(shopPreparationDurationGameMs(crossShopIds.fruitTea, 'fresh-orange-juice')).toBeNull()
    expect(shopPreparationDurationGameMs(crossShopIds.yonghe, 'egg-fried-rice')).toBeNull()
    expect(shopPreparationDurationGameMs(crossShopIds.cafeTakeaway, 'latte')).toBeNull()
  })

  it('accepts explicit per-SKU test durations without changing production defaults', () => {
    expect(shopPreparationDurationGameMs(crossShopIds.fruitTea, 'fresh-orange-juice', {
      overrides: { [`${crossShopIds.fruitTea}:fresh-orange-juice`]: 2_500 },
    })).toBe(2_500)
    expect(shopPreparationDurationGameMs(crossShopIds.yonghe, 'egg-fried-rice', { overrides: { [crossShopIds.yonghe]: 1_000 } })).toBe(1_000)
  })
})
