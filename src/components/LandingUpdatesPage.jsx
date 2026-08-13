import { useCallback, useEffect, useRef } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function LandingUpdatesPage({ phase, onSurfaceComplete, onReturnRequested }) {
  const returnIssuedRef = useRef(false)
  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES

  useEffect(() => {
    if (phase === UPDATES_PHASE.LANDING) returnIssuedRef.current = false
  }, [phase])

  const handleReturnComplete = useCallback(({ inputType }) => {
    if (!interactive || returnIssuedRef.current) return
    returnIssuedRef.current = true
    recordRuntimeAudit('updates-return-intent', {
      inputType,
      phase,
      source: 'button',
    })
    onReturnRequested?.()
  }, [interactive, onReturnRequested, phase])

  const handleSurfaceAnimationEnd = useCallback((event) => {
    if (
      (phase === UPDATES_PHASE.ENTER_SURFACE && event.animationName === 'updates-page-enter')
      || (phase === UPDATES_PHASE.RETURN_SURFACE && event.animationName === 'updates-page-return')
    ) onSurfaceComplete?.()
  }, [onSurfaceComplete, phase])

  if (!visible) return null

  return (
    <section
      className="landing-updates-page paper-surface"
      data-updates-phase={phase}
      onAnimationEnd={handleSurfaceAnimationEnd}
    >
      <div className="landing-updates-page__placeholder">更新公告</div>
      <EntryButtonSurface
        visible={interactive}
        mobile={isCoarsePointer()}
        materialMode="background"
        entryId="landing-updates-return"
        label="返回入口"
        ariaLabel="返回 NewTone"
        className="landing-updates-return"
        onActionComplete={handleReturnComplete}
      />
    </section>
  )
}

export default LandingUpdatesPage
