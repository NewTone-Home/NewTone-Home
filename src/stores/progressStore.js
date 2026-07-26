import { create } from 'zustand'
import { comparePosition, resolvePosition } from '../reader/readerPosition'
import {
  clearProgressStorage,
  createInitialProgressState,
  loadProgressState,
  saveProgressState,
} from './progressMigration'
import { getNextReaderLanguage, READER_LANGUAGE_CODES } from '../i18n/languages'
import { clampThemePosition, legacyThemeName, migrateThemePosition } from '../reader/readerTheme'
import { getActiveCenterDefinition } from '../center-next/domain/definitionRegistry'
import { resolveCenterWorld } from '../center-next/domain/worldResolver'
import {
  createDefaultCenterViewSnapshot,
  normalizeCenterCamera,
  normalizeCenterViewSnapshot,
  normalizeCenterWorldSnapshot,
} from '../center-next/domain/invariants'

const VALID_CENTER_MODES = ['home', 'records', 'perspectives', 'fragments']
const VALID_LANGUAGES = READER_LANGUAGE_CODES

const initialState = createInitialProgressState()
const storage = typeof localStorage === 'undefined' ? null : localStorage
const persisted = loadProgressState(storage)

function persistedLocation(location) {
  const resolved = resolvePosition(location)
  return {
    phaseId: resolved.phaseId,
    pageId: resolved.pageId,
    beatIndex: resolved.beatIndex,
  }
}

function resolveWorldForState(state, committedLocation, furthestLocation) {
  try {
    const definition = getActiveCenterDefinition()
    if (definition.id !== state.centerContentPackageId) return state.centerWorldSnapshot
    return resolveCenterWorld({
      definition,
      committedLocation,
      furthestLocation,
      visitedLandmarkIds: state.centerWorldSnapshot?.visitedLandmarkIds,
    })
  } catch {
    return state.centerWorldSnapshot
  }
}

