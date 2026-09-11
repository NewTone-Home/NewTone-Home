import type { Point } from './sceneGeometry'
import { worldLayerForScene, type PhoneDevice } from './phoneState'
import type { MainlineSceneId } from './mainlineSceneModel'

const phoneDeviceStorageKey = 'newtone.mainline.carried-phone.v2'
const legacyPhoneDeviceStorageKey = 'newtone.mainline.carried-phone.v1'
// The v2 key intentionally retires positions written before the doorway
// spawn contract was corrected; otherwise an old saved doorway position can
// override the scene's safe authored entry on the first render.
const scenePositionStorageKey = 'newtone.mainline.scene-positions.v2'

type ScenePositionRecord = Record<string, Point>

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

type CarriedPhoneRecord = {
  device: PhoneDevice
  sceneId?: MainlineSceneId
}

function readCarriedPhoneRecord(): CarriedPhoneRecord | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(phoneDeviceStorageKey) ?? window.localStorage.getItem(legacyPhoneDeviceStorageKey)
  if (raw === 'inner' || raw === 'surface') return { device: raw }
  try {
    const parsed: unknown = JSON.parse(raw ?? '')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const device = (parsed as { device?: unknown }).device
    const sceneId = (parsed as { sceneId?: unknown }).sceneId
    if (device !== 'inner' && device !== 'surface') return null
    return { device, sceneId: typeof sceneId === 'string' ? sceneId as MainlineSceneId : undefined }
  } catch {
    return null
  }
}

export function loadCarriedPhoneDevice(sceneId?: MainlineSceneId): PhoneDevice {
  const record = readCarriedPhoneRecord()
  const sceneLayer = sceneId ? worldLayerForScene(sceneId) : undefined
  // The office is the deliberate handoff point. Other stable world scenes
  // must reopen with their own device so an old or missing checkpoint cannot
  // strand the player without access to that world's ride destinations.
  if (sceneId && sceneId !== 'zhongshuyuan-office') {
    if (sceneLayer === 'inner') return 'inner'
    if (sceneLayer === 'surface') return 'surface'
  }
  return record?.device ?? (sceneId === 'zhongshuyuan-office' ? 'surface' : sceneLayer === 'inner' ? 'inner' : 'surface')
}

export function persistCarriedPhoneDevice(device: PhoneDevice, sceneId?: MainlineSceneId) {
  if (!canUseStorage()) return
  window.localStorage.setItem(phoneDeviceStorageKey, JSON.stringify({ device, sceneId }))
}

function loadScenePositionRecord(): ScenePositionRecord {
  if (!canUseStorage()) return {}
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(scenePositionStorageKey) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => (
      value && typeof value === 'object' && !Array.isArray(value)
        && Number.isFinite((value as Point).x)
        && Number.isFinite((value as Point).y)
    ))) as ScenePositionRecord
  } catch {
    return {}
  }
}

export function loadScenePosition(sceneId: string): Point | undefined {
  return loadScenePositionRecord()[sceneId]
}

export function persistScenePosition(sceneId: string, position: Point) {
  if (!canUseStorage()) return
  const positions = loadScenePositionRecord()
  positions[sceneId] = position
  window.localStorage.setItem(scenePositionStorageKey, JSON.stringify(positions))
}
