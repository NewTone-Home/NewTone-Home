import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import LandingEntryArrow from '../landing/LandingEntryArrow'
import './ReaderReturnControl.css'

const RETURN_RING_DRAW_MS = 2200
const RETURN_RING_RETRACT_MS = 1200
const RETURN_WHEEL_THRESHOLD = 8
const RETURN_DIRECT_THRESHOLD = 36
const RETURN_SCRAMBLE = '01░▒/\\-_:;~*#+%&@'

function randomReturnChar() {
  return RETURN_SCRAMBLE[Math.floor(Math.random() * RETURN_SCRAMBLE.length)]
}

function useReturnScrambleText(text) {
  const [displayText, setDisplayText] = useState('')
  const [stable, setStable] = useState(false)

  useEffect(() => {
    let mounted = true
    let resolvedCount = 0
    const scrambleTimer = window.setInterval(() => {
      if (!mounted) return
      setDisplayText(text.split('').map((char, index) => index < resolvedCount ? char : randomReturnChar()).join(''))
    }, 40)
    const resolveTimer = window.setInterval(() => {
      if (!mounted) return
      resolvedCount += 1
      if (resolvedCount >= text.length) {
        window.clearInterval(resolveTimer)
        window.clearInterval(scrambleTimer)
        setDisplayText(text)
        setStable(true)
        return
      }
      setDisplayText(text.split('').map((char, index) => index < resolvedCount ? char : randomReturnChar()).join(''))
    }, Math.max(70, Math.floor(650 / Math.max(1, text.length))))
    setDisplayText(text.split('').map(() => randomReturnChar()).join(''))
    setStable(false)
    return () => {
      mounted = false
      window.clearInterval(scrambleTimer)
      window.clearInterval(resolveTimer)
    }
  }, [text])

  return { displayText, stable }
}

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
  const returnTextRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const { displayText: returnDisplayText, stable: returnTextStable } = useReturnScrambleText(returnLabel)
  const [progress, setProgress] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [arrowFadeComplete, setArrowFadeComplete] = useState(true)
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const pendingCompleteRef = useRef(false)
  const frameRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const visualArmed = armed && !completing

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
    if (!visualArmed && pendingCompleteRef.current && !arrowFadeComplete) return undefined
    const from = progressRef.current
    const target = visualArmed ? 1 : 0
    const distance = Math.abs(target - from)

    const finishTarget = () => {
      progressRef.current = target
      setProgress(target)
      frameRef.current = 0
      if (target === 0 && pendingCompleteRef.current) {
        pendingCompleteRef.current = false
        onCompleteRef.current()
      }
    }

    if (distance < 0.001) {
      finishTarget()
      return undefined
    }

    const fullDuration = visualArmed ? RETURN_RING_DRAW_MS : RETURN_RING_RETRACT_MS
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
  }, [arrowFadeComplete, visualArmed])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  useEffect(() => {
    if (!armed && !pendingCompleteRef.current) setCompleting(false)
  }, [armed])

  const entryReady = visualArmed && progress >= 0.999

  useEffect(() => {
    onReadyChange?.(entryReady || completing)
  }, [completing, entryReady, onReadyChange])

  useEffect(() => {
    if (!visualArmed) return undefined
    completedRef.current = false
    let directGesture = null

    const completeOnce = () => {
      if (completedRef.current) return
      completedRef.current = true
      pendingCompleteRef.current = true
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      setArrowFadeComplete(!entryReady || !returnTextStable || reduced)
      setCompleting(true)
      setHovered(false)
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
  }, [entryReady, returnTextStable, visualArmed])

  const affordanceVisible = visualArmed || progress > 0.001

  return (
    <button
      type="button"
      className={`reader-return-control${visualArmed ? ' is-armed' : ''}${affordanceVisible ? ' has-affordance' : ''}`}
      style={{ '--return-progress': progress }}
      data-reader-return-control="true"
      data-return-armed={visualArmed ? 'true' : 'false'}
      data-return-progress={progress.toFixed(3)}
      data-return-ready={entryReady ? 'true' : 'false'}
      data-return-completing={completing ? 'true' : 'false'}
      onPointerEnter={event => {
        setHovered(true)
        if (!completing && event.pointerType === 'mouse' && hasHoverPointer()) onArm()
      }}
      onPointerLeave={event => {
        setHovered(false)
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
    >
      <span className="reader-return-text-row">
        <span ref={returnTextRef} className="reader-return-text" data-stable={returnTextStable ? 'true' : 'false'}>
          {returnDisplayText || returnLabel}
        </span>
        <LandingEntryArrow
          className="reader-return-entry-arrow"
          direction={completing ? 'left' : hovered ? 'down' : 'left'}
          initialDirection="right"
          phase={completing ? 'retracting' : 'steady'}
          sourceRef={returnTextRef}
          entryReady={returnTextStable}
          showRing={false}
          onExitComplete={() => setArrowFadeComplete(true)}
        />
      </span>
    </button>
  )
}

export default ReaderReturnControl
