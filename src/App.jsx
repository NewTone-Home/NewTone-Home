import { useCallback, useEffect, useRef } from 'react'
import { useProgressStore } from './stores/progressStore'
import { useTransitionStore } from './stores/transitionStore'
import { useReadingEntry } from './transitions/readingEntryController'
import { resolveEntryBlockedStepId, useEntryFrictionTracking } from './hooks/useEntryFrictionTracking'
import Reader from './views/ReaderOrchestrator'
import AdminSequenceGate from './admin/AdminSequenceGate'
import EntrySurface from './components/EntrySurface'
import GlobalTransitionOverlay from './components/GlobalTransitionOverlay'
import PageShell from './components/PageShell'
import { resolveReaderEnvironmentState } from './data/readerContent'
import { resolveReaderEnvironmentPreview } from './data/reader-experiments/readerEnvironmentPreview'
import { getReaderThemeVariables } from './reader/readerTheme'
import { trackEvent } from './services/analytics'
import { recordRuntimeAudit } from './services/runtimeAudit'

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

  const readingEntry = useReadingEntry(motionMode)
  const globalTransitionPhase = useTransitionStore(s => s.phase)
  const globalTransitionTargetView = useTransitionStore(s => s.targetView)
  const isGlobalTransitioning = globalTransitionPhase !== 'idle'
  useEntryFrictionTracking(readingEntry.phase, { language, readingMode })

  const historyPushRef = useRef(true)
  const readingEntryRef = useRef(readingEntry)
  readingEntryRef.current = readingEntry
  const restoringBlockedHistoryRef = useRef(false)

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
      const currentStableView = useProgressStore.getState().currentView
      const readerReturningToLanding = currentStableView === 'reader' && view === 'landing'

      if (readerReturningToLanding) {
        trackEvent('reader_exit', { exitReason: 'browser_back' })
      }

      if (ctrl.isActive) ctrl.cancel()

      const tState = useTransitionStore.getState()
      if (tState.phase !== 'idle') tState.reset()

      if (readerReturningToLanding) {
        tState.transitionTo('landing', { preset: 'reader-to-surface', waitForReady: false })
        return
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

  const handleEnter = useCallback((intent) => {
    if (readingEntry.isActive || isGlobalTransitioning) {
      trackEvent('entry_blocked', {
        stepId: resolveEntryBlockedStepId(readingEntry.phase, isGlobalTransitioning),
        language: hasInitializedLanguage ? language : undefined,
        readingMode: hasInitializedLanguage ? readingMode : undefined,
      })
      return
    }
    trackEvent('reader_entry_requested', {
      stepId: `entry:${intent}`,
      language: hasInitializedLanguage ? language : undefined,
      readingMode: hasInitializedLanguage ? readingMode : undefined,
    })
    readingEntry.start(intent)
  }, [hasInitializedLanguage, isGlobalTransitioning, language, readingEntry.isActive, readingEntry.phase, readingEntry.start, readingMode])

  const readingEntryNeedsReader =
    readingEntry.phase === 'reader-preparing' ||
    readingEntry.phase === 'transition-leaving'

  const showReader =
    currentView === 'reader' &&
    (!readingEntry.isActive || readingEntryNeedsReader)

  const readerEntryHandoffPhase = readingEntry.phase === 'reader-preparing'
    || readingEntry.phase === 'transition-leaving'
    ? readingEntry.phase
    : 'idle'

  const showEntrySurface = currentView === 'landing' || readingEntry.isActive
  const showLandingHandoffSurface = globalTransitionPhase === 'handoff'
    && globalTransitionTargetView === 'landing'

  const handleLanguageProceed = useCallback((selectedLanguage) => {
    const nextLanguage = selectedLanguage || language
    useProgressStore.getState().setLanguage(nextLanguage)
    recordRuntimeAudit('language-confirmed', { language: nextLanguage })
    trackEvent('language_selected', { stepId: 'entry:language', language: nextLanguage })
    readingEntry.proceedFromLanguage()
  }, [language, readingEntry.proceedFromLanguage])

  const handleModeSelect = useCallback((mode) => {
    trackEvent('mode_selected', { stepId: 'entry:mode', readingMode: mode })
    readingEntry.proceedFromMode(mode)
  }, [readingEntry.proceedFromMode])

  return (
    <>
      <PageShell motionMode={motionMode} surfaceStyle={readerSurfaceStyle}>
        {showReader && (
          <Reader
            contentStatus={contentStatus}
            onRetryContent={onRetryContent}
            onReaderReady={readingEntry.isActive ? readingEntry.handleReaderReady : undefined}
            readerEntryHandoffPhase={readerEntryHandoffPhase}
          />
        )}
        {(showEntrySurface || showLandingHandoffSurface) && (
          <EntrySurface
            currentView={currentView}
            phase={readingEntry.phase}
            intent={readingEntry.intent}
            language={language}
            hasInitializedLanguage={hasInitializedLanguage}
            readingMode={readingMode}
            themePosition={themePosition}
            motionMode={motionMode}
            surfaceStyle={readerSurfaceStyle}
            environmentState={environmentState}
            landingHandoff={showLandingHandoffSurface}
            onEnter={handleEnter}
            onProceed={handleLanguageProceed}
            onModeSelect={handleModeSelect}
            onTransitionReady={readingEntry.isActive ? readingEntry.handleTransitionReady : undefined}
          />
        )}
      </PageShell>
      {isGlobalTransitioning && <GlobalTransitionOverlay surfaceStyle={readerSurfaceStyle} />}
      <AdminSequenceGate />
    </>
  )
}

export default App
