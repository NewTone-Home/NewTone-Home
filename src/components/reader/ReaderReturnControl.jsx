import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const RETURN_LINE_DRAW_MS = 560
const RETURN_WHEEL_THRESHOLD = 8

function ReaderReturnControl({ onComplete, language }) {
  const ui = getReaderUi(language)
  const [progress, setProgress] = useState(0)
  const completedRef = useRef(false)
  const frameRef = useRef(0)

  useEffect(() => {
    const startedAt = performance.now()
    const drawLines = time => {
      const next = Math.min(1, (time - startedAt) / RETURN_LINE_DRAW_MS)
      setProgress(next)
      if (next < 1) frameRef.current = requestAnimationFrame(drawLines)
    }
    frameRef.current = requestAnimationFrame(drawLines)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    const onWheel = event => {
      if (completedRef.current || event.deltaY <= RETURN_WHEEL_THRESHOLD) return
      completedRef.current = true
      onComplete()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [onComplete])

  return (
    <div
      className="reader-return-control"
      style={{ '--return-progress': progress }}
      data-return-progress={progress.toFixed(3)}
      aria-label={ui.returnToLandingHint}
    >
      <span className="reader-return-text">{ui.returnToLanding}</span>
      <svg className="reader-return-affordance" viewBox="0 0 112 18" aria-hidden="true">
        <path className="reader-return-affordance__line" pathLength="1" d="M4 5.8C24 3.1 45 7.4 65 5.1C82 3.2 97 5.8 108 4.2" />
        <path className="reader-return-affordance__line reader-return-affordance__line--second" pathLength="1" d="M13 11.8C31 9.4 50 13.5 68 10.7C82 8.8 94 11.9 102 10.2" />
      </svg>
    </div>
  )
}

export default ReaderReturnControl
