import { useState, useCallback, useRef, useEffect } from 'react'
import { useProgressStore } from '../stores/progressStore'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import { createTimerRegistry } from './transitionUtils'

export const READING_ENTRY_TIMINGS = {
  FIRST_LANDING_LEAVE_MS: 1600,
  RETURN_LANDING_LEAVE_MS: 1600,
  LANG_LEAVING_MS: 420,
  MODE_LEAVING_MS: 420,
  TRANSITION_FADE_MS: 400,
  LANGUAGE_INIT_TITLE_DELAY_MS: 300,
}

export const REDUCED_READING_ENTRY_TIMINGS = {
  FIRST_LANDING_LEAVE_MS: 550,
  RETURN_LANDING_LEAVE_MS: 300,
  LANG_LEAVING_MS: 1000,
  MODE_LEAVING_MS: 420,
}

const { FIRST_LANDING_LEAVE_MS, RETURN_LANDING_LEAVE_MS, LANG_LEAVING_MS, MODE_LEAVING_MS, TRANSITION_FADE_MS } = READING_ENTRY_TIMINGS

export function useReadingEntry(motionMode = 'full') {
  const [phase, setPhase] = useState('idle')
  const [intent, setIntent] = useState(null)

  const guardRef = useRef(false)
  const readerReadyRef = useRef(false)
  const transitionReadyRef = useRef(false)
  const handoffLeavingRef = useRef(false)
  const intentRef = useRef(null)
  const phaseRef = useRef('idle')

  const timers = useRef(null)
  if (!timers.current) timers.current = createTimerRegistry()

  const syncPhase = useCallback((newPhase) => {
    phaseRef.current = newPhase
    recordRuntimeAudit('reader-entry-phase', { phase: newPhase, intent: intentRef.current })
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
    readerReadyRef.current = false
    transitionReadyRef.current = false
    handoffLeavingRef.current = false
    syncPhase('reader-preparing')
  }, [syncPhase])

  const start = useCallback((entryIntent) => {
    if (guardRef.current) return
    guardRef.current = true
    readerReadyRef.current = false
    transitionReadyRef.current = false
    handoffLeavingRef.current = false
    intentRef.current = entryIntent
    setIntent(entryIntent)
    syncPhase('landing-leaving')

    const store = useProgressStore.getState()
    if (!store.hasInitializedLanguage) {
      timers.current.add(() => {
        syncPhase('language-active')
      }, usesReducedTiming() ? REDUCED_READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS : FIRST_LANDING_LEAVE_MS)
    } else {
      if (!store.hasInitializedReadingMode) store.selectReadingMode('standard')
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
      store.selectReadingMode('standard')
      enterReaderView(intentRef.current || 'start')
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

  const maybeLeaveReader = useCallback(() => {
    if (phaseRef.current !== 'reader-preparing') return
    if (!readerReadyRef.current || !transitionReadyRef.current) return
    if (handoffLeavingRef.current) return

    handoffLeavingRef.current = true
    syncPhase('transition-leaving')

    timers.current.add(() => {
      guardRef.current = false
      readerReadyRef.current = false
      transitionReadyRef.current = false
      handoffLeavingRef.current = false
      intentRef.current = null
      setIntent(null)
      syncPhase('idle')
    }, TRANSITION_FADE_MS)
  }, [syncPhase])

  const handleReaderReady = useCallback(() => {
    if (phaseRef.current !== 'reader-preparing' || readerReadyRef.current) return
    readerReadyRef.current = true
    recordRuntimeAudit('reader-ready', { intent: intentRef.current })
    maybeLeaveReader()
  }, [maybeLeaveReader])

  const handleTransitionReady = useCallback(() => {
    if (phaseRef.current !== 'reader-preparing' || transitionReadyRef.current) return
    transitionReadyRef.current = true
    recordRuntimeAudit('reader-transition-ready', { intent: intentRef.current })
    maybeLeaveReader()
  }, [maybeLeaveReader])

  const cancel = useCallback(() => {
    timers.current.clearAll()
    guardRef.current = false
    readerReadyRef.current = false
    transitionReadyRef.current = false
    handoffLeavingRef.current = false
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
    handleTransitionReady,
    cancel,
    isActive: phase !== 'idle',
  }
}
