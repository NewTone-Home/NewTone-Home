import { create } from 'zustand'
import { useProgressStore } from './progressStore'
import { getDefinition } from '../transitions/transitionDefinitions'

let activeTimers = []
const READER_LANDING_HANDOFF_MS = 760

function clearAllTimers() {
  activeTimers.forEach(clearTimeout)
  activeTimers = []
}

function schedule(callback, delay) {
  const timer = setTimeout(() => {
    activeTimers = activeTimers.filter(candidate => candidate !== timer)
    callback()
  }, delay)
  activeTimers.push(timer)
  return timer
}

function commitTargetView(targetView, preset, payload) {
  const progress = useProgressStore.getState()
  if (targetView === 'landing') {
    progress.goLanding()
    return true
  }
  if (targetView === 'reader') {
    const mode = payload?.mode || 'continue'
    if (mode === 'continue') progress.continueReading()
    else progress.startReading()
    return true
  }
  if (targetView === 'center') {
    progress.goCenter()
    return true
  }
  return false
}

export const useTransitionStore = create((set, get) => ({
  phase: 'idle',
  targetView: null,
  preset: 'fade-cover',
  payload: null,
  waitingForTarget: false,
  landingArrivalKind: null,

  clearLandingArrival() {
    if (get().landingArrivalKind !== null) set({ landingArrivalKind: null })
  },

  beginEntering() {
    const state = get()
    if (state.phase !== 'covered') return false
    const timings = getDefinition(state.preset).timings
    set({ phase: 'entering', waitingForTarget: false })
    schedule(() => {
      if (get().phase !== 'entering') return
      set({
        phase: 'idle',
        targetView: null,
        preset: 'fade-cover',
        payload: null,
        waitingForTarget: false,
      })
    }, timings.entering)
    return true
  },

  notifyTargetReady(view) {
    const state = get()
    if (state.phase !== 'covered' || !state.waitingForTarget || state.targetView !== view) return false
    const timings = getDefinition(state.preset).timings
    set({ waitingForTarget: false })
    schedule(() => get().beginEntering(), timings.coveredHold)
    return true
  },

  transitionTo(targetView, options = {}) {
    if (get().phase !== 'idle') return false
    clearAllTimers()

    const preset = options.preset || 'fade-cover'
    const payload = options.payload || null

    // Keep the Reader mounted while the real Landing surface is pre-mounted and
    // fades in. This removes the route-level flash without introducing a second
    // NewTone transition mark.
    if (targetView === 'landing' && preset === 'reader-to-surface') {
      set({
        phase: 'handoff',
        targetView,
        preset,
        payload,
        waitingForTarget: false,
        landingArrivalKind: 'return',
      })
      schedule(() => {
        if (get().phase !== 'handoff' || get().targetView !== targetView) return
        const committed = commitTargetView(targetView, preset, payload)
        if (committed === false) {
          get().reset()
          return
        }
        set({
          phase: 'idle',
          targetView: null,
          preset: 'fade-cover',
          payload: null,
          waitingForTarget: false,
        })
      }, READER_LANDING_HANDOFF_MS)
      return true
    }

    const timings = getDefinition(preset).timings
    const waitForReady = options.waitForReady ?? false
    const readyTimeoutMs = Math.max(500, options.readyTimeoutMs || 4500)

    set({
      phase: 'leaving',
      targetView,
      preset,
      payload,
      waitingForTarget: false,
      landingArrivalKind: null,
    })

    schedule(() => {
      if (get().phase !== 'leaving') return
      const committed = commitTargetView(targetView, preset, payload)
      if (committed === false) {
        get().reset()
        return
      }

      set({ phase: 'covered', waitingForTarget: waitForReady })
      if (!waitForReady) {
        schedule(() => get().beginEntering(), timings.coveredHold)
        return
      }

      schedule(() => {
        const state = get()
        if (state.phase === 'covered' && state.waitingForTarget && state.targetView === targetView) {
          set({ waitingForTarget: false })
          get().beginEntering()
        }
      }, readyTimeoutMs)
    }, timings.leaving)

    return true
  },

  reset() {
    clearAllTimers()
    set({
      phase: 'idle',
      targetView: null,
      preset: 'fade-cover',
      payload: null,
      waitingForTarget: false,
      landingArrivalKind: null,
    })
  },
}))
