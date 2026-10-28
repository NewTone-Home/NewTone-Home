import { describe, expect, it } from 'vitest'
import { yongheMenuForChoice, yongheMenuText, yongheRecommendedDishNames, yongheTakeawayCatalog, yongheTakeawayShopId } from './yongheTakeawayCatalog'

describe('Yonghe cross-shop order catalog contract', () => {
  it('uses the authored shop ID, stable SKU IDs, and unchanged prices', () => {
    expect(yongheTakeawayShopId).toBe('yonghe-eatery')
    expect(yongheTakeawayCatalog.map(({ id, price }) => [id, price])).toEqual([
      ['yonghe-fresh-pork-wontons', 12],
      ['yonghe-minced-pork-noodles', 11],
      ['yonghe-egg-fried-rice', 10],
      ['yonghe-pork-and-greens-rice', 14],
    ])
    expect(yongheTakeawayCatalog.every(product => product.storeId === yongheTakeawayShopId)).toBe(true)
  })

  it('filters noodle and rice recommendations without choosing a specific dish, and shows the established prices', () => {
    expect(yongheMenuForChoice('\u9762').map(product => product.id)).toEqual(['yonghe-fresh-pork-wontons', 'yonghe-minced-pork-noodles'])
    expect(yongheMenuForChoice('\u996d').map(product => product.id)).toEqual(['yonghe-egg-fried-rice', 'yonghe-pork-and-greens-rice'])
    expect(yongheRecommendedDishNames('\u9762')).toEqual(['\u9c9c\u8089\u9984\u9968', '\u8089\u672b\u62cc\u9762'])
    expect(yongheRecommendedDishNames('\u996d')).toEqual(['\u86cb\u7092\u996d', '\u9752\u83dc\u8089\u7247\u76d6\u996d'])
    expect(yongheMenuText().split('\n').map(line => Number(line.match(/  (\d+)$/)?.[1]))).toEqual([12, 11, 10, 14])
  })
})
