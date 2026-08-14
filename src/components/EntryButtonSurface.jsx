import { useCallback, useEffect, useRef, useState } from 'react'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import EntryButtonFrame, { FILL_DIRECTIONS, FRAME_ORIGINS } from './EntryButtonFrame'
import './EntryButtonSurface.css'

const TIMINGS = Object.freeze({
  textEnter: 320,
  frameEnter: 720,
  fillOpen: 520,
  textExit: 260,
  fillClose: 520,
  frameExit: 420,
})

function createProgress() {
  return { text: 0, frame: 0, fill: 0 }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

function resolveActiveText(materialMode, worldLayer) {
  if (materialMode === 'background') return 'var(--reader-ink, var(--ink-dark))'
  return worldLayer === 'inner' ? '#191817' : '#f4efe6'
}

/**
 * Shared entry button surface.
 *
 * The host supplies visibility, material source, label, and action callbacks.
 * This component owns the only visual timeline used by Landing, Updates, and
 * Reader: hidden -> entering -> visible -> exiting -> hidden.
 */
function EntryButtonSurface({
  visible = false,
  mobile = false,
  materialMode = 'background',
  worldLayer = 'surface',
  entryId = 'entry',
  label,
  ariaLabel = label,
  className = '',
  disabled = false,
  dataAttributes = {},
  onActionStart,
  onActionComplete,
}) {
  const [phase, setPhase] = useState('hidden')
  const [progress, setProgress] = useState(createProgress)
  const [variant, setVariant] = useState(() => ({
    fillDirection: 'left',
    frameOrigin: randomItem(FRAME_ORIGINS),
  }))
  const phaseRef = useRef('hidden')
  const progressRef = useRef(createProgress())
  const mobileRef = useRef(mobile)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const fillDirectionQueueRef = useRef([])
  const timelineRef = useRef({ token: 0, frame: 0 })
  const entryCompleteRef = useRef(false)
  const actionRequestedRef = useRef(false)
  const actionModeRef = useRef(null)
  const inputTypeRef = useRef('programmatic')
  const onActionStartRef = useRef(onActionStart)
  const onActionCompleteRef = useRef(onActionComplete)

  mobileRef.current = mobile
  onActionStartRef.current = onActionStart
  onActionCompleteRef.current = onActionComplete

  const auditFields = useCallback((extra = {}) => ({
    entryId,
    inputType: inputTypeRef.current,
    materialSource: materialMode,
    worldLayer,
    ...extra,
  }), [entryId, materialMode, worldLayer])

  const setPhaseValue = useCallback(nextPhase => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    recordRuntimeAudit('entry-phase', auditFields({ phase: nextPhase }))
  }, [auditFields])

  const setProgressValue = useCallback((key, value) => {
    const next = { ...progressRef.current, [key]: value }
    progressRef.current = next
    setProgress(next)
  }, [])

  const cancelTimeline = useCallback(() => {
    const hadFrame = Boolean(timelineRef.current.frame)
    if (timelineRef.current.frame) cancelAnimationFrame(timelineRef.current.frame)
    if (hadFrame) recordRuntimeAudit('entry-timeline-cancel', auditFields({ phase: phaseRef.current }))
    timelineRef.current = {
      token: timelineRef.current.token + 1,
      frame: 0,
    }
  }, [auditFields])

  const runTimeline = useCallback((steps, onComplete) => {
    cancelTimeline()
    const token = timelineRef.current.token
    recordRuntimeAudit('entry-timeline-start', auditFields({
      phase: phaseRef.current,
      steps: steps.map(step => step.key),
    }))
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let stepIndex = 0

    const runNextStep = () => {
      if (token !== timelineRef.current.token) return
      const step = steps[stepIndex]
      if (!step) {
        timelineRef.current.frame = 0
        onComplete?.()
        return
      }

      stepIndex += 1
      const from = progressRef.current[step.key]
      const target = clamp(step.to)
      const distance = Math.abs(target - from)
      const duration = reducedMotion ? Math.min(120, step.duration) : step.duration

      const finishStep = () => {
        setProgressValue(step.key, target)
        recordRuntimeAudit('entry-timeline-step', auditFields({
          phase: phaseRef.current,
          key: step.key,
          progress: target,
        }))
        runNextStep()
      }

      if (distance < 0.001 || duration <= 0) {
        finishStep()
        return
      }

      const startedAt = performance.now()
      const tick = now => {
        if (token !== timelineRef.current.token) return
        const raw = Math.min(1, (now - startedAt) / duration)
        setProgressValue(step.key, from + (target - from) * easeInOut(raw))
        if (raw < 1) {
          timelineRef.current.frame = requestAnimationFrame(tick)
          return
        }
        timelineRef.current.frame = 0
        finishStep()
      }

      timelineRef.current.frame = requestAnimationFrame(tick)
    }

    runNextStep()
  }, [auditFields, cancelTimeline, setProgressValue])

  const activateFill = useCallback(() => {
    if (!entryCompleteRef.current || phaseRef.current !== 'visible') return

    if (progressRef.current.fill <= 0.001) {
      const nextDirection = fillDirectionQueueRef.current.length > 0
        ? fillDirectionQueueRef.current.shift()
        : (() => {
            fillDirectionQueueRef.current.push(...[...FILL_DIRECTIONS].sort(() => Math.random() - 0.5))
            return fillDirectionQueueRef.current.shift()
          })()
      setVariant(current => ({ ...current, fillDirection: nextDirection }))
    }

    runTimeline([{ key: 'fill', to: 1, duration: TIMINGS.fillOpen }])
  }, [runTimeline])

  const deactivateFill = useCallback(() => {
    if (!entryCompleteRef.current || phaseRef.current !== 'visible') return
    runTimeline([{ key: 'fill', to: 0, duration: TIMINGS.fillClose }])
  }, [runTimeline])

  const startEntry = useCallback(() => {
    const canResumeEntering = phaseRef.current === 'entering' && !timelineRef.current.frame
    if (phaseRef.current !== 'hidden' && phaseRef.current !== 'exiting' && !canResumeEntering) return
    if (phaseRef.current === 'hidden') {
      setVariant(current => ({ ...current, frameOrigin: randomItem(FRAME_ORIGINS) }))
    }
    entryCompleteRef.current = false
    actionModeRef.current = null
    setPhaseValue('entering')
    runTimeline([
      { key: 'text', to: 1, duration: TIMINGS.textEnter },
      { key: 'frame', to: 1, duration: TIMINGS.frameEnter },
    ], () => {
      if (phaseRef.current !== 'entering') return
      entryCompleteRef.current = true
      setPhaseValue('visible')
      if (mobileRef.current || hoveredRef.current || focusedRef.current) activateFill()
    })
  }, [activateFill, runTimeline, setPhaseValue])

  const startExit = useCallback((mode) => {
    if (phaseRef.current === 'hidden' || phaseRef.current === 'exiting') return
    entryCompleteRef.current = false
    actionModeRef.current = mode
    setPhaseValue('exiting')
    runTimeline([
      { key: 'text', to: 0, duration: TIMINGS.textExit },
      { key: 'fill', to: 0, duration: TIMINGS.fillClose },
      { key: 'frame', to: 0, duration: TIMINGS.frameExit },
    ], () => {
      if (phaseRef.current !== 'exiting') return
      const completedMode = actionModeRef.current
      actionModeRef.current = null
      setPhaseValue('hidden')
      if (completedMode === 'activate') {
        actionRequestedRef.current = false
        recordRuntimeAudit('entry-action-complete', auditFields({
          textProgress: 0,
          fillProgress: 0,
          frameProgress: 0,
        }))
        onActionCompleteRef.current?.({ entryId, inputType: inputTypeRef.current })
      }
    })
  }, [auditFields, entryId, runTimeline, setPhaseValue])

  useEffect(() => {
    if (visible) {
      if (actionRequestedRef.current) return undefined
      if (
        phaseRef.current === 'hidden'
        || phaseRef.current === 'exiting'
        || (phaseRef.current === 'entering' && !timelineRef.current.frame)
      ) startEntry()
      return undefined
    }

    if (!actionRequestedRef.current && ['entering', 'visible'].includes(phaseRef.current)) {
      startExit('dismiss')
    }
    return undefined
  }, [startEntry, startExit, visible])

  useEffect(() => {
    if (mobile && phaseRef.current === 'visible') activateFill()
  }, [activateFill, mobile])

  useEffect(() => () => cancelTimeline(), [cancelTimeline])

  const handleActionClick = useCallback(() => {
    if (!visible || disabled || actionRequestedRef.current || phaseRef.current !== 'visible') return
    actionRequestedRef.current = true
    recordRuntimeAudit('entry-click', auditFields({
      phase: phaseRef.current,
      textProgress: progressRef.current.text,
      fillProgress: progressRef.current.fill,
      frameProgress: progressRef.current.frame,
    }))
    onActionStartRef.current?.({ entryId, inputType: inputTypeRef.current })
    startExit('activate')
  }, [auditFields, disabled, entryId, startExit, visible])

  const handlePointerDown = useCallback(event => {
    inputTypeRef.current = event.pointerType || 'pointer'
  }, [])

  const handleKeyDown = useCallback(event => {
    if (event.key === 'Enter' || event.key === ' ') inputTypeRef.current = 'keyboard'
  }, [])

  const handlePointerEnter = useCallback(event => {
    if (event.pointerType !== 'mouse') return
    hoveredRef.current = true
    activateFill()
  }, [activateFill])

  const handlePointerLeave = useCallback(event => {
    if (event.pointerType !== 'mouse') return
    hoveredRef.current = false
    if (!focusedRef.current && !mobileRef.current) deactivateFill()
  }, [deactivateFill])

  const handleFocus = useCallback(() => {
    focusedRef.current = true
    activateFill()
  }, [activateFill])

  const handleBlur = useCallback(() => {
    focusedRef.current = false
    if (!hoveredRef.current && !mobileRef.current) deactivateFill()
  }, [deactivateFill])

  const present = phase !== 'hidden'
  const fillActive = progress.fill > 0.001
  const textStyle = { opacity: progress.text }
  const readerReturnData = entryId === 'reader-return'
    ? {
        'data-return-fill-direction': variant.fillDirection,
        'data-return-frame-origin': variant.frameOrigin,
        'data-return-layer-model': 'shared-svg-geometry>text',
        'data-return-text-progress': progress.text.toFixed(3),
        'data-return-fill-progress': progress.fill.toFixed(3),
        'data-return-frame-progress': progress.frame.toFixed(3),
      }
    : {}

  return (
    <button
      type="button"
      className={['shared-entry-control', className].filter(Boolean).join(' ')}
      style={{
        '--return-text-active': resolveActiveText(materialMode, worldLayer),
        '--return-text-progress': progress.text,
        '--return-frame-progress': progress.frame,
        '--return-fill-progress': progress.fill,
      }}
      data-entry-id={entryId}
      data-entry-visible={present ? 'true' : 'false'}
      data-entry-phase={phase}
      data-entry-active={fillActive ? 'true' : 'false'}
      data-entry-mobile={mobile ? 'true' : 'false'}
      data-entry-material-source={materialMode}
      data-entry-world-layer={worldLayer}
      data-entry-fill-direction={variant.fillDirection}
      data-entry-frame-origin={variant.frameOrigin}
      data-entry-layer-model="shared-svg-geometry>text"
      data-entry-text-progress={progress.text.toFixed(3)}
      data-entry-fill-progress={progress.fill.toFixed(3)}
      data-entry-frame-progress={progress.frame.toFixed(3)}
      {...readerReturnData}
      {...dataAttributes}
      aria-label={ariaLabel}
      aria-hidden={!present}
      aria-pressed={fillActive}
      aria-disabled={present && (disabled || phase !== 'visible')}
      disabled={!present || disabled || phase !== 'visible'}
      tabIndex={present && !disabled && phase === 'visible' ? 0 : -1}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleActionClick}
    >
      <span className="shared-entry-content">
        <EntryButtonFrame
          frameOrigin={variant.frameOrigin}
          frameProgress={progress.frame}
          fillDirection={variant.fillDirection}
          fillProgress={progress.fill}
          materialMode={materialMode}
          worldLayer={worldLayer}
        />
        <span className="shared-entry-text" style={textStyle}>{label}</span>
      </span>
    </button>
  )
}

export { FRAME_ORIGINS, FILL_DIRECTIONS, TIMINGS }
export default EntryButtonSurface
