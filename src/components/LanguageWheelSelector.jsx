import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import EntryButtonFrame, { useEntryFrameProgress } from './EntryButtonFrame'
import './LanguageWheelSelector.css'

const LANGUAGE_FILL_DIRECTIONS = Object.freeze(['left', 'right', 'top', 'bottom'])
const LANGUAGE_FILL_DURATION_MS = 520
export const LANGUAGE_WHEEL_TRANSITION_MS = 360
export const LANGUAGE_ARROW_DELAY_MS = 0
export const LANGUAGE_SWIPE_THRESHOLD_PX = 24

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function cycleLanguage(code, direction) {
  const currentIndex = READER_LANGUAGES.findIndex(item => item.code === code)
  const safeIndex = currentIndex < 0 ? 0 : currentIndex
  const nextIndex = (safeIndex + direction + READER_LANGUAGES.length) % READER_LANGUAGES.length
  return READER_LANGUAGES[nextIndex].code
}

function trackCodes(code) {
  return [cycleLanguage(code, -1), code, cycleLanguage(code, 1)]
}

function randomDirection(previous) {
  const options = LANGUAGE_FILL_DIRECTIONS.filter(direction => direction !== previous)
  return options[Math.floor(Math.random() * options.length)] || LANGUAGE_FILL_DIRECTIONS[0]
}

function requestFrame(callback) {
  return window.requestAnimationFrame(callback)
}

