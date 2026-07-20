import { create } from 'zustand'
import { useProgressStore } from './progressStore'
import { getDefinition } from '../transitions/transitionDefinitions'

let activeTimers = []

function clearAllTimers() {
  activeTimers.forEach(clearTimeout)
  activeTimers = []
}

export const useTransitionStore = create((set, get) => ({
  phase: 'idle',
  targetView: null,
  preset: 'fade-cover',
  payload: null,

  transitionTo(targetView, options = {}) {
    const { phase } = get()
    if (phase !== 'idle') return

    clearAllTimers()

    const preset = options.preset || 'fade-cover'
    const def = getDefinition(preset)
    const timings = def.timings

    set({
      phase: 'leaving',
      targetView,
      preset,
      payload: options.payload || null,
    })

    const t1 = setTimeout(() => {
      if (get().phase !== 'leaving') return

      const progress = useProgressStore.getState()
      if (targetView === 'center') {
        if (preset === 'reader-to-core') progress.returnToCenter()
        else progress.enterCenter()
      } else if (targetView === 'landing') {
        progress.goLanding()
      } else if (targetView === 'reader') {
        const mode = options.payload?.mode || 'continue'
        if (mode === 'continue') {
          progress.continueReading()
        } else {
          progress.startReading()
        }
      }

      set({ phase: 'covered' })

      const t2 = setTimeout(() => {
        if (get().phase !== 'covered') return
        set({ phase: 'entering' })

        const t3 = setTimeout(() => {
          if (get().phase !== 'entering') return
          set({
            phase: 'idle',
            targetView: null,
            preset: 'fade-cover',
            payload: null,
          })
        }, timings.entering)
        activeTimers.push(t3)
      }, timings.coveredHold)
      activeTimers.push(t2)
    }, timings.leaving)
    activeTimers.push(t1)
  },

  reset() {
    clearAllTimers()
    set({
      phase: 'idle',
      targetView: null,
      preset: 'fade-cover',
      payload: null,
    })
  },
}))
