import { isValidPhase } from '../constants/phases'
import { readerContentIndex, comparePosition, resolvePosition } from '../reader/readerPosition'

export const PROGRESS_STORAGE_KEYS = Object.freeze({
  V1: 'newtone-progress-v1',
  V2: 'newtone-progress-v2',
  EXIT_TUTORIAL: 'newtone-reader-exit-tutorial-v1',
})

export const PROGRESS_VERSION = 2

const VALID_VIEWS = ['landing', 'reader', 'center']
const VALID_CENTER_MODES = ['home', 'records', 'perspectives', 'fragments']
const VALID_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'es', 'id']

export const READER_START_LOCATION = toPersistedLocation(readerContentIndex.entries[0])

function toPersistedLocation(location) {
  return {
    phaseId: location.phaseId,
    pageId: location.pageId,
    beatIndex: location.beatIndex,
  }
}

function sanitizeLocation(location, fallback = READER_START_LOCATION) {
  try {
    return toPersistedLocation(resolvePosition(location))
  } catch {
    return { ...fallback }
  }
}

function getPhaseStart(phaseId) {
  const entry = readerContentIndex.entries.find(candidate => candidate.phaseId === phaseId)
  return entry ? toPersistedLocation(entry) : { ...READER_START_LOCATION }
}

function sanitizeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(value, 0)
    : 0
}

function sanitizeLegacyPhase(value) {
  return value === null || isValidPhase(value) ? value ?? null : null
}

function sanitizeSharedFields(data, centerUnlocked) {
  const currentView = VALID_VIEWS.includes(data.currentView)
    ? data.currentView
    : 'landing'

  return {
    currentView: currentView === 'center' && !centerUnlocked ? 'landing' : currentView,
    centerMode: VALID_CENTER_MODES.includes(data.centerMode) ? data.centerMode : 'home',
    language: VALID_LANGUAGES.includes(data.language) ? data.language : 'zh',
    hasInitializedLanguage: Boolean(data.hasInitializedLanguage),
  }
}

export function createInitialProgressState() {
  return {
    currentView: 'landing',
    maxReadPhase: null,
    lastReadPhase: null,
    committedLocation: { ...READER_START_LOCATION },
    furthestLocation: { ...READER_START_LOCATION },
    readerStarted: false,
    readerCompleted: false,
    centerUnlocked: false,
    centerMode: 'home',
    resumeRequested: false,
    exitTutorialSeen: false,
    legacyLastScrollY: 0,
    language: 'zh',
    hasInitializedLanguage: false,
  }
}

export function migrateV1ToV2(data) {
  const source = data && typeof data === 'object' ? data : {}
  const centerUnlocked = source.centerUnlocked === true
  const lastReadPhase = sanitizeLegacyPhase(source.lastReadPhase)
  const maxReadPhase = sanitizeLegacyPhase(source.maxReadPhase)
  const legacyLastScrollY = sanitizeNumber(source.lastScrollY)
  const committedLocation = getPhaseStart(lastReadPhase)
  const shared = sanitizeSharedFields(source, centerUnlocked)
  const readerStarted = legacyLastScrollY > 0
    || lastReadPhase !== null
    || maxReadPhase !== null
    || source.currentView === 'reader'
    || centerUnlocked

  return {
    ...createInitialProgressState(),
    ...shared,
    maxReadPhase,
    lastReadPhase,
    committedLocation,
    furthestLocation: { ...committedLocation },
    readerStarted,
    readerCompleted: false,
    centerUnlocked,
    resumeRequested: shared.currentView === 'reader',
    exitTutorialSeen: false,
    legacyLastScrollY,
  }
}

export function sanitizeV2Progress(data) {
  const source = data && typeof data === 'object' ? data : {}
  const readerCompleted = source.readerCompleted === true
  const centerUnlocked = source.centerUnlocked === true || readerCompleted
  const committedLocation = sanitizeLocation(source.committedLocation)
  let furthestLocation = sanitizeLocation(source.furthestLocation, committedLocation)

  if (comparePosition(furthestLocation, committedLocation) < 0) {
    furthestLocation = { ...committedLocation }
  }

  const shared = sanitizeSharedFields(source, centerUnlocked)
  const legacyLastScrollY = sanitizeNumber(
    source.legacyLastScrollY ?? source.lastScrollY,
  )
  const derivedPhase = committedLocation.phaseId
  const lastReadPhase = sanitizeLegacyPhase(source.lastReadPhase) ?? derivedPhase
  const maxReadPhase = sanitizeLegacyPhase(source.maxReadPhase) ?? furthestLocation.phaseId

  return {
    ...createInitialProgressState(),
    ...shared,
    maxReadPhase,
    lastReadPhase,
    committedLocation,
    furthestLocation,
    readerStarted: Boolean(source.readerStarted),
    readerCompleted,
    centerUnlocked,
    resumeRequested: shared.currentView === 'reader' || Boolean(source.resumeRequested),
    exitTutorialSeen: Boolean(source.exitTutorialSeen),
    legacyLastScrollY,
  }
}

export function serializeProgressV2(state) {
  const clean = sanitizeV2Progress(state)
  return { _version: PROGRESS_VERSION, ...clean }
}

function parseStorageValue(storage, key) {
  try {
    const raw = storage?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadProgressState(storage) {
  const v2 = parseStorageValue(storage, PROGRESS_STORAGE_KEYS.V2)
  if (v2?._version === PROGRESS_VERSION) {
    return sanitizeV2Progress(v2)
  }

  const v1 = parseStorageValue(storage, PROGRESS_STORAGE_KEYS.V1)
  if (v1?._version !== 1) {
    return null
  }

  const migrated = migrateV1ToV2(v1)
  storage?.setItem(
    PROGRESS_STORAGE_KEYS.V2,
    JSON.stringify(serializeProgressV2(migrated)),
  )
  return migrated
}

export function saveProgressState(storage, state) {
  storage?.setItem(
    PROGRESS_STORAGE_KEYS.V2,
    JSON.stringify(serializeProgressV2(state)),
  )
}

export function clearProgressStorage(storage) {
  storage?.removeItem(PROGRESS_STORAGE_KEYS.V1)
  storage?.removeItem(PROGRESS_STORAGE_KEYS.V2)
  storage?.removeItem(PROGRESS_STORAGE_KEYS.EXIT_TUTORIAL)
}
