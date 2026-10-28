import type { PlayerSceneState } from './playerSave'
import { commercialStreetMilkTeaAppUnlocked } from './commercialStreetMilkTea'
import { crossShopIds } from './crossShopOrders'

export const commercialStreetFruitTeaAppUnlockedKey = 'commercialStreetFruitTeaAppUnlocked'
export const commercialStreetCafeAppUnlockedKey = 'commercialStreetCafeAppUnlocked'

export function commercialStreetFruitTeaAppUnlocked(sceneState: PlayerSceneState | undefined): boolean {
  return sceneState?.[commercialStreetFruitTeaAppUnlockedKey] === true
}

export function commercialStreetFruitTeaAppUnlockPatch(): PlayerSceneState {
  return { [commercialStreetFruitTeaAppUnlockedKey]: true }
}

export function commercialStreetCafeAppUnlocked(sceneState: PlayerSceneState | undefined): boolean {
  return sceneState?.[commercialStreetCafeAppUnlockedKey] === true
}

export function commercialStreetCafeAppUnlockPatch(): PlayerSceneState {
  return { [commercialStreetCafeAppUnlockedKey]: true }
}

/** Existing scene progress stores each QR unlock independently and survives save/reload. */
export function unlockedCommercialDrinkShopIds(
  sceneState: PlayerSceneState | undefined,
  allowSyntheticUnlocks = false,
): string[] {
  if (allowSyntheticUnlocks) return [crossShopIds.milkTea, crossShopIds.fruitTea]
  return [
    ...(commercialStreetMilkTeaAppUnlocked(sceneState) ? [crossShopIds.milkTea] : []),
    ...(commercialStreetFruitTeaAppUnlocked(sceneState) ? [crossShopIds.fruitTea] : []),
    ...(commercialStreetCafeAppUnlocked(sceneState) ? [crossShopIds.cafeTakeaway] : []),
  ]
}
