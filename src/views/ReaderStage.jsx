import ReaderBeatStack from '../components/reader/ReaderBeatStack'
import ReaderExitTutorial from '../components/reader/ReaderExitTutorial'
import ReaderPageExit from '../components/reader/ReaderPageExit'
import ReaderSceneLabel from '../components/reader/ReaderSceneLabel'
import ReaderTools from '../components/reader/ReaderTools'
import ReaderTraceProgress from '../components/reader/ReaderTraceProgress'
import './ReaderStage.css'

function ReaderStage({
  phaseId,
  page,
  focusBeatIndex,
  progress,
  language,
  onBackward,
  onForward,
  onLanguage,
  onFocusMotionEnd,
  transitionKind,
  sceneTransitionKind,
  tutorialVisible,
  onTutorialDismiss,
  rootRef,
  focusRef,
}) {
  return (
    <main className="reader-stage-page paper-surface">
      <section
        ref={rootRef}
        className={`reader-stage${sceneTransitionKind ? ` reader-stage--scene-${sceneTransitionKind}` : ''}`}
        aria-label={`${phaseId} ${page.scene.label}`}
        data-transition-kind={transitionKind || 'idle'}
      >
        <ReaderTools language={language} onLanguage={onLanguage} />
        <ReaderSceneLabel phaseId={phaseId} scene={page.scene} />
        <ReaderBeatStack
          beats={page.beats}
          focusBeatIndex={focusBeatIndex}
          onFocusMotionEnd={onFocusMotionEnd}
          focusRef={focusRef}
        />
        <ReaderTraceProgress progress={progress} />
        <ReaderExitTutorial visible={tutorialVisible} onDismiss={onTutorialDismiss} />
        <ReaderPageExit exits={page.exits} onBackward={onBackward} onForward={onForward} />
      </section>
    </main>
  )
}

export default ReaderStage
