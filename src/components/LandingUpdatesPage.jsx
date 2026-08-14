import { useCallback } from 'react'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

function LandingUpdatesPage({ phase, onSurfaceComplete, onReturnRequested }) {
  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES

  const handleAnimationEnd = useCallback((event) => {
    if (
      (phase === UPDATES_PHASE.ENTER_SURFACE && event.animationName === 'updates-page-enter')
      || (phase === UPDATES_PHASE.RETURN_SURFACE && event.animationName === 'updates-page-return')
    ) onSurfaceComplete()
  }, [onSurfaceComplete, phase])

  if (!visible) return null

  return (
    <section
      className="landing-updates-page"
      data-updates-phase={phase}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="landing-updates-page__placeholder">更新公告</div>
      {interactive && (
        <button
          type="button"
          className="landing-updates-return"
          aria-label="返回 NewTone"
          onClick={onReturnRequested}
        >
          <span className="landing-updates-return__label">返回入口</span>
        </button>
      )}
    </section>
  )
}

export default LandingUpdatesPage
