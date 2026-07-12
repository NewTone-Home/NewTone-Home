import { useCallback, useEffect, useRef } from 'react'
import { useProgressStore } from './stores/progressStore'
import { useTransitionStore } from './stores/transitionStore'
import { useReadingEntry, READING_ENTRY_TIMINGS } from './transitions/readingEntryController'
import Landing from './views/Landing'
import Reader from './views/Reader'
import Center from './views/Center'
import ReadingTransition from './components/ReadingTransition'
import GlobalTransitionOverlay from './components/GlobalTransitionOverlay'
import PageShell from './components/PageShell'

function App() {
  const currentView = useProgressStore(s => s.currentView)
  const language = useProgressStore(s => s.language)
  const hasInitializedLanguage = useProgressStore(s => s.hasInitializedLanguage)

  const readingEntry = useReadingEntry()
  const isGlobalTransitioning = useTransitionStore(s => s.phase !== 'idle')

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
      ].includes(ctrl.phase)

      if (isFirstInitHistoryLocked) {
        restoringBlockedHistoryRef.current = true
        history.forward()
        return
      }

      historyPushRef.current = false
      const view = event.state?.newtoneView || 'landing'

      if (ctrl.isActive) {
        ctrl.cancel()
      }

      const tState = useTransitionStore.getState()
      if (tState.phase !== 'idle') {
        tState.reset()
      }

      const pState = useProgressStore.getState()
      if (view === 'center' && !pState.centerUnlocked) {
        window.history.replaceState({ newtoneView: 'landing' }, '')
        pState.setViewFromHistory('landing')
        return
      }

      pState.setViewFromHistory(view)
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

  const showCenter = currentView === 'center' && !readingEntry.isActive

  return (
    <>
      <PageShell>
        {showReader && <Reader onReaderReady={readingEntry.isActive ? readingEntry.handleReaderReady : undefined} />}
        {showLanding && <Landing onEnter={handleEnter} leaving={readingEntryLandingLeaving} leavingMs={landingLeaveMs} />}
        {showCenter && <Center />}
      </PageShell>
      <ReadingTransition
        phase={readingEntry.phase}
        intent={readingEntry.intent}
        language={language}
        onProceed={readingEntry.proceedFromLanguage}
      />
      {isGlobalTransitioning && <GlobalTransitionOverlay />}
    </>
  )
}

export default App
