import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const RETURN_LINE_DRAW_MS = 560
const RETURN_WHEEL_THRESHOLD = 8
const RETURN_TOUCH_THRESHOLD = 36

function ReaderReturnControl({ armed, onArm, onComplete, language }) {
  const ui = getReaderUi(language)
  const [progress, setProgress] = useState(0)
  const completedRef = useRef(false)
  const frameRef = useRef(0)

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
    setProgress(0)
    completedRef.current = false
    if (!armed) return undefined
    const startedAt = performance.now()
    const drawLines = time => {
      const next = Math.min(1, (time - startedAt) / RETURN_LINE_DRAW_MS)
      setProgress(next)
      if (next < 1) frameRef.current = requestAnimationFrame(drawLines)
    }
    frameRef.current = requestAnimationFrame(drawLines)
    return () => cancelAnimationFrame(frameRef.current)
  }, [armed])

  useEffect(() => {
    if (!armed) return undefined
    let touchStartY = 0
    let touchActive = false
    const completeOnce = () => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete()
    }
    const onWheel = event => {
      if (event.deltaY > RETURN_WHEEL_THRESHOLD) completeOnce()
    }
    const onTouchStart = event => {
      touchStartY = event.touches[0]?.clientY ?? 0
      touchActive = true
    }
    const onTouchMove = event => {
      if (!touchActive) return
      const currentY = event.touches[0]?.clientY ?? touchStartY
      if (touchStartY - currentY <= RETURN_TOUCH_THRESHOLD) return
      touchActive = false
      completeOnce()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [armed, onComplete])

  return (
    <button
      type="button"
      className={`reader-return-control${armed ? ' is-armed' : ''}`}
      style={{ '--return-progress': progress }}
      data-reader-return-control="true"
      data-return-armed={armed ? 'true' : 'false'}
      data-return-progress={progress.toFixed(3)}
      onClick={() => { if (!armed) onArm() }}
      aria-label={ui.returnToLandingHint}
      aria-pressed={armed}
    >
      <span className="reader-return-text">{ui.returnToLanding}</span>
      <svg className="reader-return-affordance" viewBox="0 0 112 31" aria-hidden="true">
        <path className="reader-return-affordance__line" pathLength="1" d="M4 5.8C24 3.1 45 7.4 65 5.1C82 3.2 97 5.8 108 4.2" />
        <path className="reader-return-affordance__line reader-return-affordance__line--second" pathLength="1" d="M13 11.8C31 9.4 50 13.5 68 10.7C82 8.8 94 11.9 102 10.2" />
        <path className="reader-return-affordance__arrow" d="M56 17C55 21 56 24 56 28M51 24C53 26 55 28 56 29M61 24C59 26 57 28 56 29" />
      </svg>
    </button>
  )
}

export default ReaderReturnControl
