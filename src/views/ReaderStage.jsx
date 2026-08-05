import { useEffect, useState } from 'react'
import ReaderBeatStack from '../components/reader/ReaderBeatStack'
import ReaderPrecipitation from '../components/reader/ReaderPrecipitation'
import ReaderTools from '../components/reader/ReaderTools'
import ReaderTraceProgress from '../components/reader/ReaderTraceProgress'
import ReaderReturnControl from '../components/reader/ReaderReturnControl'
import { resolveReaderEnvironmentPreview } from '../data/reader-experiments/readerEnvironmentPreview'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { getReaderThemeVariables } from '../reader/readerTheme'
import './ReaderStage.css'
import './ReaderShellContract.css'

const STANDARD_THEME_POSITIONS = Object.freeze({ light: 0, soft: 0.5, dark: 1 })

function ReaderStage({
  page,
  beats,
  focusBeatIndex,
  progress,
  language,
  onLanguage,
  readingMode,
  standardTheme,
  themePosition,
  motionMode,
  onReadingMode,
  onStandardTheme,
  onThemePosition,
  onFocusMotionEnd,
  onNativeFocusChange,
  onNativeBoundary,
  onNativeScrollOffset,
  initialScrollOffset,
  narrativeRuntimeEnabled,
  narrativeDeliveryStates,
  activeNarrativePauseId,
  activeNarrativePausePhase,
  activeNarrativeRevealId,
  activeNarrativeTypewriterId,
  transitionKind,
  sceneTransitionKind,
  autoVisual,
  rootRef,
  focusRef,
  chapterTrialEnded,
  onReturnLanding,
}) {
  const [escapeReturnVisible, setEscapeReturnVisible] = useState(false)
  const sceneState = beats[focusBeatIndex]?.sceneState ?? {}
  const sceneStateName = sceneState.sceneState ?? 'normal'
  const nativeEnvironmentState = beats[focusBeatIndex]?.worldState
  const environmentState = nativeEnvironmentState
  const environmentVisual = resolveReaderEnvironmentPreview(environmentState)
  const immersiveStyle = environmentVisual.style
  const stageStyle = readingMode === 'standard'
    ? getReaderThemeVariables(themePosition ?? STANDARD_THEME_POSITIONS[standardTheme] ?? 0.5)
    : immersiveStyle
  const atPageEnd = focusBeatIndex >= Math.max(0, beats.length - 1)
  const returnVisible = readingMode === 'immersive' || atPageEnd || escapeReturnVisible
  const locationLabel = getReaderSceneLabel(language, environmentState.locationId, environmentState.locationLabel)
    ?.replace(/\s*·\s*/g, ' · ')

  useEffect(() => {
    setEscapeReturnVisible(false)
  }, [page.id])

  useEffect(() => {
    const revealReturn = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setEscapeReturnVisible(true)
    }
    window.addEventListener('keydown', revealReturn)
    return () => window.removeEventListener('keydown', revealReturn)
  }, [])

  return (
    <main
      className={`reader-stage-page paper-surface reader-stage-page--${readingMode} reader-stage-page--theme-${standardTheme} reader-stage-page--motion-${motionMode}`}
      style={stageStyle}
      data-reading-mode={readingMode}
      data-motion-mode={motionMode}
      data-scene-state={sceneStateName}
      data-world-layer={environmentState.worldLayer}
      data-scene-characters={environmentState.characters.join(' ')}
      data-world-evidence={environmentState.evidence.worldLayer.sourceType}
      data-time-of-day={environmentState.time}
      data-weather={environmentState.weather}
      data-weather-evidence={environmentState.evidence.weather.sourceType}
      data-reader-location={environmentState.locationId}
      data-light-state={environmentState.light}
      data-environment-preview="chapter"
      data-auto-visual={autoVisual || 'idle'}
    >
      <section
        ref={rootRef}
        className={`reader-stage${sceneTransitionKind ? ` reader-stage--scene-${sceneTransitionKind}` : ''}`}
        aria-label={`阅读场景：${environmentState.locationLabel}`}
        data-transition-kind={transitionKind || 'idle'}
      >
        <div className="reader-environment-light" aria-hidden="true" />
        <div className="reader-environment-shadow" aria-hidden="true" />
        <div className="reader-environment-weather" aria-hidden="true">
          <ReaderPrecipitation />
        </div>
        <ReaderTools
          language={language}
          onLanguage={onLanguage}
          readingMode={readingMode}
          standardTheme={standardTheme}
          themePosition={themePosition}
          motionMode={motionMode}
          onReadingMode={onReadingMode}
          onStandardTheme={onStandardTheme}
          onThemePosition={onThemePosition}
          locationId={environmentState.locationId}
          locationLabel={locationLabel}
        />
        <ReaderBeatStack
          beats={beats}
          focusBeatIndex={focusBeatIndex}
          onFocusMotionEnd={onFocusMotionEnd}
          onNativeFocusChange={onNativeFocusChange}
          onNativeBoundary={onNativeBoundary}
          onNativeScrollOffset={onNativeScrollOffset}
          initialScrollOffset={initialScrollOffset}
          narrativeRuntimeEnabled={narrativeRuntimeEnabled}
          narrativeDeliveryStates={narrativeDeliveryStates}
          activeNarrativePauseId={activeNarrativePauseId}
          activeNarrativePausePhase={activeNarrativePausePhase}
          activeNarrativeRevealId={activeNarrativeRevealId}
          activeNarrativeTypewriterId={activeNarrativeTypewriterId}
          focusRef={focusRef}
        />
        <ReaderTraceProgress
          key={page.id}
          progress={progress}
          beats={beats}
          focusBeatIndex={focusBeatIndex}
          language={language}
          readingMode={readingMode}
        />
        {returnVisible && <ReaderReturnControl onComplete={onReturnLanding} language={language} />}
        {chapterTrialEnded && <span className="reader-chapter-end" aria-hidden="true" />}
      </section>
    </main>
  )
}

export default ReaderStage
