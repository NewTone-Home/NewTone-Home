import { readerContent } from '../data/readerContent'
import { READER_LANGUAGE_CODES } from '../i18n/languages'
import { resolvePosition } from '../reader/readerPosition'
import { legacyThemeName, migrateThemePosition } from '../reader/readerTheme'
import { clearNarrativeProgressStorage } from './narrativeProgressStorage'

export const PROGRESS_STORAGE_KEYS = Object.freeze({ V1: 'newtone-progress-v1', V2: 'newtone-progress-v2', V3: 'newtone-progress-v3', V4: 'newtone-progress-v4', EXIT_TUTORIAL: 'newtone-reader-exit-tutorial-v1' })
export const PROGRESS_VERSION = 4
const firstPhase = readerContent[0]
const firstPage = firstPhase?.pages?.[0]
export const READER_START_LOCATION = { phaseId: firstPhase?.id ?? 'M1', pageId: firstPage?.id ?? '', beatIndex: 0 }

function location(value, fallback = READER_START_LOCATION) {
  try { const resolved = resolvePosition(value); return { phaseId: resolved.phaseId, pageId: resolved.pageId, beatIndex: resolved.beatIndex } }
  catch { return { ...fallback } }
}
function chapterAt(value) { const phase = readerContent.find(item => item.id === value.phaseId); return phase?.pages.find(page => page.id === value.pageId)?.chapterId ?? firstPage?.chapterId ?? null }

export function createInitialProgressState() {
  return { currentView: 'landing', committedLocation: { ...READER_START_LOCATION }, furthestLocation: { ...READER_START_LOCATION }, readerStarted: false, readerCompleted: false, resumeRequested: false, readerExitGestureLearned: false, chapterTrialEnded: false, language: 'zh', hasInitializedLanguage: false, hasInitializedReadingMode: false, readingMode: 'immersive', themePosition: .5, standardTheme: 'soft', motionMode: 'full', currentChapter: chapterAt(READER_START_LOCATION), currentPage: READER_START_LOCATION.pageId, currentBeat: 0, readerScrollOffset: 0 }
}

export function sanitizeProgress(value) {
  const source = value && typeof value === 'object' ? value : {}
  const committedLocation = location(source.committedLocation)
  const furthestLocation = location(source.furthestLocation, committedLocation)
  const themePosition = migrateThemePosition(source.themePosition, source.standardTheme)
  return { ...createInitialProgressState(), currentView: ['reader', 'center'].includes(source.currentView) ? source.currentView : 'landing', committedLocation, furthestLocation, readerStarted: Boolean(source.readerStarted), readerCompleted: Boolean(source.readerCompleted), resumeRequested: Boolean(source.resumeRequested), readerExitGestureLearned: Boolean(source.readerExitGestureLearned ?? source.exitTutorialSeen), chapterTrialEnded: source.chapterTrialEnded === true, language: READER_LANGUAGE_CODES.includes(source.language) ? source.language : 'zh', hasInitializedLanguage: Boolean(source.hasInitializedLanguage), hasInitializedReadingMode: Boolean(source.hasInitializedReadingMode ?? source.hasInitializedLanguage), readingMode: ['immersive', 'standard'].includes(source.readingMode) ? source.readingMode : 'immersive', themePosition, standardTheme: legacyThemeName(themePosition), motionMode: ['full', 'reduced'].includes(source.motionMode) ? source.motionMode : 'full', currentChapter: chapterAt(committedLocation), currentPage: committedLocation.pageId, currentBeat: committedLocation.beatIndex, readerScrollOffset: Number.isFinite(source.readerScrollOffset) ? Math.max(0, source.readerScrollOffset) : 0 }
}

export function loadProgressState(storage) {
  for (const key of [PROGRESS_STORAGE_KEYS.V4, PROGRESS_STORAGE_KEYS.V3, PROGRESS_STORAGE_KEYS.V2, PROGRESS_STORAGE_KEYS.V1]) {
    try { const raw = storage?.getItem(key); if (raw) return sanitizeProgress(JSON.parse(raw)) } catch { /* try older key */ }
  }
  return null
}
export function saveProgressState(storage, state) { storage?.setItem(PROGRESS_STORAGE_KEYS.V4, JSON.stringify({ _version: PROGRESS_VERSION, ...sanitizeProgress(state) })) }
export function clearProgressStorage(storage) { Object.values(PROGRESS_STORAGE_KEYS).forEach(key => storage?.removeItem(key)); clearNarrativeProgressStorage(storage) }
