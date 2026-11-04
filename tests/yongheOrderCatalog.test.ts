import { describe, expect, it } from 'vitest'
import { yongheInteractionCopy, yongheMenu, yongheShopId } from '../src/center/runtime/yongheOrderCatalog'

describe('Yonghe order integration catalog', () => {
  it('publishes stable shop and SKU IDs with the authored four-item menu', () => {
    expect(yongheShopId).toBe('yonghe-eatery')
    expect(yongheMenu.map(({ sku, price }) => [sku, price])).toEqual([
      ['yonghe-fresh-pork-wontons', 12],
      ['yonghe-minced-pork-noodles', 11],
      ['yonghe-egg-fried-rice', 10],
      ['yonghe-pork-and-greens-rice', 14],
    ])
    expect(new Set(yongheMenu.map(item => item.sku)).size).toBe(4)
  })

  it('keeps only authored interaction copy and leaves unchosen recommendation details blank', () => {
    expect(yongheInteractionCopy.opening).toBe('想吃点什么？')
    expect(yongheInteractionCopy.options).toEqual(['点餐', '有什么推荐吗？', '聊聊'])
    expect(yongheInteractionCopy.recommendationQuestion).toBe('想吃面，还是吃饭？')
    expect(yongheInteractionCopy.recommendationOptions).toEqual(['面', '饭'])
    expect(yongheInteractionCopy.ordered).toBe('行，你找个地方坐会儿吧。')
  })
})
