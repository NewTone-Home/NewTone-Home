import { getBeatVisualState } from '../../reader/readerStageModel'

function ReaderBeatStack({ beats, focusBeatIndex, onFocusMotionEnd }) {
  return (
    <div className="reader-beat-stack" aria-live="polite">
      {beats.map((beat, beatIndex) => {
        const visualState = getBeatVisualState(beatIndex, focusBeatIndex)
        return (
          <article
            key={beat.id}
            className={`reader-stage-beat reader-stage-beat--${visualState}`}
            aria-current={visualState === 'focus' ? 'true' : undefined}
            aria-hidden={visualState === 'far' ? 'true' : undefined}
            onAnimationEnd={visualState === 'focus' ? onFocusMotionEnd : undefined}
          >
            {beat.blocks.map((block, blockIndex) => (
              <p key={`${beat.id}-${blockIndex}`}>{block.text}</p>
            ))}
          </article>
        )
      })}
    </div>
  )
}

export default ReaderBeatStack
