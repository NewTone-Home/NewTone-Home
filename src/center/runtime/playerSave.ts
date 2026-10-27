import { currentCommercialDepthVersion, migrateCommercialDepthPoint, type CommercialDepthBackup } from './commercialDepthMigration'
import type { MainlineSceneId } from './mainlineSceneModel'
import { migratePreGridPosition } from './sceneGridRollout'
import { mainlineSceneBlueprints } from './mainlineSceneModel'
import { continuousCafeRoomId, mapLegacyCafePoint } from './continuousCafe'
import { cleanMiningPositionBackup, cleanMiningPositionRooms, currentMiningLayoutVersion, currentMiningRoomId, isMiningSceneId, migrateMiningPositions, type MiningPositionBackup, type MiningPositionRooms } from './miningLayoutMigration'
import { cleanPhoneNotifications, type PhoneNotification } from './phoneNotifications'
import type { PhoneDevice } from './phoneState'
import { mainlineSceneWorldLayers } from './phoneState'
import { initialMainlinePhoneDevice, initialMainlineSceneId } from './mainlineInitialState'
import { createInitialMainlineStoryClock, storyClockForStage, type MainlineStoryClock, type MainlineStoryStage } from './mainlineStoryClock'
import { applyPublicReleaseCutover } from '../../services/publicReleaseMigration'
import { cleanPhoneCallHistory, cleanPhoneContactNotes, cleanPhoneNotes, createInitialPhoneNotes, type PhoneCallRecord, type PhoneNote } from './phonePersonalData'
import { defaultLaoZhouCafeSeatId, isLaoZhouCafeSeatId, selectLaoZhouCafeSeat } from './commercialCafeSeatSelection'
import { migrateLegacyShopState, sanitizeCrossShopOrderState, type CrossShopOrder, type HeldConsumable } from './crossShopOrders'

export const PLAYER_SAVE_STORAGE_KEY = 'newtone-player-save-v1'
export const PLAYER_SAVE_VERSION = 2
const LEGACY_PHONE_STORAGE_KEYS = ['newtone.mainline.carried-phone.v2', 'newtone.mainline.carried-phone.v1']
const LEGACY_POSITION_STORAGE_KEY = 'newtone.mainline.scene-positions.v2'
// Explicit reset invalidates writers still mounted in the departing document.
// A new coordinator after reset captures the new generation normally.
let playerSaveResetGeneration = 0

export type PlayerPoint = { x: number; y: number }
export type PlayerChoiceValue = string | number | boolean | null
export type PlayerSceneState = Record<string, PlayerChoiceValue>

