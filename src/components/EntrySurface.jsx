import { useCallback, useRef, useState } from 'react'
import { useTransitionStore } from '../stores/transitionStore'
import Landing from '../views/Landing'
import LandingUpdatesPage from './LandingUpdatesPage'
import { advanceUpdatesPhase, UPDATES_PHASE } from '../landing/landingUpdatesFlow'
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
  onProceed,
  onModeSelect,
  guidePaused = false,
}) {
  const [updatesPhase, setUpdatesPhase] = useState(UPDATES_PHASE.LANDING)
  const landingArrivalKind = useTransitionStore(s => s.landingArrivalKind)
  const [returnArrivalSurface] = useState(() => landingArrivalKind === 'return')
  const barrierRef = useRef({ phase: '', keys: new Set() })
  const entryActive = phase !== 'idle'
  const mounted = currentView === 'landing' || entryActive || landingHandoff

  if (!mounted) return null

  const landingLeaveMs = hasInitializedLanguage
    ? READING_ENTRY_TIMINGS.RETURN_LANDING_LEAVE_MS
    : READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS

  const sendUpdatesEvent = useCallback((event) => {
    setUpdatesPhase(current => advanceUpdatesPhase(current, event))
  }, [])

  const handleUpdatesBarrier = useCallback((kind, key) => {
    setUpdatesPhase(current => {
      const expected = (
        kind === 'turns' && current === UPDATES_PHASE.ENTER_ARROW_TURN
      ) || (
        kind === 'arrows' && current === UPDATES_PHASE.RETURN_ARROWS
      ) ? 1 : 2
      if (barrierRef.current.phase !== current) {
        barrierRef.current = { phase: current, keys: new Set() }
      }
      barrierRef.current.keys.add(key)
      if (barrierRef.current.keys.size < expected) return current
      return advanceUpdatesPhase(current, `${kind}-complete`)
    })
  }, [])

  return (
    <div
      className={`entry-surface entry-surface--phase-${phase}${landingHandoff ? ' entry-surface--reader-return' : ''}`}
      data-entry-phase={phase}
      data-entry-intent={intent || 'none'}
      data-updates-phase={updatesPhase}
      data-entry-handoff={landingHandoff && returnArrivalSurface ? 'reader-to-landing' : 'none'}
    >
      <Landing
        onEnter={onEnter}
        onEnterUpdates={() => sendUpdatesEvent('enter-requested')}
        updatesPhase={updatesPhase}
        onUpdatesBarrier={handleUpdatesBarrier}
        leaving={entryActive}
        leavingMs={landingLeaveMs}
        surfaceStyle={surfaceStyle}
        readingMode={readingMode}
        environmentState={environmentState}
        guidePaused={guidePaused || entryActive}
      />

      <LandingUpdatesPage
        phase={updatesPhase}
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
      />
    </div>
  )
}

export default EntrySurface
