import { useState, useCallback, useRef, useEffect } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { createTimerRegistry } from './transitionUtils'

export const READING_ENTRY_TIMINGS = {
  FIRST_LANDING_LEAVE_MS: 1600,
  RETURN_LANDING_LEAVE_MS: 1600,
  LANG_LEAVING_MS: 1600,
  MODE_LEAVING_MS: 420,
  MIN_READER_MS: 3000,
  RESUME_READER_MS: 4720,
  TRANSITION_FADE_MS: 400,
  LANGUAGE_INIT_TITLE_DELAY_MS: 300,
}

export const REDUCED_READING_ENTRY_TIMINGS = {
  FIRST_LANDING_LEAVE_MS: 550,
  RETURN_LANDING_LEAVE_MS: 300,
  LANG_LEAVING_MS: 1000,
  MODE_LEAVING_MS: 420,
}

const { FIRST_LANDING_LEAVE_MS, RETURN_LANDING_LEAVE_MS, LANG_LEAVING_MS, MODE_LEAVING_MS, MIN_READER_MS, RESUME_READER_MS, TRANSITION_FADE_MS } = READING_ENTRY_TIMINGS

export function useReadingEntry(motionMode = 'full') {
  const [phase, setPhase] = useState('idle')
  const [intent, setIntent] = useState(null)

  const guardRef = useRef(false)
  const readyCalledRef = useRef(false)
  const startTimeRef = useRef(0)
  const intentRef = useRef(null)
  const phaseRef = useRef('idle')

  const timers = useRef(null)
  if (!timers.current) timers.current = createTimerRegistry()

  const syncPhase = useCallback((newPhase) => {
    phaseRef.current = newPhase
    setPhase(newPhase)
  }, [])

  const usesReducedTiming = useCallback(() => (
    motionMode === 'reduced'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  ), [motionMode])

  useEffect(() => {
    return () => timers.current.clearAll()
  }, [])

  const enterReaderView = useCallback((entryIntent) => {
    const store = useProgressStore.getState()
    if (entryIntent === 'start') {
      store.startReading()
    } else {
      store.continueReading()
    }
    startTimeRef.current = Date.now()
    syncPhase('reader-preparing')
  }, [syncPhase])

  const start = useCallback((entryIntent) => {
    if (guardRef.current) return
    guardRef.current = true
    readyCalledRef.current = false
    intentRef.current = entryIntent
    setIntent(entryIntent)
    syncPhase('landing-leaving')

    const store = useProgressStore.getState()
    if (!store.hasInitializedLanguage || !store.hasInitializedReadingMode) {
      timers.current.add(() => {
        syncPhase(store.hasInitializedLanguage ? 'mode-active' : 'language-active')
      }, usesReducedTiming() ? REDUCED_READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS : FIRST_LANDING_LEAVE_MS)
    } else {
      timers.current.add(() => {
        enterReaderView(entryIntent)
      }, usesReducedTiming() ? REDUCED_READING_ENTRY_TIMINGS.RETURN_LANDING_LEAVE_MS : RETURN_LANDING_LEAVE_MS)
    }
  }, [enterReaderView, syncPhase, usesReducedTiming])

  const proceedFromLanguage = useCallback(() => {
    if (phaseRef.current !== 'language-active') return
    syncPhase('language-leaving')

    timers.current.add(() => {
      const store = useProgressStore.getState()
      store.setInitializedLanguage()
      syncPhase('mode-active')
    }, usesReducedTiming() ? REDUCED_READING_ENTRY_TIMINGS.LANG_LEAVING_MS : LANG_LEAVING_MS)
  }, [syncPhase, usesReducedTiming])

  const proceedFromMode = useCallback((readingMode) => {
    if (phaseRef.current !== 'mode-active') return
    const store = useProgressStore.getState()
    if (!store.selectReadingMode(readingMode)) return
    syncPhase('mode-leaving')
    timers.current.add(() => {
      const currentIntent = intentRef.current || 'start'
      enterReaderView(currentIntent)
    }, usesReducedTiming() ? REDUCED_READING_ENTRY_TIMINGS.MODE_LEAVING_MS : MODE_LEAVING_MS)
  }, [enterReaderView, syncPhase, usesReducedTiming])

  const handleReaderReady = useCallback(() => {
    if (readyCalledRef.current) return
    if (phaseRef.current !== 'reader-preparing') return
    readyCalledRef.current = true

    const elapsed = Date.now() - startTimeRef.current
    const visibleDuration = intentRef.current === 'start' ? MIN_READER_MS : RESUME_READER_MS
    const remaining = Math.max(visibleDuration - elapsed, 0)

    timers.current.add(() => {
      syncPhase('transition-leaving')

      timers.current.add(() => {
        guardRef.current = false
        readyCalledRef.current = false
        intentRef.current = null
        setIntent(null)
        syncPhase('idle')
      }, TRANSITION_FADE_MS)
    }, remaining)
  }, [syncPhase])

  const cancel = useCallback(() => {
    timers.current.clearAll()
    guardRef.current = false
    readyCalledRef.current = false
    intentRef.current = null
    setIntent(null)
    syncPhase('idle')
  }, [syncPhase])

  return {
    phase,
    intent,
    start,
    proceedFromLanguage,
    proceedFromMode,
    handleReaderReady,
    cancel,
    isActive: phase !== 'idle',
  }
}