export type PlayerSave = {
  worldGridVersion?: 1
  commercialDepthVersion?: number
  commercialDepthBackup?: CommercialDepthBackup
  miningLayoutVersion?: number
  miningPositionRooms?: MiningPositionRooms
  miningPositionBackup?: MiningPositionBackup
  _version: typeof PLAYER_SAVE_VERSION
  currentSceneId: MainlineSceneId
  currentPosition: PlayerPoint | null
  scenePositions: Partial<Record<MainlineSceneId, PlayerPoint>>
  phoneDevice: PhoneDevice
  storyClock: MainlineStoryClock
  /** Simulation milliseconds elapsed in-world; never derived from wall time on resume. */
  gameTimeMs: number
  /** Cross-shop commerce state. Stored separately from scene state so rides and scene changes preserve one global hand. */
  shopOrders: Record<string, CrossShopOrder>
  heldConsumable: HeldConsumable | null
  sceneState: Partial<Record<MainlineSceneId, PlayerSceneState>>
  phoneNotifications: PhoneNotification[]
  phoneNotes: PhoneNote[]
  phoneContactNotes: Record<string, string>
  phoneCallHistory: PhoneCallRecord[]
  /** Stable NPC seat chosen once for a genuinely new save; absent legacy values use the authored seat. */
  laoZhouCafeSeatId: string
  /** Distinguishes the immediately persisted seat seed from a player session that should resume Center. */
  freshSeatOnly?: true
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

export function createInitialPlayerSave(sceneId: MainlineSceneId = initialMainlineSceneId): PlayerSave {
  const storyClock = createInitialMainlineStoryClock(sceneId)
  return {
    worldGridVersion: 1,
    commercialDepthVersion: currentCommercialDepthVersion,
    miningLayoutVersion: currentMiningLayoutVersion,
    _version: PLAYER_SAVE_VERSION,
    currentSceneId: sceneId,
    currentPosition: null,
    scenePositions: {},
    phoneDevice: initialMainlinePhoneDevice,
    storyClock,
    gameTimeMs: storyClockTimeAsMilliseconds(storyClock),
    shopOrders: {},
    heldConsumable: null,
    sceneState: {},
    phoneNotifications: [],
    phoneNotes: createInitialPhoneNotes(),
    phoneContactNotes: {},
    phoneCallHistory: [],
    laoZhouCafeSeatId: defaultLaoZhouCafeSeatId,
    updatedAt: 0,
  }
}

function storyClockTimeAsMilliseconds(clock: Pick<MainlineStoryClock, 'hour' | 'minute'>): number {
  const hour = clock.hour
  const minute = clock.minute
  if (!Number.isInteger(hour) || hour! < 0 || hour! > 23 || !Number.isInteger(minute) || minute! < 0 || minute! > 59) {
    return 0
  }
  return (hour! * 60 + minute!) * 60_000
}

function savedStoryClockTimeAsMilliseconds(value: unknown, fallback: MainlineStoryClock): number {
  if (value && typeof value === 'object') {
    const clock = value as Partial<MainlineStoryClock>
    if (Number.isInteger(clock.hour) && clock.hour! >= 0 && clock.hour! <= 23
      && Number.isInteger(clock.minute) && clock.minute! >= 0 && clock.minute! <= 59) {
      return (clock.hour! * 60 + clock.minute!) * 60_000
    }
  }
  return storyClockTimeAsMilliseconds(fallback)
}

function readLegacyPlayerSave(storage: PlayerSaveStorage | null, fallbackSceneId: MainlineSceneId): { save: PlayerSave; hasLegacyValue: boolean } {
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

  if (hasLegacyValue && !migrated.currentPosition && migrated.phoneDevice === 'surface'
    && migrated.scenePositions['jijia-ancestral-home']) {
    // The legacy map has no current-scene field. Preserve an identifiable
    // surface-world position instead of pairing its phone with a new street.
    migrated.currentSceneId = 'jijia-ancestral-home'
    migrated.currentPosition = migrated.scenePositions['jijia-ancestral-home']!
  }
  if (hasLegacyValue && !migrated.currentPosition && migrated.phoneDevice === 'surface') {
    migrated.currentSceneId = initialMainlineSceneId
    migrated.phoneDevice = initialMainlinePhoneDevice
  }
  return {
    save: hasLegacyValue
      ? sanitizePlayerSave({ ...migrated, _version: 1, worldGridVersion: undefined, miningLayoutVersion: undefined }, fallbackSceneId)
      : createInitialPlayerSave(fallbackSceneId),
    hasLegacyValue,
  }
}

export function sanitizePlayerSave(value: unknown, _fallbackSceneId: MainlineSceneId): PlayerSave {
  const source = value && typeof value === 'object' ? value as Partial<PlayerSave> : {}
  const validScene = typeof source.currentSceneId === 'string' && Object.hasOwn(mainlineSceneWorldLayers, source.currentSceneId)
  const validPhone = source.phoneDevice === 'inner' || source.phoneDevice === 'surface'
  const validCore = validScene && validPhone && (source.currentPosition == null || isPoint(source.currentPosition))
  let currentSceneId = validCore
    ? source.currentSceneId as MainlineSceneId
    : initialMainlineSceneId
  const savedVersion = Number(source._version ?? 0)
  // Version1 treated a valid street + surface-phone pair as resumable, even
  // though that phone is offline here and the street has no swap terminal.
  // Repair only that old combination; keep position/progression and respect
  // deliberate phone choices made after this migration has been saved.
  const repairLegacyStreetPhone = validCore && currentSceneId === 'commercial-street'
    && source.phoneDevice === 'surface' && (!Number.isFinite(savedVersion) || savedVersion < 2)
  const phoneDevice = repairLegacyStreetPhone ? 'inner' : validCore ? source.phoneDevice as PhoneDevice : initialMainlinePhoneDevice
  let scenePositions = cleanScenePositions(source.scenePositions)
  if(source.worldGridVersion !== 1) {
    for(const [id,position] of Object.entries(scenePositions)) {
      if(Object.hasOwn(mainlineSceneWorldLayers,id)&&!isMiningSceneId(id)) scenePositions[id as MainlineSceneId]=migratePreGridPosition(id as MainlineSceneId,position!)
    }
  }
  if (!validCore) delete scenePositions[initialMainlineSceneId]
  let currentPosition = validCore && isPoint(source.currentPosition)
    ? source.worldGridVersion === 1 || isMiningSceneId(currentSceneId) ? cleanPoint(source.currentPosition) : migratePreGridPosition(currentSceneId, source.currentPosition)
    : null
  const mining = migrateMiningPositions({
    layoutVersion: source.miningLayoutVersion, worldGridVersion: source.worldGridVersion,
    currentSceneId, currentPosition, scenePositions,
    rooms: cleanMiningPositionRooms(source.miningPositionRooms), backup: cleanMiningPositionBackup(source.miningPositionBackup),
  })
  currentPosition = mining.currentPosition
  scenePositions = mining.scenePositions
  const cafeBounds = mainlineSceneBlueprints['commercial-street'].scene.rooms!.find(room => room.id === continuousCafeRoomId)!.bounds
  const rememberedCafe = scenePositions['commercial-cafe']
  if (currentSceneId === 'commercial-cafe') {
    currentSceneId = 'commercial-street'
    currentPosition = mapLegacyCafePoint(currentPosition, cafeBounds)
    scenePositions['commercial-street'] = currentPosition
  } else if (rememberedCafe && !scenePositions['commercial-street']) {
    scenePositions['commercial-street'] = mapLegacyCafePoint(rememberedCafe, cafeBounds)
  }
  delete scenePositions['commercial-cafe']
  let commercialDepthBackup: CommercialDepthBackup | undefined
  const priorDepthBackup = source.commercialDepthBackup && typeof source.commercialDepthBackup === 'object' ? source.commercialDepthBackup : undefined
  if (priorDepthBackup) commercialDepthBackup = {
    ...(isPoint(priorDepthBackup.currentPosition) ? { currentPosition: cleanPoint(priorDepthBackup.currentPosition)! } : {}),
    ...(isPoint(priorDepthBackup.rememberedPosition) ? { rememberedPosition: cleanPoint(priorDepthBackup.rememberedPosition)! } : {}),
  }
  const savedDepthVersion = Number(source.commercialDepthVersion)
  if (!Number.isFinite(savedDepthVersion) || savedDepthVersion < currentCommercialDepthVersion) {
    const rooms = mainlineSceneBlueprints['commercial-street'].scene.rooms!
    const oldCurrent = currentSceneId === 'commercial-street' && source.currentSceneId !== 'commercial-cafe' ? currentPosition : null
    const oldRemembered = source.currentSceneId !== 'commercial-cafe' && source.scenePositions && typeof source.scenePositions === 'object' && isPoint(source.scenePositions['commercial-street']) ? scenePositions['commercial-street'] : undefined
    if (oldCurrent) currentPosition = migrateCommercialDepthPoint(oldCurrent, rooms)
    if (oldRemembered) scenePositions['commercial-street'] = migrateCommercialDepthPoint(oldRemembered, rooms)!
    if (!commercialDepthBackup && (oldCurrent || oldRemembered)) commercialDepthBackup = {
      ...(oldCurrent ? { currentPosition: oldCurrent } : {}), ...(oldRemembered ? { rememberedPosition: oldRemembered } : {}),
    }
  }

  const storyStage = source.storyClock?.stage
  const storyClock: MainlineStoryClock = storyStage === 'commercial-street' || storyStage === 'cafe' || storyStage === 'yonghe' || storyStage === 'opening'
    ? storyClockForStage(storyStage as MainlineStoryStage)
    : createInitialMainlineStoryClock(validCore && source.currentSceneId === 'commercial-cafe' ? 'commercial-cafe' : currentSceneId)
  const updatedAt = Number(source.updatedAt)
  const savedGameTimeMs = source.gameTimeMs
  const gameTimeMs = typeof savedGameTimeMs === 'number' && Number.isFinite(savedGameTimeMs) && savedGameTimeMs >= 0
    ? savedGameTimeMs
    : savedStoryClockTimeAsMilliseconds((source as { storyClock?: unknown }).storyClock, storyClock)
  const commerceState = Object.hasOwn(source, 'shopOrders') || Object.hasOwn(source, 'heldConsumable')
    ? sanitizeCrossShopOrderState({ ordersByShop: source.shopOrders, heldConsumable: source.heldConsumable })
    : migrateLegacyShopState(cleanSceneState(source.sceneState))
  return {
    worldGridVersion: 1,
    commercialDepthVersion: Math.max(currentCommercialDepthVersion, Number.isFinite(savedDepthVersion) ? savedDepthVersion : currentCommercialDepthVersion),
    ...(commercialDepthBackup ? { commercialDepthBackup } : {}),
    miningLayoutVersion: mining.version,
    ...(mining.rooms ? { miningPositionRooms: mining.rooms } : {}),
    ...(mining.backup ? { miningPositionBackup: mining.backup } : {}),
    _version: PLAYER_SAVE_VERSION,
    currentSceneId,
    currentPosition,
    scenePositions,
    phoneDevice,
    storyClock,
    gameTimeMs,
    shopOrders: commerceState.ordersByShop,
    heldConsumable: commerceState.heldConsumable,
    sceneState: cleanSceneState(source.sceneState),
    phoneNotifications: cleanPhoneNotifications(source.phoneNotifications),
    phoneNotes: cleanPhoneNotes(source.phoneNotes),
    phoneContactNotes: cleanPhoneContactNotes(source.phoneContactNotes),
    phoneCallHistory: cleanPhoneCallHistory(source.phoneCallHistory),
    laoZhouCafeSeatId: isLaoZhouCafeSeatId(source.laoZhouCafeSeatId) ? source.laoZhouCafeSeatId : defaultLaoZhouCafeSeatId,
    ...(source.freshSeatOnly === true && Number(source.updatedAt) === 0
      && source.currentPosition == null && Object.keys(cleanScenePositions(source.scenePositions)).length === 0
      && Object.values(cleanSceneState(source.sceneState)).every((state) => Object.keys(state).length === 0)
      ? { freshSeatOnly: true as const }
      : {}),
    updatedAt: Number.isFinite(updatedAt) && updatedAt >= 0 ? Math.round(updatedAt) : 0,
  }
}

export function loadPlayerSave(
  storage = defaultStorage(),
  fallbackSceneId: MainlineSceneId = initialMainlineSceneId,
  random: () => number = Math.random,
): PlayerSave {
  applyPublicReleaseCutover(storage)
  try {
    const raw = storage?.getItem(PLAYER_SAVE_STORAGE_KEY)
    if (raw) return sanitizePlayerSave(JSON.parse(raw), fallbackSceneId)
    const legacy = readLegacyPlayerSave(storage, fallbackSceneId)
    if (legacy.hasLegacyValue || !storage) return legacy.save
    const fresh = { ...legacy.save, laoZhouCafeSeatId: selectLaoZhouCafeSeat(random), freshSeatOnly: true as const }
    try {
      // Persist the seat choice immediately without changing updatedAt or the
      // landing/resume contract. A StrictMode initializer will read this value.
      storage.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify(fresh))
      return fresh
    } catch {
      // If durable storage is unavailable, stay on the deterministic legacy seat
      // rather than rerolling on every mount or reload.
      return legacy.save
    }
  } catch {
    return createInitialPlayerSave()
  }
}

