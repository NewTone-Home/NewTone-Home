import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderLanguage, READER_LANGUAGES } from '../i18n/languages'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import EntryButtonFrame from './EntryButtonFrame'
import { ENTRY_BUTTON_TIMINGS, createEntryProgress, useEntryButtonTimeline } from './entryButtonTimeline'
import './LanguageWheelSelector.css'

const LANGUAGE_FILL_DIRECTIONS = Object.freeze(['left', 'right', 'top', 'bottom'])
export const LANGUAGE_WHEEL_TRANSITION_MS = 360
export const LANGUAGE_ARROW_DELAY_MS = 180
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function LanguageWheelSelector({ language, onLanguagePreview, visible = true }) {
  const coarse = isCoarsePointer()
  const rootRef = useRef(null)
  const viewportRef = useRef(null)
  const phaseRef = useRef('idle')
  const selectedLanguageRef = useRef(language)
  const trackRef = useRef(null)
  const pointerRef = useRef({ id: null, startY: 0 })
  const dragOffsetRef = useRef(0)
  const suppressClickRef = useRef(false)
  const closeRequestedRef = useRef(false)
  const inputReadyRef = useRef(false)
  const exitStartedRef = useRef(false)
  const arrowRevealFrameRef = useRef(0)
  const onLanguagePreviewRef = useRef(onLanguagePreview)
  const [phase, setPhase] = useState('idle')
  const [selectedLanguage, setSelectedLanguage] = useState(language)
  const [fillDirection, setFillDirection] = useState(() => randomDirection())
  const [track, setTrack] = useState(null)
  const [trackState, setTrackState] = useState('center')
  const [trackMotion, setTrackMotion] = useState('idle')
  const [dragOffset, setDragOffset] = useState(0)
  const [arrowState, setArrowState] = useState('hidden')

  onLanguagePreviewRef.current = onLanguagePreview

  const setSelectorPhase = useCallback(nextPhase => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const { progress, runTimeline } = useEntryButtonTimeline({
    initialProgress: createEntryProgress(),
    onStart: steps => recordRuntimeAudit('language-timeline-start', {
      phase: phaseRef.current,
      steps: steps.map(step => step.key),
    }),
    onStep: ({ key, progress: stepProgress }) => recordRuntimeAudit('language-timeline-step', {
      phase: phaseRef.current,
      key,
      progress: stepProgress,
    }),
  })

  const resetTrack = useCallback(() => {
    setTrack(null)
    trackRef.current = null
    setTrackState('center')
    setTrackMotion('reset')
    dragOffsetRef.current = 0
    setDragOffset(0)
    requestFrame(() => setTrackMotion('idle'))
  }, [])

  const centerTrack = useCallback((source = 'center') => {
    const current = selectedLanguageRef.current
    const centered = { from: current, target: current, direction: 0, source }
    setTrack(centered)
    trackRef.current = centered
    setTrackState('center')
    setTrackMotion('reset')
    dragOffsetRef.current = 0
    setDragOffset(0)
    requestFrame(() => setTrackMotion('idle'))
  }, [])

  const cancelArrowReveal = useCallback(() => {
    if (!arrowRevealFrameRef.current) return
    window.cancelAnimationFrame(arrowRevealFrameRef.current)
    arrowRevealFrameRef.current = 0
  }, [])

  const revealArrowAfterText = useCallback(() => {
    cancelArrowReveal()
    setArrowState('entering')
    recordRuntimeAudit('language-arrow-reveal-start', { language: selectedLanguageRef.current })
    const startedAt = performance.now()
    const tick = now => {
      if (phaseRef.current !== 'ready') {
        arrowRevealFrameRef.current = 0
        return
      }
      if (now - startedAt < LANGUAGE_ARROW_DELAY_MS) {
        arrowRevealFrameRef.current = requestFrame(tick)
        return
      }
      arrowRevealFrameRef.current = 0
      setArrowState('visible')
      recordRuntimeAudit('language-arrow-revealed', { language: selectedLanguageRef.current })
    }
    arrowRevealFrameRef.current = requestFrame(tick)
  }, [cancelArrowReveal])

  const finishClose = useCallback(source => {
    cancelArrowReveal()
    resetTrack()
    setArrowState('hidden')
    setSelectorPhase('idle')
    recordRuntimeAudit('language-fill-close-complete', { source })
  }, [cancelArrowReveal, resetTrack, setSelectorPhase])

  const closeSelector = useCallback(source => {
    const currentPhase = phaseRef.current
    if (currentPhase === 'idle' || currentPhase === 'closing' || currentPhase === 'hidden') return
    if (currentPhase === 'snapping') {
      closeRequestedRef.current = true
      setArrowState('fading')
      return
    }

    closeRequestedRef.current = false
    inputReadyRef.current = false
    cancelArrowReveal()
    setArrowState('fading')
    setFillDirection(coarse ? 'top' : randomDirection(fillDirection))
    setSelectorPhase('closing')
    recordRuntimeAudit('language-fill-close-start', { source, direction: coarse ? 'top' : 'random' })
    runTimeline([{ key: 'text', to: 0, duration: ENTRY_BUTTON_TIMINGS.textExit }], () => {
      if (phaseRef.current !== 'closing') return
      finishClose(source)
      runTimeline([{ key: 'text', to: 1, duration: ENTRY_BUTTON_TIMINGS.textEnter }], () => {
        inputReadyRef.current = true
      })
    })
  }, [cancelArrowReveal, coarse, fillDirection, finishClose, runTimeline, setSelectorPhase])

  const openSelector = useCallback(source => {
    if (!visible || !inputReadyRef.current || phaseRef.current !== 'idle') return
    const direction = coarse ? 'top' : randomDirection(fillDirection)
    const current = selectedLanguageRef.current
    setFillDirection(direction)
    setTrack({ from: current, target: current, direction: 0, source })
    trackRef.current = { from: current, target: current, direction: 0, source }
    setTrackState('center')
    setTrackMotion('reset')
    setSelectorPhase('opening')
    recordRuntimeAudit('language-fill-open-start', { source, direction })
    runTimeline([{ key: 'text', to: 0, duration: ENTRY_BUTTON_TIMINGS.textExit }], () => {
      if (phaseRef.current !== 'opening') return
      setSelectorPhase('ready')
      runTimeline([{ key: 'text', to: 1, duration: ENTRY_BUTTON_TIMINGS.textEnter }], () => {
        if (phaseRef.current !== 'ready') return
        recordRuntimeAudit('language-fill-open-complete', {
          source,
          language: selectedLanguageRef.current,
          direction,
        })
        revealArrowAfterText()
      })
    })
  }, [coarse, fillDirection, revealArrowAfterText, runTimeline, setSelectorPhase, visible])

  const startSnap = useCallback((direction, source, dragDistance = 0) => {
    if (phaseRef.current !== 'ready' && phaseRef.current !== 'dragging') return
    const from = selectedLanguageRef.current
    const target = cycleLanguage(from, direction)
    const nextTrack = { from, target, direction, source }
    setTrack(nextTrack)
    trackRef.current = nextTrack
    setTrackState('center')
    setTrackMotion('moving')
    dragOffsetRef.current = dragDistance
    setDragOffset(dragDistance)
    setSelectorPhase('snapping')
    setArrowState('fading')
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
    centerTrack('snap-cancelled')
    setSelectorPhase('ready')
    setArrowState('visible')
    recordRuntimeAudit('language-wheel-snap-cancelled', {})
  }, [centerTrack, setSelectorPhase])

  const handleTrackTransitionEnd = useCallback(event => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (phaseRef.current !== 'snapping') return

    const completedTrack = trackRef.current
    if (!completedTrack) {
      resetTrack()
      setSelectorPhase('ready')
      return
    }

    selectedLanguageRef.current = completedTrack.target
    setSelectedLanguage(completedTrack.target)
    centerTrack('preview')
    setSelectorPhase('ready')
    recordRuntimeAudit('language-wheel-transition-complete', {
      language: completedTrack.target,
      direction: completedTrack.direction,
      source: completedTrack.source,
    })
    onLanguagePreviewRef.current?.(completedTrack.target)
    recordRuntimeAudit('language-wheel-language-previewed', {
      language: completedTrack.target,
      previousLanguage: completedTrack.from,
      direction: completedTrack.direction,
      source: completedTrack.source,
    })
    setArrowState('hidden')
    recordRuntimeAudit('language-arrow-dismissed', { source: completedTrack.source })
    if (closeRequestedRef.current) {
      closeRequestedRef.current = false
      requestFrame(() => closeSelector('pointer-leave'))
    }
  }, [centerTrack, closeSelector, setSelectorPhase])

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
    if (!coarse || phase === 'idle' || phase === 'hidden') return undefined
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

  useEffect(() => {
    inputReadyRef.current = false
    exitStartedRef.current = false
    runTimeline([
      { key: 'text', to: 1, duration: ENTRY_BUTTON_TIMINGS.textEnter },
      { key: 'frame', to: 1, duration: ENTRY_BUTTON_TIMINGS.frameEnter },
      { key: 'fill', to: 1, duration: ENTRY_BUTTON_TIMINGS.fillOpen },
    ], () => {
      inputReadyRef.current = true
      recordRuntimeAudit('language-entry-ready', {})
    })
  }, [runTimeline])

  useEffect(() => () => cancelArrowReveal(), [cancelArrowReveal])

  useEffect(() => {
    if (visible) return undefined
    if (exitStartedRef.current) return undefined

    exitStartedRef.current = true
    inputReadyRef.current = false
    cancelArrowReveal()
    pointerRef.current = { id: null, startY: 0 }
    closeRequestedRef.current = false
    setArrowState('fading')
    setSelectorPhase('exiting')
    recordRuntimeAudit('language-entry-exit-start', {})
    runTimeline([
      { key: 'text', to: 0, duration: ENTRY_BUTTON_TIMINGS.textExit },
      { key: 'fill', to: 0, duration: ENTRY_BUTTON_TIMINGS.fillClose },
      { key: 'frame', to: 0, duration: ENTRY_BUTTON_TIMINGS.frameExit },
    ], () => {
      resetTrack()
      setArrowState('hidden')
      setSelectorPhase('hidden')
      recordRuntimeAudit('language-entry-exit-complete', {})
    })
    return undefined
  }, [cancelArrowReveal, resetTrack, runTimeline, setSelectorPhase, visible])

  const codes = trackCodes(track?.from || selectedLanguage)
  const labels = codes.map(code => getReaderLanguage(code).label)
  const activeLabel = getReaderLanguage(selectedLanguage).label
  const showsTrack = ['opening', 'ready', 'snapping', 'dragging', 'closing'].includes(phase)
  const accessibleLanguage = ['idle', 'closing', 'hidden'].includes(phase) ? '当前语言' : activeLabel
  const coverState = progress.fill > .999 ? 'closed' : progress.fill < .001 ? 'open' : 'moving'
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
      data-language-track-motion={trackMotion}
      data-language-arrow-state={arrowState}
      data-language-fill="shared-path"
      data-language-fill-progress={progress.fill.toFixed(3)}
      data-language-fill-direction={fillDirection}
      data-language-cover-state={coverState}
      data-language-input={coarse ? 'touch' : 'wheel'}
      data-language-candidates={coarse ? 'vertical' : 'none'}
      data-entry-frame-progress={progress.frame.toFixed(3)}
      data-language-text-progress={progress.text.toFixed(3)}
      data-language-drag-offset={dragOffset.toFixed(1)}
      data-entry-frame-fill="enabled"
      data-entry-paint-model="shared-path-fill>shared-path-stroke>text"
      aria-label={`${accessibleLanguage}，语言选择`}
      aria-hidden={!visible || progress.frame < .001}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <span className="shared-entry-content language-wheel-selector__content">
        <EntryButtonFrame
          className="language-wheel-selector__surface"
          frameProgress={progress.frame}
          fillProgress={progress.fill}
          fillDirection={fillDirection}
          fillEnabled
          materialMode="background"
        />
        <span
          className={`language-wheel-selector__viewport${showsTrack ? ' language-wheel-selector__viewport--track' : ''}`}
          ref={viewportRef}
          aria-hidden="true"
          style={{ opacity: progress.text }}
        >
          {showsTrack ? (
            <span
              className="language-wheel-selector__track"
              data-language-track-state={trackClass}
              data-language-track-motion={trackMotion}
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
          ) : (
            <span className="language-wheel-selector__label">当前语言</span>
          )}
        </span>
      </span>
      {arrowState !== 'hidden' && (
        <span className="language-wheel-selector__arrow" aria-hidden="true">↓</span>
      )}
    </button>
  )
}

export default LanguageWheelSelector