export const useProgressStore = create((set, get) => ({
  ...initialState,
  ...persisted,
  isFirstReaderSession: false,

  startReading: () => {
    const state = get()
    set({
      currentView: 'reader',
      readerStarted: true,
      resumeRequested: false,
      isFirstReaderSession: state.readerStarted !== true,
    })
  },

  continueReading: () => {
    set({
      currentView: 'reader',
      readerStarted: true,
      resumeRequested: true,
      isFirstReaderSession: false,
    })
  },

  clearResumeRequest: () => set({ resumeRequested: false }),

  commitLocation: (location) => {
    let committedLocation
    try {
      committedLocation = persistedLocation(location)
    } catch {
      return false
    }

    const state = get()
    const furthestLocation = comparePosition(committedLocation, state.furthestLocation) > 0
      ? { ...committedLocation }
      : state.furthestLocation
    const centerWorldSnapshot = resolveWorldForState(state, committedLocation, furthestLocation)

    set({
      committedLocation,
      furthestLocation,
      centerWorldSnapshot,
      readerStarted: true,
      currentChapter: 'chapter-1',
      currentPage: committedLocation.pageId,
      currentBeat: committedLocation.beatIndex,
    })
    return true
  },

  setReaderExitGestureLearned: () => set({ readerExitGestureLearned: true }),
  endChapterTrial: () => set({ chapterTrialEnded: true }),

  completeReader: () => {
    const state = get()
    if (state.readerCompleted === true) return false
    set({
      readerCompleted: true,
      centerUnlocked: true,
      centerWorldSnapshot: resolveWorldForState(
        state,
        state.committedLocation,
        state.furthestLocation,
      ),
    })
    return true
  },

  enterCenter: () => {
    const state = get()
    if (state.centerUnlocked !== true) return false
    set({ currentView: 'center', centerMode: 'home' })
    return true
  },

  returnToCenter: () => {
    const state = get()
    const returningFromReader = state.currentView === 'reader'
    if (!returningFromReader && state.centerUnlocked !== true) return false
    set({
      currentView: 'center',
      centerMode: 'home',
      centerUnlocked: true,
      centerWorldSnapshot: state.centerWorldSnapshot ?? resolveWorldForState(
        state,
        state.committedLocation,
        state.furthestLocation,
      ),
    })
    return true
  },

  goLanding: () => set({ currentView: 'landing' }),

  setViewFromHistory: (view) => {
    if (!['landing', 'reader', 'center'].includes(view)) view = 'landing'
    const state = get()
    if (view === 'center' && state.centerUnlocked !== true) {
      set({ currentView: 'landing' })
      return
    }
    if (view === 'reader') {
      set({ currentView: 'reader', readerStarted: true, resumeRequested: true })
      return
    }
    set({ currentView: view })
  },

  setCenterMode: (mode) => {
    if (!VALID_CENTER_MODES.includes(mode)) mode = 'home'
    set({ centerMode: mode })
  },

  setCenterContentPackage: (centerContentPackageId) => {
    if (typeof centerContentPackageId !== 'string' || centerContentPackageId.length === 0) return false
    set({
      centerContentPackageId,
      centerWorldSnapshot: null,
      centerViewSnapshot: createDefaultCenterViewSnapshot(),
    })
    return true
  },

  setCenterWorldSnapshot: (snapshot) => {
    const centerWorldSnapshot = normalizeCenterWorldSnapshot(snapshot)
    if (!centerWorldSnapshot) return false
    set({ centerWorldSnapshot })
    return true
  },

  refreshCenterWorld: () => {
    const state = get()
    const centerWorldSnapshot = resolveWorldForState(
      state,
      state.committedLocation,
      state.furthestLocation,
    )
    if (!centerWorldSnapshot) return false
    set({ centerWorldSnapshot })
    return true
  },

  visitCenterLandmark: (landmarkId) => {
    if (typeof landmarkId !== 'string' || landmarkId.length === 0) return false
    const state = get()
    const world = state.centerWorldSnapshot
    if (!world || !world.unlockedLandmarkIds.includes(landmarkId)) return false
    if (world.visitedLandmarkIds.includes(landmarkId)) return true
    set({
      centerWorldSnapshot: {
        ...world,
        visitedLandmarkIds: [...world.visitedLandmarkIds, landmarkId],
      },
    })
    return true
  },

  updateCenterView: (partial) => {
    const state = get()
    set({
      centerViewSnapshot: normalizeCenterViewSnapshot({
        ...state.centerViewSnapshot,
        ...partial,
      }),
    })
  },

  commitCenterCamera: (camera) => {
    const normalized = normalizeCenterCamera(camera)
    if (!normalized) return false
    const state = get()
    set({
      centerViewSnapshot: normalizeCenterViewSnapshot({
        ...state.centerViewSnapshot,
        camera: normalized,
      }),
    })
    return true
  },

  selectCenterLandmark: (selectedLandmarkId) => {
    const state = get()
    set({
      centerViewSnapshot: normalizeCenterViewSnapshot({
        ...state.centerViewSnapshot,
        selectedLandmarkId: typeof selectedLandmarkId === 'string' ? selectedLandmarkId : null,
      }),
    })
  },

  resetCenterView: () => set({ centerViewSnapshot: createDefaultCenterViewSnapshot() }),

  setLanguage: (lang) => {
    if (!VALID_LANGUAGES.includes(lang)) return
    set({ language: lang })
  },

  toggleLanguage: () => {
    const state = get()
    set({ language: getNextReaderLanguage(state.language).code })
  },

  setInitializedLanguage: () => set({ hasInitializedLanguage: true }),

  selectReadingMode: (readingMode) => {
    if (!['immersive', 'standard'].includes(readingMode)) return false
    set({
      readingMode,
      hasInitializedReadingMode: true,
      themePosition: migrateThemePosition(get().themePosition, get().standardTheme),
      standardTheme: legacyThemeName(migrateThemePosition(get().themePosition, get().standardTheme)),
    })
    return true
  },

  toggleReadingMode: () => {
    set({ readingMode: get().readingMode === 'immersive' ? 'standard' : 'immersive' })
  },

  setStandardTheme: (standardTheme) => {
    if (!['soft', 'light', 'dark'].includes(standardTheme)) return false
    const themePosition = migrateThemePosition(standardTheme)
    set({ themePosition, standardTheme })
    return true
  },

  setThemePosition: (value) => {
    const themePosition = clampThemePosition(value)
    set({ themePosition, standardTheme: legacyThemeName(themePosition) })
    return true
  },

  toggleMotionMode: () => {
    set({ motionMode: get().motionMode === 'full' ? 'reduced' : 'full' })
  },

  reset: () => {
    clearProgressStorage(storage)
    set({ ...createInitialProgressState(), isFirstReaderSession: false })
  },
}))

useProgressStore.subscribe((state, previousState) => {
  if (state !== previousState) saveProgressState(storage, state)
})