/**
 * A freshly-created default save is not enough evidence that the player has
 * entered Center. App startup uses this predicate so a first visit still
 * opens Landing, while a refresh after real play resumes Center.
 */
export function hasResumablePlayerSave(storage = defaultStorage()): boolean {
  const save = loadPlayerSave(storage)
  let storedPhoneState = false
  try {
    storedPhoneState = [PLAYER_SAVE_STORAGE_KEY, ...LEGACY_PHONE_STORAGE_KEYS]
      .some(key => storage?.getItem(key) != null)
  } catch { /* Unavailable storage is a fresh in-memory session. */ }
  return !save.freshSeatOnly && (save.updatedAt > 0
    || save.currentPosition !== null
    || Object.keys(save.scenePositions).length > 0
    || (save.phoneDevice === 'inner' && storedPhoneState)
    || Object.values(save.sceneState).some((state) => Object.keys(state ?? {}).length > 0))
}

export function savePlayerSave(
  save: PlayerSave,
  storage = defaultStorage(),
  now = Date.now(),
  options: { preserveFreshSeatOnly?: boolean } = {},
): PlayerSave {
  const keepFreshSeatOnly = options.preserveFreshSeatOnly === true && save.freshSeatOnly === true
  const clean = sanitizePlayerSave({
    ...save,
    ...(keepFreshSeatOnly ? {} : { freshSeatOnly: undefined }),
    updatedAt: keepFreshSeatOnly ? save.updatedAt : now,
  }, save.currentSceneId)
  try {
    storage?.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify(clean))
  } catch {
    // Private browsing or blocked storage should not stop the current session.
  }
  return clean
}

