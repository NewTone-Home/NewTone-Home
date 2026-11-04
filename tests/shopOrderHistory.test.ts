import { describe, expect, it } from 'vitest'
import { appendShopOrderHistory, sanitizeShopOrderHistory, shopOrderHistoryLimit, type CrossShopOrder } from '../src/center/runtime/crossShopOrders'

const order = (id: string): CrossShopOrder => ({ id, shopId: 'commercial-south-slot-5', productId: 'taro-milk-tea', status: 'queued', placedAtGameTimeMs: 1000, readyAtGameTimeMs: 2000, pricePaid: 4, options: { sugar: '少糖', ice: '少冰' } })

describe('shop order history', () => {
  it('records newest first, keeps only the latest five, and ignores duplicates', () => {
    let history = appendShopOrderHistory(undefined, order('a'), 10)
    for (const id of ['b', 'c', 'd', 'e', 'f']) history = appendShopOrderHistory(history, order(id), 20)
    expect(history.map(entry => entry.id)).toEqual(['f', 'e', 'd', 'c', 'b'])
    expect(history).toHaveLength(shopOrderHistoryLimit)
    expect(appendShopOrderHistory(history, order('f'), 30)).toEqual(history)
    expect(appendShopOrderHistory(history, undefined, 30)).toEqual(history)
  })
  it('keeps price and options, and drops malformed saved entries', () => {
    const [entry] = appendShopOrderHistory([], order('a'), 10)
    expect(entry).toMatchObject({ pricePaid: 4, options: { sugar: '少糖', ice: '少冰' }, pickedUpAtGameTimeMs: 10 })
    expect(sanitizeShopOrderHistory([entry, { id: '' }, null, 'x'])).toEqual([entry])
    expect(sanitizeShopOrderHistory(undefined)).toEqual([])
  })
})
