import { describe, expect, it } from 'vitest'
import { commercialStreetDrinkCatalog, commercialStreetDrinkCatalogMissingCopy, commercialStreetDrinkShopDialogue, drinkCustomizationOptions } from './commercialStreetDrinkCatalog'
import { milkTeaDrinks } from './commercialStreetMilkTea'

describe('commercial street drink reference catalog', () => {
  it('contains the eight approved names and prices with unique IDs', () => {
    expect(commercialStreetDrinkCatalog.map(({ name, price }) => [name, price])).toEqual([
      ['原味奶茶', 3], ['黑糖珍珠奶茶', 4], ['芋泥奶茶', 4], ['茉莉奶绿', 3],
      ['百香果绿茶', 4], ['葡萄茉莉', 4], ['鲜橙汁', 4], ['草莓果饮', 5],
    ])
    expect(new Set(commercialStreetDrinkCatalog.map(item => item.id)).size).toBe(8)
  })

  it('keeps the purchase flow limited to existing milk tea products', () => {
    expect(milkTeaDrinks).toEqual(commercialStreetDrinkCatalog.slice(0, 4).map(item => item.name))
    expect(milkTeaDrinks).toHaveLength(4)
  })

  it('offers sugar and ice for teas, and ice only for juices', () => {
    for (const drink of commercialStreetDrinkCatalog.slice(0, 6)) {
      expect(drink.customization.sugar).toEqual(drinkCustomizationOptions.sugar)
      expect(drink.customization.ice).toEqual(drinkCustomizationOptions.ice)
    }
    for (const drink of commercialStreetDrinkCatalog.slice(6)) {
      expect(drink.customization.sugar).toBeNull()
      expect(drink.customization.ice).toEqual(drinkCustomizationOptions.ice)
    }
  })

  it('preserves approved milk tea copy and explicitly leaves unretrieved fruit copy blank', () => {
    expect(commercialStreetDrinkCatalog.slice(0, 4).map(item => item.description)).toEqual([
      '经典原味奶茶，茶香与奶香相互融合。',
      '浓郁黑糖风味，加入Q弹珍珠，甜香十足。',
      '加入细腻芋泥，奶香中带着淡淡芋香。',
      '清新的茉莉茶香与奶香融合，口感轻盈。',
    ])
    expect(commercialStreetDrinkCatalog.slice(4).every(item => item.description === null && item.recommendation === null)).toBe(true)
    expect(commercialStreetDrinkCatalogMissingCopy.descriptions).toEqual(commercialStreetDrinkCatalog.slice(4).map(item => item.id))
    expect(commercialStreetDrinkShopDialogue).toEqual({ welcome: '欢迎光临，看看想喝什么？', preferenceQuestion: '喜欢清爽一点，还是浓郁一点？' })
  })
})