export function clearPlayerSave(storage = defaultStorage()) {
  playerSaveResetGeneration += 1
  try {
    storage?.removeItem(PLAYER_SAVE_STORAGE_KEY)
    LEGACY_PHONE_STORAGE_KEYS.forEach(key => storage?.removeItem(key))
    storage?.removeItem(LEGACY_POSITION_STORAGE_KEY)
  } catch {
    // Clearing is best-effort; the in-memory runtime can still restart cleanly.
  }
}

/** Persist a fresh clock sample into the latest save without replacing other progress. */
export function createGameTimeSaveCheckpoint({
  getSave,
  setSave,
  getGameTimeMs,
  persist,
}: {
  getSave: () => PlayerSave
  setSave: (save: PlayerSave) => void
  getGameTimeMs: () => number
  persist: (save: PlayerSave) => PlayerSave
}) {
  const generation = playerSaveResetGeneration
  return () => {
    if (generation !== playerSaveResetGeneration) return getSave()
    const current = getSave()
    const gameTimeMs = getGameTimeMs()
    if (!Number.isFinite(gameTimeMs) || gameTimeMs < 0 || current.gameTimeMs === gameTimeMs) return current
    const persisted = persist({ ...current, gameTimeMs })
    setSave(persisted)
    return persisted
  }
}

