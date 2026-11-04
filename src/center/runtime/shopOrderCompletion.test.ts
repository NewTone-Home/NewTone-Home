import { describe, expect, it, vi } from 'vitest'
import { crossShopIds, type CrossShopOrder } from './crossShopOrders'
import { notifyDueShopOrders } from './shopOrderCompletion'
import { createInitialPlayerSave, createPositionSaveCoordinator, recordPlayerScenePosition, savePlayerSave, PLAYER_SAVE_STORAGE_KEY, type PlayerSave, type PlayerPoint } from './playerSave'
import { memoryStorage } from '../../save-session.mjs'
import type { PhoneNotification } from './phoneNotifications'

const order = (id: string, shopId: string, readyAtGameTimeMs: number): CrossShopOrder => ({
  id, shopId, productId: id, status: 'queued', placedAtGameTimeMs: 0, readyAtGameTimeMs,
})

describe('game-clock shop order completion notices', () => {
  it('notifies milk and fruit orders from their saved ready times and durably marks each once', () => {
    const orders = {
      [crossShopIds.milkTea]: order('milk-1', crossShopIds.milkTea, 300_000),
      [crossShopIds.fruitTea]: order('fruit-1', crossShopIds.fruitTea, 360_000),
      [crossShopIds.yonghe]: order('meal-1', crossShopIds.yonghe, 720_000),
      [crossShopIds.cafeTakeaway]: order('coffee-1', crossShopIds.cafeTakeaway, 300_000),
    }
    const before = notifyDueShopOrders(orders, [], 299_999)
    expect(before.changed).toBe(false)
    const ready = notifyDueShopOrders(orders, [], 300_000)
    expect(ready.orders[crossShopIds.milkTea]?.completionNotified).toBe(true)
    expect(ready.orders[crossShopIds.fruitTea]?.completionNotified).toBeUndefined()
    expect(ready.notifications[0]).toMatchObject({ id: 'shop-order-ready:milk-1', shopId: crossShopIds.milkTea })
    expect(ready.notifications.map(item => item.shopId)).toEqual([crossShopIds.milkTea, crossShopIds.cafeTakeaway])
    const next = notifyDueShopOrders(ready.orders, ready.notifications, 360_000)
    expect(next.orders[crossShopIds.fruitTea]?.completionNotified).toBe(true)
    expect(next.notifications.map(item => item.shopId)).toEqual([crossShopIds.milkTea, crossShopIds.cafeTakeaway, crossShopIds.fruitTea])
    const mealReady = notifyDueShopOrders(next.orders, next.notifications, 720_000)
    expect(mealReady.orders[crossShopIds.yonghe]?.completionNotified).toBe(true)
    expect(mealReady.notifications.map(item => item.shopId)).toEqual([crossShopIds.milkTea, crossShopIds.cafeTakeaway, crossShopIds.fruitTea])
    expect(mealReady.notifications.some(item => item.app === 'yonghe-order' || item.id === 'shop-order-ready:meal-1')).toBe(false)
    expect(notifyDueShopOrders(mealReady.orders, mealReady.notifications, 10_000_000).changed).toBe(false)
  })

  it('uses no wall-time catch-up and ignores malformed game-time samples', () => {
    const orders = { [crossShopIds.milkTea]: order('later', crossShopIds.milkTea, 1_000) }
    expect(notifyDueShopOrders(orders, [], Number.NaN).changed).toBe(false)
    expect(notifyDueShopOrders(orders, [], 999).changed).toBe(false)
    expect(notifyDueShopOrders(orders, [], 1_000).changed).toBe(true)
  })
})

const oldYongheNotice: PhoneNotification = { id: 'legacy-yonghe-ready', app: 'yonghe-order', shopId: crossShopIds.yonghe, title: 'ready', body: 'old phone notice', unread: true, presented: true }
const unrelatedNotice: PhoneNotification = { id: 'ride-notice', app: 'ride', title: 'ride', body: 'ride status', unread: true, presented: false }
function completionSave(): PlayerSave {
  return {
    ...createInitialPlayerSave('commercial-street'), walletBalance: 650,
    shopOrders: {
      [crossShopIds.milkTea]: order('milk-ready', crossShopIds.milkTea, 300),
      [crossShopIds.fruitTea]: order('fruit-later', crossShopIds.fruitTea, 1_000),
    },
    phoneNotifications: [{ ...oldYongheNotice }, { ...unrelatedNotice }],
  }
}
// This completion-only coordinator records positions only for its active scene.
// Validate the broad coordinator argument before passing the typed saved scene.
function recordCompletionPosition(save: PlayerSave, sceneId: string, position: PlayerPoint): PlayerSave {
  if (sceneId !== save.currentSceneId) throw new Error('completion-position-scene-mismatch')
  return recordPlayerScenePosition(save, save.currentSceneId, position)
}
function dueUpdate(current: PlayerSave): PlayerSave {
  const completion = notifyDueShopOrders(current.shopOrders, current.phoneNotifications, 300)
  return completion.changed ? { ...current, shopOrders: completion.orders, phoneNotifications: completion.notifications } : current
}

