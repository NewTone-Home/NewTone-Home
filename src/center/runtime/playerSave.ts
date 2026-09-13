import type { MainlineSceneId } from './mainlineSceneModel'
import type { PhoneDevice } from './phoneState'

export const PLAYER_SAVE_STORAGE_KEY = 'newtone-player-save-v1'
export const PLAYER_SAVE_VERSION = 1
const LEGACY_PHONE_STORAGE_KEYS = ['newtone.mainline.carried-phone.v2', 'newtone.mainline.carried-phone.v1']
const LEGACY_POSITION_STORAGE_KEY = 'newtone.mainline.scene-positions.v2'

export type PlayerPoint = { x: number; y: number }
export type PlayerChoiceValue = string | number | boolean | null
export type PlayerSceneState = Record<string, PlayerChoiceValue>

export type PlayerSave = {
  _version: typeof PLAYER_SAVE_VERSION
  currentSceneId: MainlineSceneId
  currentPosition: PlayerPoint | null
  scenePositions: Partial<Record<MainlineSceneId, PlayerPoint>>
  phoneDevice: PhoneDevice
  sceneState: Partial<Record<MainlineSceneId, PlayerSceneState>>
  updatedAt: number
}

export type PlayerSaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): PlayerSaveStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isPoint(value: unknown): value is PlayerPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<PlayerPoint>
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function cleanPoint(value: unknown): PlayerPoint | null {
  return isPoint(value) ? { x: Number(value.x), y: Number(value.y) } : null
}

function cleanScenePositions(value: unknown): Partial<Record<MainlineSceneId, PlayerPoint>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([sceneId, point]) => [sceneId, cleanPoint(point)] as const)
      .filter((entry): entry is [string, PlayerPoint] => entry[1] !== null),
  ) as Partial<Record<MainlineSceneId, PlayerPoint>>
}

function cleanRecord(value: unknown): Record<string, PlayerChoiceValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => (
      item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
    )),
  )
}

function cleanSceneState(value: unknown): Partial<Record<MainlineSceneId, PlayerSceneState>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([sceneId, state]) => [sceneId, cleanRecord(state)] as const)
      .filter(([, state]) => Object.keys(state).length > 0),
  ) as Partial<Record<MainlineSceneId, PlayerSceneState>>
}

export function createInitialPlayerSave(sceneId: MainlineSceneId): PlayerSave {
  return {
    _version: PLAYER_SAVE_VERSION,
    currentSceneId: sceneId,
    currentPosition: null,
    scenePositions: {},
    phoneDevice: 'surface',
    sceneState: {},
    updatedAt: 0,
  }
}

function readLegacyPlayerSave(storage: PlayerSaveStorage | null, fallbackSceneId: MainlineSceneId): PlayerSave {
  const migrated = createInitialPlayerSave(fallbackSceneId)
  let hasLegacyValue = false

  try {
    const rawPhone = LEGACY_PHONE_STORAGE_KEYS
      .map(key => storage?.getItem(key))
      .find(value => value !== null)
    if (rawPhone) {
      const parsed = JSON.parse(rawPhone)
      const device = typeof parsed === 'string' ? parsed : parsed?.device
      if (device === 'inner' || device === 'surface') {
        migrated.phoneDevice = device
        hasLegacyValue = true
      }
    }
  } catch {
    // Ignore malformed legacy state and start with the normal defaults.
  }

  try {
    const rawPositions = storage?.getItem(LEGACY_POSITION_STORAGE_KEY)
    if (rawPositions) {
      const scenePositions = cleanScenePositions(JSON.parse(rawPositions))
      if (Object.keys(scenePositions).length > 0) {
        migrated.scenePositions = scenePositions
        migrated.currentPosition = scenePositions[fallbackSceneId] ?? null
        hasLegacyValue = true
      }
    }
  } catch {
    // Ignore malformed legacy state and start with the normal defaults.
  }

  return hasLegacyValue ? migrated : createInitialPlayerSave(fallbackSceneId)
}

export function sanitizePlayerSave(value: unknown, fallbackSceneId: MainlineSceneId): PlayerSave {
  const source = value && typeof value === 'object' ? value as Partial<PlayerSave> : {}
  const currentSceneId = typeof source.currentSceneId === 'string' && source.currentSceneId.length > 0
    ? source.currentSceneId as MainlineSceneId
    : fallbackSceneId
  const phoneDevice = source.phoneDevice === 'inner' ? 'inner' : 'surface'
  const updatedAt = Number(source.updatedAt)
  return {
    _version: PLAYER_SAVE_VERSION,
    currentSceneId,
    currentPosition: cleanPoint(source.currentPosition),
    scenePositions: cleanScenePositions(source.scenePositions),
    phoneDevice,
    sceneState: cleanSceneState(source.sceneState),
    updatedAt: Number.isFinite(updatedAt) && updatedAt >= 0 ? Math.round(updatedAt) : 0,
  }
}

export function loadPlayerSave(
  storage = defaultStorage(),
  fallbackSceneId: MainlineSceneId = 'jijia-ancestral-home',
): PlayerSave {
  try {
    const raw = storage?.getItem(PLAYER_SAVE_STORAGE_KEY)
    return raw
      ? sanitizePlayerSave(JSON.parse(raw), fallbackSceneId)
      : readLegacyPlayerSave(storage, fallbackSceneId)
  } catch {
    return createInitialPlayerSave(fallbackSceneId)
  }
}

export function savePlayerSave(save: PlayerSave, storage = defaultStorage(), now = Date.now()): PlayerSave {
  const clean = sanitizePlayerSave({ ...save, updatedAt: now }, save.currentSceneId)
  try {
    storage?.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify(clean))
  } catch {
    // Private browsing or blocked storage should not stop the current session.
  }
  return clean
}

export function clearPlayerSave(storage = defaultStorage()) {
  try {
    storage?.removeItem(PLAYER_SAVE_STORAGE_KEY)
    LEGACY_PHONE_STORAGE_KEYS.forEach(key => storage?.removeItem(key))
    storage?.removeItem(LEGACY_POSITION_STORAGE_KEY)
  } catch {
    // Clearing is best-effort; the in-memory runtime can still restart cleanly.
  }
}

export function recordPlayerScenePosition(
  save: PlayerSave,
  sceneId: MainlineSceneId,
  position: PlayerPoint,
): PlayerSave {
  return {
    ...save,
    currentSceneId: sceneId,
    currentPosition: { ...position },
    scenePositions: { ...save.scenePositions, [sceneId]: { ...position } },
  }
}

export function recordPlayerSceneState(
  save: PlayerSave,
  sceneId: MainlineSceneId,
  key: string,
  value: PlayerChoiceValue,
): PlayerSave {
  return {
    ...save,
    sceneState: {
      ...save.sceneState,
      [sceneId]: { ...save.sceneState[sceneId], [key]: value },
    },
  }
}
