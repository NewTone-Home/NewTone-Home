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

/** The first commercial-street QR installs one app that can view all three shops. */
export function unlockedCommercialDrinkShopIds(
  sceneState: PlayerSceneState | undefined,
  allowSyntheticUnlocks = false,
): string[] {
  const anyQrUnlocked = allowSyntheticUnlocks
    || commercialStreetMilkTeaAppUnlocked(sceneState)
    || commercialStreetFruitTeaAppUnlocked(sceneState)
    || commercialStreetCafeAppUnlocked(sceneState)
  return anyQrUnlocked
    ? [crossShopIds.cafeTakeaway, crossShopIds.milkTea, crossShopIds.fruitTea]
    : []
}
