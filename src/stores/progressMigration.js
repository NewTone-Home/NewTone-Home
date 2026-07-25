import { isValidPhase } from '../constants/phases'
import { readerContentIndex, comparePosition, resolvePosition } from '../reader/readerPosition'
import { READER_LANGUAGE_CODES } from '../i18n/languages'
import { legacyThemeName, migrateThemePosition } from '../reader/readerTheme'
import {
  createDefaultCenterViewSnapshot,
  normalizeCenterViewSnapshot,
  normalizeCenterWorldSnapshot,
} from '../center-next/domain/invariants'
import { DEFAULT_CENTER_PACKAGE_ID } from '../center-next/content/defaultCenterDefinition'

export const PROGRESS_STORAGE_KEYS = Object.freeze({
  V1: 'newtone-progress-v1',
  V2: 'newtone-progress-v2',
  V3: 'newtone-progress-v3',
  EXIT_TUTORIAL: 'newtone-reader-exit-tutorial-v1',
})

export const PROGRESS_VERSION = 3

const VALID_VIEWS = ['landing', 'reader', 'center']
const VALID_CENTER_MODES = ['home', 'records', 'perspectives', 'fragments']
const VALID_LANGUAGES = READER_LANGUAGE_CODES
const VALID_READING_MODES = ['immersive', 'standard']
const VALID_MOTION_MODES = ['full', 'reduced']

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
    centerContentPackageId: DEFAULT_CENTER_PACKAGE_ID,
    centerWorldSnapshot: null,
    centerViewSnapshot: createDefaultCenterViewSnapshot(),
    resumeRequested: false,
    readerExitGestureLearned: false,
    chapterTrialEnded: false,
    legacyLastScrollY: 0,
    language: 'zh',
    hasInitializedLanguage: false,
    hasInitializedReadingMode: false,
    readingMode: 'immersive',
    themePosition: 0.5,
    standardTheme: 'soft',
    motionMode: 'full',
    currentChapter: 'chapter-1',
    currentPage: READER_START_LOCATION.pageId,
    currentBeat: READER_START_LOCATION.beatIndex,
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
    legacyLastScrollY,
    hasInitializedReadingMode: Boolean(source.hasInitializedReadingMode ?? source.hasInitializedLanguage),
    readingMode: VALID_READING_MODES.includes(source.readingMode) ? source.readingMode : 'immersive',
    themePosition: migrateThemePosition(source.themePosition, source.standardTheme),
    standardTheme: legacyThemeName(migrateThemePosition(source.themePosition, source.standardTheme)),
    motionMode: VALID_MOTION_MODES.includes(source.motionMode) ? source.motionMode : 'full',
    currentPage: committedLocation.pageId,
    currentBeat: committedLocation.beatIndex,
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
  const legacyLastScrollY = sanitizeNumber(source.legacyLastScrollY ?? source.lastScrollY)
  const lastReadPhase = sanitizeLegacyPhase(source.lastReadPhase) ?? committedLocation.phaseId
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
    readerExitGestureLearned: Boolean(source.readerExitGestureLearned ?? source.exitTutorialSeen),
    chapterTrialEnded: source.chapterTrialEnded === true,
    legacyLastScrollY,
    hasInitializedReadingMode: Boolean(source.hasInitializedReadingMode ?? source.hasInitializedLanguage),
    readingMode: VALID_READING_MODES.includes(source.readingMode) ? source.readingMode : 'immersive',
    themePosition: migrateThemePosition(source.themePosition, source.standardTheme),
    standardTheme: legacyThemeName(migrateThemePosition(source.themePosition, source.standardTheme)),
    motionMode: VALID_MOTION_MODES.includes(source.motionMode) ? source.motionMode : 'full',
    currentPage: committedLocation.pageId,
    currentBeat: committedLocation.beatIndex,
  }
}

export function serializeProgressV2(state) {
  return { _version: 2, ...sanitizeV2Progress(state) }
}

export function sanitizeV3Progress(data) {
  const clean = sanitizeV2Progress(data)
  const source = data && typeof data === 'object' ? data : {}
  return {
    ...clean,
    centerContentPackageId: typeof source.centerContentPackageId === 'string' && source.centerContentPackageId.length > 0
      ? source.centerContentPackageId
      : DEFAULT_CENTER_PACKAGE_ID,
    centerWorldSnapshot: normalizeCenterWorldSnapshot(source.centerWorldSnapshot),
    centerViewSnapshot: normalizeCenterViewSnapshot(source.centerViewSnapshot),
  }
}

export function migrateV2ToV3(data) {
  return sanitizeV3Progress(data)
}

export function serializeProgressV3(state) {
  return { _version: PROGRESS_VERSION, ...sanitizeV3Progress(state) }
}

function parseStorageValue(storage, key) {
  try {
    const raw = storage?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistCurrentVersion(storage, state) {
  storage?.setItem(
    PROGRESS_STORAGE_KEYS.V3,
    JSON.stringify(serializeProgressV3(state)),
  )
  return state
}

function persistV1Migration(storage, state) {
  storage?.setItem(
    PROGRESS_STORAGE_KEYS.V2,
    JSON.stringify(serializeProgressV2(state)),
  )
  return persistCurrentVersion(storage, state)
}

export function loadProgressState(storage) {
  const v3 = parseStorageValue(storage, PROGRESS_STORAGE_KEYS.V3)
  if (v3?._version === PROGRESS_VERSION) return sanitizeV3Progress(v3)

  const v2 = parseStorageValue(storage, PROGRESS_STORAGE_KEYS.V2)
  if (v2?._version === 2) return persistCurrentVersion(storage, migrateV2ToV3(v2))

  const v1 = parseStorageValue(storage, PROGRESS_STORAGE_KEYS.V1)
  if (v1?._version === 1) return persistV1Migration(storage, migrateV1ToV2(v1))

  return null
}

export function saveProgressState(storage, state) {
  storage?.setItem(
    PROGRESS_STORAGE_KEYS.V3,
    JSON.stringify(serializeProgressV3(state)),
  )
}

export function clearProgressStorage(storage) {
  storage?.removeItem(PROGRESS_STORAGE_KEYS.V1)
  storage?.removeItem(PROGRESS_STORAGE_KEYS.V2)
  storage?.removeItem(PROGRESS_STORAGE_KEYS.V3)
  storage?.removeItem(PROGRESS_STORAGE_KEYS.EXIT_TUTORIAL)
}
