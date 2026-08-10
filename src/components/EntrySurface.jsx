import Landing from '../views/Landing'
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
  guidePaused = false,
}) {
  const entryActive = phase !== 'idle'
  const mounted = currentView === 'landing' || entryActive

  if (!mounted) return null

  const landingLeaveMs = hasInitializedLanguage
    ? READING_ENTRY_TIMINGS.RETURN_LANDING_LEAVE_MS
    : READING_ENTRY_TIMINGS.FIRST_LANDING_LEAVE_MS

  return (
    <div
      className={`entry-surface entry-surface--phase-${phase}`}
      data-entry-phase={phase}
      data-entry-intent={intent || 'none'}
    >
      <Landing
        onEnter={onEnter}
        leaving={entryActive}
        leavingMs={landingLeaveMs}
        surfaceStyle={surfaceStyle}
        readingMode={readingMode}
        environmentState={environmentState}
        guidePaused={guidePaused || entryActive}
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
