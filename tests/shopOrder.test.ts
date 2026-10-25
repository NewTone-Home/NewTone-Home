import { describe, expect, it } from 'vitest'
import {
  createShopOrder,
  formatShopOrderNumber,
  nextShopOrderNumber,
  shopItemIsHeld,
  shopOrderFromState,
  shopOrderIsReady,
  shopOrderPatch,
  shopOrderQueueStatus,
  shopPickupAllowed,
  shopPickupPatch,
  shopPreparationDurationMs,
  consumeShopItemPatch,
  type ShopOrderConfig,
} from '../src/center/runtime/shopOrder'
import type { PlayerSceneState } from '../src/center/runtime/playerSave'

type TestSelection = { itemId: string; choiceId: string }

const config: ShopOrderConfig<TestSelection> = {
  keys: {
    orderNumber: 'testOrderNumber', lastOrderNumber: 'testLastOrderNumber',
    readyAt: 'testReadyAt', createdAt: 'testCreatedAt', queueAhead: 'testQueueAhead', heldItem: 'testHeldItem',
  },
  minimumPreparationMs: 100,
  maximumPreparationMs: 200,
  queueAheadForOrder: (orderNumber) => orderNumber % 4 + 1,
  heldValue: 'test-item',
  selectionKeys: ['testItemId', 'testChoiceId'],
  readSelection: (state) => typeof state.testItemId === 'string' && typeof state.testChoiceId === 'string'
    ? { itemId: state.testItemId, choiceId: state.testChoiceId }
    : null,
  selectionPatch: (selection) => ({ testItemId: selection.itemId, testChoiceId: selection.choiceId }),
}

describe('reusable shop order lifecycle', () => {
  it('keeps number rollover, duration bounds and formatted labels configurable', () => {
    expect(nextShopOrderNumber(undefined)).toBe(1)
    expect(nextShopOrderNumber(998)).toBe(999)
    expect(nextShopOrderNumber(999)).toBe(1)
    expect(formatShopOrderNumber(7)).toBe('007')
    expect(shopPreparationDurationMs(config, () => 0)).toBe(100)
    expect(shopPreparationDurationMs(config, () => 1)).toBe(200)
  })

  it('creates an order, writes only its configured state and restores it', () => {
    const order = createShopOrder({ testLastOrderNumber: 41 }, { itemId: 'sample', choiceId: 'plain' }, config, 1_000, () => 0)
    expect(order).toEqual({ number: 42, itemId: 'sample', choiceId: 'plain', readyAt: 1_100, createdAt: 1_000, queueAhead: 3 })
    const patch = shopOrderPatch(order, config)
    expect(Object.keys(patch).sort()).toEqual([
      'testChoiceId', 'testCreatedAt', 'testItemId', 'testLastOrderNumber', 'testOrderNumber', 'testQueueAhead', 'testReadyAt',
    ])
    expect(shopOrderFromState(patch, config)).toEqual(order)
  })

  it('prevents early or repeated pickup, then clears the held item on use', () => {
    const order = createShopOrder(undefined, { itemId: 'sample', choiceId: 'plain' }, config, 1_000, () => 0)
    const orderState = { ...shopOrderPatch(order, config) } as PlayerSceneState
    expect(shopPickupAllowed(orderState, order, config, order.readyAt - 1)).toBe(false)
    expect(shopPickupAllowed(orderState, order, config, order.readyAt)).toBe(true)

    const heldState = { ...orderState, ...shopPickupPatch(config) }
    expect(shopOrderFromState(heldState, config)).toBeNull()
    expect(shopItemIsHeld(heldState, config)).toBe(true)
    expect(shopPickupAllowed(heldState, order, config, order.readyAt)).toBe(false)
    expect(shopItemIsHeld({ ...heldState, ...consumeShopItemPatch(config) }, config)).toBe(false)
  })

  it('reports a durable pending/ready queue state from timestamps', () => {
    const order = createShopOrder(undefined, { itemId: 'sample', choiceId: 'plain' }, config, 1_000, () => 1)
    expect(shopOrderIsReady(order, order.readyAt - 1)).toBe(false)
    expect(shopOrderQueueStatus(order, order.createdAt)).toEqual({ phase: 'pending', ahead: order.queueAhead, progress: 0 })
    expect(shopOrderQueueStatus(order, order.readyAt)).toEqual({ phase: 'ready', ahead: 0, progress: 1 })
  })
})
