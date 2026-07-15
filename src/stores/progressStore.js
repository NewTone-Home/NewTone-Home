import { create } from 'zustand'
import { isValidPhase, isAfter } from '../constants/phases'
import { comparePosition, resolvePosition } from '../reader/readerPosition'
import {
  clearProgressStorage,
  createInitialProgressState,
  loadProgressState,
  saveProgressState,
} from './progressMigration'

const VALID_CENTER_MODES = ['home', 'records', 'perspectives', 'fragments']
const VALID_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'es', 'id']

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
  ...(persisted || {}),

  startReading: () => {
    set({
      currentView: 'reader',
      currentReadingPhase: null,
      readerStarted: true,
      resumeRequested: false,
    })
  },

  continueReading: () => {
    set({ currentView: 'reader', readerStarted: true, resumeRequested: true })
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
    }
    if (comparePosition(committedLocation, state.furthestLocation) > 0) {
      updates.furthestLocation = { ...committedLocation }
    }
    set(updates)
    return true
  },

  setExitTutorialSeen: () => {
    set({ exitTutorialSeen: true })
  },

  setPhase: (phase) => {
    if (!isValidPhase(phase)) return
    const state = get()
    if (phase === state.currentReadingPhase) return
    const updates = { currentReadingPhase: phase, lastReadPhase: phase }
    if (isAfter(phase, state.maxReadPhase)) {
      updates.maxReadPhase = phase
    }
    set(updates)
  },

  completeM4: () => {
    const state = get()
    if (state.readerCompleted === true || state.centerUnlocked === true) return false
    set({
      currentReadingPhase: 'M4',
      maxReadPhase: 'M4',
      lastReadPhase: 'M4',
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

  setLastScrollY: (y) => {
    if (typeof y !== 'number' || !Number.isFinite(y)) return
    const clamped = Math.max(y, 0)
    const current = get().lastScrollY
    if (Math.abs(clamped - current) < 2) return
    set({ lastScrollY: clamped, legacyLastScrollY: clamped })
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
    set({ language: state.language === 'zh' ? 'en' : 'zh' })
  },

  setInitializedLanguage: () => {
    set({ hasInitializedLanguage: true })
  },

  reset: () => {
    clearProgressStorage(storage)
    set(createInitialProgressState())
  },
}))

useProgressStore.subscribe((state, previousState) => {
  if (state !== previousState) {
    saveProgressState(storage, state)
  }
})
