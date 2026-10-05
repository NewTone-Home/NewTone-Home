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
export type CommercialCafeFloorServerPhase = 'staging' | 'serving' | 'dwelling' | 'blocked'

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
  let ambientStopIndex = 0
  let ambientPaused = false
  const getPhase = () => phase
  const reset = () => { phase = 'counter'; retryPhase = 'counter'; ambientStopIndex = 0; ambientPaused = false }
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
    if (scene.id !== 'commercial-cafe') return null
    const ambientMoving = snapshot.dutyId === 'cafe-coffee-owner.counter-ambient'
    if (snapshot.phase === 'moving' && !ambientMoving) return null
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
    if (coffeeStatus === 'delivered' && narrativePhase === 'dialogue' && phase === 'delivery-arrived') {
      const intent = resolveCommercialCafeReturnToCounterIntent(scene)
      if (intent) phase = 'returning'
      return intent
    }
    if ((coffeeStatus === 'none' || coffeeStatus === 'delivered') && phase === 'counter' && !ambientPaused && !(snapshot.phase === 'moving' && ambientMoving)) {
      const stop = scene.npcBehaviorTargets?.find((candidate) => candidate.id === `commercial-cafe-counter-ambient-${ambientStopIndex + 1}`)
      if (stop) return { dutyId: 'cafe-coffee-owner.counter-ambient', targetId: stop.id, target: { ...stop.position } }
    }
    return null
  }

  const arrivedAtAmbientCounter = () => { ambientStopIndex = (ambientStopIndex + 1) % 3; ambientPaused = true }
  const resumeAmbientCounter = () => { ambientPaused = false }
  return { getPhase, request, arrivedAtPrep, arrivedAtStoryTable, arrivedAtCounter, arrivedAtAmbientCounter, resumeAmbientCounter, block, retry, reset }
}

/** Ordinary table service is an independent floor duty and never makes coffee. */
export function createCommercialCafeFloorServerBehaviorCoordinator() {
  let phase: CommercialCafeFloorServerPhase = 'staging'
  let tableRotation = 0
  const getPhase = () => phase
  const block = () => { phase = 'blocked' }
  const reset = () => { phase = 'staging'; tableRotation = 0 }
  const retry = () => { if (phase === 'blocked') phase = 'staging' }
  const arrived = () => { phase = 'dwelling'; tableRotation += 1; return commercialCafeFloorServiceDwellMs() }
  const finishDwell = () => { if (phase === 'dwelling') phase = 'serving' }
  const request = (scene: MainlineSceneDefinition, snapshot: NpcRuntimeSnapshot): NpcIntent | null => {
    if (scene.id !== 'commercial-cafe' || snapshot.phase === 'moving' || phase === 'blocked' || phase === 'dwelling') return null
    const intent = resolveCommercialCafeFloorServiceIntent(scene, tableRotation)
    if (intent) phase = 'serving'
    return intent
  }
  return { getPhase, request, arrived, finishDwell, block, retry, reset }
}

/** Eight of ten services last 2–4s; the tails are 1s and 5s. */
export function commercialCafeFloorServiceDwellMs(random = Math.random) {
  const sample = Math.max(0, Math.min(1, random()))
  if (sample < .1) return 1000
  if (sample >= .9) return 5000
  return Math.round(2000 + (sample - .1) / .8 * 2000)
}
