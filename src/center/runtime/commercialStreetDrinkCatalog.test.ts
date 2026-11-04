import { describe, expect, it } from 'vitest'
import { commercialStreetDrinkCatalog, commercialStreetDrinkCatalogMissingCopy, commercialStreetDrinkMenuText, commercialStreetDrinkShopDialogue, commercialStreetDrinkShopForInteraction, drinkCustomizationOptions, recommendedCommercialStreetDrink } from './commercialStreetDrinkCatalog'
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
    expect(commercialStreetDrinkCatalog.slice(4).map(item => item.description)).toEqual([
      '百香果酸香，绿茶清爽', '葡萄果香，伴有茉莉花香', '鲜橙酸甜，果香自然', '草莓香甜，果味浓郁',
    ])
    expect(commercialStreetDrinkCatalogMissingCopy.descriptions).toEqual([])
    expect(commercialStreetDrinkShopDialogue).toEqual({ welcome: '欢迎光临，看看想喝什么？', recommendationRequest: '有什么推荐？', preferenceQuestion: '想喝清爽些的，还是口味浓一点的？', preferenceOptions: ['清爽些的', '口味浓一点的'], recommendationOptions: ['就要这款', '再看看其他饮品'] })
  })

  it('points recommendations to products that support their customization', () => {
    const recommendations = commercialStreetDrinkCatalog.filter(item => item.recommendation)
    expect(recommendations.map(item => [item.id, item.recommendation?.mood, item.recommendation?.line])).toEqual([
      ['taro-milk-tea', '浓郁', '想喝浓郁一点的，可以试试芋泥奶茶。'],
      ['jasmine-milk-green-tea', '清爽', '可以试试茉莉奶绿，茉莉花香比较清新。'],
      ['passionfruit-green-tea', '清爽', '百香果绿茶不错，果香明显，喝起来也清爽。'],
      ['strawberry-fruit-drink', '浓郁', '想要果味浓一点，可以试试草莓果饮。'],
    ])
    expect(recommendations.find(item => item.id === 'strawberry-fruit-drink')?.customization.sugar).toBeNull()
    expect(recommendations.every(item => item.customization.ice.length > 0)).toBe(true)
    expect(commercialStreetDrinkCatalogMissingCopy.recommendations).toEqual(['original-milk-tea', 'brown-sugar-pearl-milk-tea', 'grape-jasmine-tea', 'fresh-orange-juice'])
  })

  it('routes only the milk tea and fruit tea shop staff and counters to their own shared ordering flow', () => {
    expect(commercialStreetDrinkShopForInteraction('milk-tea-trial-worker')).toBe('commercial-south-slot-5')
    expect(commercialStreetDrinkShopForInteraction('milk-tea-trial-long-counter-0')).toBe('commercial-south-slot-5')
    expect(commercialStreetDrinkShopForInteraction('commercial-s5-milk-tea-order-service-label')).toBe('commercial-south-slot-5')
    expect(commercialStreetDrinkShopForInteraction('fruit-tea-trial-worker')).toBe('commercial-north-slot-1')
    expect(commercialStreetDrinkShopForInteraction('fruit-tea-trial-long-counter-0')).toBe('commercial-north-slot-1')
    expect(commercialStreetDrinkShopForInteraction('fruit-tea-trial-order')).toBe('commercial-north-slot-1')
    expect(commercialStreetDrinkShopForInteraction('commercial-cafe-counter')).toBeNull()
    expect(commercialStreetDrinkShopForInteraction('yonghe-trial-worker')).toBeNull()
  })

  it('renders each wall menu from the approved store-bound catalog and preserves staff recommendations', () => {
    const milkTeaMenu = commercialStreetDrinkMenuText('commercial-south-slot-5')
    const fruitTeaMenu = commercialStreetDrinkMenuText('commercial-north-slot-1')
    expect(milkTeaMenu).toContain('原味奶茶  3\n经典原味奶茶，茶香与奶香相互融合。')
    expect(milkTeaMenu).toContain('茉莉奶绿  3\n清新的茉莉茶香与奶香融合，口感轻盈。')
    expect(fruitTeaMenu).toContain('百香果绿茶  4\n百香果酸香，绿茶清爽')
    expect(fruitTeaMenu).toContain('草莓果饮  5\n草莓香甜，果味浓郁')
    expect(fruitTeaMenu).not.toContain('原味奶茶')
    expect(recommendedCommercialStreetDrink('commercial-south-slot-5', '清爽些的')?.id).toBe('jasmine-milk-green-tea')
    expect(recommendedCommercialStreetDrink('commercial-south-slot-5', '浓郁一点')?.id).toBe('taro-milk-tea')
    expect(recommendedCommercialStreetDrink('commercial-north-slot-1', '清爽些的')?.id).toBe('passionfruit-green-tea')
    expect(recommendedCommercialStreetDrink('commercial-north-slot-1', '浓郁一点')?.id).toBe('strawberry-fruit-drink')
  })
})
