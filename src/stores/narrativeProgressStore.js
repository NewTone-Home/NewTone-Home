import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import {
  beginNarrativeEvent,
  clearNarrativeProgressStorage,
  completeNarrativeEvent,
  completeSkippedNarrativeEvent,
  createInitialNarrativeProgressState,
  loadNarrativeProgressState,
  saveNarrativeProgressState,
} from './narrativeProgressStorage'

const browserStorage = typeof localStorage === 'undefined' ? null : localStorage

function narrativeProgressStateCreator(storage) {
  return (set, get) => ({
    ...createInitialNarrativeProgressState(),
    initialized: false,

    initialize: (readerProgress) => {
      const loaded = loadNarrativeProgressState(storage, readerProgress)
      set({ ...loaded, initialized: true })
      return loaded
    },

    beginEvent: (eventId) => {
      const next = beginNarrativeEvent(get(), eventId)
      set(next)
      saveNarrativeProgressState(storage, next)
      return next
    },

    completeEvent: (eventId) => {
      const next = completeNarrativeEvent(get(), eventId)
      set(next)
      saveNarrativeProgressState(storage, next)
      return next
    },

    completeSkippedEvent: (eventId) => {
      const next = completeSkippedNarrativeEvent(get(), eventId)
      set(next)
      saveNarrativeProgressState(storage, next)
      return next
    },

    reset: () => {
      set({ ...createInitialNarrativeProgressState(), initialized: true })
      clearNarrativeProgressStorage(storage)
    },
  })
}

export function createNarrativeProgressStore(storage) {
  return createStore(narrativeProgressStateCreator(storage))
}

export const useNarrativeProgressStore = create(narrativeProgressStateCreator(browserStorage))
