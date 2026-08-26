import { useCallback, useRef } from 'react'
import ReaderBeatStack from '../components/reader/ReaderBeatStack'
import ReaderSceneTransition from '../components/reader/ReaderSceneTransition'
import ReaderPrecipitation from '../components/reader/ReaderPrecipitation'
import ReaderTools from '../components/reader/ReaderTools'
import ReaderReturnControl from '../components/reader/ReaderReturnControl'
import ReaderStatusBar from '../components/reader/ReaderStatusBar'
import { resolveReaderEnvironmentPreview } from '../data/reader-experiments/readerEnvironmentPreview'
import { getReaderSceneLabel } from '../i18n/readerUi'
import { preventReaderShortcut, preventReaderTransfer } from '../reader/readerCopyProtection'
import { getReaderThemeVariables } from '../reader/readerTheme'
import './ReaderStage.css'
import './ReaderShellContract.css'

const STANDARD_THEME_POSITIONS = Object.freeze({ light: 0, soft: 0.5, dark: 1 })
const DIRECT_READER_QUERY = '(hover: none), (pointer: coarse), (max-width: 720px)'
const EMPTY_READER_ENVIRONMENT = Object.freeze({
  worldLayer: 'surface', time: 'noon', weather: 'clear', light: 'neutral',
  locationId: 'unpublished', locationLabel: '', characters: [],
  evidence: { worldLayer: { sourceType: 'system' }, weather: { sourceType: 'system' } },
})

