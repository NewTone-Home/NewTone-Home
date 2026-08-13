import LandingEntryArrow from './LandingEntryArrow'
import ScrambleText from '../ScrambleText'

function isTextWithdrawalState(state) {
  return state === 'withdraw-arrow' || state === 'withdraw-text'
}

function LandingUpdatesReturnEntry({
  flow,
  triggerRef,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onAnimationEnd,
  onTransitionEnd,
  onTextRevealed,
  onTextWithdrawn,
}) {
  const visible = flow.state !== 'hidden'
  const withdrawal = isTextWithdrawalState(flow.state)
  const armed = flow.armed === true
  const entryReady = flow.state === 'ready'
  const arrowDirection = withdrawal || flow.state === 'withdraw-arrow-turn'
    ? 'left'
    : ['arrow-turn', 'ready'].includes(flow.state)
      ? 'up'
      : 'right'

  return (
    <div
      ref={triggerRef}
      className="landing-updates-return-trigger"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {visible && <button
        type="button"
        className="landing-updates-return"
        aria-label="返回 NewTone"
        aria-expanded="true"
        onPointerDown={onPointerDown}
        onAnimationEnd={onAnimationEnd}
        onTransitionEnd={onTransitionEnd}
      >
        <span className="landing-updates-return__label">
          <ScrambleText
            key={`return-text-${flow.instanceId}`}
            text="返回入口"
            active
            duration={760}
            onRevealed={onTextRevealed}
            withdrawing={withdrawal}
            withdrawalDuration={flow.reason === 'wheel' ? 480 : 640}
            onWithdrawn={onTextWithdrawn}
          />
        </span>
        <LandingEntryArrow
          key={`return-arrow-${flow.instanceId}`}
          className="landing-updates-return__arrow"
          direction={arrowDirection}
          phase="steady"
          ringActive={armed}
          showRing={false}
          delayedBob={entryReady}
          arrowDelayed={armed && flow.state === 'arrow-turn'}
        />
      </button>}
    </div>
  )
}

export default LandingUpdatesReturnEntry
