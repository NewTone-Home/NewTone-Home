import type { Point } from './sceneGeometry'
import type { PhoneDevice } from './phoneState'
import type { MainlineSceneId } from './mainlineSceneModel'
import {
  loadPlayerSave,
  recordPlayerScenePosition,
  savePlayerSave,
} from './playerSave'

export function loadCarriedPhoneDevice(sceneId?: MainlineSceneId): PhoneDevice {
  return loadPlayerSave(undefined, sceneId ?? 'jijia-ancestral-home').phoneDevice
}

export function persistCarriedPhoneDevice(device: PhoneDevice, sceneId?: MainlineSceneId) {
  if (!sceneId) return
  const save = loadPlayerSave(undefined, sceneId)
  savePlayerSave({ ...save, phoneDevice: device }, undefined)
}

export function loadScenePosition(sceneId: MainlineSceneId): Point | undefined {
  return loadPlayerSave(undefined, sceneId).scenePositions[sceneId]
}

export function persistScenePosition(sceneId: MainlineSceneId, position: Point) {
  const save = loadPlayerSave(undefined, sceneId)
  savePlayerSave(recordPlayerScenePosition(save, sceneId, position), undefined)
}
