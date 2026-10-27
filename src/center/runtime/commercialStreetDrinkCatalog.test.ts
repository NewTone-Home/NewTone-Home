import { describe, expect, it } from 'vitest'
import { commercialStreetDrinkCatalog, commercialStreetDrinkCatalogMissingCopy, commercialStreetDrinkShopDialogue, drinkCustomizationOptions } from './commercialStreetDrinkCatalog'
import { milkTeaDrinks } from './commercialStreetMilkTea'

describe('commercial street drink reference catalog', () => {
  it('contains the eight approved names and prices with unique IDs', () => {
    expect(commercialStreetDrinkCatalog.map(({ name, price }) => [name, price])).toEqual([
      ['原味奶茶', 5], ['黑糖珍珠奶茶', 7], ['芋泥奶茶', 7], ['茉莉奶绿', 5],
      ['百香果绿茶', 5], ['葡萄茉莉', 7], ['鲜橙汁', 5], ['草莓果饮', 7],
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
    expect(commercialStreetDrinkCatalog.slice(4).map(item => item.description)).toEqual([
      '百香果酸香，绿茶清爽', '葡萄果香，伴有茉莉花香', '鲜橙酸甜，果香自然', '草莓香甜，果味浓郁',
    ])
    expect(commercialStreetDrinkCatalogMissingCopy.descriptions).toEqual([])
    expect(commercialStreetDrinkShopDialogue).toEqual({ welcome: '欢迎光临，看看想喝什么？', preferenceQuestion: '喜欢清爽一点，还是浓郁一点？', recommendationOptions: ['就要这款', '看看其他饮品'] })
  })

  it('points recommendations to products that support their customization', () => {
    const recommendations = commercialStreetDrinkCatalog.filter(item => item.recommendation)
    expect(recommendations.map(item => [item.id, item.recommendation?.mood, item.recommendation?.line])).toEqual([
      ['taro-milk-tea', '浓郁', '芋泥奶茶的口感会比较浓郁。'],
      ['jasmine-milk-green-tea', '清爽', '可以试试茉莉奶绿，花香比较清爽。'],
      ['passionfruit-green-tea', '清爽', '可以试试百香果绿茶，酸香比较清爽。'],
      ['strawberry-fruit-drink', '浓郁', '草莓果饮的果味会更浓郁一些。'],
    ])
    expect(recommendations.find(item => item.id === 'strawberry-fruit-drink')?.customization.sugar).toBeNull()
    expect(recommendations.every(item => item.customization.ice.length > 0)).toBe(true)
    expect(commercialStreetDrinkCatalogMissingCopy.recommendations).toEqual(['grape-jasmine-tea', 'fresh-orange-juice'])
  })
})
