import { describe, expect, it } from 'vitest'
import { crossShopIds } from './crossShopOrders'
import {
  commercialStreetCafeAppUnlockPatch, commercialStreetCafeAppUnlocked,
  commercialStreetFruitTeaAppUnlockPatch, commercialStreetFruitTeaAppUnlocked,
  unlockedCommercialDrinkShopIds,
} from './commercialStreetShopApps'
import { commercialStreetMilkTeaAppUnlockPatch } from './commercialStreetMilkTea'
import { sanitizePlayerSave, createInitialPlayerSave } from './playerSave'

describe('scanned drink app unlocks', () => {
  it('shows only the shop whose QR unlock was saved, then exposes both after both scans', () => {
    expect(unlockedCommercialDrinkShopIds({})).toEqual([])
    const milk = commercialStreetMilkTeaAppUnlockPatch()
    expect(unlockedCommercialDrinkShopIds(milk)).toEqual([crossShopIds.milkTea])
    const fruit = commercialStreetFruitTeaAppUnlockPatch()
    expect(commercialStreetFruitTeaAppUnlocked(fruit)).toBe(true)
    expect(unlockedCommercialDrinkShopIds(fruit)).toEqual([crossShopIds.fruitTea])
    expect(unlockedCommercialDrinkShopIds({ ...milk, ...fruit })).toEqual([crossShopIds.milkTea, crossShopIds.fruitTea])
  })

  it('persists each shop unlock through the existing save sanitizer independently', () => {
    const save = createInitialPlayerSave('commercial-street')
    const fruitState = { ...save.sceneState['commercial-street'], ...commercialStreetFruitTeaAppUnlockPatch() }
    const restored = sanitizePlayerSave({ ...save, sceneState: { ...save.sceneState, 'commercial-street': fruitState } }, save.currentSceneId)
    expect(unlockedCommercialDrinkShopIds(restored.sceneState['commercial-street'])).toEqual([crossShopIds.fruitTea])
    expect(restored.sceneState['commercial-street']?.commercialStreetFruitTeaAppUnlocked).toBe(true)
  })

  it('persists the cafe QR unlock while routing its shop through the shared drink app', () => {
    const save = createInitialPlayerSave('commercial-street')
    const cafeState = { ...save.sceneState['commercial-street'], ...commercialStreetCafeAppUnlockPatch() }
    const restored = sanitizePlayerSave({ ...save, sceneState: { ...save.sceneState, 'commercial-street': cafeState } }, save.currentSceneId)
    expect(commercialStreetCafeAppUnlocked(restored.sceneState['commercial-street'])).toBe(true)
    expect(unlockedCommercialDrinkShopIds(restored.sceneState['commercial-street'])).toEqual([crossShopIds.cafeTakeaway])
  })

  it('keeps the synthetic all-shops unlock gated to an explicit fixture argument', () => {
    expect(unlockedCommercialDrinkShopIds({}, true)).toEqual([crossShopIds.milkTea, crossShopIds.fruitTea])
    expect(unlockedCommercialDrinkShopIds({})).toEqual([])
  })
})
