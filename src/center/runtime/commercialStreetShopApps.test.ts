import { describe, expect, it } from 'vitest'
import { crossShopIds } from './crossShopOrders'
import {
  commercialStreetCafeAppUnlockPatch, commercialStreetCafeAppUnlocked,
  commercialStreetFruitTeaAppUnlockPatch, commercialStreetFruitTeaAppUnlocked,
  unlockedCommercialDrinkShopIds,
} from './commercialStreetShopApps'
import { commercialStreetMilkTeaAppUnlockPatch, commercialStreetMilkTeaAppUnlocked } from './commercialStreetMilkTea'
import { sanitizePlayerSave, createInitialPlayerSave } from './playerSave'

const sharedAppShops = [crossShopIds.cafeTakeaway, crossShopIds.milkTea, crossShopIds.fruitTea]

describe('scanned drink app unlocks', () => {
  it('installs one three-shop app after any QR while keeping individual scan facts distinct', () => {
    expect(unlockedCommercialDrinkShopIds({})).toEqual([])
    const milk = commercialStreetMilkTeaAppUnlockPatch()
    expect(unlockedCommercialDrinkShopIds(milk)).toEqual(sharedAppShops)
    expect(commercialStreetMilkTeaAppUnlocked(milk)).toBe(true)
    expect(commercialStreetFruitTeaAppUnlocked(milk)).toBe(false)
    expect(commercialStreetCafeAppUnlocked(milk)).toBe(false)
    const fruit = commercialStreetFruitTeaAppUnlockPatch()
    expect(commercialStreetFruitTeaAppUnlocked(fruit)).toBe(true)
    expect(unlockedCommercialDrinkShopIds(fruit)).toEqual(sharedAppShops)
    expect(unlockedCommercialDrinkShopIds({ ...milk, ...fruit })).toEqual(sharedAppShops)
  })

  it('persists each shop unlock through the existing save sanitizer independently', () => {
    const save = createInitialPlayerSave('commercial-street')
    const fruitState = { ...save.sceneState['commercial-street'], ...commercialStreetFruitTeaAppUnlockPatch() }
    const restored = sanitizePlayerSave({ ...save, sceneState: { ...save.sceneState, 'commercial-street': fruitState } }, save.currentSceneId)
    expect(unlockedCommercialDrinkShopIds(restored.sceneState['commercial-street'])).toEqual(sharedAppShops)
    expect(restored.sceneState['commercial-street']?.commercialStreetFruitTeaAppUnlocked).toBe(true)
    expect(commercialStreetMilkTeaAppUnlocked(restored.sceneState['commercial-street'])).toBe(false)
    expect(commercialStreetCafeAppUnlocked(restored.sceneState['commercial-street'])).toBe(false)
  })

  it('persists the cafe QR unlock while routing its shop through the shared drink app', () => {
    const save = createInitialPlayerSave('commercial-street')
    const cafeState = { ...save.sceneState['commercial-street'], ...commercialStreetCafeAppUnlockPatch() }
    const restored = sanitizePlayerSave({ ...save, sceneState: { ...save.sceneState, 'commercial-street': cafeState } }, save.currentSceneId)
    expect(commercialStreetCafeAppUnlocked(restored.sceneState['commercial-street'])).toBe(true)
    expect(unlockedCommercialDrinkShopIds(restored.sceneState['commercial-street'])).toEqual(sharedAppShops)
  })

  it('keeps the synthetic all-shops unlock gated to an explicit fixture argument', () => {
    expect(unlockedCommercialDrinkShopIds({}, true)).toEqual(sharedAppShops)
    expect(unlockedCommercialDrinkShopIds({})).toEqual([])
  })
})

it('installing the shared three-shop app preserves each shop order and balance independently', () => {
  const save = createInitialPlayerSave('commercial-street')
  const order = (shopId: string, productId: string, id: string) => ({ id, shopId, productId, status: 'queued' as const, placedAtGameTimeMs: 100, readyAtGameTimeMs: 300 })
  const shopOrders = {
    [crossShopIds.cafeTakeaway]: order(crossShopIds.cafeTakeaway, 'americano', 'cafe-own'),
    [crossShopIds.milkTea]: order(crossShopIds.milkTea, 'original-milk-tea', 'milk-own'),
    [crossShopIds.fruitTea]: order(crossShopIds.fruitTea, 'passionfruit-green-tea', 'fruit-own'),
  }
  const scanned = { ...save, walletBalance: 650, shopOrders, sceneState: { ...save.sceneState, 'commercial-street': commercialStreetCafeAppUnlockPatch() } }
  const restored = sanitizePlayerSave(scanned, scanned.currentSceneId)
  expect(unlockedCommercialDrinkShopIds(restored.sceneState['commercial-street'])).toEqual(sharedAppShops)
  expect(restored.shopOrders).toEqual(shopOrders)
  expect(restored.walletBalance).toBe(650)
  expect(restored.heldConsumable).toBeNull()
  expect(restored.shopOrderPaymentReceipts).toEqual(save.shopOrderPaymentReceipts)
  expect(commercialStreetCafeAppUnlocked(restored.sceneState['commercial-street'])).toBe(true)
  expect(commercialStreetMilkTeaAppUnlocked(restored.sceneState['commercial-street'])).toBe(false)
  expect(commercialStreetFruitTeaAppUnlocked(restored.sceneState['commercial-street'])).toBe(false)
})
