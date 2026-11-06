import { useCallback, useRef, useState } from 'react'
import { getReaderThemeVariables, migrateThemePosition } from '../reader/readerTheme'
import { entryPresentation } from '../services/entryPresentation.mjs'
import Landing from '../views/Landing'
import LandingUpdatesPage from './LandingUpdatesPage'
import { advanceUpdatesPhase, UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './EntrySurface.css'

export default function EntrySurface({ worldEntryPhase = 'idle', onWorldCoverComplete, entryUI, preferences, landingIntroPreview, inspectionSettled }) {
  const surfaceStyle = getReaderThemeVariables(migrateThemePosition(preferences?.themePosition, preferences?.standardTheme))
  const { language } = entryPresentation(preferences ?? {}, navigator.languages || [navigator.language])
  const [updatesPhase, setUpdatesPhase] = useState(UPDATES_PHASE.LANDING)
  const phaseRef = useRef(UPDATES_PHASE.LANDING)
  const send = useCallback(event => {
    phaseRef.current = advanceUpdatesPhase(phaseRef.current, event)
    setUpdatesPhase(phaseRef.current)
  }, [])
  return <div className={`entry-surface entry-surface--phase-idle${worldEntryPhase !== 'idle' ? ' entry-surface--world-entry' : ''}`} data-world-entry-phase={worldEntryPhase} style={surfaceStyle} data-motion-mode={preferences?.motionMode ?? 'full'}>
    <Landing preferences={preferences} landingIntroPreview={landingIntroPreview} inspectionSettled={inspectionSettled} entryUI={entryUI} worldMode
      onEnterUpdates={() => send('enter-requested')} updatesPhase={updatesPhase}
      surfaceStyle={surfaceStyle} readingMode={preferences?.readingMode ?? 'standard'} environmentState={{ worldLayer: 'inner', time: 'day' }}
      worldEntryPhase={worldEntryPhase} onWorldCoverComplete={onWorldCoverComplete} />
    <LandingUpdatesPage phase={updatesPhase} language={language}
      onSurfaceComplete={() => send('surface-complete')} onReturnRequested={() => send('return-requested')} />
  </div>
}
