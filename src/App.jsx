import { useCallback, useEffect, useRef } from 'react'
import { useProgressStore } from './stores/progressStore'
import { useTransitionStore } from './stores/transitionStore'
import { useReadingEntry, READING_ENTRY_TIMINGS } from './transitions/readingEntryController'
import { setHoldProgressPaused } from './interactions/holdProgress'
import { resolveRitualWheelAction } from './interactions/ritualWheelAdvance'
import Landing from './views/Landing'
import Reader from './views/ReaderOrchestrator'
import AdminSequenceGate from './admin/AdminSequenceGate'
import ReadingTransition from './components/ReadingTransition'
import './components/ReadingTransitionHover.css'
import GlobalTransitionOverlay from './components/GlobalTransitionOverlay'
import PageShell from './components/PageShell'
import { resolveReaderEnvironmentState } from './data/readerContent'
import { resolveReaderEnvironmentPreview } from './data/reader-experiments/readerEnvironmentPreview'
import { getReaderThemeVariables } from './reader/readerTheme'
import { trackEvent } from './services/analytics'

function App({ contentStatus = 'ready', onRetryContent }) {
  const currentView = useProgressStore(s => s.currentView)
  const language = useProgressStore(s => s.language)
  const hasInitializedLanguage = useProgressStore(s => s.hasInitializedLanguage)
  const readingMode = useProgressStore(s => s.readingMode)
  const themePosition = useProgressStore(s => s.themePosition)
  const motionMode = useProgressStore(s => s.motionMode)
  const committedLocation = useProgressStore(s => s.committedLocation)
  const environmentState = resolveReaderEnvironmentState(committedLocation)
  const readerSurfaceStyle = readingMode === 'standard'
    ? getReaderThemeVariables(themePosition)
    : resolveReaderEnvironmentPreview(environmentState).style

  const readingEntry = useReadingEntry()
  const isGlobalTransitioning = useTransitionStore(s => s.phase !== 'idle')

  const historyPushRef = useRef(true)
  const readingEntryRef = useRef(readingEntry)
  readingEntryRef.current = readingEntry
  const restoringBlockedHistoryRef = useRef(false)
  const ritualWheelLockedRef = useRef(false)

  useEffect(() => {
    if (!window.history.state?.newtoneView) {
      const stableView = useProgressStore.getState().currentView
      window.history.replaceState({ newtoneView: stableView }, '')
    }
  }, [])

  useEffect(() => {
    const handlePopState = (event) => {
      if (restoringBlockedHistoryRef.current) {
        restoringBlockedHistoryRef.current = false
        return
      }

      const ctrl = readingEntryRef.current

      const isFirstInitHistoryLocked = [
        'landing-empty-hold',
        'language-active',
        'language-leaving',
        'mode-active',
        'mode-leaving',
      ].includes(ctrl.phase)

      if (isFirstInitHistoryLocked) {
        restoringBlockedHistoryRef.current = true
        history.forward()
        return
      }

      historyPushRef.current = false
      const requestedView = event.state?.newtoneView || 'landing'
      const view = requestedView === 'reader' ? 'reader' : 'landing'

      if (useProgressStore.getState().currentView === 'reader' && view === 'landing') {
        trackEvent('reader_exit', { exitReason: 'browser-back' })
      }

      if (ctrl.isActive) {
        ctrl.cancel()
      }

      const tState = useTransitionStore.getState()
      if (tState.phase !== 'idle') {
        tState.reset()
      }

      useProgressStore.getState().setViewFromHistory(view)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!historyPushRef.current) {
      historyPushRef.current = true
      return
    }
    if (window.history.state?.newtoneView === currentView) return
    window.history.pushState({ newtoneView: currentView }, '')
  }, [currentView])

  useEffect(() => {
    if (currentView === 'landing') trackEvent('landing_entry', { stepId: 'landing' })
  }, [currentView])

  useEffect(() => {
    const wheelSelectorActive = readingEntry.phase === 'language-active' || readingEntry.phase === 'mode-active'
    ritualWheelLockedRef.current = false
    setHoldProgressPaused(wheelSelectorActive)
    return () => setHoldProgressPaused(false)
  }, [readingEntry.phase])

  useEffect(() => {
    const handleRitualWheel = event => {
      if (ritualWheelLockedRef.current) return

      const selectorOption = event.target?.closest?.('[data-selector-option]')?.dataset?.selectorOption
      const ctrl = readingEntryRef.current
      const action = resolveRitualWheelAction(ctrl.phase, selectorOption, event.deltaY)
      if (!action) return

      event.preventDefault()
      event.stopPropagation()
      ritualWheelLockedRef.current = true

      if (action.type === 'language') {
        const selectedLanguage = useProgressStore.getState().language
        trackEvent('language_selected', { language: selectedLanguage })
        ctrl.proceedFromLanguage()
        return
      }

      trackEvent('mode_selected', { readingMode: action.mode })
      ctrl.proceedFromMode(action.mode)
    }

    window.addEventListener('wheel', handleRitualWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleRitualWheel, { capture: true })
  }, [])

  const handleEnter = useCallback((intent) => {
    if (readingEntry.isActive || isGlobalTransitioning) return
    readingEntry.start(intent)
  }, [readingEntry.isActive, readingEntry.start, isGlobalTransitioning])

  const readingEntryLandingLeaving =
    readingEntry.phase === 'landing-leaving' ||
    readingEntry.phase === 'landing-empty-hold'

  const readingEntryNeedsReader =
    readingEntry.phase === 'reader-preparing' ||
    readingEntry.phase === 'transition-leaving'

  const showReader =
    currentView === 'reader' &&
    (!readingEntry.isActive || readingEntryNeedsReader)

  const showLanding =
    currentView === 'landing' &&
    (!readingEntry.isActive || readingEntryLandingLeaving)

  const isFirstTimeLeaving = readingEntry.phase === 'landing-leaving' && !hasInitializedLanguage
  const landingLeaveMs = isFirstTimeLeaving ? READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS : READING_ENTRY_TIMINGS.RETURN_LANDING_LEAVE_MS

  const handleLanguageProceed = useCallback(() => {
    trackEvent('language_selected', { language })
    readingEntry.proceedFromLanguage()
  }, [language, readingEntry.proceedFromLanguage])

  const handleModeSelect = useCallback((mode) => {
    trackEvent('mode_selected', { readingMode: mode })
    readingEntry.proceedFromMode(mode)
  }, [readingEntry.proceedFromMode])

  return (
    <>
      <PageShell motionMode={motionMode} surfaceStyle={readerSurfaceStyle}>
        {showReader && <Reader contentStatus={contentStatus} onRetryContent={onRetryContent} onReaderReady={readingEntry.isActive ? readingEntry.handleReaderReady : undefined} />}
        {showLanding && (
          <Landing
            onEnter={handleEnter}
            leaving={readingEntryLandingLeaving}
            leavingMs={landingLeaveMs}
            surfaceStyle={readerSurfaceStyle}
            readingMode={readingMode}
            environmentState={environmentState}
          />
        )}
      </PageShell>
      <ReadingTransition
        phase={readingEntry.phase}
        intent={readingEntry.intent}
        language={language}
        readingMode={readingMode}
        themePosition={themePosition}
        motionMode={motionMode}
        surfaceStyle={readerSurfaceStyle}
        environmentState={environmentState}
        onProceed={handleLanguageProceed}
        onModeSelect={handleModeSelect}
      />
      {isGlobalTransitioning && <GlobalTransitionOverlay surfaceStyle={readerSurfaceStyle} />}
      <AdminSequenceGate />
    </>
  )
}

export default App
