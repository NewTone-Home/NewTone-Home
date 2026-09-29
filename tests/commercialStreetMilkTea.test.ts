import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, recordPlayerSceneStatePatch, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import {
  commercialStreetMilkTeaHeld,
  commercialStreetMilkTeaIsReady,
  commercialStreetMilkTeaOrderFromSceneState,
  commercialStreetMilkTeaOrderPatch,
  commercialStreetMilkTeaPickupPatch,
  createCommercialStreetMilkTeaOrder,
  formatCommercialStreetMilkTeaOrderNumber,
  milkTeaDrinks,
  milkTeaIceOptions,
  milkTeaPreparationDurationMs,
  milkTeaSugarOptions,
  nextCommercialStreetMilkTeaOrderNumber,
} from '../src/center/runtime/commercialStreetMilkTea'

describe('commercial street milk tea', () => {
  it('keeps the approved menu and preference choices', () => {
    expect(milkTeaDrinks).toEqual(['原味奶茶', '黑糖珍珠奶茶', '芋泥奶茶', '茉莉奶绿'])
    expect(milkTeaSugarOptions).toEqual(['少糖', '正常', '多糖'])
    expect(milkTeaIceOptions).toEqual(['少冰', '正常冰', '去冰'])
  })

  it('assigns a three-digit looping order number and a 15–30 second ready timestamp', () => {
    expect(nextCommercialStreetMilkTeaOrderNumber(undefined)).toBe(1)
    expect(nextCommercialStreetMilkTeaOrderNumber(998)).toBe(999)
    expect(nextCommercialStreetMilkTeaOrderNumber(999)).toBe(1)
    expect(formatCommercialStreetMilkTeaOrderNumber(1)).toBe('001')
    expect(formatCommercialStreetMilkTeaOrderNumber(999)).toBe('999')
    expect(milkTeaPreparationDurationMs(() => 0)).toBe(15_000)
    expect(milkTeaPreparationDurationMs(() => 1)).toBe(30_000)

    const order = createCommercialStreetMilkTeaOrder(
      { commercialStreetMilkTeaLastOrderNumber: 41 },
      { drink: '黑糖珍珠奶茶', sugar: '正常', ice: '少冰' },
      1000,
      () => 0,
    )
    expect(order).toEqual({ number: 42, drink: '黑糖珍珠奶茶', sugar: '正常', ice: '少冰', readyAt: 16_000 })
    expect(commercialStreetMilkTeaIsReady(order, 15_999)).toBe(false)
    expect(commercialStreetMilkTeaIsReady(order, 16_000)).toBe(true)
  })

  it('persists an in-progress order atomically and restores it after save sanitation', () => {
    const order = createCommercialStreetMilkTeaOrder(
      {},
      { drink: '芋泥奶茶', sugar: '多糖', ice: '去冰' },
      10_000,
      () => 0,
    )
    const patched = recordPlayerSceneStatePatch(
      createInitialPlayerSave('commercial-street'),
      'commercial-street',
      commercialStreetMilkTeaOrderPatch(order),
    )
    const restored = sanitizePlayerSave(JSON.parse(JSON.stringify(patched)), 'commercial-street')
    expect(commercialStreetMilkTeaOrderFromSceneState(restored.sceneState['commercial-street'])).toEqual(order)
    expect(commercialStreetMilkTeaHeld(restored.sceneState['commercial-street'])).toBe(false)
  })

  it('picks up a ready drink without leaving an active order and keeps the held state persistent', () => {
    const order = createCommercialStreetMilkTeaOrder(
      {},
      { drink: '茉莉奶绿', sugar: '少糖', ice: '正常冰' },
      1000,
      () => 0,
    )
    const save = recordPlayerSceneStatePatch(
      createInitialPlayerSave('commercial-street'),
      'commercial-street',
      { ...commercialStreetMilkTeaOrderPatch(order), ...commercialStreetMilkTeaPickupPatch() },
    )
    const state = save.sceneState['commercial-street']
    expect(commercialStreetMilkTeaOrderFromSceneState(state)).toBeNull()
    expect(commercialStreetMilkTeaHeld(state)).toBe(true)
  })
})