export function recordPlayerScenePosition(
  save: PlayerSave,
  sceneId: MainlineSceneId,
  position: PlayerPoint,
): PlayerSave {
  const stored = save.scenePositions[sceneId]
  if (save.currentSceneId === sceneId
    && save.currentPosition?.x === position.x && save.currentPosition?.y === position.y
    && stored?.x === position.x && stored?.y === position.y) return save
  const rememberedRooms = { ...save.miningPositionRooms?.scenes }
  const currentRoom = isMiningSceneId(sceneId) && save.miningLayoutVersion === currentMiningLayoutVersion
    ? currentMiningRoomId(sceneId, position) ?? rememberedRooms[sceneId]
    : undefined
  if (isMiningSceneId(sceneId) && currentRoom) rememberedRooms[sceneId] = currentRoom
  return {
    ...save,
    currentSceneId: sceneId,
    currentPosition: { ...position },
    scenePositions: { ...save.scenePositions, [sceneId]: { ...position } },
    miningPositionRooms: currentRoom || Object.keys(rememberedRooms).length
      ? { ...(currentRoom ? { current: currentRoom } : {}), ...(Object.keys(rememberedRooms).length ? { scenes: rememberedRooms } : {}) }
      : undefined,
  }
}

/** Keeps only the latest movement sample until a save boundary flushes it. */
export function createPositionSaveBuffer<T>() {
  let pending: { sceneId: string; position: T } | null = null
  return {
    queue(sceneId: string, position: T) { pending = { sceneId, position } },
    take(sceneId: string) {
      if (!pending || pending.sceneId !== sceneId) return null
      const latest = pending
      pending = null
      return latest
    },
    clear() { pending = null },
  }
}