describe('completion copy-on-write through the real save coordinator', () => {
  it.each(['legacy-yonghe', 'orphan-ready'] as const)('keeps frozen orders untouched when %s cleanup and several due orders happen together', kind => {
    const milk = Object.freeze(order('milk-ready', crossShopIds.milkTea, 300))
    const coffee = Object.freeze(order('coffee-ready', crossShopIds.cafeTakeaway, 300))
    const fruit = Object.freeze(order('fruit-later', crossShopIds.fruitTea, 1_000))
    const orders = Object.freeze({ [crossShopIds.milkTea]: milk, [crossShopIds.cafeTakeaway]: coffee, [crossShopIds.fruitTea]: fruit })
    const obsolete: PhoneNotification = kind === 'legacy-yonghe' ? { ...oldYongheNotice } : { id: 'shop-order-ready:removed-order', app: 'milk-tea', title: 'obsolete', body: 'claimed', unread: true, presented: true }
    const notifications = Object.freeze([Object.freeze(obsolete), Object.freeze({ ...unrelatedNotice })])
    const result = notifyDueShopOrders(orders, notifications, 300)
    expect(result.changed).toBe(true)
    expect(result.orders).not.toBe(orders)
    expect(result.orders[crossShopIds.milkTea]).not.toBe(milk)
    expect(result.orders[crossShopIds.cafeTakeaway]).not.toBe(coffee)
    expect(result.orders[crossShopIds.milkTea].completionNotified).toBe(true)
    expect(result.orders[crossShopIds.cafeTakeaway].completionNotified).toBe(true)
    expect(result.orders[crossShopIds.fruitTea]).toBe(fruit)
    expect(milk.completionNotified).toBeUndefined()
    expect(coffee.completionNotified).toBeUndefined()
    expect(result.notifications.map(item => item.id)).toEqual(['ride-notice', 'shop-order-ready:milk-ready', 'shop-order-ready:coffee-ready'])
    expect(notifications).toEqual([obsolete, unrelatedNotice])
    const repeated = notifyDueShopOrders(result.orders, result.notifications, 300)
    expect(repeated.changed).toBe(false)
    expect(repeated.orders).toBe(result.orders)
    expect(repeated.notifications).toEqual(result.notifications)
  })

  it('notification-only cleanup does not copy or mark a not-yet-due order', () => {
    const later = Object.freeze(order('later', crossShopIds.milkTea, 1_000))
    const orders = Object.freeze({ [crossShopIds.milkTea]: later })
    const result = notifyDueShopOrders(orders, [oldYongheNotice, unrelatedNotice], 300)
    expect(result.changed).toBe(true)
    expect(result.orders).toBe(orders)
    expect(later.completionNotified).toBeUndefined()
    expect(result.notifications).toEqual([unrelatedNotice])
  })

  it('a failed real persistence call leaves old memory, completion facts and original stored bytes unchanged', () => {
    const initial = completionSave(), original = structuredClone(initial)
    let current = initial
    const storage = memoryStorage({ [PLAYER_SAVE_STORAGE_KEY]: JSON.stringify(initial) })
    const rawBefore = storage.getItem(PLAYER_SAVE_STORAGE_KEY)
    const failure = vi.fn(() => { throw Error('synthetic storage failure') })
    const unavailable = { ...storage, setItem: failure }
    const publish = vi.fn((next: PlayerSave) => { current = next })
    const coordinator = createPositionSaveCoordinator({
      getSave: () => current, setSave: publish, getCurrentSceneId: () => current.currentSceneId,
      recordPosition: recordCompletionPosition, persist: next => savePlayerSave(next, unavailable),
    })
    expect(() => coordinator.commit(dueUpdate)).toThrow('player-save-write-failed')
    expect(failure).toHaveBeenCalledTimes(1)
    expect(publish).not.toHaveBeenCalled()
    expect(current).toBe(initial)
    expect(current).toEqual(original)
    expect(current.shopOrders).toBe(initial.shopOrders)
    expect(current.shopOrders[crossShopIds.milkTea].completionNotified).toBeUndefined()
    expect(current.phoneNotifications).toEqual([oldYongheNotice, unrelatedNotice])
    expect(current.walletBalance).toBe(650)
    expect(current.shopOrderPaymentReceipts).toEqual(original.shopOrderPaymentReceipts)
    expect(storage.getItem(PLAYER_SAVE_STORAGE_KEY)).toBe(rawBefore)
  })

  it('publishes only after successful persistence, leaves the previous snapshot intact and does not repeat completion', () => {
    const initial = completionSave(), original = structuredClone(initial)
    let current = initial
    const storage = memoryStorage({ [PLAYER_SAVE_STORAGE_KEY]: JSON.stringify(initial) })
    const publish = vi.fn((next: PlayerSave) => { current = next })
    const persist = vi.fn((next: PlayerSave) => {
      expect(current).toBe(initial)
      expect(current).toEqual(original)
      expect(publish).not.toHaveBeenCalled()
      return savePlayerSave(next, storage)
    })
    const coordinator = createPositionSaveCoordinator({
      getSave: () => current, setSave: publish, getCurrentSceneId: () => current.currentSceneId,
      recordPosition: recordCompletionPosition, persist,
    })
    coordinator.commit(dueUpdate)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledTimes(1)
    expect(current).not.toBe(initial)
    expect(initial).toEqual(original)
    expect(current.shopOrders[crossShopIds.milkTea].completionNotified).toBe(true)
    expect(current.shopOrders[crossShopIds.fruitTea]).toEqual(initial.shopOrders[crossShopIds.fruitTea])
    expect(current.phoneNotifications.map(item => item.id)).toEqual(['ride-notice', 'shop-order-ready:milk-ready'])
    expect(current.walletBalance).toBe(650)
    expect(current.shopOrderPaymentReceipts).toEqual(original.shopOrderPaymentReceipts)
    expect(JSON.parse(storage.getItem(PLAYER_SAVE_STORAGE_KEY)!)).toEqual(current)
    const firstCommit = current
    coordinator.commit(dueUpdate)
    expect(current).toBe(firstCommit)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledTimes(1)
  })
})
