import ReaderBeatStack from '../components/reader/ReaderBeatStack'
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
}) {
  return (
    <main className="reader-stage-page paper-surface">
      <section className="reader-stage" aria-label={`${phaseId} ${page.scene.label}`}>
        <ReaderTools language={language} onLanguage={onLanguage} />
        <ReaderSceneLabel phaseId={phaseId} scene={page.scene} />
        <ReaderBeatStack
          beats={page.beats}
          focusBeatIndex={focusBeatIndex}
          onFocusMotionEnd={onFocusMotionEnd}
        />
        <ReaderTraceProgress progress={progress} />
        <ReaderPageExit exits={page.exits} onBackward={onBackward} onForward={onForward} />
      </section>
    </main>
  )
}

export default ReaderStage