export function createPositionSaveCoordinator<TPosition, TSave>({
  getSave,
  setSave,
  getCurrentSceneId,
  recordPosition,
  persist,
}: {
  getSave: () => TSave
  setSave: (save: TSave) => void
  getCurrentSceneId: () => string
  recordPosition: (save: TSave, sceneId: string, position: TPosition) => TSave
  persist: (save: TSave) => TSave
}) {
  const buffer = createPositionSaveBuffer<TPosition>()
  const generation = playerSaveResetGeneration
  const apply = (save: TSave, pending: { sceneId: string; position: TPosition }) => recordPosition(save, pending.sceneId, pending.position)
  const publish = (next: TSave, current: TSave) => {
    if (next === current) return current
    const persisted = persist(next)
    setSave(persisted)
    return persisted
  }
  return {
    queue: buffer.queue,
    flush(sceneId: string) {
      if (generation !== playerSaveResetGeneration) { buffer.clear(); return getSave() }
      const pending = buffer.take(sceneId)
      if (!pending) return getSave()
      const current = getSave()
      return publish(apply(current, pending), current)
    },
    commit(update: (save: TSave) => TSave) {
      if (generation !== playerSaveResetGeneration) { buffer.clear(); return getSave() }
      const current = getSave()
      const pending = buffer.take(getCurrentSceneId())
      const positioned = pending ? apply(current, pending) : current
      return publish(update(positioned), current)
    },
    clear: buffer.clear,
  }
}

export function attachPositionSaveLifecycle(
  flush: (sceneId: string) => void,
  getSceneId: () => string,
  windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> = document,
  checkpoint?: () => void,
) {
  const flushCurrent = () => { flush(getSceneId()); checkpoint?.() }
  const flushWhenHidden = () => {
    if (documentTarget.visibilityState === 'hidden') flushCurrent()
  }
  windowTarget.addEventListener('pagehide', flushCurrent)
  documentTarget.addEventListener('visibilitychange', flushWhenHidden)
  return () => {
    windowTarget.removeEventListener('pagehide', flushCurrent)
    documentTarget.removeEventListener('visibilitychange', flushWhenHidden)
    flushCurrent()
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

/** Apply one domain-owned scene-state transition atomically. */
export function recordPlayerSceneStatePatch(
  save: PlayerSave,
  sceneId: MainlineSceneId,
  patch: Readonly<Record<string, PlayerChoiceValue>>,
): PlayerSave {
  return {
    ...save,
    sceneState: {
      ...save.sceneState,
      [sceneId]: { ...save.sceneState[sceneId], ...patch },
    },
  }
}
