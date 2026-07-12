import { create } from 'zustand'
import { isValidPhase, isAfter } from '../constants/phases'

const STORAGE_KEY = 'newtone-progress-v1'
const VERSION = 1
const VALID_VIEWS = ['landing', 'reader', 'center']
const PERSISTED_KEYS = ['currentView', 'maxReadPhase', 'lastReadPhase', 'lastScrollY', 'centerUnlocked', 'centerMode', 'language', 'hasInitializedLanguage']

const VALID_CENTER_MODES = ['home', 'records', 'perspectives', 'fragments']
const VALID_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'es', 'id']

const initialState = {
  currentView: 'landing',
  currentReadingPhase: null,
  maxReadPhase: null,
  lastReadPhase: null,
  lastScrollY: 0,
  centerUnlocked: false,
  centerMode: 'home',
  resumeRequested: false,
  language: 'zh',
  hasInitializedLanguage: false,
}

function sanitizePersisted(data) {
  const clean = {}

  if (data.maxReadPhase === null || isValidPhase(data.maxReadPhase)) {
    clean.maxReadPhase = data.maxReadPhase ?? null
  } else {
    clean.maxReadPhase = null
  }

  if (data.lastReadPhase === null || isValidPhase(data.lastReadPhase)) {
    clean.lastReadPhase = data.lastReadPhase ?? null
  } else {
    clean.lastReadPhase = null
  }

  clean.lastScrollY = typeof data.lastScrollY === 'number' && Number.isFinite(data.lastScrollY)
    ? Math.max(data.lastScrollY, 0)
    : 0

  if (VALID_CENTER_MODES.includes(data.centerMode)) {
    clean.centerMode = data.centerMode
  } else {
    clean.centerMode = 'home'
  }

  clean.centerUnlocked = Boolean(data.centerUnlocked)

  if (clean.centerUnlocked && clean.maxReadPhase !== 'M4') {
    clean.maxReadPhase = 'M4'
  }
  if (clean.maxReadPhase === 'M4' && !clean.centerUnlocked) {
    clean.centerUnlocked = true
  }

  clean.currentView =
    VALID_VIEWS.includes(data.currentView)
      ? data.currentView
      : 'landing'

  if (clean.currentView === 'center' && !clean.centerUnlocked) {
    clean.currentView = 'landing'
  }

  if (clean.currentView === 'reader') {
    clean.resumeRequested = true
  }

  clean.language = VALID_LANGUAGES.includes(data.language) ? data.language : 'zh'
  clean.hasInitializedLanguage = Boolean(data.hasInitializedLanguage)

  return clean
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data._version !== VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return sanitizePersisted(data)
  } catch {
    return null
  }
}

function savePersisted(state) {
  const toStore = { _version: VERSION }
  for (const key of PERSISTED_KEYS) {
    toStore[key] = state[key]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
}

const persisted = loadPersisted()

export const useProgressStore = create((set, get) => ({
  ...initialState,
  ...(persisted || {}),

  startReading: () => {
    set({ currentView: 'reader', currentReadingPhase: null, resumeRequested: false })
  },

  continueReading: () => {
    set({ currentView: 'reader', resumeRequested: true })
  },

  clearResumeRequest: () => {
    set({ resumeRequested: false })
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
    set({ currentReadingPhase: 'M4', maxReadPhase: 'M4', lastReadPhase: 'M4', centerUnlocked: true })
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
      window.history.replaceState({ newtoneView: 'landing' }, '')
      set({ currentView: 'landing' })
      return
    }
    if (view === 'reader') {
      set({ currentView: 'reader', resumeRequested: true })
      return
    }
    set({ currentView: view })
  },

  setLastScrollY: (y) => {
    if (typeof y !== 'number' || !Number.isFinite(y)) return
    const clamped = Math.max(y, 0)
    const current = get().lastScrollY
    if (Math.abs(clamped - current) < 2) return
    set({ lastScrollY: clamped })
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
    localStorage.removeItem(STORAGE_KEY)
    set({ ...initialState })
  },
}))

useProgressStore.subscribe((state, prevState) => {
  const changed = PERSISTED_KEYS.some(key => state[key] !== prevState[key])
  if (changed) savePersisted(state)
})
