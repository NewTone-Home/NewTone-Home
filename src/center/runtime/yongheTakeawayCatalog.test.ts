import { describe, expect, it } from 'vitest'
import { yongheMenuForChoice, yongheMenuText, yongheRecommendedDishNames, yongheTakeawayCatalog, yongheTakeawayShopId } from './yongheTakeawayCatalog'

describe('Yonghe cross-shop order catalog contract', () => {
  it('uses the authored shop ID, stable SKU IDs, and prices', () => {
    expect(yongheTakeawayShopId).toBe('yonghe-eatery')
    expect(yongheTakeawayCatalog.map(({ id, price }) => [id, price])).toEqual([
      ['yonghe-fresh-pork-wontons', 12],
      ['yonghe-minced-pork-noodles', 11],
      ['yonghe-egg-fried-rice', 10],
      ['yonghe-pork-and-greens-rice', 14],
    ])
    expect(yongheTakeawayCatalog.every(product => product.storeId === yongheTakeawayShopId)).toBe(true)
  })

  it('filters the authored menu by the requested type without choosing for the player', () => {
    expect(yongheMenuForChoice('面').map(product => product.id)).toEqual(['yonghe-fresh-pork-wontons', 'yonghe-minced-pork-noodles'])
    expect(yongheMenuForChoice('饭').map(product => product.id)).toEqual(['yonghe-egg-fried-rice', 'yonghe-pork-and-greens-rice'])
    expect(yongheRecommendedDishNames('面')).toEqual(['鲜肉馄饨', '肉末拌面'])
    expect(yongheRecommendedDishNames('饭')).toEqual(['蛋炒饭', '青菜肉片盖饭'])
    expect(yongheMenuText()).toBe('鲜肉馄饨 12元\n肉末拌面 11元\n蛋炒饭 10元\n青菜肉片盖饭 14元')
    expect(yongheMenuForChoice('面').concat(yongheMenuForChoice('饭'))).toHaveLength(4)
  })
})
