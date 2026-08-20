import { useCallback, useRef, useState } from 'react'
import { useTransitionStore } from '../stores/transitionStore'
import Landing from '../views/Landing'
import LandingUpdatesPage from './LandingUpdatesPage'
import { advanceUpdatesPhase, UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import ReadingTransition from './ReadingTransition'
import { READING_ENTRY_TIMINGS } from '../transitions/readingEntryController'
import './EntrySurface.css'

function EntrySurface({
  currentView,
  phase,
  intent,
  language,
  hasInitializedLanguage,
  readingMode,
  themePosition,
  motionMode,
  surfaceStyle,
  environmentState,
  landingHandoff = false,
  onEnter,
  onEnterCenter,
  onProceed,
  onModeSelect,
  onTransitionReady,
}) {
  const [updatesPhase, setUpdatesPhase] = useState(UPDATES_PHASE.LANDING)
  const landingArrivalKind = useTransitionStore(s => s.landingArrivalKind)
  const [returnArrivalSurface] = useState(() => landingArrivalKind === 'return')
  const updatesPhaseRef = useRef(UPDATES_PHASE.LANDING)
  const entryActive = phase !== 'idle'
  const readerHandoffActive = phase === 'reader-preparing' || phase === 'transition-leaving'
  const readerHandoffLeaving = phase === 'transition-leaving'
  const mounted = currentView === 'landing' || entryActive || landingHandoff

  if (!mounted) return null

  const landingLeaveMs = hasInitializedLanguage
    ? READING_ENTRY_TIMINGS.RETURN_LANDING_LEAVE_MS
    : READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS

  const sendUpdatesEvent = useCallback((event) => {
    const current = updatesPhaseRef.current
    const next = advanceUpdatesPhase(current, event)
    recordRuntimeAudit('updates-event', { phase: current, event, nextPhase: next })
    if (next === current) return
    updatesPhaseRef.current = next
    setUpdatesPhase(next)
    recordRuntimeAudit('updates-phase', { phase: next, sourceEvent: event })
  }, [])

  return (
    <div
      className={`entry-surface entry-surface--phase-${phase}${readerHandoffActive ? ' entry-surface--reader-handoff' : ''}${readerHandoffLeaving ? ' entry-surface--reader-handoff-leaving' : ''}${landingHandoff ? ' entry-surface--reader-return' : ''}`}
      style={readerHandoffActive ? { '--entry-handoff-fade-duration': `${READING_ENTRY_TIMINGS.TRANSITION_FADE_MS}ms` } : undefined}
      data-entry-phase={phase}
      data-entry-intent={intent || 'none'}
      data-updates-phase={updatesPhase}
      data-entry-handoff={landingHandoff && returnArrivalSurface ? 'reader-to-landing' : 'none'}
    >
      <Landing
        onEnter={onEnter}
        onEnterCenter={onEnterCenter}
        onEnterUpdates={() => sendUpdatesEvent('enter-requested')}
        updatesPhase={updatesPhase}
        leaving={entryActive}
        leavingMs={landingLeaveMs}
        surfaceStyle={surfaceStyle}
        readingMode={readingMode}
        environmentState={environmentState}
      />

      <LandingUpdatesPage
        phase={updatesPhase}
        language={language}
        onSurfaceComplete={() => sendUpdatesEvent('surface-complete')}
        onReturnRequested={() => sendUpdatesEvent('return-requested')}
      />

      <ReadingTransition
        phase={phase}
        intent={intent}
        language={language}
        readingMode={readingMode}
        themePosition={themePosition}
        motionMode={motionMode}
        surfaceStyle={surfaceStyle}
        environmentState={environmentState}
        onProceed={onProceed}
        onModeSelect={onModeSelect}
        onTransitionReady={onTransitionReady}
      />
    </div>
  )
}

export default EntrySurface
