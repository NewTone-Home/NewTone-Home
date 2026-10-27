import { describe, expect, it } from 'vitest'
import { yongheTakeawayCatalog, yongheTakeawayShopId } from './yongheTakeawayCatalog'

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
})
