import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const RETURN_RING_DRAW_MS = 720
const RETURN_RING_RETRACT_MS = 360
const RETURN_ARROW_FADE_MS = 180
const RETURN_CONTENT_FADE_MS = 260
const RETURN_WHEEL_THRESHOLD = 8
const RETURN_DIRECT_THRESHOLD = 36

function hasHoverPointer() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true
}

function isDirectPointer(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
}

function ReaderReturnControl({ armed, onArm, onDisarm, onReadyChange, onComplete, language }) {
  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint
  const [progress, setProgress] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [exitStage, setExitStage] = useState('idle')
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const pendingCompleteRef = useRef(false)
  const pendingArrowFadeRef = useRef(false)
  const frameRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  const returnTextRef = useRef(null)
  onCompleteRef.current = onComplete

  const visualArmed = armed && !completing
  const ringActive = visualArmed && exitStage === 'idle'

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
    const from = progressRef.current
    const target = ringActive ? 1 : 0
    const distance = Math.abs(target - from)

    const finishTarget = () => {
      progressRef.current = target
      setProgress(target)
      frameRef.current = 0
      if (target === 0 && pendingCompleteRef.current) {
        setExitStage(pendingArrowFadeRef.current ? 'arrow-fading' : 'content-fading')
      }
    }

    if (distance < 0.001) {
      finishTarget()
      return undefined
    }

    const fullDuration = ringActive ? RETURN_RING_DRAW_MS : RETURN_RING_RETRACT_MS
    const duration = Math.max(80, fullDuration * distance)
    const startedAt = performance.now()

    const animate = time => {
      const raw = Math.min(1, (time - startedAt) / duration)
      const eased = raw * raw * (3 - 2 * raw)
      const next = from + (target - from) * eased
      progressRef.current = next
      setProgress(next)
      if (raw < 1) {
        frameRef.current = requestAnimationFrame(animate)
        return
      }
      finishTarget()
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [ringActive])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  useEffect(() => {
    if (!armed && !pendingCompleteRef.current) {
      setCompleting(false)
      setExitStage('idle')
      pendingArrowFadeRef.current = false
    }
  }, [armed])

  const entryReady = visualArmed && progress >= 0.999

  useEffect(() => {
    onReadyChange?.(entryReady || completing)
  }, [completing, entryReady, onReadyChange])

  useEffect(() => {
    if (exitStage !== 'arrow-fading') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      setExitStage('content-fading')
    }
  }, [exitStage])

  useEffect(() => {
    if (exitStage !== 'content-fading') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      pendingCompleteRef.current = false
      onCompleteRef.current()
    }
  }, [exitStage])

  useLayoutEffect(() => {
    const syncAffordanceMetrics = () => {
      const textNode = returnTextRef.current
      const button = textNode?.closest('.reader-return-control')
      if (!textNode || !button) return
      const textRect = textNode.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const width = Math.max(96, textRect.width + 50)
      const height = Math.max(28, textRect.height + 12)
      button.style.setProperty('--return-affordance-left', `${textRect.left - buttonRect.left - 6}px`)
      button.style.setProperty('--return-affordance-top', `${textRect.top - buttonRect.top + textRect.height / 2}px`)
      button.style.setProperty('--return-affordance-width', `${width}px`)
      button.style.setProperty('--return-affordance-height', `${height}px`)
    }
    syncAffordanceMetrics()
    window.addEventListener('resize', syncAffordanceMetrics)
    return () => window.removeEventListener('resize', syncAffordanceMetrics)
  }, [returnLabel])

  useEffect(() => {
    if (!visualArmed) return undefined
    completedRef.current = false
    let directGesture = null

    const completeOnce = () => {
      if (completedRef.current) return
      completedRef.current = true
      pendingCompleteRef.current = true
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      pendingArrowFadeRef.current = entryReady && !reduced
      setCompleting(true)
      setExitStage('retracting')
    }

    const onWheel = event => {
      if (event.deltaY > RETURN_WHEEL_THRESHOLD) completeOnce()
    }

    const onPointerDown = event => {
      if (!isDirectPointer(event.pointerType)) return
      directGesture = {
        pointerId: event.pointerId,
        startY: event.clientY,
      }
    }

    const onPointerMove = event => {
      if (!directGesture || event.pointerId !== directGesture.pointerId) return
      if (directGesture.startY - event.clientY <= RETURN_DIRECT_THRESHOLD) return
      directGesture = null
      completeOnce()
    }

    const clearDirectGesture = event => {
      if (!directGesture || event.pointerId !== directGesture.pointerId) return
      directGesture = null
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', clearDirectGesture, { passive: true })
    window.addEventListener('pointercancel', clearDirectGesture, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', clearDirectGesture)
      window.removeEventListener('pointercancel', clearDirectGesture)
    }
  }, [entryReady, visualArmed])

  const arrowVisible = (exitStage === 'idle' || exitStage === 'retracting')
    && (entryReady || pendingArrowFadeRef.current)
  const affordanceVisible = visualArmed || progress > 0.001 || exitStage !== 'idle'

  return (
    <button
      type="button"
      className={`reader-return-control${visualArmed ? ' is-armed' : ''}${affordanceVisible ? ' has-affordance' : ''}`}
      style={{
        '--return-progress': progress,
        '--return-ring-retract-ms': `${RETURN_RING_RETRACT_MS}ms`,
        '--return-arrow-fade-ms': `${RETURN_ARROW_FADE_MS}ms`,
        '--return-content-fade-ms': `${RETURN_CONTENT_FADE_MS}ms`,
      }}
      data-reader-return-control="true"
      data-return-armed={visualArmed ? 'true' : 'false'}
      data-return-progress={progress.toFixed(3)}
      data-return-ready={arrowVisible ? 'true' : 'false'}
      data-return-completing={completing ? 'true' : 'false'}
      data-return-exit-stage={exitStage}
      onPointerEnter={event => {
        if (!completing && event.pointerType === 'mouse' && hasHoverPointer()) onArm()
      }}
      onPointerLeave={event => {
        if (!completing && !entryReady && event.pointerType === 'mouse' && hasHoverPointer()) onDisarm()
      }}
      onPointerUp={event => {
        if (!completing && isDirectPointer(event.pointerType) && !armed) onArm()
      }}
      onClick={event => {
        if (!completing && event.detail === 0 && !armed) onArm()
      }}
      aria-label={returnHint}
      aria-pressed={visualArmed}
      onTransitionEnd={event => {
        if (
          completing
          && event.propertyName === 'opacity'
          && event.target.classList.contains('reader-return-affordance__arrow')
          && exitStage === 'arrow-fading'
        ) setExitStage('content-fading')
        if (
          completing
          && event.propertyName === 'opacity'
          && event.target.classList.contains('reader-return-text')
          && exitStage === 'content-fading'
        ) {
          pendingCompleteRef.current = false
          onCompleteRef.current()
        }
      }}
    >
      <span ref={returnTextRef} className="reader-return-text">{returnLabel}</span>
      <svg className="reader-return-affordance" viewBox="0 0 80 80" aria-hidden="true">
        <path className="reader-return-affordance__ring" pathLength="1" d="M40 5C61 4 74 17 74 39C74 61 61 75 39 74C17 73 5 61 6 39C7 17 19 6 40 5" />
        <path className="reader-return-affordance__arrow" pathLength="1" d="M40 22C39 33 40 45 40 57M31 48C34 52 37 56 40 59M49 48C46 52 43 56 40 59" />
      </svg>
    </button>
  )
}

export default ReaderReturnControl
