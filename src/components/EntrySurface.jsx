import { useCallback, useState } from 'react'
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
  onEnter,
  onProceed,
  onModeSelect,
}) {
  const [updatesPhase, setUpdatesPhase] = useState(UPDATES_PHASE.LANDING)
  const entryActive = phase !== 'idle'
  const mounted = currentView === 'landing' || entryActive

  if (!mounted) return null

  const landingLeaveMs = hasInitializedLanguage
    ? READING_ENTRY_TIMINGS.RETURN_LANDING_LEAVE_MS
    : READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS

  const sendUpdatesEvent = useCallback((event) => {
    setUpdatesPhase(current => advanceUpdatesPhase(current, event))
  }, [])

  return (
    <div
      className={`entry-surface entry-surface--phase-${phase}`}
      data-entry-phase={phase}
      data-entry-intent={intent || 'none'}
      data-updates-phase={updatesPhase}
    >
      <Landing
        onEnter={onEnter}
        onEnterUpdates={() => sendUpdatesEvent('enter-requested')}
        leaving={entryActive}
        leavingMs={landingLeaveMs}
        surfaceStyle={surfaceStyle}
        readingMode={readingMode}
        environmentState={environmentState}
        updatesPhase={updatesPhase}
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
