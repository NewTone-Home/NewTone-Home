import { useEffect, useState } from 'react'
import ReaderBeatStack from '../components/reader/ReaderBeatStack'
import ReaderPrecipitation from '../components/reader/ReaderPrecipitation'
import ReaderTools from '../components/reader/ReaderTools'
import ReaderTraceProgress from '../components/reader/ReaderTraceProgress'
import ReaderReturnControl from '../components/reader/ReaderReturnControl'
import { resolveReaderEnvironmentPreview } from '../data/reader-experiments/readerEnvironmentPreview'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { preventReaderShortcut, preventReaderTransfer } from '../reader/readerCopyProtection'
import { getReaderThemeVariables } from '../reader/readerTheme'
import './ReaderStage.css'
import './ReaderShellContract.css'

const STANDARD_THEME_POSITIONS = Object.freeze({ light: 0, soft: 0.5, dark: 1 })
const EMPTY_READER_ENVIRONMENT = Object.freeze({
  worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral',
  locationId: 'unpublished', locationLabel: '', characters: [],
  evidence: { worldLayer: { sourceType: 'system' }, weather: { sourceType: 'system' } },
})

function ReaderStage({
  emptyDocument = false,
  contentStatus,
  onRetryContent,
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
  const environmentState = nativeEnvironmentState ?? EMPTY_READER_ENVIRONMENT
  const environmentVisual = resolveReaderEnvironmentPreview(environmentState)
  const immersiveStyle = environmentVisual.style
  const stageStyle = readingMode === 'standard'
    ? getReaderThemeVariables(themePosition ?? STANDARD_THEME_POSITIONS[standardTheme] ?? 0.5)
    : immersiveStyle
  const atPageEnd = focusBeatIndex >= Math.max(0, beats.length - 1)
  const returnVisible = emptyDocument || readingMode === 'immersive' || atPageEnd || escapeReturnVisible
  const locationLabel = emptyDocument
    ? (language === 'en' ? 'No page' : '暂无页面')
    : getReaderSceneLabel(language, environmentState.locationId, environmentState.locationLabel)?.replace(/\s*·\s*/g, ' · ')

  useEffect(() => {
    setEscapeReturnVisible(false)
  }, [page?.id])

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
      data-copy-protected="true"
      onCopyCapture={preventReaderTransfer}
      onCutCapture={preventReaderTransfer}
      onContextMenu={preventReaderTransfer}
      onDragStartCapture={preventReaderTransfer}
      onKeyDownCapture={preventReaderShortcut}
    >
      <section
        ref={rootRef}
        className={`reader-stage${sceneTransitionKind ? ` reader-stage--scene-${sceneTransitionKind}` : ''}`}
        aria-label={emptyDocument ? 'NewTone Reader：暂无可读页面' : `阅读场景：${environmentState.locationLabel}`}
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
        {!emptyDocument && <ReaderBeatStack
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
        />}
        {emptyDocument && <section className="reader-empty-document" aria-labelledby="reader-empty-document-title">
          <p className="reader-empty-document-mark">NewTone / Reader</p>
          <h1 id="reader-empty-document-title">{language === 'en' ? 'No readable page' : '暂无可读页面'}</h1>
          <p>{language === 'en' ? 'The body has not been published. Reader settings remain available.' : '正文尚未发布。Reader 的阅读设置可以继续使用。'}</p>
          {contentStatus !== 'empty' && <button type="button" onClick={onRetryContent}>{language === 'en' ? 'Check again' : '重新检查正文'}</button>}
        </section>}
        {!emptyDocument && <ReaderTraceProgress
          key={page?.id}
          progress={progress}
          beats={beats}
          focusBeatIndex={focusBeatIndex}
          language={language}
          readingMode={readingMode}
        />}
        {returnVisible && <ReaderReturnControl onComplete={onReturnLanding} language={language} />}
        {chapterTrialEnded && <span className="reader-chapter-end" aria-hidden="true" />}
      </section>
    </main>
  )
}

export default ReaderStage
