import type { NpcIntent, NpcRuntimeSnapshot } from './npcCore'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { commercialCafeCoffeeOwnerNpcId } from './commercialCafeStory'
import type { CommercialCafeCoffeeStatus, CommercialCafeNarrativePhase } from './commercialCafeStory'
import { npcRoles } from './npcRoles'
import {
  resolveCommercialCafeCoffeeDeliveryIntent,
  resolveCommercialCafeCoffeePrepIntent,
  resolveCommercialCafeFloorServiceIntent,
  resolveCommercialCafeReturnToCounterIntent,
} from './commercialCafeStory'

export type CommercialCafeCoffeeOwnerPhase = 'counter' | 'moving-to-prep' | 'preparing' | 'delivering' | 'delivery-arrived' | 'returning' | 'blocked'
export type CommercialCafeFloorServerPhase = 'staging' | 'serving' | 'blocked'

/** Café NPC speed is a local duty override layered on the shared locomotion engine. */
export function commercialCafeDutySpeedMultiplier(npcId: string, dutyId: string | null, readingActive: boolean) {
  if (npcId === commercialCafeCoffeeOwnerNpcId
    && (dutyId === npcRoles.cafeCoffeeOwner.duties.deliverCoffee.id
      || dutyId === npcRoles.cafeCoffeeOwner.duties.returnToCounter.id)) return 1
  return readingActive ? .45 : 1
}

/** Coffee duties belong only to the counter/prep actor; movement remains shared. */
export function createCommercialCafeCoffeeOwnerBehaviorCoordinator() {
  let phase: CommercialCafeCoffeeOwnerPhase = 'counter'
  let retryPhase: CommercialCafeCoffeeOwnerPhase = 'counter'
  const getPhase = () => phase
  const reset = () => { phase = 'counter'; retryPhase = 'counter' }
  const block = () => {
    if (phase === 'moving-to-prep') retryPhase = 'counter'
    else if (phase === 'delivering') retryPhase = 'preparing'
    else if (phase === 'returning') retryPhase = 'delivery-arrived'
    phase = 'blocked'
  }
  const retry = () => { if (phase === 'blocked') phase = retryPhase }
  const arrivedAtPrep = () => { phase = 'preparing' }
  const arrivedAtStoryTable = () => { phase = 'delivery-arrived' }
  const arrivedAtCounter = () => { phase = 'counter' }

  const request = ({
    scene, coffeeStatus, narrativePhase, snapshot,
  }: {
    scene: MainlineSceneDefinition
    coffeeStatus: CommercialCafeCoffeeStatus
    narrativePhase: CommercialCafeNarrativePhase
    snapshot: NpcRuntimeSnapshot
  }): NpcIntent | null => {
    if (scene.id !== 'commercial-cafe' || snapshot.phase === 'moving') return null
    if (phase === 'blocked') return null

    if (coffeeStatus === 'ordered' && phase !== 'moving-to-prep') {
      const intent = resolveCommercialCafeCoffeePrepIntent(scene)
      if (intent) phase = 'moving-to-prep'
      return intent
    }
    if (coffeeStatus === 'preparing') {
      phase = 'preparing'
      return null
    }
    if (coffeeStatus === 'ready' && narrativePhase === 'coffee-delivery' && phase !== 'delivery-arrived') {
      const intent = resolveCommercialCafeCoffeeDeliveryIntent({ scene, coffeeStatus, narrativePhase })
      if (intent) phase = 'delivering'
      return intent
    }
    if (coffeeStatus === 'delivered' && phase === 'delivery-arrived') {
      const intent = resolveCommercialCafeReturnToCounterIntent(scene)
      if (intent) phase = 'returning'
      return intent
    }
    return null
  }

  return { getPhase, request, arrivedAtPrep, arrivedAtStoryTable, arrivedAtCounter, block, retry, reset }
}

/** Ordinary table service is an independent floor duty and never makes coffee. */
export function createCommercialCafeFloorServerBehaviorCoordinator() {
  let phase: CommercialCafeFloorServerPhase = 'staging'
  let tableRotation = 0
  const getPhase = () => phase
  const block = () => { phase = 'blocked' }
  const reset = () => { phase = 'staging'; tableRotation = 0 }
  const retry = () => { if (phase === 'blocked') phase = 'staging' }
  const arrived = () => { phase = 'serving'; tableRotation += 1 }
  const request = (scene: MainlineSceneDefinition, snapshot: NpcRuntimeSnapshot): NpcIntent | null => {
    if (scene.id !== 'commercial-cafe' || snapshot.phase === 'moving' || phase === 'blocked') return null
    const intent = resolveCommercialCafeFloorServiceIntent(scene, tableRotation)
    if (intent) phase = 'serving'
    return intent
  }
  return { getPhase, request, arrived, block, retry, reset }
}
