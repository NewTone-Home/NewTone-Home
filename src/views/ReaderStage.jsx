import { getScenePalette } from '../reader/readerScenePalette'
import ReaderBeatStack from '../components/reader/ReaderBeatStack'
import ReaderSceneLabel from '../components/reader/ReaderSceneLabel'
import ReaderTools from '../components/reader/ReaderTools'
import ReaderTraceProgress from '../components/reader/ReaderTraceProgress'
import ReaderReturnControl from '../components/reader/ReaderReturnControl'
import { getReaderThemeVariables } from '../reader/readerTheme'
import './ReaderStage.css'

function ReaderStage({
  page,
  beats,
  focusBeatIndex,
  progress,
  overallProgress,
  language,
  onLanguage,
  readingMode,
  standardTheme,
  themePosition,
  motionMode,
  onReadingMode,
  onStandardTheme,
  onThemePosition,
  onMotionMode,
  onFocusMotionEnd,
  onNativeFocusChange,
  transitionKind,
  sceneTransitionKind,
  autoVisual,
  tutorialVisible,
  rootRef,
  focusRef,
  chapterTrialEnded,
  onReturnCenter,
}) {
  const sceneState = beats[focusBeatIndex]?.sceneState ?? {}
  const sceneStateName = sceneState.sceneState ?? 'normal'
  const palette = getScenePalette(sceneState, page.scene.id)
  const immersiveStyle = {
    '--scene-light': palette.light,
    '--scene-warm': palette.warm,
    '--scene-saturation': sceneState.saturation ?? .7,
    '--scene-vignette': sceneState.vignette ?? .24,
    '--scene-cool': palette.cool,
    '--scene-narrow': sceneState.narrow ?? .1,
    '--scene-narrow-inset': `${(sceneState.narrow ?? .1) * 4.5}%`,
    '--scene-paper': palette.paper,
    '--scene-ink': palette.ink,
    '--scene-muted': palette.muted,
  }
  const stageStyle = readingMode === 'standard'
    ? { ...immersiveStyle, ...getReaderThemeVariables(themePosition) }
    : immersiveStyle

  return (
    <main
      className={`reader-stage-page paper-surface reader-stage-page--${readingMode} reader-stage-page--theme-${standardTheme} reader-stage-page--motion-${motionMode}`}
      style={stageStyle}
      data-reading-mode={readingMode}
      data-motion-mode={motionMode}
      data-scene-state={sceneStateName}
      data-auto-visual={autoVisual || 'idle'}
    >
      <section
        ref={rootRef}
        className={`reader-stage${sceneTransitionKind ? ` reader-stage--scene-${sceneTransitionKind}` : ''}`}
        aria-label={`阅读场景：${page.scene.label}`}
        data-transition-kind={transitionKind || 'idle'}
      >
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
          onMotionMode={onMotionMode}
        />
        <ReaderBeatStack
          beats={beats}
          focusBeatIndex={focusBeatIndex}
          onFocusMotionEnd={onFocusMotionEnd}
          onNativeFocusChange={onNativeFocusChange}
          focusRef={focusRef}
        />
        <div className="reader-scene-atmosphere" aria-hidden="true" />
        {sceneStateName === 'chase' && <div className="reader-commercial-figure" aria-hidden="true" />}
        <div className="reader-scene-flash" aria-hidden="true" />
        {readingMode === 'standard' && <ReaderTraceProgress progress={overallProgress ?? progress} />}
        <ReaderSceneLabel scene={page.scene} />
        <ReaderReturnControl onComplete={onReturnCenter} />
        {tutorialVisible && <div className="reader-input-tutorial" role="status">向下前行 · 向上回看</div>}
        {chapterTrialEnded && <span className="reader-chapter-end" aria-hidden="true" />}
      </section>
    </main>
  )
}

export default ReaderStage