function cancelFrame(frame) {
  if (frame) window.cancelAnimationFrame(frame)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

function LanguageWheelSelector({ language, onLanguageChange, visible = true }) {
  const coarse = isCoarsePointer()
  const rootRef = useRef(null)
  const viewportRef = useRef(null)
  const phaseRef = useRef('idle')
  const selectedLanguageRef = useRef(language)
  const trackRef = useRef(null)
  const pointerRef = useRef({ id: null, startY: 0 })
  const dragOffsetRef = useRef(0)
  const suppressClickRef = useRef(false)
  const coverProgressRef = useRef(1)
  const coverAnimationRef = useRef({ token: 0, frame: 0 })
  const closeRequestedRef = useRef(false)
  const onLanguageChangeRef = useRef(onLanguageChange)
  const [phase, setPhase] = useState('idle')
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [fillDirection, setFillDirection] = useState(() => (coarse ? 'top' : randomDirection()))
  const [coverProgress, setCoverProgress] = useState(1)
  const [track, setTrack] = useState(null)
  const [trackState, setTrackState] = useState('center')
  const [dragOffset, setDragOffset] = useState(0)
  const [arrowState, setArrowState] = useState('hidden')
  const frameProgress = useEntryFrameProgress(visible, 'language-selector-frame')

  onLanguageChangeRef.current = onLanguageChange

  const setSelectorPhase = useCallback(nextPhase => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const cancelCoverAnimation = useCallback(() => {
    const frame = coverAnimationRef.current.frame
    if (frame) cancelFrame(frame)
    coverAnimationRef.current = {
      token: coverAnimationRef.current.token + 1,
      frame: 0,
    }
  }, [])

  const animateCover = useCallback((target, onComplete) => {
    cancelCoverAnimation()
    const token = coverAnimationRef.current.token
    const from = coverProgressRef.current
    const startedAt = performance.now()

    const tick = timestamp => {
      if (token !== coverAnimationRef.current.token) return
      const raw = Math.min(1, Math.max(0, (timestamp - startedAt) / LANGUAGE_FILL_DURATION_MS))
      const next = from + (target - from) * easeInOut(raw)
      coverProgressRef.current = next
      setCoverProgress(next)
      if (raw < 1) {
        coverAnimationRef.current.frame = requestFrame(tick)
        return
      }
      coverAnimationRef.current.frame = 0
      onComplete?.()
    }

    coverAnimationRef.current.frame = requestFrame(tick)
  }, [cancelCoverAnimation])

  const closeSelector = useCallback(source => {
    const currentPhase = phaseRef.current
    if (currentPhase === 'idle' || currentPhase === 'closing') return
    if (currentPhase === 'snapping') {
      closeRequestedRef.current = true
      return
    }

    closeRequestedRef.current = false
    setArrowState('fading')
    setFillDirection(coarse ? 'top' : randomDirection(fillDirection))
    setSelectorPhase('closing')
    recordRuntimeAudit('language-fill-close-start', { source, direction: coarse ? 'top' : 'random' })
    animateCover(1, () => {
      if (phaseRef.current !== 'closing') return
      setTrack(null)
      setTrackState('center')
      dragOffsetRef.current = 0
      setDragOffset(0)
      setArrowState('hidden')
      setSelectorPhase('idle')
      recordRuntimeAudit('language-fill-close-complete', { source })
    })
  }, [animateCover, coarse, fillDirection, setSelectorPhase])

  const openSelector = useCallback(source => {
    if (!visible || phaseRef.current !== 'idle') return
    const direction = coarse ? 'top' : randomDirection(fillDirection)
    setFillDirection(direction)
    setSelectorPhase('opening')
    recordRuntimeAudit('language-fill-open-start', { source, direction })
    animateCover(0, () => {
      if (phaseRef.current !== 'opening') return
      setSelectorPhase('ready')
      recordRuntimeAudit('language-fill-open-complete', {
        source,
        language: selectedLanguageRef.current,
        direction,
      })
      setArrowState('entering')
      recordRuntimeAudit('language-arrow-reveal-start', { language: selectedLanguageRef.current })
      requestFrame(() => {
        if (phaseRef.current !== 'ready') return
        setArrowState('visible')
        recordRuntimeAudit('language-arrow-revealed', { language: selectedLanguageRef.current })
      })
    })
  }, [animateCover, coarse, fillDirection, setSelectorPhase, visible])

  const startSnap = useCallback((direction, source, dragDistance = 0) => {
    if (phaseRef.current !== 'ready' && phaseRef.current !== 'dragging') return
    const from = selectedLanguageRef.current
    const target = cycleLanguage(from, direction)
    setTrack({ from, target, direction, source })
    trackRef.current = { from, target, direction, source }
    setTrackState('center')
    dragOffsetRef.current = dragDistance
    setDragOffset(dragDistance)
    setSelectorPhase('snapping')
    recordRuntimeAudit('language-wheel-snap-start', { from, target, direction, source, dragDistance })
    requestFrame(() => {
      if (phaseRef.current !== 'snapping') return
      setDragOffset(0)
      dragOffsetRef.current = 0
      setTrackState(direction > 0 ? 'next' : 'previous')
      recordRuntimeAudit('language-wheel-transition-start', { language: target, direction, source })
    })
  }, [setSelectorPhase])

  const cancelSnap = useCallback(() => {
    if (phaseRef.current !== 'dragging') return
    setTrack(null)
    trackRef.current = null
    setTrackState('center')
    setSelectorPhase('snapping')
    recordRuntimeAudit('language-wheel-snap-start', { source: 'drag-cancel', dragDistance: dragOffsetRef.current })
    requestFrame(() => {
      dragOffsetRef.current = 0
      setDragOffset(0)
    })
  }, [setSelectorPhase])

  const handleTrackTransitionEnd = useCallback(event => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (phaseRef.current !== 'snapping') return

    const completedTrack = trackRef.current
    if (!completedTrack) {
      setSelectorPhase('ready')
      recordRuntimeAudit('language-wheel-snap-cancelled', {})
      return
    }

    selectedLanguageRef.current = completedTrack.target
    setSelectedLanguage(completedTrack.target)
    setTrack(null)
    trackRef.current = null
    setTrackState('center')
    setSelectorPhase('ready')
    recordRuntimeAudit('language-wheel-transition-complete', {
      language: completedTrack.target,
      direction: completedTrack.direction,
      source: completedTrack.source,
    })
    onLanguageChangeRef.current?.(completedTrack.target)
    recordRuntimeAudit('language-wheel-language-committed', {
      language: completedTrack.target,
      previousLanguage: completedTrack.from,
      direction: completedTrack.direction,
      source: completedTrack.source,
    })

    if (closeRequestedRef.current) {
      closeRequestedRef.current = false
      requestFrame(() => closeSelector('pointer-leave'))
    }
  }, [closeSelector, setSelectorPhase])

  const handleWheel = useCallback(event => {
    if (coarse || phaseRef.current !== 'ready' || Math.abs(event.deltaY) < 1) return
    event.preventDefault()
    startSnap(event.deltaY > 0 ? 1 : -1, 'wheel')
  }, [coarse, startSnap])

  const handlePointerEnter = useCallback(event => {
    if (coarse || event.pointerType !== 'mouse') return
    openSelector('hover')
  }, [coarse, openSelector])

  const handlePointerLeave = useCallback(event => {
    if (coarse || event.pointerType !== 'mouse') return
    closeSelector('pointer-leave')
  }, [coarse, closeSelector])

  const handleClick = useCallback(() => {
    if (!coarse) return
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    openSelector('tap')
  }, [coarse, openSelector])

  const handlePointerDown = useCallback(event => {
    if (!coarse || phaseRef.current !== 'ready') return
    pointerRef.current = { id: event.pointerId, startY: event.clientY }
    suppressClickRef.current = true
    dragOffsetRef.current = 0
    setDragOffset(0)
    setSelectorPhase('dragging')
    recordRuntimeAudit('language-wheel-drag-start', { language: selectedLanguageRef.current })
  }, [coarse, setSelectorPhase])

  useEffect(() => {
    if (!coarse || phase !== 'dragging') return undefined

    const handleMove = event => {
      if (pointerRef.current.id !== event.pointerId) return
      event.preventDefault()
      const startY = pointerRef.current.startY
      const viewportHeight = viewportRef.current?.getBoundingClientRect().height || 36
      const maxOffset = Math.max(viewportHeight, 36)
      const nextOffset = clamp(event.clientY - startY, -maxOffset, maxOffset)
      dragOffsetRef.current = nextOffset
      setDragOffset(nextOffset)
      recordRuntimeAudit('language-wheel-drag-move', { offset: Math.round(nextOffset) })
    }

    const handleEnd = event => {
      if (pointerRef.current.id !== event.pointerId) return
      const deltaY = dragOffsetRef.current
      pointerRef.current = { id: null, startY: 0 }
      recordRuntimeAudit('language-wheel-drag-end', { offset: Math.round(deltaY) })
      const viewportHeight = viewportRef.current?.getBoundingClientRect().height || 36
      const threshold = Math.max(LANGUAGE_SWIPE_THRESHOLD_PX, viewportHeight * .35)
      if (Math.abs(deltaY) < threshold) {
        cancelSnap()
        return
      }
      startSnap(deltaY > 0 ? 1 : -1, 'drag', deltaY)
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [cancelSnap, coarse, phase, startSnap])

  useEffect(() => {
    if (!coarse || phase === 'idle') return undefined
    const handleOutsidePointer = event => {
      if (!rootRef.current?.contains(event.target)) closeSelector('outside-tap')
    }
    document.addEventListener('pointerdown', handleOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true)
  }, [closeSelector, coarse, phase])

  useEffect(() => {
    if (phase === 'idle' && !track) {
      selectedLanguageRef.current = language
      setSelectedLanguage(language)
    }
  }, [language, phase, track])

  useEffect(() => () => cancelCoverAnimation(), [cancelCoverAnimation])

  const codes = trackCodes(track?.from || selectedLanguage)
  const labels = codes.map(code => getReaderLanguage(code).label)
  const accessibleLanguage = phase === 'idle' ? '当前语言' : getReaderLanguage(selectedLanguage).label
  const coverState = coverProgress > .999 ? 'closed' : coverProgress < .001 ? 'open' : 'moving'
  const trackClass = track ? trackState : 'center'

  return (
    <button
      ref={rootRef}
      type="button"
      className="shared-entry-control language-wheel-selector"
      data-language-selector="true"
      data-language-selector-phase={phase}
      data-language-selected={selectedLanguage}
      data-language-track-state={trackClass}
      data-language-arrow-state={arrowState}
      data-language-fill="shared-path"
      data-language-fill-progress={coverProgress.toFixed(3)}
      data-language-fill-direction={fillDirection}
      data-language-cover-state={coverState}
      data-language-input={coarse ? 'touch' : 'wheel'}
      data-language-candidates={coarse ? 'vertical' : 'none'}
      data-entry-frame-progress={frameProgress.toFixed(3)}
      data-language-drag-offset={dragOffset.toFixed(1)}
      data-entry-frame-fill="enabled"
      data-entry-paint-model="shared-path-fill>shared-path-stroke>text"
      aria-label={`${accessibleLanguage}，语言选择`}
      aria-hidden={!visible && frameProgress < .001}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <span className="shared-entry-content language-wheel-selector__content">
        <EntryButtonFrame
          className="language-wheel-selector__surface"
          frameProgress={frameProgress}
          fillProgress={coverProgress}
          fillDirection={fillDirection}
          fillEnabled
          materialMode="background"
        />
        <span className="language-wheel-selector__viewport" ref={viewportRef} aria-hidden="true">
          <span className="language-wheel-selector__placeholder">当前语言</span>
          <span
            className="language-wheel-selector__track"
            data-language-track-state={trackClass}
            style={{ '--language-drag-offset': `${dragOffset}px` }}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {labels.map((label, index) => (
              <span
                className={`language-wheel-selector__slot language-wheel-selector__slot--${index === 1 ? 'current' : index === 0 ? 'previous' : 'next'}`}
                key={`${codes[index]}:${index}`}
              >
                {label}
              </span>
            ))}
          </span>
        </span>
      </span>
      {arrowState !== 'hidden' && (
        <span className="language-wheel-selector__arrow" aria-hidden="true">↓</span>
      )}
    </button>
  )
}

export { LANGUAGE_FILL_DIRECTIONS }
export default LanguageWheelSelector
