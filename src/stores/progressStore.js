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

  clearResumeRequest: () => {
    set({ resumeRequested: false })
  },

  commitLocation: (location) => {
    let committedLocation
    try {
      committedLocation = persistedLocation(location)
    } catch {
      return false
    }

    const state = get()
    const updates = {
      committedLocation,
      readerStarted: true,
      currentChapter: 'chapter-1',
      currentPage: committedLocation.pageId,
      currentBeat: committedLocation.beatIndex,
    }
    if (comparePosition(committedLocation, state.furthestLocation) > 0) {
      updates.furthestLocation = { ...committedLocation }
    }
    set(updates)
    return true
  },

  setReaderExitGestureLearned: () => {
    set({ readerExitGestureLearned: true })
  },

  endChapterTrial: () => set({ chapterTrialEnded: true }),

  completeReader: () => {
    const state = get()
    if (state.readerCompleted === true) return false
    set({
      readerCompleted: true,
      centerUnlocked: true,
    })
    return true
  },

  enterCenter: () => {
    const state = get()
    if (state.centerUnlocked !== true) return
    set({ currentView: 'center', centerMode: 'home' })
  },

  returnToCenter: () => {
    set({ currentView: 'center', centerMode: 'home' })
  },

  goLanding: () => {
    set({ currentView: 'landing' })
  },

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

  setLanguage: (lang) => {
    if (!VALID_LANGUAGES.includes(lang)) return
    set({ language: lang })
  },

  toggleLanguage: () => {
    const state = get()
    set({ language: getNextReaderLanguage(state.language).code })
  },

  setInitializedLanguage: () => {
    set({ hasInitializedLanguage: true })
  },

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
  if (state !== previousState) {
    saveProgressState(storage, state)
  }
})