function ReaderStage({
  emptyDocument = false,
  contentStatus,
  onRetryContent,
  scene,
  beats,
  focusBeatIndex,
  sceneBoundaryRanges = [],
  progress: _progress,
  language,
  contentLanguage = language,
  languageTransitionPhase = 'idle',
  onLanguage,
  standardTheme,
  themePosition,
  motionMode,
  onReadingMode,
  onStandardTheme,
  onThemePosition,
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
  autoVisual,
  rootRef,
  focusRef,
  chapterTrialEnded,
  finalReaderBeat = false,
  returningToLanding = false,
  readerEntryHandoffPhase = 'idle',
  onReturnStart,
  onReturnLanding,
}) {
  const visibleReadingMode = 'standard'
  const nativeBoundaryLockRef = useRef(null)
  const returnControlRef = useRef(null)
  const sceneState = beats[focusBeatIndex]?.sceneState ?? {}
  const sceneStateName = sceneState.sceneState ?? 'normal'
  const nativeEnvironmentState = beats[focusBeatIndex]?.worldState
  const environmentState = nativeEnvironmentState ?? EMPTY_READER_ENVIRONMENT
  const sceneEnvironmentState = scene?.beats?.[0]?.worldState ?? environmentState
  const environmentVisual = resolveReaderEnvironmentPreview(environmentState)
  const immersiveStyle = environmentVisual.style
  const stageStyle = visibleReadingMode === 'standard'
    ? getReaderThemeVariables(themePosition ?? STANDARD_THEME_POSITIONS[standardTheme] ?? 0.5)
    : immersiveStyle
  const directReaderInput = typeof window !== 'undefined' && (
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    || window.matchMedia(DIRECT_READER_QUERY).matches
  )
  const locationLabel = emptyDocument
    ? (language === 'en' ? 'No pages yet' : '暂无页面')
    : getReaderSceneLabel(language, environmentState.locationId, environmentState.locationLabels?.[language] || environmentState.locationLabel)?.replace(/\s*·\s*/g, ' · ')

  const handleViewportBoundaryChange = useCallback(({ direction = 0, atTop = false, atBottom = false }) => {
    if (atTop && direction < 0 && nativeBoundaryLockRef.current !== 'backward') {
      nativeBoundaryLockRef.current = 'backward'
      onNativeBoundary?.('backward')
    }
    if (atBottom && direction > 0 && nativeBoundaryLockRef.current !== 'forward') {
      nativeBoundaryLockRef.current = 'forward'
      onNativeBoundary?.('forward')
    }
    if ((!atTop && !atBottom) || (atTop && direction > 0) || (atBottom && direction < 0)) {
      nativeBoundaryLockRef.current = null
    }
  }, [onNativeBoundary])

  return (
    <>
      <ReaderStatusBar
        language={language}
        state={sceneEnvironmentState}
        visible={!emptyDocument && !returningToLanding && readerEntryHandoffPhase === 'idle'}
        style={stageStyle}
      />
      <main
        className={`reader-stage-page paper-surface reader-stage-page--${visibleReadingMode} reader-stage-page--theme-${standardTheme} reader-stage-page--motion-${motionMode}${returningToLanding ? ' reader-stage-page--returning' : ''}`}
        style={stageStyle}
        data-reading-mode={visibleReadingMode}
        data-motion-mode={motionMode}
        data-returning-to-landing={returningToLanding ? 'true' : 'false'}
        data-reader-entry-handoff={readerEntryHandoffPhase}
        data-scene-transition="idle"
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
        className="reader-stage"
        aria-label={emptyDocument ? 'NewTone Reader：暂无可读页面' : `阅读场景：${environmentState.locationLabel}`}
        data-transition-kind={transitionKind || 'idle'}
      >
        {visibleReadingMode === 'immersive' && (
          <>
            <div className="reader-environment-light" aria-hidden="true" />
            <div className="reader-environment-shadow" aria-hidden="true" />
            <div className="reader-environment-weather" aria-hidden="true">
              <ReaderPrecipitation />
            </div>
          </>
        )}
        <ReaderTools
          language={language}
          onLanguage={onLanguage}
          readingMode={visibleReadingMode}
          standardTheme={standardTheme}
          themePosition={themePosition}
          motionMode={motionMode}
          onReadingMode={onReadingMode}
          onStandardTheme={onStandardTheme}
          onThemePosition={onThemePosition}
          locationId={environmentState.locationId}
          locationLabel={locationLabel}
          showLocationLabel={false}
        />
        {!emptyDocument && (
          <ReaderSceneTransition
            sceneId={scene?.id}
            phase="idle"
          >
            <ReaderBeatStack
              beats={beats}
              language={contentLanguage}
              languageTransitionPhase={languageTransitionPhase}
              focusBeatIndex={focusBeatIndex}
              onNativeFocusChange={onNativeFocusChange}
              onNativeScrollOffset={onNativeScrollOffset}
              onViewportBoundaryChange={handleViewportBoundaryChange}
              sceneBoundaryRanges={sceneBoundaryRanges}
              sceneBoundaryControlRef={returnControlRef}
              initialScrollOffset={initialScrollOffset}
              narrativeRuntimeEnabled={narrativeRuntimeEnabled}
              narrativeDeliveryStates={narrativeDeliveryStates}
              activeNarrativePauseId={activeNarrativePauseId}
              activeNarrativePausePhase={activeNarrativePausePhase}
              activeNarrativeRevealId={activeNarrativeRevealId}
              activeNarrativeTypewriterId={activeNarrativeTypewriterId}
              focusRef={focusRef}
            />
          </ReaderSceneTransition>
        )}
        {emptyDocument && <section className="reader-empty-document" aria-labelledby="reader-empty-document-title">
          <p className="reader-empty-document-mark">NewTone / Reader</p>
          <h1 id="reader-empty-document-title">{language === 'en' ? 'No pages are available yet' : '暂无可读页面'}</h1>
          <p>{language === 'en' ? 'The story has not been published yet. You can still explore the Reader settings.' : '正文尚未发布。Reader 的阅读设置可以继续使用。'}</p>
          {contentStatus !== 'empty' && <button type="button" onClick={onRetryContent}>{language === 'en' ? 'Try again' : '重新检查正文'}</button>}
        </section>}
        <ReaderReturnControl
          ref={returnControlRef}
          visible={!returningToLanding}
          alwaysVisible={emptyDocument || finalReaderBeat}
          mobile={directReaderInput}
          worldLayer={environmentState.worldLayer}
          onReturnStart={onReturnStart}
          onReturnComplete={onReturnLanding}
          language={language}
        />
        {chapterTrialEnded && <span className="reader-chapter-end" aria-hidden="true" />}
      </section>
      </main>
    </>
  )
}

export default ReaderStage
